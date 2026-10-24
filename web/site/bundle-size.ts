// Entry for min/bundlebuilder.min.js, the /bundle-builder page's builder.
// On each selection or version change, esbuild-wasm builds morpheus.min.js,
// morpheus.min.css and their unminified forms from the version's sources,
// as web/build.ts builds min/. Reports sizes, zips the checked files, syncs
// ?version= and ?components= and runs ?file= downloads.
//
// internal/bundle/build.go is the same build for the morpheus command and
// must produce the same bytes. Change both together.

import type { OnLoadArgs, OnResolveArgs, Plugin, PluginBuild } from "esbuild";
import { zip } from "./zip";

// A version's pinned esbuild-wasm reproduces its min/bundle.js.
const esbuildURL = (version: string, file: string) => `https://cdn.jsdelivr.net/npm/esbuild-wasm@${version}/${file}`;

// internal/cmd/gen writes this directory and rewrites "/static/" for -base.
const versionDir = (version: string) => `${location.origin}/static/bundle/${encodeURIComponent(version)}/`;

interface ManifestEntry {
	id: string;
	name: string;
	bound: boolean;
	js: string;
	owners?: string[];
}
interface ManifestSheet {
	file: string;
	// Absent for a base sheet, which ships in every bundle.
	nodes?: string[];
}
interface Manifest {
	banner: string;
	// Pinned esbuild version.
	esbuild: string;
	css: ManifestSheet[];
	entries: ManifestEntry[];
}
interface Source {
	manifest: Manifest;
	dir: string;
}
interface SizeResult {
	raw: number;
	gzip: number;
	brotli: number | null;
}

// window.__bundleURL from the page's bundleURLBootstrap.
// Datastar seeds $bundleVersion and $bundleSel from it.
interface URLRequest {
	components: { id: string; name: string; deps?: string[] }[];
	ids: string[];
	defaultVersion: string;
	version: string;
	selected: string[];
	// ?components= names matching no component.
	unknown: string[];
	// ?components= names the version lacks.
	missing: string[];
	// A ?version= matching no version.
	badVersion: string | null;
	// Raw ?file= value.
	file: string | null;
	// Ids of the components a version lacks.
	absent: (version: string) => string[];
	// The ids and their requirements a version has.
	withDeps: (ids: string[], version: string) => string[];
}

declare global {
	interface Window {
		__bundleSizeUpdate?: (selected: unknown, version: unknown) => void;
		__bundleSizePending?: [unknown, unknown];
		__bundleURL?: URLRequest;
	}
}

// File names after "morpheus.", as in the data-file rows and ?file= values.
const FILE_KEYS = ["min.js", "min.css", "js", "css"] as const;
type FileKey = (typeof FILE_KEYS)[number];
const fileName = (key: FileKey | "zip") => `morpheus.${key}`;

interface BuiltFile {
	key: FileKey;
	text: string;
	bytes: Uint8Array<ArrayBuffer>;
	size: SizeResult;
}

// Loads once per key. A failed load is dropped and the next call retries.
function memo<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
	let p = cache.get(key);
	if (!p) {
		p = load().catch((err) => {
			cache.delete(key);
			throw err;
		});
		cache.set(key, p);
	}
	return p;
}

// esbuild-wasm by version, because a module initializes once. Loaded from
// jsDelivr because esm.sh changes the module shape. The API may be on default.
// biome-ignore lint/suspicious/noExplicitAny: untyped esbuild-wasm API from the CDN.
const esbuildReady = new Map<string, Promise<any>>();
// Load attempts by version. A failed import stays cached under its URL.
// Retries add ?retry=n.
const esbuildAttempts = new Map<string, number>();
// biome-ignore lint/suspicious/noExplicitAny: see esbuildReady.
function getEsbuild(version: string): Promise<any> {
	return memo(esbuildReady, version, async () => {
		const n = esbuildAttempts.get(version) ?? 0;
		esbuildAttempts.set(version, n + 1);
		// biome-ignore lint/suspicious/noExplicitAny: the API may be on default.
		const ns: any = await import(esbuildURL(version, "esm/browser.min.js") + (n ? `?retry=${n}` : ""));
		const api = typeof ns.initialize === "function" ? ns : ns.default;
		if (!api || typeof api.initialize !== "function") {
			throw new Error("esbuild-wasm browser API unavailable");
		}
		await api.initialize({ wasmURL: esbuildURL(version, "esbuild.wasm") });
		return api;
	});
}

