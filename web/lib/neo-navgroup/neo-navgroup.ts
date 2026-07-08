import { NavEngine } from "../nav-engine";

// Thin element wrapper over the shared NavEngine: it owns lifecycle, the
// `columns` CSS variable, and change detection (mutation/resize observers),
// and feeds the engine its light-DOM items ([data-neo-navgroup-item],
// excluding nested groups). The keyboard model lives entirely in NavEngine,
// shared verbatim with the listbox controls.
export class NeoNavGroup extends HTMLElement {
	static readonly observedAttributes = ["columns", "orientation"];

	#engine: NavEngine;
	#mutationObserver: MutationObserver | null = null;
	#resizeObserver: ResizeObserver | null = null;
	#connected = false;
	#refreshFrame = 0;

	constructor() {
		super();
		this.#engine = new NavEngine({
			host: this,
			getItems: () => this.#collectItems(),
			// Verb is `navigate`, not `change`: onMove fires on every
			// roving-focus move, and navgroup holds no selected-value
			// state, so focus moving is not a committed value change.
			onMove: (item, index) =>
				this.dispatchEvent(new CustomEvent("neo-navgroup-navigate", { bubbles: true, detail: { index, item } })),
		});
	}

	connectedCallback() {
		if (this.#connected) {
			this.#syncColumns();
			this.#refreshSoon();
			return;
		}
		this.#connected = true;
		this.#engine.attach();

		this.#mutationObserver = new MutationObserver(() => this.#refreshSoon());
		this.#mutationObserver.observe(this, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-neo-navgroup-item", "disabled", "aria-disabled"],
		});

		if (typeof ResizeObserver !== "undefined") {
			this.#resizeObserver = new ResizeObserver(() => this.#refreshSoon());
			this.#resizeObserver.observe(this);
		}

		this.#syncColumns();
		this.#refreshSoon();
	}

	attributeChangedCallback(name: string) {
		if (name === "columns") this.#syncColumns();
		if (this.#connected && (name === "columns" || name === "orientation")) {
			this.#refreshSoon();
		}
	}

	disconnectedCallback() {
		queueMicrotask(() => {
			if (this.isConnected) return;
			this.#teardown();
		});
	}

	/** Programmatically focus the item at `index`. */
	focusItem(index: number): void {
		this.#engine.focusItem(index);
	}

	resetTypeahead(): void {
		this.#engine.resetTypeahead();
	}

	// Mirror explicit `columns` values into the CSS variable. Omitted columns
	// may be driven by authored CSS, so leave the variable unset in that case.
	#syncColumns() {
		const n = this.#explicitColumns();
		if (n) this.style.setProperty("--neo-navgroup-columns", String(n));
		else this.style.removeProperty("--neo-navgroup-columns");
	}

	#explicitColumns(): number | null {
		const n = parseInt(this.getAttribute("columns") ?? "", 10);
		return Number.isFinite(n) && n > 0 ? n : null;
	}

	#teardown() {
		if (this.#refreshFrame) {
			cancelAnimationFrame(this.#refreshFrame);
			this.#refreshFrame = 0;
		}
		this.#engine.detach();
		this.#mutationObserver?.disconnect();
		this.#mutationObserver = null;
		this.#resizeObserver?.disconnect();
		this.#resizeObserver = null;
		this.#connected = false;
	}

	#refreshSoon() {
		this.#engine.refresh();
		if (this.#refreshFrame) return;
		this.#refreshFrame = requestAnimationFrame(() => {
			this.#refreshFrame = 0;
			if (this.isConnected) this.#engine.refresh();
		});
	}

	#collectItems(): HTMLElement[] {
		return Array.from(this.querySelectorAll<HTMLElement>("[data-neo-navgroup-item]")).filter((el) => {
			if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
			// Exclude items inside a NESTED <neo-navgroup> so the outer group
			// doesn't claim the inner group's items.
			return el.closest("neo-navgroup") === this;
		});
	}
}

if (!customElements.get("neo-navgroup")) {
	customElements.define("neo-navgroup", NeoNavGroup);
}
