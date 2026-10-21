// The light layers live in the shadow root, out of a fat morph's reach; the
// default slot passes the wrapped element through as light DOM.

import { scopeCssToHost } from "../shadow-utils";
import auraCss from "./neo-aura.css";

const SHEET = new CSSStyleSheet();
SHEET.replaceSync(scopeCssToHost(auraCss, "neo-aura"));

// Back to front: a wide halo, a tight glow, and the ring masked to the host
// padding. Each layer clips one oversized light.
const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML =
	`<div data-neo-aura-layers>` +
	`<div data-neo-aura-glow="far" part="glow"><div data-neo-aura-light part="light"></div></div>` +
	`<div data-neo-aura-glow="near" part="glow"><div data-neo-aura-light part="light"></div></div>` +
	`<div data-neo-aura-ring part="ring"><div data-neo-aura-light part="light"></div></div>` +
	`</div><slot></slot>`;

// CSS cannot read a child's border-radius. The wrapped element's corners are
// measured into --neo-aura-{corner}-{x,y} on the layers; the shadow sheet
// prefers --neo-aura-radius (an author's, or the kit radius map's).
const CORNERS = [
	["borderTopLeftRadius", "tl"],
	["borderTopRightRadius", "tr"],
	["borderBottomRightRadius", "br"],
	["borderBottomLeftRadius", "bl"],
] as const;

export class NeoAura extends HTMLElement {
	// A theme class on <html> or a late stylesheet changes a child's radius
	// with no mutation on the child: re-measure every connected aura.
	static #connected = new Set<NeoAura>();
	static #pageWatched = false;

	#frame = 0;
	#resize = new ResizeObserver(() => this.#schedule());
	#mutations = new MutationObserver(() => this.#schedule());

	connectedCallback() {
		if (!this.shadowRoot) {
			const root = this.attachShadow({ mode: "open" });
			root.adoptedStyleSheets = [SHEET];
			root.appendChild(TEMPLATE.content.cloneNode(true));
			root.querySelector("slot")?.addEventListener("slotchange", () => this.#observeChild());
		}
		NeoAura.#connected.add(this);
		NeoAura.#watchPage();
		this.#observeChild();
	}

	disconnectedCallback() {
		NeoAura.#connected.delete(this);
		this.#resize.disconnect();
		this.#mutations.disconnect();
		cancelAnimationFrame(this.#frame);
		this.#frame = 0;
	}

	static #watchPage() {
		if (NeoAura.#pageWatched) return;
		NeoAura.#pageWatched = true;
		const all = () => {
			for (const aura of NeoAura.#connected) aura.#schedule();
		};
		new MutationObserver(all).observe(document.documentElement, { attributes: true });
		// load does not bubble: capture it to see a <link> stylesheet arrive.
		document.addEventListener(
			"load",
			(e) => {
				if (e.target instanceof HTMLLinkElement) all();
			},
			true,
		);
	}

	// A morph or slot change can swap the wrapped element: re-target.
	#observeChild() {
		this.#resize.disconnect();
		this.#mutations.disconnect();
		const child = this.#child();
		if (child) {
			this.#resize.observe(child);
			this.#mutations.observe(child, { attributes: true });
		}
		this.#schedule();
	}

	#child(): Element | undefined {
		return this.shadowRoot?.querySelector("slot")?.assignedElements()[0];
	}

	// One measurement per frame, however many triggers fire.
	#schedule() {
		if (this.#frame) return;
		this.#frame = requestAnimationFrame(() => {
			this.#frame = 0;
			this.#measure();
		});
	}

	#measure() {
		const layers = this.shadowRoot?.querySelector<HTMLElement>("[data-neo-aura-layers]");
		if (!layers) return;
		const child = this.#child();
		const style = child ? getComputedStyle(child) : null;
		// Layout size, not the transformed box: percentages resolve against it.
		const width = child instanceof HTMLElement ? child.offsetWidth : (child?.getBoundingClientRect().width ?? 0);
		const height = child instanceof HTMLElement ? child.offsetHeight : (child?.getBoundingClientRect().height ?? 0);
		for (const [prop, corner] of CORNERS) {
			const [x, y] = style ? cornerPx(style[prop], width, height) : [0, 0];
			setProp(layers, `--neo-aura-${corner}-x`, `${x}px`);
			setProp(layers, `--neo-aura-${corner}-y`, `${y}px`);
		}
	}
}

// A computed corner radius is one or two lengths or percentages ("8px",
// "50%", "10px 20px"); a percentage resolves against the box side.
function cornerPx(value: string, width: number, height: number): [number, number] {
	const [x, y = x] = value.trim().split(/\s+/);
	return [lengthPx(x, width), lengthPx(y, height)];
}

function lengthPx(value: string, basis: number): number {
	const n = Number.parseFloat(value);
	if (!Number.isFinite(n)) return 0;
	return value.endsWith("%") ? (n * basis) / 100 : n;
}

// Write only on a change: a no-op measurement then invalidates no style.
function setProp(el: HTMLElement, name: string, value: string) {
	if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
}

if (!customElements.get("neo-aura")) {
	customElements.define("neo-aura", NeoAura);
}
