// Lightweight loader for <site-codemirror>. It keeps docs pages readable
// with a plain <pre> fallback, then imports the heavy CodeMirror graph only
// when the user asks for an editor by opening or interacting with code.

const CODEMIRROR_MODULE = new URL("./site_codemirror.js", import.meta.url).href;

let loadPromise: Promise<void> | null = null;

function loadCodeMirror(): Promise<void> {
	if (customElements.get("site-codemirror")) return Promise.resolve();
	visibleEditorObserver?.disconnect();
	loadPromise ??= import(CODEMIRROR_MODULE)
		.then(() => undefined)
		.catch((err) => {
			for (const el of document.querySelectorAll("site-codemirror[data-site-codemirror-loading]")) {
				el.removeAttribute("data-site-codemirror-loading");
			}
			throw err;
		});
	return loadPromise;
}

const visibleEditorObserver =
	"IntersectionObserver" in window
		? new IntersectionObserver((entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && entry.target instanceof Element) {
						requestLoad(entry.target);
					}
				}
			})
		: null;

function readSource(el: Element): string {
	const valueAttr = el.getAttribute("value");
	if (valueAttr !== null) return valueAttr;
	const tpl = el.querySelector<HTMLTemplateElement>(":scope > template");
	if (tpl) return tpl.content.textContent ?? "";
	return (el.textContent ?? "").replace(/^\n/, "");
}

function ensureFallback(el: Element): void {
	if (el.querySelector(":scope > .site-codemirror-host")) {
		return;
	}
	if (!el.querySelector(":scope > .site-codemirror-fallback")) {
		const pre = document.createElement("pre");
		pre.className = "site-codemirror-fallback";
		pre.setAttribute("aria-hidden", "true");
		pre.textContent = readSource(el);
		el.appendChild(pre);
	}
	ensureLoadingIndicator(el);
}

function ensureLoadingIndicator(el: Element): void {
	if (el.querySelector(":scope > .site-codemirror-loading")) return;
	const indicator = document.createElement("div");
	indicator.className = "site-codemirror-loading";
	indicator.setAttribute("aria-hidden", "true");
	const chip = document.createElement("div");
	chip.className = "site-codemirror-loading-chip";
	chip.appendChild(document.createElement("neo-spinner"));
	indicator.appendChild(chip);
	el.appendChild(indicator);
}

function requestLoad(el: Element): void {
	el.setAttribute("data-site-codemirror-loading", "");
	void loadCodeMirror();
}

function prepareEditor(el: Element): void {
	if (customElements.get("site-codemirror")) return;
	ensureFallback(el);
	visibleEditorObserver?.observe(el);
	if (el.hasAttribute("data-site-codemirror-load-bound")) return;
	el.setAttribute("data-site-codemirror-load-bound", "");
	el.addEventListener("pointerdown", () => requestLoad(el), { once: true });
	el.addEventListener("focusin", () => requestLoad(el), { once: true });
}

function prepareAll(root: ParentNode = document): void {
	for (const el of root.querySelectorAll("site-codemirror")) {
		prepareEditor(el);
	}
}

function loadActivePanelEditor(tabs: Element, value: string): void {
	const panel = tabs.querySelector(`:scope > neo-tabpanel[value="${CSS.escape(value)}"]`);
	const editor = panel?.querySelector("site-codemirror");
	if (editor) {
		requestLoad(editor);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => prepareAll(), { once: true });
} else {
	prepareAll();
}

document.addEventListener("pointerdown", (event) => {
	const el = (event.target as Element | null)?.closest("site-codemirror");
	if (el) requestLoad(el);
});

document.addEventListener("focusin", (event) => {
	const el = (event.target as Element | null)?.closest("site-codemirror");
	if (el) requestLoad(el);
});

document.addEventListener("neo-tabs-change", (event) => {
	const tabs = event.target;
	const value = (event as CustomEvent).detail?.value;
	if (tabs instanceof Element && typeof value === "string") {
		loadActivePanelEditor(tabs, value);
	}
});

new MutationObserver((records) => {
	for (const record of records) {
		for (const node of record.addedNodes) {
			if (!(node instanceof Element)) continue;
			if (node.matches("site-codemirror")) prepareEditor(node);
			prepareAll(node);
		}
	}
}).observe(document.documentElement, { childList: true, subtree: true });
