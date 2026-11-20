import { boolAttr } from "../command";
import { attachHostStyle, type HostStyle } from "../host-style";
import { observeManagedAttrs, setAttrIfChanged } from "../neo-morph-resilient";
import { assignChildren, attachSlotRoot } from "../slot-root";

interface HSV {
	h: number;
	s: number;
	v: number;
}

interface ActiveDrag {
	pointerId: number;
	startX: number;
	startY: number;
}

const DEFAULT_VALUE = "#2563eb";

const MANAGED_ATTRS = [
	"role",
	"tabindex",
	"aria-label",
	"aria-valuemin",
	"aria-valuemax",
	"aria-valuenow",
	"aria-valuetext",
	"aria-disabled",
];

function clamp(n: number, min = 0, max = 100) {
	return Math.min(max, Math.max(min, n));
}

function clampHue(n: number) {
	if (!Number.isFinite(n)) return 0;
	return ((n % 360) + 360) % 360;
}

function hexByte(n: number) {
	return Math.round(clamp(n, 0, 255))
		.toString(16)
		.padStart(2, "0");
}

function hsvToHex(h: number, sPct: number, vPct: number) {
	const s = clamp(sPct) / 100;
	const v = clamp(vPct) / 100;
	const c = v * s;
	const hp = clampHue(h) / 60;
	const x = c * (1 - Math.abs((hp % 2) - 1));
	let r = 0;
	let g = 0;
	let b = 0;

	if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
	else if (hp < 2) [r, g, b] = [x, c, 0];
	else if (hp < 3) [r, g, b] = [0, c, x];
	else if (hp < 4) [r, g, b] = [0, x, c];
	else if (hp < 5) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];

	const m = v - c;
	return `#${hexByte((r + m) * 255)}${hexByte((g + m) * 255)}${hexByte((b + m) * 255)}`;
}

function hexToRgb(value: string) {
	const m = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (!m) return null;
	const raw = m[1];
	const hex =
		raw.length === 3
			? raw
					.split("")
					.map((ch) => ch + ch)
					.join("")
			: raw;
	return {
		r: parseInt(hex.slice(0, 2), 16),
		g: parseInt(hex.slice(2, 4), 16),
		b: parseInt(hex.slice(4, 6), 16),
	};
}

function rgbToHsv(r: number, g: number, b: number): HSV {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const d = max - min;
	let h = 0;

	if (d !== 0) {
		if (max === rn) h = 60 * (((gn - bn) / d) % 6);
		else if (max === gn) h = 60 * ((bn - rn) / d + 2);
		else h = 60 * ((rn - gn) / d + 4);
	}

	return {
		h: clampHue(h),
		s: max === 0 ? 0 : (d / max) * 100,
		v: max * 100,
	};
}

