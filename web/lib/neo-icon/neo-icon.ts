// Renders /static/icons/<name>.svg into a shadow root, fetched once per URL
// (shared cache). Inlined rather than mask-image because Lucide icons use
// stroke="currentColor", unreliable in external mask contexts (notably Safari).
// The shadow root has no <slot>, which keeps fat-morphs of the
// host's light DOM from disturbing the SVG.

import { setState } from "../internal-state";

const cache = new Map<string, Promise<string>>();

function load(url: string): Promise<string> {
	let p = cache.get(url);
	if (p !== undefined) return p;
	p = fetch(url, { credentials: "same-origin" })
		.then(async (r) => {
			if (!r.ok) return "";
			const text = await r.text();
			// Strip XML prolog / DOCTYPE / license comments before the <svg> root.
			const start = text.indexOf("<svg");
			return start === -1 ? "" : text.slice(start);
		})
		.catch(() => "");
	cache.set(url, p);
	return p;
}

function normalizeBase(base: string): string {
	return base
		.trim()
		.replace(/^["']|["']$/g, "")
		.replace(/\/+$/, "");
}

function hasNamedTheme(): boolean {
	for (const cls of document.documentElement.classList) {
		if (cls.startsWith("theme-")) return true;
	}
	return false;
}

// Page CSS can't cross the shadow boundary; pin the SVG sizing here.
const ICON_SHEET = new CSSStyleSheet();
ICON_SHEET.replaceSync(`svg { width: 100%; height: 100%; display: block; }`);

export class NeoIcon extends HTMLElement {
	static readonly observedAttributes = ["name", "base"];
	// Caps the computed-style reads per frame after the first. A rendered icon's
	// read is near free once the first has recalculated style. In a display:none
	// subtree (closed dialog, hidden tab panel) Chrome styles on demand,
	// ~1.5ms per icon after a theme swap.
	static readonly #READ_BUDGET_MS = 8;
	static #renderQueue = new Set<NeoIcon>();
	static #renderFrame = 0;

	#internals = this.attachInternals();
	#shadow: ShadowRoot | null = null;
	#token = 0;
	// Dedupes redundant renders (1 `attributeChangedCallback` per
	// observed attr at upgrade) and gates SSR-adoption to first render.
	#renderedURL: string | null = null;

	connectedCallback() {
		// `--neo-icon-base` flips between icon sets on theme change;
		// switchers dispatch a bubbling `neo-theme-change`.
		window.addEventListener("neo-theme-change", this.#onThemeChange);
		if (this.#token === 0) {
			// Set before the first batched render, in the same task as the upgrade.
			// The skeleton animation then continues from the
			// :not(:defined) rule instead of restarting its delay.
			const ssrSVG = this.firstElementChild instanceof SVGSVGElement;
			setState(this.#internals, "loading", !!this.getAttribute("name") && !ssrSVG);
			NeoIcon.#enqueueRender(this);
		}
	}

	disconnectedCallback() {
		window.removeEventListener("neo-theme-change", this.#onThemeChange);
		NeoIcon.#renderQueue.delete(this);
	}

	attributeChangedCallback() {
		// `getComputedStyle` returns "" for inherited custom properties
		// on a detached element; defer to `connectedCallback`.
		if (this.isConnected) NeoIcon.#enqueueRender(this);
	}

	#onThemeChange = () => {
		NeoIcon.#enqueueRender(this);
	};

	static #enqueueRender(icon: NeoIcon) {
		NeoIcon.#renderQueue.add(icon);
		if (NeoIcon.#renderFrame !== 0) return;
		NeoIcon.#renderFrame = requestAnimationFrame(NeoIcon.#flushRenderQueue);
	}

	static #flushRenderQueue = () => {
		NeoIcon.#renderFrame = 0;
		// Every read before the first write. A getComputedStyle after a DOM write
		// recalculates style for the whole page, ~15ms per icon on a large docs page.
		const icons: NeoIcon[] = [];
		const bases: string[] = [];
		let deadline = 0;
		for (const icon of NeoIcon.#renderQueue) {
			NeoIcon.#renderQueue.delete(icon);
			icons.push(icon);
			bases.push(icon.#base());
			if (icons.length === 1) deadline = performance.now() + NeoIcon.#READ_BUDGET_MS;
			else if (performance.now() > deadline) break;
		}
		icons.forEach((icon, i) => void icon.#render(bases[i]));
		if (NeoIcon.#renderQueue.size > 0) {
			NeoIcon.#renderFrame = requestAnimationFrame(NeoIcon.#flushRenderQueue);
		}
	};

	#base(): string {
		const attr = this.getAttribute("base");
		if (attr !== null) return normalizeBase(attr);
		const ssrBase = this.dataset.neoIconBase;
		if (
			ssrBase !== undefined &&
			this.#shadow === null &&
			this.firstElementChild instanceof SVGSVGElement &&
			!hasNamedTheme()
		) {
			return normalizeBase(ssrBase);
		}
		const cssVar = getComputedStyle(this).getPropertyValue("--neo-icon-base").trim();
		return normalizeBase(cssVar || "/static/icons");
	}

	async #render(base: string) {
		const name = this.getAttribute("name");
		const mine = ++this.#token;
		if (!name) {
			this.#shadow?.replaceChildren();
			this.#renderedURL = null;
			setState(this.#internals, "loading", false);
			return;
		}
		const url = `${base}/${encodeURIComponent(name)}.svg`;
		// Dedupe upgrade-time double-fire and same-URL theme changes.
		if (this.#renderedURL === url) return;
		// Adopt the SSR-inlined SVG only if the server's base matches the resolved one;
		// otherwise a themed user gets pinned to the default-theme SVG.
		// `attachShadow` + `appendChild` are synchronous so light DOM never paints empty.
		if (this.#shadow === null && this.firstElementChild instanceof SVGSVGElement && this.dataset.neoIconBase === base) {
			const svg = this.firstElementChild;
			svg.setAttribute("part", "svg");
			this.#shadow = this.attachShadow({ mode: "open" });
			this.#shadow.adoptedStyleSheets = [ICON_SHEET];
			this.#shadow.appendChild(svg);
			this.#renderedURL = url;
			setState(this.#internals, "loading", false);
			return;
		}
		if (this.#shadow === null) {
			this.#shadow = this.attachShadow({ mode: "open" });
			this.#shadow.adoptedStyleSheets = [ICON_SHEET];
		}
		// A shown SVG stays up while its replacement loads.
		if (this.#shadow.firstElementChild === null) setState(this.#internals, "loading", true);
		const markup = await load(url);
		// Only the latest render call applies.
		if (mine !== this.#token) return;
		this.#shadow.innerHTML = markup;
		this.#shadow.firstElementChild?.setAttribute("part", "svg");
		this.#renderedURL = url;
		setState(this.#internals, "loading", false);
	}
}

if (!customElements.get("neo-icon")) {
	customElements.define("neo-icon", NeoIcon);
}
