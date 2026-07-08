// Animated `height: auto` substitute. On hydration the children are
// wrapped in a [data-neo-elastic-content] div (the ResizeObserver target);
// a MutationObserver re-syncs if a morph strips it. Height only: animating
// width re-wraps text mid-animation and looks broken.

import { boolAttr } from "../command";

export class NeoElastic extends HTMLElement {
	static readonly observedAttributes = ["open"];

	#inner: HTMLElement | null = null;
	#placeholder: HTMLTemplateElement | null = null;
	#resizeObserver: ResizeObserver | null = null;
	#mutationObserver: MutationObserver | null = null;
	#firstMeasure = true;
	// Last height we pinned via inline `style.height`. Survives a morph
	// strip so we can re-establish a known starting value before the next
	// transition (the DOM alone can't tell us what we were).
	#lastPinnedHeight: number | null = null;
	#applyScheduled = false;

	connectedCallback() {
		if (!this.#mutationObserver) {
			this.#resizeObserver = new ResizeObserver(() => this.#applyHeight());
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
		this.#inner = null;
		this.#firstMeasure = true;
		this.#lastPinnedHeight = null;
	}

	attributeChangedCallback() {
		// Defer to a microtask: a morph that toggles `open` typically
		// strips inline `style` in the same task. Running synchronously
		// here either reads a stripped style (from === to, no animation)
		// or sets a height the morph nukes a tick later (transition
		// cancels). Microtask lets the morph settle first.
		if (this.#applyScheduled) return;
		this.#applyScheduled = true;
		queueMicrotask(() => {
			this.#applyScheduled = false;
			this.#applyHeight();
		});
	}

	/**
	 * Idempotent: ensures children live inside the
	 * [data-neo-elastic-content] wrapper and the ResizeObserver targets
	 * the current wrapper. Safe to call any number of times. Restores
	 * the wrapper if a morph patch removed it, and pulls newly-added
	 * loose children into it.
	 */
	#sync() {
		this.#placeholder = this.querySelector<HTMLTemplateElement>(":scope > template[data-neo-async-placeholder]");
		let inner = this.querySelector<HTMLElement>(":scope > [data-neo-elastic-content]");

		// Loose children: should live inside the wrapper but don't yet.
		// Happens on first hydration, or after a morph patch bypassed
		// the wrapper.
		const loose = Array.from(this.children).filter((c) => c !== inner && c !== this.#placeholder);

		if (!inner) {
			inner = document.createElement("div");
			inner.setAttribute("data-neo-elastic-content", "");
			// Keep the placeholder template on the host (not inside inner)
			// so the reset slot stays available.
			for (const child of Array.from(this.childNodes)) {
				if (child === this.#placeholder) continue;
				inner.appendChild(child);
			}
			this.appendChild(inner);
		} else if (loose.length > 0) {
			for (const child of loose) inner.appendChild(child);
		}

		if (this.#inner !== inner) {
			if (this.#inner) this.#resizeObserver?.unobserve(this.#inner);
			this.#inner = inner;
			this.#resizeObserver?.observe(this.#inner);
		}

		this.#mutationObserver?.takeRecords();

		// A morph that re-emits the host strips the JS-managed inline
		// `height` pin (server markup has no `style`). applyHeight
		// restores it from `lastPinnedHeight` and animates to the new
		// target, including collapse/expand toggled by the same morph.
		this.#applyHeight();
	}

	// Snap inline height with no transition: used for first paint and
	// for re-establishing the last pinned value after a morph strip.
	#snapHeight(h: number): void {
		this.style.transition = "none";
		this.style.height = `${h}px`;
		this.#lastPinnedHeight = h;
		void this.offsetHeight;
		this.style.transition = "";
	}

	#applyHeight() {
		if (!this.#inner) return;
		const height = boolAttr(this, "open", true) ? this.#inner.offsetHeight : 0;

		if (this.#firstMeasure) {
			this.#firstMeasure = false;
			// First-paint flash guard: a transition from implicit `auto`
			// animates inconsistently across browsers.
			this.#snapHeight(height);
			return;
		}

		// Morph stripped our inline pin? Re-establish it as the start
		// state so the next write transitions from a known value instead
		// of from the natural height that the unpinned host now reads.
		if (this.#lastPinnedHeight !== null && !this.style.height) {
			this.#snapHeight(this.#lastPinnedHeight);
		}

		// Skip the redundant write to avoid a spurious start event with
		// from === to (ResizeObserver fires on zero-delta noise).
		const from = parseFloat(this.style.height) || this.offsetHeight;
		if (from === height) return;

		this.style.height = `${height}px`;
		this.#lastPinnedHeight = height;
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
		const height = (this.#inner?.offsetHeight ?? parseFloat(this.style.height)) || 0;
		this.dispatchEvent(
			new CustomEvent("neo-elastic-end", {
				bubbles: true,
				detail: { height },
			}),
		);
		if (!boolAttr(this, "open", true)) {
			this.#resetToPlaceholder();
		}
	};

	#resetToPlaceholder() {
		if (!boolAttr(this, "reset-on-collapse", false)) return;
		if (!this.#inner || !this.#placeholder) return;
		this.#inner.replaceChildren(this.#placeholder.content.cloneNode(true));
		this.style.height = "0px";
		this.#lastPinnedHeight = 0;
	}
}

if (!customElements.get("neo-elastic")) {
	customElements.define("neo-elastic", NeoElastic);
}
