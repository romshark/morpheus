// In-browser bundle builder for /bundle-builder. On every selection
// change it assembles the *real* morpheus.min.js (esbuild-wasm bundles
// + minifies the selected kit modules) and the selected component CSS
// morpheus.min.css, then reports exact uncompressed / gzip / brotli
// sizes.
//
// esbuild-wasm and brotli-wasm are imported dynamically inside their
// getters so this module stays cheap when bundled together with
// <bundle-graph> on the landing page (which never triggers a build):
// the multi-MB wasm only loads on first size computation.
//
// CSS modules are copied from internal/site/static/morpheus, so the CSS
// figure follows the same component boundaries as the source files.

// esbuild is a devDependency, so its types resolve at compile time even
// though the runtime module is loaded from the CDN; use them to type the
// build plugin below.
import type { OnLoadArgs, OnResolveArgs, Plugin, PluginBuild } from "esbuild";

const ESBUILD_ESM = "https://cdn.jsdelivr.net/npm/esbuild-wasm@0.24.2/esm/browser.min.js";
const ESBUILD_WASM = "https://cdn.jsdelivr.net/npm/esbuild-wasm@0.24.2/esbuild.wasm";
const BROTLI_ESM = "https://cdn.jsdelivr.net/npm/brotli-wasm@3.0.1/index.web.js";

const SRC_BASE = `${location.origin}/static/bundle-src/`;
const CSS_BASE = `${location.origin}/static/bundle-css/`;
const MANIFEST = "/static/bundle-manifest.json";

interface ManifestEntry {
	id: string;
	name: string;
	bound: boolean;
	js: string;
	css: string;
	owners?: string[];
}
interface Manifest {
	base: string[];
	entries: ManifestEntry[];
}
interface SizeResult {
	raw: number;
	gzip: number;
	brotli: number | null;
}

declare global {
	interface Window {
		__bundleSizeUpdate?: (selected: unknown) => void;
		__bundleSizePending?: unknown;
	}
}

// esbuild-wasm's browser ESM build (named API). esm.sh mangles the
// shape, so it's loaded raw from jsDelivr; tolerate API-on-default.
// biome-ignore lint/suspicious/noExplicitAny: esbuild-wasm browser API is loaded raw from the CDN at runtime; its value-level shape isn't statically known here.
let esbuildReady: Promise<any> | undefined;
// biome-ignore lint/suspicious/noExplicitAny: returns the runtime-loaded esbuild-wasm API (see above).
async function getEsbuild(): Promise<any> {
	if (!esbuildReady) {
		esbuildReady = (async () => {
			// biome-ignore lint/suspicious/noExplicitAny: raw dynamic import of the CDN module; shape is uncertain (API may sit on `default`).
			const ns: any = await import(ESBUILD_ESM);
			const api = typeof ns.initialize === "function" ? ns : ns.default;
			if (!api || typeof api.initialize !== "function") {
				throw new Error("esbuild-wasm browser API unavailable");
			}
			await api.initialize({ wasmURL: ESBUILD_WASM });
			return api;
		})();
	}
	return esbuildReady;
}

type Compressor = (bytes: Uint8Array) => Uint8Array;
// undefined = not tried, null = unavailable, fn = ready compressor.
let brotliCompress: Compressor | null | undefined;
async function getBrotliCompress(): Promise<Compressor | null> {
	if (brotliCompress !== undefined) return brotliCompress;
	try {
		// biome-ignore lint/suspicious/noExplicitAny: brotli-wasm CDN module; shape probed at runtime across init/promise/default wrapper forms.
		let m: any = (await import(BROTLI_ESM)).default;
		// init-function form, promise form, and the occasional extra
		// { default } wrapper; peel until we find compress().
		for (let i = 0; i < 4 && m && typeof m.compress !== "function"; i++) {
			if (typeof m === "function") m = m();
			else if (m.then) m = await m;
			else if (m.default !== undefined) m = m.default;
			else break;
		}
		brotliCompress =
			m && typeof m.compress === "function" ? (bytes: Uint8Array) => m.compress(bytes, { quality: 11 }) : null;
		if (!brotliCompress) {
			console.warn("[bundle-size] brotli compress() not found on module");
		}
	} catch (err) {
		console.warn("[bundle-size] brotli unavailable:", err);
		brotliCompress = null;
	}
	return brotliCompress;
}

let manifestPromise: Promise<Manifest> | undefined;
function getManifest(): Promise<Manifest> {
	if (!manifestPromise) {
		manifestPromise = fetch(MANIFEST).then((r) => r.json());
	}
	return manifestPromise;
}

// Fetched .ts sources are immutable for the page's life; cache them
// so toggling doesn't refetch the kit on every rebuild.
const srcCache = new Map<string, string>();
async function fetchText(url: string): Promise<string> {
	const cached = srcCache.get(url);
	if (cached !== undefined) return cached;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
	const text = await res.text();
	srcCache.set(url, text);
	return text;
}

