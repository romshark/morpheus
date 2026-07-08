// The inner input's :focus-visible outline is suppressed in CSS; the
// group paints one ring around the whole composed control via :focus-within.

const PASSIVE_ADDON_SELECTOR = "neo-input-group > :is(span, neo-kbd, neo-kbd-group, neo-icon)";

const INPUT_SELECTOR = ":scope > neo-textinput, :scope > input";

export class NeoInputGroup extends HTMLElement {
	#observer: MutationObserver | null = null;

	connectedCallback() {
		this.addEventListener("mousedown", this.#onAddonMouseDown);
		// Subtree observer to watch the inner input's disabled state (lives
		// one level down inside <neo-textinput>).
		//
		// CRITICAL: subtree:true reports mutations on `this` too, and
		// syncDisabled writes aria-disabled on the host. Without the
		// `target !== this` guard below, the observer re-fires on its own
		// write and loops forever (page hangs).
		this.#observer = new MutationObserver((mutations) => {
			for (const m of mutations) {
				if (m.target !== this) {
					this.#syncDisabled();
					return;
				}
			}
		});
		this.#observer.observe(this, {
			attributes: true,
			attributeFilter: ["disabled", "aria-disabled"],
			subtree: true,
		});
		this.#syncDisabled();
	}

	disconnectedCallback() {
		this.removeEventListener("mousedown", this.#onAddonMouseDown);
		this.#observer?.disconnect();
		this.#observer = null;
	}

	// mousedown (not click) to forward focus before the browser commits
	// the click's default focus to the addon. preventDefault stops
	// text-selection gestures from stealing focus from the input.
	#onAddonMouseDown = (e: MouseEvent) => {
		const t = e.target as Element | null;
		if (!t) return;
		const passive = t.closest(PASSIVE_ADDON_SELECTOR);
		if (!passive || passive.parentElement !== this) return;
		const inner = this.#findInput();
		if (!inner) return;
		e.preventDefault();
		inner.focus();
	};

	#findInput(): HTMLElement | null {
		return this.querySelector<HTMLElement>(INPUT_SELECTOR);
	}

	#syncDisabled = () => {
		const inner = this.#findInput();
		const dis = !!inner && (inner.hasAttribute("disabled") || inner.getAttribute("aria-disabled") === "true");
		// Skip no-op writes: even with the target filter, a redundant
		// setAttribute would log a mutation we'd then have to discard.
		const cur = this.getAttribute("aria-disabled");
		if (dis && cur !== "true") this.setAttribute("aria-disabled", "true");
		else if (!dis && cur !== null) this.removeAttribute("aria-disabled");
	};
}

if (!customElements.get("neo-input-group")) {
	customElements.define("neo-input-group", NeoInputGroup);
}