function parseValue(value: string | null) {
	const rgb = value ? hexToRgb(value) : null;
	if (!rgb) return rgbToHsv(37, 99, 235);
	return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

export class NeoColorField extends HTMLElement {
	static readonly observedAttributes = ["value", "hue", "disabled"];

	#surface: HTMLElement | null = null;
	#active: ActiveDrag | null = null;
	#slot: HTMLSlotElement;
	// Holds the hue and handle position, which the surface and handle read.
	// Important, because the kit CSS sets their defaults on the host.
	#hostStyle: HostStyle;
	#childObserver: MutationObserver | null = null;
	#attrObserver: MutationObserver | null = null;
	#ready = false;
	#syncingValue = false;
	#hueValue = 221;
	#xValue = 85;
	#yValue = 8;

	constructor() {
		super();
		this.#slot = attachSlotRoot(this);
		this.#hostStyle = attachHostStyle(this.shadowRoot!);
	}

	connectedCallback() {
		if (this.#ready) return;
		this.#ready = true;
		this.#ensureStructure();
		this.addEventListener("pointerdown", this.#onPointerDown);
		this.addEventListener("keydown", this.#onKeyDown);
		this.addEventListener("lostpointercapture", this.#onLostPointerCapture);
		this.#childObserver = new MutationObserver(this.#onChildrenChanged);
		this.#childObserver.observe(this, { childList: true, subtree: true });
		this.#attrObserver = observeManagedAttrs(this, MANAGED_ATTRS, () => this.#syncAria());
		const hsv = parseValue(this.getAttribute("value") || DEFAULT_VALUE);
		const hueAttr = Number(this.getAttribute("hue"));
		this.#hueValue = this.hasAttribute("hue") ? clampHue(hueAttr) : hsv.h;
		this.#xValue = hsv.s;
		this.#yValue = 100 - hsv.v;
		this.#sync(false);
	}

	disconnectedCallback() {
		this.#endDrag();
		this.removeEventListener("pointerdown", this.#onPointerDown);
		this.removeEventListener("keydown", this.#onKeyDown);
		this.removeEventListener("lostpointercapture", this.#onLostPointerCapture);
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		this.#attrObserver?.disconnect();
		this.#attrObserver = null;
		this.#ready = false;
	}

	// Reflected `value` property (parity with neo-select / neo-textinput).
	// Property-based bindings (React, Alpine `:value`, ...) set the attribute
	// through here; the getter returns the live rendered color so a
	// same-value write is a no-op and can't echo back mid-drag.
	get value(): string {
		return hsvToHex(this.#hueValue, this.#xValue, 100 - this.#yValue);
	}

	set value(v: string | null) {
		if (v == null) this.removeAttribute("value");
		else this.setAttribute("value", v);
	}

	attributeChangedCallback(name: string) {
		if (!this.#ready || this.#syncingValue) return;
		const currentColor = hsvToHex(this.#hueValue, this.#xValue, 100 - this.#yValue);
		// During a drag, the host reflects `value` and consumers may echo it
		// straight back through data bindings. Near the bottom edge many x
		// positions collapse to the same black hex value. Reparsing that
		// echoed value would erase saturation and jump the handle left.
		if (this.#active && name === "value") return;
		if (name === "value" && this.getAttribute("value") === currentColor) {
			return;
		}
		// A fat-morph that swaps attributes strips the host's runtime-managed
		// `tabindex` (the authored markup doesn't declare it), which blurs the
		// focused host even though `sync` re-adds it. Capture focus now and
		// restore it once the morph settles so keyboard control survives.
		const hadFocus = this === this.ownerDocument.activeElement;
		if (name === "value") {
			const hsv = parseValue(this.getAttribute("value") || DEFAULT_VALUE);
			if (!this.hasAttribute("hue")) this.#hueValue = hsv.h;
			this.#xValue = hsv.s;
			this.#yValue = 100 - hsv.v;
		} else if (name === "hue") {
			this.#hueValue = clampHue(Number(this.getAttribute("hue")));
		}
		this.#sync(false);
		if (hadFocus) this.#restoreFocusAfterMorph();
	}

	// Re-assert focus after a morph strips `tabindex` and blurs the host.
	// Deferred to a microtask so it runs after the morph's attribute-removal pass;
	// a no-op when focus never moved or the host is now disabled.
	#restoreFocusAfterMorph() {
		queueMicrotask(() => {
			if (boolAttr(this, "disabled", false)) return;
			if (this === this.ownerDocument.activeElement) return;
			this.#sync(false);
			this.focus({ preventScroll: true });
		});
	}

	#ensureStructure() {
		// Reconcile against the DOM, never a cached pointer, because a morph
		// can re-emit the surface markup, leaving duplicate
		// [data-neo-color-field-surface] siblings. Keep 1 surface + 1 handle
		// as the host's only child; drop extras and strays.
		// The reconciling mutations only fire when the DOM isn't already canonical,
		// which makes a re-entrant observer call post-reconcile a no-op.
		// That fixpoint breaks the childObserver loop.
		const surfaces = this.querySelectorAll<HTMLElement>(":scope > [data-neo-color-field-surface]");
		let surface = surfaces[0] ?? null;
		if (!surface) {
			surface = document.createElement("div");
			surface.setAttribute("data-neo-color-field-surface", "");
		}
		for (let i = 1; i < surfaces.length; i++) surfaces[i].remove();

		const handles = surface.querySelectorAll<HTMLElement>(":scope > [data-neo-color-field-handle]");
		let handle = handles[0] ?? null;
		if (!handle) {
			handle = document.createElement("div");
			handle.setAttribute("data-neo-color-field-handle", "");
			surface.appendChild(handle);
		}
		for (let i = 1; i < handles.length; i++) handles[i].remove();

		for (const child of Array.from(this.children)) {
			if (child !== surface) child.remove();
		}
		if (surface.parentElement !== this) this.appendChild(surface);

		this.#surface = surface;
		assignChildren(this, this.#slot);
	}

	#onChildrenChanged = () => {
		if (!this.#ready) return;
		this.#ensureStructure();
		this.#sync(false);
	};

	#sync(reflect: boolean) {
		const color = hsvToHex(this.#hueValue, this.#xValue, 100 - this.#yValue);
		this.#hostStyle.setProperty("--neo-color-field-hue", String(this.#hueValue), "important");
		this.#hostStyle.setProperty("--neo-color-field-x", `${this.#xValue}%`, "important");
		this.#hostStyle.setProperty("--neo-color-field-y", `${this.#yValue}%`, "important");
		this.#syncAria();

		if (reflect) {
			this.#syncingValue = true;
			this.setAttribute("value", color);
			this.#syncingValue = false;
		}
	}

	#syncAria() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "slider");
		if (!this.hasAttribute("aria-label")) this.setAttribute("aria-label", "Color field");
		setAttrIfChanged(this, "aria-valuemin", "0");
		setAttrIfChanged(this, "aria-valuemax", "100");
		setAttrIfChanged(this, "aria-valuenow", String(Math.round(this.#xValue)));
		setAttrIfChanged(this, "aria-valuetext", hsvToHex(this.#hueValue, this.#xValue, 100 - this.#yValue));
		const disabled = boolAttr(this, "disabled", false);
		if (disabled) setAttrIfChanged(this, "aria-disabled", "true");
		else this.removeAttribute("aria-disabled");
		setAttrIfChanged(this, "tabindex", disabled ? "-1" : "0");
	}

	#detail() {
		return {
			value: hsvToHex(this.#hueValue, this.#xValue, 100 - this.#yValue),
			hue: this.#hueValue,
			x: this.#xValue,
			y: this.#yValue,
		};
	}

	#emit(name: string) {
		this.dispatchEvent(
			new CustomEvent(name, {
				bubbles: true,
				detail: this.#detail(),
			}),
		);
	}

	#setFromEvent(e: PointerEvent) {
		if (!this.#surface) return;
		const rect = this.#surface.getBoundingClientRect();
		const x = clamp(((e.clientX - rect.left) / rect.width) * 100);
		const y = clamp(((e.clientY - rect.top) / rect.height) * 100);
		this.#move(x, y);
	}

	// Fires `input` and reports true only when the position moved.
	#move(x: number, y: number): boolean {
		if (x === this.#xValue && y === this.#yValue) return false;
		this.#xValue = x;
		this.#yValue = y;
		this.#sync(true);
		this.#emit("neo-color-field-input");
		return true;
	}

	#onPointerDown = (e: PointerEvent) => {
		if (boolAttr(this, "disabled", false)) return;
		if (e.button !== 0) return;
		e.preventDefault();
		this.focus();
		this.#active = { pointerId: e.pointerId, startX: this.#xValue, startY: this.#yValue };
		this.setPointerCapture(e.pointerId);
		this.addEventListener("pointermove", this.#onPointerMove);
		this.addEventListener("pointerup", this.#onPointerUp);
		this.addEventListener("pointercancel", this.#onPointerCancel);
		this.#setFromEvent(e);
	};

	#onPointerMove = (e: PointerEvent) => {
		if (!this.#active || e.pointerId !== this.#active.pointerId) return;
		if ((e.buttons & 1) === 0) {
			this.#endDrag();
			return;
		}
		this.#setFromEvent(e);
	};

	#onPointerUp = (e: PointerEvent) => {
		if (!this.#active || e.pointerId !== this.#active.pointerId) return;
		this.#setFromEvent(e);
		this.#endDrag();
	};

	#onPointerCancel = (e: PointerEvent) => {
		if (!this.#active || e.pointerId !== this.#active.pointerId) return;
		this.#endDrag();
	};

	#onLostPointerCapture = (e: PointerEvent) => {
		if (!this.#active || e.pointerId !== this.#active.pointerId) return;
		this.#endDrag();
	};

	// Commits on pointerup, pointercancel and lost capture alike. A click on the handle
	// or a drag back to the start fires no `change`, as on a native range input.
	#endDrag() {
		const d = this.#active;
		if (!d) return;
		try {
			if (this.hasPointerCapture(d.pointerId)) {
				this.releasePointerCapture(d.pointerId);
			}
		} catch {
			// Pointer capture may already be gone after cancellation.
		}
		this.removeEventListener("pointermove", this.#onPointerMove);
		this.removeEventListener("pointerup", this.#onPointerUp);
		this.removeEventListener("pointercancel", this.#onPointerCancel);
		this.#active = null;
		if (this.#xValue !== d.startX || this.#yValue !== d.startY) this.#emit("neo-color-field-change");
	}

	#onKeyDown = (e: KeyboardEvent) => {
		if (boolAttr(this, "disabled", false)) return;
		let dx = 0;
		let dy = 0;
		const step = e.shiftKey ? 10 : 1;
		if (e.key === "ArrowLeft") dx = -step;
		else if (e.key === "ArrowRight") dx = step;
		else if (e.key === "ArrowUp") dy = -step;
		else if (e.key === "ArrowDown") dy = step;
		else if (e.key === "Home") {
			dx = -100;
			dy = 0;
		} else if (e.key === "End") {
			dx = 100;
			dy = 0;
		} else return;

		e.preventDefault();
		if (this.#move(clamp(this.#xValue + dx), clamp(this.#yValue + dy))) this.#emit("neo-color-field-change");
	};
}

if (!customElements.get("neo-color-field")) {
	customElements.define("neo-color-field", NeoColorField);
}
