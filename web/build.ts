// Build script driven by Make and templier custom watchers.
//
// Default invocation (`node build.mjs`) runs both stages: bundle the
// TypeScript (the kit -> ../min/bundle.js, the bundle builder ->
// ../min/bundlebuilder.min.js and ../min/brotli_worker.js, the landing-page
// graph -> ../min/bundle_graph.js, the landing-page bundle ->
// ../min/landing.js, the docs UI bundle -> ../min/site_docs.js, the
// CodeMirror loader -> ../min/site_codemirror_loader.js and the editor
// bundle -> ../min/site_codemirror.js), then minify every top-level CSS
// entry in ../internal/site/static/ into ../min/. Local @imports
// (including morpheus/*.css modules) are bundled into their top-level entry.
//
// /min/ at the repo root is the tracked deliverable directory. Every
// vendorable artifact lands there and is committed; internal/cmd/gen
// later mirrors it to dst/static/min/.
//
// Pass --js or --css to run a single stage; templier watchers do
// this so a TS save doesn't redo CSS work and vice versa.

import fs from "node:fs";
import path from "node:path";
import esbuild, { type Plugin } from "esbuild";

const STATIC_DIR = "../internal/site/static";
const MIN_DIR = "../min";

// Release version, single-sourced from the repo-root VERSION file that the Go
// site generator (internal/cmd/gen) also reads. Stamped as a legal-comment
// banner on every bundled JS artifact so the vendorable /min/ deliverable is
// self-identifying; the `/*!` form survives esbuild's minifier.
const VERSION = fs.readFileSync("../VERSION", "utf8").trim();
const BANNER = `/*! Morpheus ${VERSION} | MIT License | https://github.com/romshark/morpheus */`;

const commonBuildOptions: Parameters<typeof esbuild.buildSync>[0] = {
	bundle: true,
	minify: true,
	target: ["es2022"],
	logLevel: "info",
	// ESM: external imports stay browser module imports.
	format: "esm",
	external: ["https://*"],
	banner: { js: BANNER },
};

// Minify .css modules pulled in via the `text` loader. esbuild inlines text
// imports verbatim and does not minify CSS inside a string, so a module's
// comments and indentation would otherwise ship in bundle.js. scopeCssToHost
// runs on this text at runtime and treats `{`/`}` as selector boundaries, so
// minified output (`}neo-x{`) scopes the same as pretty-printed source.
const minifyCssText: Plugin = {
	name: "minify-css-text",
	setup(build) {
		build.onLoad({ filter: /\.css$/ }, (file) => ({
			contents: esbuild.transformSync(fs.readFileSync(file.path, "utf8"), {
				loader: "css",
				minify: true,
			}).code,
			loader: "text",
		}));
	},
};

// Minify the CSS inside inline <style>...</style> shadow-template strings.
// esbuild minifies JS but treats template-literal contents as opaque,
// so a component's inlined shadow CSS would otherwise ship with its source
// indentation in bundle.js. These blocks are static (no interpolation or
// escapes), so a source-level CSS minify of each block is safe.
const minifyInlineStyles: Plugin = {
	name: "minify-inline-styles",
	setup(build) {
		build.onLoad({ filter: /\.ts$/ }, (file) => {
			const src = fs.readFileSync(file.path, "utf8");
			if (!src.includes("<style>")) return { contents: src, loader: "ts" };
			const out = src.replace(/<style>([\s\S]*?)<\/style>/g, (m, css: string) =>
				/[`\\]|\$\{/.test(css)
					? m
					: `<style>${esbuild.transformSync(css, { loader: "css", minify: true }).code.trim()}</style>`,
			);
			return { contents: out, loader: "ts" };
		});
	},
};

const args = new Set(process.argv.slice(2));
const all = args.size === 0;
if (all) console.log("building ALL");
if (all || args.has("--js")) await buildJS();
if (all || args.has("--css")) buildCSS();

async function buildJS() {
	console.log("building JS");
	fs.mkdirSync(MIN_DIR, { recursive: true });

	// The kit: every web component, IIFE, into bundle.js. Shadow-DOM
	// components import their .css module as raw text (the `text` loader)
	// to adopt it into a shadow root via scopeCssToHost; no .css enters
	// the JS graph as a stylesheet, so this loader is safe here.
	await esbuild.build({
		...commonBuildOptions,
		entryPoints: ["lib/index.ts"],
		loader: { ".css": "text" },
		plugins: [minifyCssText, minifyInlineStyles],
		outfile: path.join(MIN_DIR, "bundle.js"),
	});

	// The /bundle-builder page's in-browser builder. Its esbuild-wasm and
	// brotli-wasm imports stay CDN URLs.
	esbuild.buildSync({
		...commonBuildOptions,
		entryPoints: ["site/bundle-size.ts"],
		outfile: path.join(MIN_DIR, "bundlebuilder.min.js"),
	});

	// The landing page's <bundle-graph> element. Its d3 import stays a CDN
	// URL, and its shadow CSS loads as minified text.
	await esbuild.build({
		...commonBuildOptions,
		entryPoints: ["site/bundle-graph.ts"],
		loader: { ".css": "text" },
		plugins: [minifyCssText],
		outfile: path.join(MIN_DIR, "bundle_graph.js"),
	});

	// The bundle builder's brotli worker. bundle-size.ts loads it from next
	// to bundlebuilder.min.js.
	esbuild.buildSync({
		...commonBuildOptions,
		entryPoints: ["site/brotli-worker.ts"],
		outfile: path.join(MIN_DIR, "brotli_worker.js"),
	});

	// Landing-page bundle: <matrix-rain> + <glitch-cycle-text> + the
	// landing simulator handlers. The shared, separately served
	// /static/datasim.js stays external, not inlined.
	esbuild.buildSync({
		...commonBuildOptions,
		entryPoints: ["site/landing.ts"],
		outfile: path.join(MIN_DIR, "landing.js"),
		external: ["/static/datasim.js"],
	});

	// Docs UI shell: playground and command palette. The CodeMirror graph
	// is intentionally excluded so normal page load doesn't parse the
	// editor bundle until a source editor is requested.
	esbuild.buildSync({
		...commonBuildOptions,
		entryPoints: ["site/site-docs.ts"],
		outfile: path.join(MIN_DIR, "site_docs.js"),
	});

	// Shared lightweight CodeMirror loader for pages that show code but do
	// not need the rest of the docs shell, such as the landing page.
	esbuild.buildSync({
		...commonBuildOptions,
		entryPoints: ["site/site-codemirror-loader.ts"],
		outfile: path.join(MIN_DIR, "site_codemirror_loader.js"),
	});

	// Heavy CodeMirror implementation, loaded dynamically by
	// site-codemirror-loader.ts. CodeMirror itself is bundled here so docs
	// editors don't depend on esm.sh availability at runtime.
	esbuild.buildSync({
		...commonBuildOptions,
		entryPoints: ["site/site-codemirror.ts"],
		outfile: path.join(MIN_DIR, "site_codemirror.js"),
		external: [],
	});
}

function buildCSS() {
	console.log("building CSS");
	fs.mkdirSync(MIN_DIR, { recursive: true });
	const entries = fs
		.readdirSync(STATIC_DIR, { withFileTypes: true })
		.filter((d) => d.isFile() && d.name.endsWith(".css"))
		.map((d) => path.join(STATIC_DIR, d.name));
	if (entries.length === 0) return;
	esbuild.buildSync({
		...commonBuildOptions,
		entryPoints: entries,
		outdir: MIN_DIR,
		external: ["/static/*"],
		loader: { ".css": "css" },
	});
}
