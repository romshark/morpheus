// Brotli for bundle-size.ts, off the main thread, because quality 11 on the
// unminified bundle takes most of a second. Replies to bytes with
// {size, failed}. size is null without brotli. failed means brotli-wasm didn't load,
// and bundle-size.ts then replaces the worker.

const BROTLI_ESM = "https://cdn.jsdelivr.net/npm/brotli-wasm@3.0.1/index.web.js";

type Compressor = (bytes: Uint8Array) => Uint8Array;

let failed = false;
let compressReady: Promise<Compressor | null> | undefined;
function getCompress(): Promise<Compressor | null> {
	compressReady ??= (async () => {
		try {
			// The default export resolves to the module when the wasm loads.
			const brotli = await (await import(BROTLI_ESM)).default;
			return (bytes: Uint8Array) => brotli.compress(bytes, { quality: 11 });
		} catch (err) {
			console.warn("[bundle-size] brotli unavailable:", err);
			failed = true;
		}
		return null;
	})();
	return compressReady;
}

// Always replies, because a lost reply leaves the build waiting.
self.addEventListener("message", async (e: MessageEvent<Uint8Array>) => {
	let size: number | null = null;
	try {
		const compress = await getCompress();
		if (compress) size = compress(e.data).length;
	} catch (err) {
		console.warn("[bundle-size] brotli failed:", err);
	}
	self.postMessage({ size, failed });
});
