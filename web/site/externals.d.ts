// CDN ESM modules have no shipped types. They're kept external by the
// esbuild build (see web/build.mjs `external: ["https://*"]`), so these
// ambient declarations only exist to keep the site TS self-describing.
declare module "https://cdn.jsdelivr.net/npm/d3@7/+esm" {
	// biome-ignore lint/suspicious/noExplicitAny: untyped CDN ESM module (see header).
	const d3: any;
	export = d3;
}
declare module "https://cdn.jsdelivr.net/npm/esbuild-wasm@0.24.2/esm/browser.min.js" {
	// biome-ignore lint/suspicious/noExplicitAny: untyped CDN ESM module (see header).
	const esbuild: any;
	export = esbuild;
}
declare module "https://cdn.jsdelivr.net/npm/brotli-wasm@3.0.1/index.web.js" {
	// biome-ignore lint/suspicious/noExplicitAny: untyped CDN ESM module (see header).
	const brotli: any;
	export = brotli;
}

declare module "/static/*" {
	const sim: unknown;
	export default sim;
}