// esbuild has no filesystem in the browser; this plugin resolves the
// kit's relative imports to /static/bundle-src/*.ts over HTTP.
function httpPlugin(): Plugin {
	return {
		name: "http",
		setup(build: PluginBuild) {
			build.onResolve({ filter: /.*/ }, (args: OnResolveArgs) => {
				if (args.kind === "entry-point") return null;
				let url: URL;
				if (args.namespace === "http" && args.importer) {
					url = new URL(args.path, args.importer);
				} else {
					url = new URL(args.path.replace(/^\.\//, ""), SRC_BASE);
				}
				if (!/\.[a-z]+$/.test(url.pathname)) url.pathname += ".ts";
				return { path: url.href, namespace: "http" };
			});
			build.onLoad({ filter: /.*/, namespace: "http" }, async (args: OnLoadArgs) => ({
				contents: await fetchText(args.path),
				loader: "ts",
			}));
		},
	};
}

// enabledNodes mirrors the graph's rule: a selectable node ships when
// it's selected; a bound child ships when any of its owners is.
function enabledNodes(manifest: Manifest, selected: string[]): ManifestEntry[] {
	const sel = new Set(selected);
	return manifest.entries.filter((e) => (e.bound ? (e.owners || []).some((o) => sel.has(o)) : sel.has(e.id)));
}

async function buildJS(nodes: ManifestEntry[]): Promise<string> {
	const mods = nodes.filter((e) => e.js).map((e) => `./${e.js}`);
	if (mods.length === 0) return "";
	const entry = mods.map((m) => `import ${JSON.stringify(m)};`).join("\n");
	const esbuild = await getEsbuild();
	const result = await esbuild.build({
		stdin: {
			contents: entry,
			loader: "ts",
			sourcefile: "morpheus.ts",
			resolveDir: "/",
		},
		bundle: true,
		minify: true,
		format: "iife",
		target: ["es2020"],
		write: false,
		logLevel: "silent",
		plugins: [httpPlugin()],
	});
	return result.outputFiles[0].text;
}

async function buildCSS(manifest: Manifest, nodes: ManifestEntry[]): Promise<string> {
	const files = [...manifest.base, ...nodes.filter((e) => e.css).map((e) => e.css)];
	const seen = new Set<string>();
	let raw = "";
	for (const f of files) {
		if (seen.has(f)) continue;
		seen.add(f);
		try {
			raw += `${await fetchText(CSS_BASE + f)}\n`;
		} catch {
			/* a node with no slice, ignore */
		}
	}
	if (!raw.trim()) return "";
	const esbuild = await getEsbuild();
	const out = await esbuild.transform(raw, { loader: "css", minify: true });
	return out.code;
}

const enc = new TextEncoder();

async function gzipSize(bytes: Uint8Array<ArrayBuffer>): Promise<number> {
	const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
	return (await new Response(stream).arrayBuffer()).byteLength;
}

async function sizes(text: string): Promise<SizeResult> {
	const bytes = enc.encode(text);
	const compress = await getBrotliCompress();
	const [gz, br] = await Promise.all([
		gzipSize(bytes),
		compress ? Promise.resolve(compress(bytes).length) : Promise.resolve(null),
	]);
	return { raw: bytes.length, gzip: gz, brotli: br };
}

const kb = (n: number | null): string => (n == null ? "n/a" : `${(n / 1024).toFixed(1)} kB`);

function setText(id: string, value: string): void {
	const el = document.getElementById(id);
	if (el) el.textContent = value;
}

type State = "building" | "ready" | "error";

function statusText(state: State): string {
	if (state === "building") return "Building bundle…";
	if (state === "error") return "Bundle build failed, see console.";
	return "";
}

function render(state: State, js?: SizeResult, css?: SizeResult): void {
	const root = document.getElementById("bundle-size");
	if (root) root.dataset.state = state;
	setText("bundle-size-status", statusText(state));
	if (state !== "ready" || !js || !css) return;
	const sum = (a: number | null, b: number | null) => (a == null || b == null ? null : a + b);
	const total: SizeResult = {
		raw: js.raw + css.raw,
		gzip: js.gzip + css.gzip,
		brotli: sum(js.brotli, css.brotli),
	};
	const rows: [string, SizeResult][] = [
		["js", js],
		["css", css],
		["total", total],
	];
	for (const [k, v] of rows) {
		setText(`bundle-size-${k}-raw`, kb(v.raw));
		setText(`bundle-size-${k}-gzip`, kb(v.gzip));
		setText(`bundle-size-${k}-br`, kb(v.brotli));
	}
}

let seq = 0;
let timer = 0;

async function run(selected: string[], mySeq: number): Promise<void> {
	render("building");
	try {
		const manifest = await getManifest();
		const nodes = enabledNodes(manifest, selected);
		const [js, css] = await Promise.all([buildJS(nodes), buildCSS(manifest, nodes)]);
		const [jsSize, cssSize] = await Promise.all([sizes(js), sizes(css)]);
		if (mySeq !== seq) return; // a newer selection superseded us
		render("ready", jsSize, cssSize);
	} catch (err) {
		console.error("[bundle-size]", err);
		if (mySeq === seq) render("error");
	}
}

// Called from the page's data-effect with the live $bundleSel array.
// Debounced: esbuild is expensive and toggles can come in bursts.
window.__bundleSizeUpdate = (selected: unknown): void => {
	const snapshot = Array.isArray(selected) ? (selected.slice() as string[]) : [];
	const mySeq = ++seq;
	render("building");
	clearTimeout(timer);
	timer = window.setTimeout(() => run(snapshot, mySeq), 500);
};

// The inline stub buffered the latest selection while this module
// loaded; replay it so the first build runs without another toggle.
if (window.__bundleSizePending !== undefined) {
	window.__bundleSizeUpdate(window.__bundleSizePending);
	window.__bundleSizePending = undefined;
}
