import { boolAttr } from "../command";
import { observeManagedAttrs, setAttrIfChanged } from "../neo-morph-resilient";

const ATTR_VALUE = "value";
const ATTR_MAX = "max";
const ATTR_PRECISION = "precision";
const ATTR_ICON = "icon";
const ATTR_LABEL = "label";
const ATTR_READONLY = "readonly";
const ATTR_DISABLED = "disabled";

const SYMBOLS = "data-neo-rating-symbols";
const SYMBOL = "data-neo-rating-symbol";
const EMPTY = "data-neo-rating-empty";
const PREVIEW = "data-neo-rating-preview";
const FULL = "data-neo-rating-full";

const MANAGED_ATTRS = [
	"role",
	"tabindex",
	"aria-valuemin",
	"aria-valuemax",
	"aria-valuenow",
	"aria-valuetext",
	"aria-orientation",
	"aria-label",
	"aria-disabled",
	"aria-readonly",
];

// The live symbol row sits in a shadow root without a <slot>, where its
// layer widths are the element's own to write. The server's prerendered row
// paints until the upgrade, then stays in the light DOM untouched for the
// next morph. These rules mirror the light-DOM ones in neo-rating.css.
const SHEET = new CSSStyleSheet();
SHEET.replaceSync(`
[${SYMBOLS}] {
	display: inline-flex;
	gap: var(--neo-rating-symbol-gap);
	border-radius: var(--page-radius, 0.25rem);
}
[${SYMBOL}] {
	position: relative;
	display: inline-flex;
	width: var(--neo-rating-symbol-size);
	height: var(--neo-rating-symbol-size);
	line-height: 0;
}
[${EMPTY}], [${PREVIEW}], [${FULL}] {
	position: absolute;
	inset: 0;
	display: inline-flex;
	overflow: hidden;
}
[${EMPTY}] { color: var(--neo-rating-empty-color); }
[${PREVIEW}], [${FULL}] {
	width: 0;
	transition: width var(--neo-rating-transition-duration) var(--neo-easing, ease);
}
[${PREVIEW}] { color: var(--neo-rating-preview-color); }
[${FULL}] { color: var(--neo-rating-color); }
[${FULL}] neo-icon::part(svg) { fill: currentColor; stroke: currentColor; }
[${PREVIEW}] neo-icon::part(svg) { fill: none; stroke: currentColor; }
neo-icon, svg {
	display: block;
	flex: none;
	width: var(--neo-rating-symbol-size);
	height: var(--neo-rating-symbol-size);
}
:host(:focus-visible) [${SYMBOLS}] {
	outline: 2px solid var(--accent, currentColor);
	outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
	[${PREVIEW}], [${FULL}] { transition: none; }
}
@media (forced-colors: active) {
	[${EMPTY}] { color: GrayText; }
	[${PREVIEW}], [${FULL}] { color: Highlight; }
	:host(:focus-visible) [${SYMBOLS}] { outline-color: Highlight; }
}
`);

export class NeoRating extends HTMLElement {
	static readonly observedAttributes = [
		ATTR_VALUE,
		ATTR_MAX,
		ATTR_PRECISION,
		ATTR_ICON,
		ATTR_LABEL,
		ATTR_READONLY,
		ATTR_DISABLED,
	];

	#root: ShadowRoot;
	#symbolsEl: HTMLElement | null = null;
	// Non-null while a hover/drag preview is showing; painted as the
	// hollow candidate layer while the committed value stays filled.
	#preview: number | null = null;
	#pointerDown = false;
	#ariaObserver: MutationObserver | null = null;
	#ownsRole = false;
	// Current value; `value` reflects it (see command). Survives a morph
	// that strips the attribute so a fat morph omitting `value` can't reset to 0.
	// Stored raw; `get value()` clamp/snaps on read so a `max` or
	// `precision` change re-clamps.
	#valueIntent = 0;
	// #reflectValue() writes `value` via setAttribute, which would otherwise
	// re-enter through attributeChangedCallback as a command.
	#reflecting = false;

	constructor() {
		super();
		this.#root = this.attachShadow({ mode: "open" });
		this.#root.adoptedStyleSheets = [SHEET];
	}

