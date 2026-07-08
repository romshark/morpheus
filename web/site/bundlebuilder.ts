// Entry for site/static/bundlebuilder.min.js (loaded by /bundle-builder
// and the landing's "Modular Bundle" graph). <bundle-graph> registers
// eagerly; the size builder stays dormant until window.__bundleSizeUpdate,
// dynamic-importing its esbuild/brotli wasm so the landing pays nothing.
import "./bundle-graph";
import "./bundle-size";