// brotli-worker.ts, started on first use. Replaced after a failed load,
// because the failed import stays cached in the worker.
let brotli: Worker | undefined;
// Runs 1 job at a time. A job superseded before its turn is dropped and
// doesn't delay the current build.
let brotliTail: Promise<number | null> = Promise.resolve(null);

// Brotli quality 11 size, or null when unavailable or superseded.
function brotliSize(bytes: Uint8Array<ArrayBuffer>, stale: () => boolean): Promise<number | null> {
	brotliTail = brotliTail.then(() => (stale() ? null : runBrotli(bytes)));
	return brotliTail;
}

function runBrotli(bytes: Uint8Array<ArrayBuffer>): Promise<number | null> {
	brotli ??= new Worker(new URL("./brotli_worker.js", import.meta.url), { type: "module" });
	const worker = brotli;
	return new Promise((resolve) => {
		const done = (size: number | null, failed: boolean) => {
			if (failed) {
				worker.terminate();
				brotli = undefined;
			}
			resolve(size);
		};
		worker.onmessage = (e: MessageEvent<{ size: number | null; failed: boolean }>) => done(e.data.size, e.data.failed);
		// A worker that failed to load never replies.
		worker.onerror = () => {
			console.warn("[bundle-size] brotli worker failed to load");
			done(null, true);
		};
		worker.postMessage(bytes);
	});
}

// Sources don't change while the page is open. Each is fetched once,
// and concurrent builds share a pending fetch.
const texts = new Map<string, Promise<string>>();
function fetchText(url: string): Promise<string> {
	return memo(texts, url, async () => {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
		return res.text();
	});
}

async function getSource(version: string): Promise<Source> {
	const dir = versionDir(version);
	return {
		manifest: JSON.parse(await fetchText(`${dir}bundle-manifest.json`)) as Manifest,
		dir,
	};
}

// biome-ignore lint/suspicious/noExplicitAny: see esbuildReady.
async function minifyCSS(esbuild: any, css: string): Promise<string> {
	return (await esbuild.transform(css, { loader: "css", minify: true })).code;
}