	connectedCallback() {
		this.#ownsRole = !this.hasAttribute("role") || this.getAttribute("role") === "slider";
		// Explicit value commands the intent; absent keeps the prior value.
		const raw = this.getAttribute(ATTR_VALUE);
		if (raw !== null) {
			const n = Number(raw);
			if (Number.isFinite(n)) this.#valueIntent = this.#clampSnap(n);
		}
		this.#reconcile();
		this.#syncState();
		this.addEventListener("keydown", this.#onKeyDown);
		this.addEventListener("pointerenter", this.#onPointerMove);
		this.addEventListener("pointermove", this.#onPointerMove);
		this.addEventListener("pointerleave", this.#onPointerLeave);
		this.addEventListener("pointerdown", this.#onPointerDown);
		this.addEventListener("pointerup", this.#onPointerUp);
		this.addEventListener("blur", this.#onBlur);
		this.#ariaObserver ??= observeManagedAttrs(this, MANAGED_ATTRS, this.#syncAria);
	}

	disconnectedCallback() {
		this.removeEventListener("keydown", this.#onKeyDown);
		this.removeEventListener("pointerenter", this.#onPointerMove);
		this.removeEventListener("pointermove", this.#onPointerMove);
		this.removeEventListener("pointerleave", this.#onPointerLeave);
		this.removeEventListener("pointerdown", this.#onPointerDown);
		this.removeEventListener("pointerup", this.#onPointerUp);
		this.removeEventListener("blur", this.#onBlur);
		this.#ariaObserver?.disconnect();
		this.#ariaObserver = null;
	}

	attributeChangedCallback(name: string, _old: string | null, newValue: string | null) {
		if (!this.isConnected) return;
		if (name === ATTR_VALUE) {
			// Our own re-reflect write (keep-on-absent); not a command.
			if (this.#reflecting) return;
			// A fat morph that drops `value` is no command. Keep the current
			// value and re-reflect so the attribute stays the state mirror.
			if (newValue === null) {
				this.#reflectValue();
			} else {
				const n = Number(newValue);
				if (Number.isFinite(n)) this.#valueIntent = this.#clampSnap(n);
			}
			this.#syncState();
			return;
		}
		if (name === ATTR_MAX || name === ATTR_ICON) {
			this.#reconcile();
			this.#syncState();
			return;
		}
		if (name === ATTR_READONLY || name === ATTR_DISABLED) {
			this.#preview = null;
		}
		this.#syncState();
	}

	get value(): number {
		return this.#clampSnap(this.#valueIntent);
	}

	set value(v: number) {
		this.#valueIntent = this.#clampSnap(v);
		this.#reflectValue();
		this.#syncState();
	}

	// State -> attribute, guarded so it isn't read back as a command.
	#reflectValue() {
		this.#reflecting = true;
		try {
			this.setAttribute(ATTR_VALUE, String(this.value));
		} finally {
			this.#reflecting = false;
		}
	}

	get max(): number {
		const m = Number(this.getAttribute(ATTR_MAX));
		return Number.isFinite(m) && m >= 1 ? Math.floor(m) : 5;
	}

	get precision(): number {
		const p = Number(this.getAttribute(ATTR_PRECISION));
		return Number.isFinite(p) && p > 0 && p <= 1 ? p : 1;
	}

	get #icon(): string {
		return this.getAttribute(ATTR_ICON) || "star";
	}

	get #interactive(): boolean {
		return !boolAttr(this, ATTR_READONLY, false) && !boolAttr(this, ATTR_DISABLED, false);
	}

	get #rtl(): boolean {
		return getComputedStyle(this).direction === "rtl";
	}

	// Keeps the shadow row while its shape (symbol count == max, same icon)
	// still matches. Otherwise copies the server's prerendered row when it matches,
	// which carries over its inlined icons and paints at once, or builds a row.
	#reconcile() {
		if (this.#symbolsEl && this.#matchesShape(this.#symbolsEl)) return;
		const light = this.querySelector<HTMLElement>(`:scope > [${SYMBOLS}]`);
		let next: HTMLElement;
		if (light && this.#matchesShape(light)) {
			next = light.cloneNode(true) as HTMLElement;
			for (const icon of next.querySelectorAll("neo-icon")) icon.setAttribute("exportparts", "svg");
		} else {
			next = document.createElement("div");
			next.setAttribute(SYMBOLS, "");
			next.setAttribute("aria-hidden", "true");
			for (let i = 0; i < this.max; i++) {
				const sym = document.createElement("span");
				sym.setAttribute(SYMBOL, "");
				sym.appendChild(this.#layer(EMPTY));
				sym.appendChild(this.#layer(PREVIEW));
				sym.appendChild(this.#layer(FULL));
				next.appendChild(sym);
			}
		}
		this.#root.replaceChildren(next);
		this.#symbolsEl = next;
	}

	#matchesShape(host: HTMLElement): boolean {
		const syms = host.querySelectorAll(`:scope > [${SYMBOL}]`);
		if (syms.length !== this.max) return false;
		const first = syms[0];
		const icon = first?.querySelector(`[${EMPTY}] neo-icon`);
		return (
			icon?.getAttribute("name") === this.#icon &&
			first?.querySelector(`[${PREVIEW}] neo-icon`) !== null &&
			first?.querySelector(`[${FULL}] neo-icon`) !== null
		);
	}

	#layer(marker: string): HTMLElement {
		const wrap = document.createElement("span");
		wrap.setAttribute(marker, "");
		const icon = document.createElement("neo-icon");
		icon.setAttribute("name", this.#icon);
		icon.setAttribute("exportparts", "svg");
		wrap.appendChild(icon);
		return wrap;
	}

	// Push state into ARIA and the per-symbol layer widths.
	// Idempotent, safe to call repeatedly.
	#syncState() {
		this.#syncAria();
		const value = this.value;
		const preview = this.#preview;
		const hollow = preview == null ? 0 : Math.max(value, preview);
		const filled = preview == null ? value : Math.min(value, preview);
		const symbols = this.#symbolsEl?.querySelectorAll<HTMLElement>(`:scope > [${SYMBOL}]`);
		symbols?.forEach((sym, i) => {
			const previewEl = sym.querySelector<HTMLElement>(`:scope > [${PREVIEW}]`);
			const full = sym.querySelector<HTMLElement>(`:scope > [${FULL}]`);
			if (previewEl) previewEl.style.width = `${this.#symbolPct(hollow, i)}%`;
			if (full) full.style.width = `${this.#symbolPct(filled, i)}%`;
		});
	}

	// Writes nothing when nothing changed, which lets the managed-attribute
	// observer that calls it settle.
	#syncAria = () => {
		const max = this.max;
		const value = this.value;
		if (this.#ownsRole) setAttrIfChanged(this, "role", "slider");
		setAttrIfChanged(this, "aria-valuemin", "0");
		setAttrIfChanged(this, "aria-valuemax", String(max));
		setAttrIfChanged(this, "aria-valuenow", String(value));
		setAttrIfChanged(this, "aria-valuetext", `${value} / ${max}`);
		setAttrIfChanged(this, "aria-orientation", "horizontal");

		const label = this.getAttribute(ATTR_LABEL);
		if (label && !this.hasAttribute("aria-labelledby")) {
			setAttrIfChanged(this, "aria-label", label);
		}

		const disabled = boolAttr(this, ATTR_DISABLED, false);
		const readonly = boolAttr(this, ATTR_READONLY, false);
		if (disabled) setAttrIfChanged(this, "aria-disabled", "true");
		else this.removeAttribute("aria-disabled");
		if (readonly && !disabled) setAttrIfChanged(this, "aria-readonly", "true");
		else this.removeAttribute("aria-readonly");
		if (disabled || readonly) {
			setAttrIfChanged(this, "tabindex", "-1");
		} else {
			// An authored tab position stays; a stripped one or the -1 a
			// disabled or readonly pass wrote returns to the tab order.
			const cur = this.getAttribute("tabindex");
			if (cur === null || cur === "-1") setAttrIfChanged(this, "tabindex", "0");
		}
	};

	#symbolPct(v: number, index: number): number {
		return Math.max(0, Math.min(1, v - index)) * 100;
	}

	// Round to precision and clamp to [0, max]. The extra toFixed pass
	// strips binary-float noise (0.5 steps stay "2.5", not "2.4999...").
	#clampSnap(v: number): number {
		if (!Number.isFinite(v)) return 0;
		const p = this.precision;
		const snapped = Math.round(v / p) * p;
		const clamped = Math.max(0, Math.min(this.max, snapped));
		return Number(clamped.toFixed(this.#decimals(p)));
	}

	#decimals(p: number): number {
		const s = String(p);
		const dot = s.indexOf(".");
		return dot < 0 ? 0 : s.length - dot - 1;
	}

	// Value the pointer is pointing at. Walks the symbols, finds the one
	// under the pointer, adds the in-symbol ratio and snaps up to precision
	// so the left fraction of a symbol selects the lower partial value.
	#valueFromPointer(e: PointerEvent): number | null {
		if (!this.#symbolsEl) return null;
		const syms = [...this.#symbolsEl.querySelectorAll<HTMLElement>(`:scope > [${SYMBOL}]`)];
		if (!syms.length) return null;
		const rtl = this.#rtl;
		for (let i = 0; i < syms.length; i++) {
			const r = syms[i].getBoundingClientRect();
			if (e.clientX < r.left || e.clientX > r.right) continue;
			let ratio = (e.clientX - r.left) / r.width;
			if (rtl) ratio = 1 - ratio;
			const raw = i + ratio;
			const p = this.precision;
			const v = Math.ceil(raw / p) * p;
			return Math.max(p, Math.min(this.max, Number(v.toFixed(this.#decimals(p)))));
		}
		// Gaps belong to the preceding value. Otherwise the pointer can
		// preview "2" in the gap, then drop back to "1.5" inside star 2.
		for (let i = 0; i < syms.length - 1; i++) {
			const a = syms[i].getBoundingClientRect();
			const b = syms[i + 1].getBoundingClientRect();
			const gapStart = Math.min(a.right, b.right);
			const gapEnd = Math.max(a.left, b.left);
			if (e.clientX >= gapStart && e.clientX <= gapEnd) {
				return Math.min(this.max, i + 1);
			}
		}
		// Past the last symbol on the inline-end side -> max;
		// before the start -> smallest step.
		const first = syms[0].getBoundingClientRect();
		const last = syms[syms.length - 1].getBoundingClientRect();
		const beforeStart = rtl ? e.clientX > first.right : e.clientX < first.left;
		const afterEnd = rtl ? e.clientX < last.left : e.clientX > last.right;
		if (beforeStart) return this.precision;
		if (afterEnd) return this.max;
		return null;
	}

	#preview_set(v: number) {
		if (this.#preview === v) return;
		this.#preview = v;
		this.#syncState();
		this.dispatchEvent(new CustomEvent("neo-rating-input", { bubbles: true, detail: { value: v } }));
	}

	#commit(v: number) {
		const next = this.#clampSnap(v);
		const changed = next !== this.value;
		this.#preview = null;
		this.value = next;
		this.#syncState();
		this.dispatchEvent(
			new CustomEvent("neo-rating-input", {
				bubbles: true,
				detail: { value: next },
			}),
		);
		if (changed) {
			this.dispatchEvent(
				new CustomEvent("neo-rating-change", {
					bubbles: true,
					detail: { value: next },
				}),
			);
		}
	}

	#onPointerMove = (e: PointerEvent) => {
		if (!this.#interactive) return;
		const v = this.#valueFromPointer(e);
		if (v != null) this.#preview_set(v);
	};

	#onPointerLeave = () => {
		this.#clearPreview();
	};

	#onBlur = () => {
		this.#clearPreview();
	};

	#clearPreview() {
		if (this.#preview == null) return;
		this.#preview = null;
		this.#syncState();
	}

	#onPointerDown = (e: PointerEvent) => {
		if (!this.#interactive || e.button !== 0) return;
		e.preventDefault();
		this.#pointerDown = true;
		this.focus();
		const v = this.#valueFromPointer(e);
		if (v != null) this.#preview_set(v);
	};

	#onPointerUp = (e: PointerEvent) => {
		if (!this.#interactive || !this.#pointerDown) return;
		this.#pointerDown = false;
		const v = this.#valueFromPointer(e);
		if (v != null) this.#commit(v);
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (!this.#interactive || e.defaultPrevented) return;
		const p = this.precision;
		const value = this.#preview ?? this.value;
		let next: number | null = null;
		const inc = this.#rtl ? -p : p;
		switch (e.key) {
			case "ArrowRight":
				next = value + inc;
				break;
			case "ArrowLeft":
				next = value - inc;
				break;
			case "ArrowUp":
				next = value + p;
				break;
			case "ArrowDown":
				next = value - p;
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = this.max;
				break;
			case "Enter":
				if (this.#preview == null) return;
				e.preventDefault();
				this.#commit(this.#preview);
				return;
			case "Escape":
				if (this.#preview == null) return;
				e.preventDefault();
				this.#clearPreview();
				return;
			default:
				if (/^[0-9]$/.test(e.key)) {
					const d = Number(e.key);
					if (d <= this.max) next = d;
				}
		}
		if (next == null) return;
		e.preventDefault();
		this.#preview_set(this.#clampSnap(next));
	};
}

if (!customElements.get("neo-rating")) {
	customElements.define("neo-rating", NeoRating);
}
