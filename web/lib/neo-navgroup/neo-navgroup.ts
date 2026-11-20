import { boolAttr } from "../command";
import { NavEngine } from "../nav-engine";

// neo-navgroup.css keys `--neo-navgroup-columns` on `columns` values 1 to 12.
// Other values get a rule here, keyed on the server-rendered attribute,
// which a morph leaves in place, unlike a write to the host style.
// 1 sheet per root, because a document sheet doesn't reach a shadow tree.
const columnSheets = new WeakMap<Document | ShadowRoot, { sheet: CSSStyleSheet; values: Set<string> }>();

function ensureColumnsRule(host: HTMLElement, raw: string, n: number): void {
	if (raw === String(n) && n <= 12) return;
	const root = host.getRootNode();
	if (!(root instanceof Document || root instanceof ShadowRoot)) return;
	let entry = columnSheets.get(root);
	if (!entry) {
		entry = { sheet: new CSSStyleSheet(), values: new Set() };
		columnSheets.set(root, entry);
	}
	if (!root.adoptedStyleSheets.includes(entry.sheet)) {
		root.adoptedStyleSheets = [...root.adoptedStyleSheets, entry.sheet];
	}
	if (entry.values.has(raw)) return;
	entry.values.add(raw);
	entry.sheet.insertRule(
		`neo-navgroup[columns="${CSS.escape(raw)}"] { --neo-navgroup-columns: ${n}; }`,
		entry.sheet.cssRules.length,
	);
}

// Thin element wrapper over the shared NavEngine. It owns lifecycle, the
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
			// Verb is `navigate`, not `change`, because onMove fires on
			// every roving-focus move and navgroup holds no selected-value state.
			// Focus moving is not a committed value change.
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

		// tabindex catches a morph stripping the roving tabindex.
		// NavEngine writes only changed values, which lets the refresh settle.
		this.#mutationObserver = new MutationObserver(() => this.#refreshSoon());
		this.#mutationObserver.observe(this, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-neo-navgroup-item", "disabled", "aria-disabled", "tabindex"],
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

	// Omitted columns may come from authored CSS, which no rule overrides.
	#syncColumns() {
		const n = this.#explicitColumns();
		if (n) ensureColumnsRule(this, this.getAttribute("columns") ?? "", n);
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
			if (boolAttr(el, "disabled", false) || el.getAttribute("aria-disabled") === "true") return false;
			// Exclude items inside a nested <neo-navgroup> so the outer group
			// doesn't claim the inner group's items.
			return el.closest("neo-navgroup") === this;
		});
	}
}

if (!customElements.get("neo-navgroup")) {
	customElements.define("neo-navgroup", NeoNavGroup);
}