// Mirrors web/build.ts's minifyInlineStyles. esbuild does not minify
// inside template literals, which hold the shadow <style> CSS.
// biome-ignore lint/suspicious/noExplicitAny: see esbuildReady.
async function minifyInlineStyles(esbuild: any, src: string): Promise<string> {
	if (!src.includes("<style>")) return src;
	const parts = src.split(/(<style>[\s\S]*?<\/style>)/);
	for (let i = 1; i < parts.length; i += 2) {
		const css = parts[i].slice("<style>".length, -"</style>".length);
		if (/[`\\]|\$\{/.test(css)) continue;
		parts[i] = `<style>${(await minifyCSS(esbuild, css)).trim()}</style>`;
	}
	return parts.join("");
}

// Resolves the kit's imports in srcDir over HTTP, because esbuild-wasm has
// no filesystem. Paths stay relative to srcDir, because the unminified
// output names modules by path. CSS loads as text, minified as by
// web/build.ts's minifyCssText.
// biome-ignore lint/suspicious/noExplicitAny: see esbuildReady.
function httpPlugin(esbuild: any, minify: boolean, srcDir: string): Plugin {
	const root = new URL(srcDir).href;
	return {
		name: "http",
		setup(build: PluginBuild) {
			build.onResolve({ filter: /.*/ }, (args: OnResolveArgs) => {
				if (args.kind === "entry-point") return null;
				const base = args.namespace === "morpheus" ? new URL(args.importer, root) : root;
				const url = new URL(args.path, base);
				if (!/\.[a-z]+$/.test(url.pathname)) url.pathname += ".ts";
				const path = url.href.startsWith(root) ? url.href.slice(root.length) : url.href;
				return { path, namespace: "morpheus" };
			});
			build.onLoad({ filter: /\.css$/, namespace: "morpheus" }, async (args: OnLoadArgs) => {
				const css = await fetchText(new URL(args.path, root).href);
				return { contents: minify ? await minifyCSS(esbuild, css) : css, loader: "text" };
			});
			build.onLoad({ filter: /.*/, namespace: "morpheus" }, async (args: OnLoadArgs) => {
				const src = await fetchText(new URL(args.path, root).href);
				return { contents: minify ? await minifyInlineStyles(esbuild, src) : src, loader: "ts" };
			});
		},
	};
}

// A bound node ships when any of its owners does.
function enabledNodes(manifest: Manifest, selected: string[]): ManifestEntry[] {
	const sel = new Set(selected);
	return manifest.entries.filter((e) => (e.bound ? (e.owners || []).some((o) => sel.has(o)) : sel.has(e.id)));
}

// index.ts without the unselected imports. The rest stays, including the
// missing-component watcher.
async function bundleEntry(nodes: ManifestEntry[], srcDir: string): Promise<string> {
	const modules = new Set(nodes.filter((e) => e.js).map((e) => e.js.replace(/\.ts$/, "")));
	const index = await fetchText(`${srcDir}index.ts`);
	return index
		.split("\n")
		.filter((line) => {
			const m = line.match(/^import "\.\/(neo-[a-z0-9-]+)";$/);
			return !m || modules.has(m[1]);
		})
		.join("\n");
}

async function buildJS({ manifest, dir }: Source, nodes: ManifestEntry[], minify: boolean): Promise<string> {
	const esbuild = await getEsbuild(manifest.esbuild);
	const srcDir = `${dir}bundle-src/`;
	const result = await esbuild.build({
		stdin: {
			contents: await bundleEntry(nodes, srcDir),
			loader: "ts",
			sourcefile: "index.ts",
			resolveDir: "/",
		},
		bundle: true,
		minify,
		format: "esm",
		target: ["es2022"],
		banner: { js: manifest.banner },
		write: false,
		logLevel: "silent",
		plugins: [httpPlugin(esbuild, minify, srcDir)],
	});
	return result.outputFiles[0].text;
}

async function buildCSS({ manifest, dir }: Source, nodes: ManifestEntry[], minify: boolean): Promise<string> {
	const enabled = new Set(nodes.map((e) => e.id));
	const sheets = manifest.css.filter((s) => !s.nodes || s.nodes.some((id) => enabled.has(id)));
	const css = (await Promise.all(sheets.map((s) => fetchText(`${dir}bundle-css/${s.file}`)))).join("\n");
	return minify ? minifyCSS(await getEsbuild(manifest.esbuild), css) : css;
}

function buildFile(key: FileKey, source: Source, nodes: ManifestEntry[]): Promise<string> {
	const minify = key.startsWith("min.");
	return key.endsWith("css") ? buildCSS(source, nodes, minify) : buildJS(source, nodes, minify);
}

const enc = new TextEncoder();

async function gzipSize(bytes: Uint8Array<ArrayBuffer>): Promise<number> {
	const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
	return (await new Response(stream).arrayBuffer()).byteLength;
}

async function sizes(bytes: Uint8Array<ArrayBuffer>, stale: () => boolean): Promise<SizeResult> {
	const [gz, br] = await Promise.all([gzipSize(bytes), brotliSize(bytes, stale)]);
	return { raw: bytes.length, gzip: gz, brotli: br };
}

const kb = (n: number | null): string => (n == null ? "n/a" : `${(n / 1024).toFixed(1)} kB`);

function setText(id: string, value: string): void {
	const el = document.getElementById(id);
	if (el) el.textContent = value;
}

let downloadURL: string | null = null;

function setDownload(archive: Blob | null): void {
	const link = document.getElementById("bundle-download");
	if (!link) return;
	if (downloadURL) URL.revokeObjectURL(downloadURL);
	downloadURL = archive && URL.createObjectURL(archive);
	if (!downloadURL) {
		link.removeAttribute("href");
		link.setAttribute("aria-disabled", "true");
		link.setAttribute("tabindex", "-1");
		return;
	}
	link.setAttribute("href", downloadURL);
	link.removeAttribute("aria-disabled");
	link.removeAttribute("tabindex");
}

function fileRow(key: FileKey): Element | null {
	return document.querySelector(`#bundle-size tr[data-file="${key}"]`);
}

function totalRow(): Element | null {
	return document.querySelector("#bundle-size .bundle-size-total");
}

function setSizes(row: Element | null, size: SizeResult | null): void {
	const set = (cell: string, value: number | null | undefined) => {
		const el = row?.querySelector(`[data-size="${cell}"]`);
		if (el) el.textContent = size ? kb(value ?? null) : "-";
	};
	set("raw", size?.raw);
	set("gzip", size?.gzip);
	set("br", size?.brotli);
}

function setCopy(row: Element | null, text: string | null): void {
	const copy = row?.querySelector("neo-clipcopy");
	if (!copy) return;
	if (text === null) copy.removeAttribute("value");
	else copy.setAttribute("value", text);
	copy.querySelector("neo-button")?.toggleAttribute("disabled", text === null);
}

// Whether the archive includes the file (its row's checkbox).
function included(key: FileKey): boolean {
	return fileRow(key)?.querySelector<HTMLElement & { checked?: boolean }>("neo-checkbox")?.checked === true;
}

type State = "building" | "ready" | "error";

const STATUS_TEXT: Record<State, string> = {
	building: "Building bundle…",
	ready: "",
	error: "Bundle build failed, see console.",
};

// The ready build's files; null while building.
let current: BuiltFile[] | null = null;
let archiveSeq = 0;

function render(state: State, files?: BuiltFile[], message?: string): void {
	const root = document.getElementById("bundle-size");
	if (root) root.dataset.state = state;
	setText("bundle-size-status", message ?? STATUS_TEXT[state]);
	current = state === "ready" && files ? files : null;
	archiveSeq++;
	setDownload(null);
	// Building keeps the last sizes under the overlay; an error clears them.
	for (const key of FILE_KEYS) {
		const file = files?.find((f) => f.key === key);
		setCopy(fileRow(key), file ? file.text : null);
		if (file || state === "error") setSizes(fileRow(key), file ? file.size : null);
	}
	if (state === "error") setSizes(totalRow(), null);
}

// Totals and zips the checked files; resolves to null when none is
// checked or a newer call or render superseded it.
async function updateArchive(): Promise<Blob | null> {
	if (!current) return null;
	const files = current.filter((f) => included(f.key));
	const total: SizeResult = { raw: 0, gzip: 0, brotli: 0 };
	for (const { size } of files) {
		total.raw += size.raw;
		total.gzip += size.gzip;
		total.brotli = total.brotli === null || size.brotli === null ? null : total.brotli + size.brotli;
	}
	setSizes(totalRow(), files.length ? total : null);
	const mySeq = ++archiveSeq;
	setDownload(null);
	if (!files.length) return null;
	const archive = await zip(files.map((f) => ({ name: fileName(f.key), data: f.bytes })));
	if (mySeq !== archiveSeq) return null;
	setDownload(archive);
	return archive;
}

// Runs the ?file= download. Its object URL is not revoked because this
// runs once per page.
function download(file: FileKey | "zip", files: BuiltFile[], archive: Blob | null): void {
	const built = files.find((f) => f.key === file);
	const type = file.endsWith("css") ? "text/css" : "text/javascript";
	const blob = file === "zip" ? archive : built && new Blob([built.bytes], { type });
	if (!blob) return;
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = fileName(file);
	document.body.append(link);
	link.click();
	link.remove();
}

// Lists only the components no other selected one depends on, because
// the bootstrap re-adds dependencies. Omits defaults, and drops ?file= to
// keep a reload from downloading again.
function writeURL(selected: string[], version: string): void {
	const url = window.__bundleURL;
	if (!url) return;
	const sel = new Set(selected);
	const absent = new Set(url.absent(version));
	const deps = new Map(url.components.map((c) => [c.id, new Set(c.deps)]));
	// Cycle members don't imply each other.
	const implied = (id: string) => selected.some((o) => o !== id && deps.get(o)?.has(id) && !deps.get(id)?.has(o));
	const names = url.components.filter((c) => sel.has(c.id) && !implied(c.id)).map((c) => c.name);
	const params = new URLSearchParams(location.search);
	params.delete("components");
	params.delete("version");
	params.delete("file");
	if (version !== url.defaultVersion) params.set("version", version);
	let search = params.toString();
	// Appended by hand because URLSearchParams escapes the commas.
	if (url.components.some((c) => !sel.has(c.id) && !absent.has(c.id))) {
		search += `${search ? "&" : ""}components=${names.join(",")}`;
	}
	const next = `${location.pathname}${search ? `?${search}` : ""}${location.hash}`;
	if (next !== location.pathname + location.search + location.hash) history.replaceState(history.state, "", next);
}

// The ?file= download, for the first build of the requested version and selection;
// any change cancels it.
let request: { file: FileKey | "zip"; selection: string } | null = null;
// Replaces the first build when the URL names something unknown; no download runs.
let requestError: string | null = null;

const selectionKey = (selected: string[], version: string) => `${version}:${selected.join(",")}`;

const isFileKey = (s: string): s is FileKey => (FILE_KEYS as readonly string[]).includes(s);

if (window.__bundleURL) {
	const { unknown, missing, badVersion, file, selected, version } = window.__bundleURL;
	const problems: string[] = [];
	if (badVersion !== null) problems.push(`Unknown version: ${badVersion}.`);
	if (unknown.length) problems.push(`Unknown component${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`);
	if (missing.length) problems.push(`Not in ${version}: ${missing.join(", ")}.`);
	if (file !== null) {
		const key = file
			.trim()
			.toLowerCase()
			.replace(/^morpheus\./, "");
		if (key === "zip" || isFileKey(key)) request = { file: key, selection: selectionKey(selected, version) };
		else problems.push(`Unknown file: ${file}.`);
	}
	if (problems.length) {
		requestError = problems.join(" ");
		request = null;
	}
}

let seq = 0;
let timer = 0;

async function run(selected: string[], version: string, mySeq: number): Promise<void> {
	try {
		const source = await getSource(version);
		const nodes = enabledNodes(source.manifest, selected);
		const stale = () => mySeq !== seq;
		const files = await Promise.all(
			FILE_KEYS.map(async (key): Promise<BuiltFile> => {
				const text = await buildFile(key, source, nodes);
				const bytes = enc.encode(text);
				return { key, text, bytes, size: await sizes(bytes, stale) };
			}),
		);
		if (mySeq !== seq) return; // a newer selection superseded us
		render("ready", files);
		const archive = await updateArchive();
		if (mySeq !== seq) return;
		if (request) download(request.file, files, archive);
		request = null;
	} catch (err) {
		console.error("[bundle-size]", err);
		if (mySeq === seq) render("error");
	}
}

// Called by the page's data-effect with $bundleSel and $bundleVersion.
// Debounced because toggles come in bursts and builds are expensive.
window.__bundleSizeUpdate = (selected: unknown, versionValue: unknown): void => {
	const snapshot = Array.isArray(selected) ? (selected.slice() as string[]) : [];
	const version = typeof versionValue === "string" ? versionValue : "main";
	writeURL(snapshot, version);
	const mySeq = ++seq;
	clearTimeout(timer);
	if (requestError !== null) {
		render("error", undefined, requestError);
		requestError = null;
		return;
	}
	if (request && selectionKey(snapshot, version) !== request.selection) request = null;
	render("building");
	timer = window.setTimeout(() => run(snapshot, version, mySeq), 500);
};

document.getElementById("bundle-size")?.addEventListener("neo-checkbox-change", () => updateArchive());

// Replays what the page's stub buffered while this module loaded.
if (window.__bundleSizePending !== undefined) {
	window.__bundleSizeUpdate(...window.__bundleSizePending);
	window.__bundleSizePending = undefined;
}
