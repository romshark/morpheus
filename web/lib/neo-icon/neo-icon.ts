// Renders /static/icons/<name>.svg into a shadow root, fetched once per URL
// (shared cache). Inlined rather than mask-image because Lucide icons use
// stroke="currentColor", unreliable in external mask contexts (notably
// Safari). The shadow root has no <slot>, so fat-morphs of the host's light
// DOM can't disturb the SVG.

const cache = new Map<string, Promise<string>>();

function load(url: string): Promise<string> {
	let p = cache.get(url);
	if (p) return p;
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
	// Resolving --neo-icon-base via getComputedStyle is layout-bound.
	// Doing it synchronously for every SSR icon at upgrade can wedge
	// large pages; a theme swap re-runs it for the whole page. Batch
	// across frames.
	static readonly #RENDER_BATCH_SIZE = 8;
	static #renderQueue = new Set<NeoIcon>();
	static #renderFrame = 0;

	#shadow: ShadowRoot | null = null;
	#token = 0;
	// Dedupes redundant renders (one `attributeChangedCallback` per
	// observed attr at upgrade) and gates SSR-adoption to first render.
	#renderedURL: string | null = null;

	connectedCallback() {
		// `--neo-icon-base` flips between icon sets on theme change;
		// switchers dispatch a bubbling `neo-theme-change`.
		window.addEventListener("neo-theme-change", this.#onThemeChange);
		if (this.#token === 0) NeoIcon.#enqueueRender(this);
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
		let rendered = 0;

		for (const icon of NeoIcon.#renderQueue) {
			NeoIcon.#renderQueue.delete(icon);
			if (icon.isConnected) void icon.#render();
			rendered += 1;
			if (rendered >= NeoIcon.#RENDER_BATCH_SIZE) break;
		}

		if (NeoIcon.#renderQueue.size > 0) {
			NeoIcon.#renderFrame = requestAnimationFrame(NeoIcon.#flushRenderQueue);
		}
	};

	async #render() {
		const name = this.getAttribute("name");
		const mine = ++this.#token;
		if (!name) {
			this.#shadow?.replaceChildren();
			this.#renderedURL = null;
			return;
		}
		const attr = this.getAttribute("base");
		const ssrBase = this.dataset.neoIconBase;
		const canAdoptSSRBase =
			attr === null &&
			ssrBase !== undefined &&
			this.#shadow === null &&
			this.firstElementChild instanceof SVGSVGElement &&
			!hasNamedTheme();
		const base = (() => {
			if (attr !== null) return normalizeBase(attr);
			if (canAdoptSSRBase) return normalizeBase(ssrBase ?? "");
			const cssVar = getComputedStyle(this).getPropertyValue("--neo-icon-base").trim();
			return normalizeBase(cssVar || "/static/icons");
		})();
		const url = `${base}/${encodeURIComponent(name)}.svg`;
		// Dedupe upgrade-time double-fire and same-URL theme changes.
		if (this.#renderedURL === url) return;
		// Adopt the SSR-inlined SVG only if the server's base matches the
		// resolved one; otherwise a themed user gets pinned to the
		// default-theme SVG. `attachShadow` + `appendChild` are synchronous
		// so light DOM never paints empty.
		if (this.#shadow === null && this.firstElementChild instanceof SVGSVGElement && this.dataset.neoIconBase === base) {
			const svg = this.firstElementChild;
			svg.setAttribute("part", "svg");
			this.#shadow = this.attachShadow({ mode: "open" });
			this.#shadow.adoptedStyleSheets = [ICON_SHEET];
			this.#shadow.appendChild(svg);
			this.#renderedURL = url;
			return;
		}
		if (this.#shadow === null) {
			this.#shadow = this.attachShadow({ mode: "open" });
			this.#shadow.adoptedStyleSheets = [ICON_SHEET];
		}
		const markup = await load(url);
		// Only the latest render call wins.
		if (mine !== this.#token) return;
		this.#shadow.innerHTML = markup;
		this.#shadow.firstElementChild?.setAttribute("part", "svg");
		this.#renderedURL = url;
	}
}

if (!customElements.get("neo-icon")) {
	customElements.define("neo-icon", NeoIcon);
}
