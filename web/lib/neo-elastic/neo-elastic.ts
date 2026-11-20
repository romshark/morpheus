// Animated `height: auto` substitute. The children stay where the server renders them,
// slotted into a shadow wrapper that is the ResizeObserver target.
// Height only, because animating width re-wraps text mid-animation and looks broken.

import { boolAttr } from "../command";
import { attachHostStyle } from "../host-style";
import { assignChildren, attachSlotRoot } from "../slot-root";

// [data-neo-elastic-content] is a block formatting context (flow-root). Without it
// a child's margin-top collapses through the wrapper to the host, whose overflow:
// hidden traps it, and the measured height comes out short by that margin.
const SHADOW_HTML =
	"<style>[data-neo-elastic-content] { display: flow-root; }</style>" +
	'<div data-neo-elastic-content part="content"><slot></slot></div>';

export class NeoElastic extends HTMLElement {
	static readonly observedAttributes = ["open"];

	#slot: HTMLSlotElement;
	#inner: HTMLElement;
	// Holds the pinned height.
	#hostStyle: CSSStyleDeclaration;
	#placeholder: HTMLTemplateElement | null = null;
	#resizeObserver: ResizeObserver | null = null;
	#mutationObserver: MutationObserver | null = null;
	#firstMeasure = true;
	#pinnedHeight: number | null = null;
	#applyScheduled = false;

	constructor() {
		super();
		this.#slot = attachSlotRoot(this, SHADOW_HTML);
		this.#hostStyle = attachHostStyle(this.shadowRoot!);
		this.#inner = this.shadowRoot!.querySelector<HTMLElement>("[data-neo-elastic-content]")!;
	}

	connectedCallback() {
		if (!this.#mutationObserver) {
			this.#resizeObserver = new ResizeObserver(() => this.#applyHeight());
			this.#resizeObserver.observe(this.#inner);
			this.#mutationObserver = new MutationObserver(() => this.#sync());
			this.#mutationObserver.observe(this, { childList: true });
			this.addEventListener("transitionend", this.#onTransitionEnd);
		}
		this.#sync();
	}

	disconnectedCallback() {
		this.#resizeObserver?.disconnect();
		this.#mutationObserver?.disconnect();
		this.removeEventListener("transitionend", this.#onTransitionEnd);
		this.#resizeObserver = null;
		this.#mutationObserver = null;
		this.#firstMeasure = true;
		this.#pinnedHeight = null;
	}

	attributeChangedCallback() {
		// Defer to a microtask. A morph that toggles `open` usually swaps the
		// content in the same task, and measuring before it settles pins the
		// old content's height.
		if (this.#applyScheduled) return;
		this.#applyScheduled = true;
		queueMicrotask(() => {
			this.#applyScheduled = false;
			this.#applyHeight();
		});
	}

	#sync() {
		this.#placeholder = this.querySelector<HTMLTemplateElement>(":scope > template[data-neo-async-placeholder]");
		assignChildren(this, this.#slot);
		this.#applyHeight();
	}

	// Pins the host height. `animate: false` snaps it, for the first paint,
	// where a transition from implicit `auto` animates inconsistently across browsers.
	#pin(height: number, animate = true): void {
		const style = this.#hostStyle;
		this.#pinnedHeight = height;
		if (!animate) style.setProperty("transition", "none", "important");
		style.setProperty("height", `${height}px`, "important");
		if (animate) return;
		void this.offsetHeight;
		style.removeProperty("transition");
	}

	#applyHeight() {
		const open = boolAttr(this, "open", true);
		// A 0px host only clips the content, which stays in the Tab order and the
		// accessibility tree. `inert` removes it from both, from the collapse start
		// to the next expand start. toggleAttribute writes only on a change.
		this.#inner.toggleAttribute("inert", !open);
		const height = open ? this.#inner.offsetHeight : 0;

		if (this.#firstMeasure) {
			this.#firstMeasure = false;
			this.#pin(height, false);
			return;
		}

		// Skip the redundant write to avoid a spurious start event with
		// from === to (ResizeObserver fires on zero-delta noise).
		const from = this.#pinnedHeight ?? this.offsetHeight;
		if (from === height) return;

		this.#pin(height);
		this.dispatchEvent(
			new CustomEvent("neo-elastic-start", {
				bubbles: true,
				detail: { from, to: height },
			}),
		);
	}

	#onTransitionEnd = (e: TransitionEvent) => {
		// Only the host's own height transition counts; children bubble
		// and other host properties (e.g. theme transforms) shouldn't fire.
		if (e.target !== this) return;
		if (e.propertyName !== "height") return;
		this.dispatchEvent(
			new CustomEvent("neo-elastic-end", {
				bubbles: true,
				detail: { height: this.#inner.offsetHeight },
			}),
		);
		if (!boolAttr(this, "open", true)) {
			this.#resetToPlaceholder();
		}
	};

	#resetToPlaceholder() {
		if (!boolAttr(this, "reset-on-collapse", false)) return;
		const placeholder = this.#placeholder;
		if (!placeholder) return;
		for (const child of Array.from(this.childNodes)) {
			if (child !== placeholder) child.remove();
		}
		this.append(placeholder.content.cloneNode(true));
	}
}

if (!customElements.get("neo-elastic")) {
	customElements.define("neo-elastic", NeoElastic);
}
