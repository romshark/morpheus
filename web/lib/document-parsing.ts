// When the bundle defines an element before the parser reaches its children
// (a blocking script ahead of the markup), connectedCallback runs at the
// start tag, before the children it binds exist.

// True while the document is still parsing: a missing child may not be
// parsed yet, which is not an authoring error.
export function stillParsing(): boolean {
	return document.readyState === "loading";
}

const pending = new WeakSet<Element>();

// While the document parses, reruns `connect` when the host's descendants
// change and once after DOMContentLoaded. A MutationObserver callback runs
// before the next paint, so the host binds before its children render.
// Returns false once the document is parsed.
export function retryWhileParsing(host: Element, connect: () => void): boolean {
	if (!stillParsing()) return false;
	if (pending.has(host)) return true;
	pending.add(host);
	const observer = new MutationObserver(retry);
	observer.observe(host, { childList: true, subtree: true });
	document.addEventListener("DOMContentLoaded", retry);
	function retry() {
		observer.disconnect();
		document.removeEventListener("DOMContentLoaded", retry);
		pending.delete(host);
		if (host.isConnected) connect();
	}
	return true;
}
