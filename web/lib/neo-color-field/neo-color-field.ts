import { type HSV, hexToHsv, hsvToHex, wrapHue } from "../color";
import { boolAttr } from "../command";

interface ActiveDrag {
	pointerId: number;
}

const DEFAULT_VALUE = "#2563eb";

function clamp(n: number) {
	return Math.min(100, Math.max(0, n));
}

function parseValue(value: string | null): HSV {
	return hexToHsv(value) ?? (hexToHsv(DEFAULT_VALUE) as HSV);
}

export class NeoColorField extends HTMLElement {
	static readonly observedAttributes = ["value", "hue", "disabled"];

	#surface: HTMLElement | null = null;
	#active: ActiveDrag | null = null;
	#childObserver: MutationObserver | null = null;
	#ready = false;
	#syncingValue = false;
	#hueValue = 221;
	#xValue = 85;
	#yValue = 8;

	connectedCallback() {
		if (this.#ready) return;
		this.#ready = true;
		this.#ensureStructure();
		this.addEventListener("pointerdown", this.#onPointerDown);
		this.addEventListener("keydown", this.#onKeyDown);
		this.addEventListener("lostpointercapture", this.#onLostPointerCapture);
		this.#childObserver = new MutationObserver(this.#onChildrenChanged);
		this.#childObserver.observe(this, { childList: true, subtree: true });
		const hsv = parseValue(this.getAttribute("value") || DEFAULT_VALUE);
		const hueAttr = Number(this.getAttribute("hue"));
		this.#hueValue = this.hasAttribute("hue") ? wrapHue(hueAttr) : hsv.h;
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
			this.#hueValue = wrapHue(Number(this.getAttribute("hue")));
		}
		this.#sync(false);
		if (hadFocus) this.#restoreFocusAfterMorph();
	}

	// Re-assert focus after a morph strips `tabindex` and blurs the host.
	// Deferred to a microtask so it runs after the morph's attribute-removal
	// pass; a no-op when focus never moved or the host is now disabled.
	#restoreFocusAfterMorph() {
		queueMicrotask(() => {
			if (boolAttr(this, "disabled", false)) return;
			if (this === this.ownerDocument.activeElement) return;
			this.#sync(false);
			this.focus({ preventScroll: true });
		});
	}

	#ensureStructure() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "slider");
		if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
		if (!this.hasAttribute("aria-label")) {
			this.setAttribute("aria-label", "Color field");
		}

		// Reconcile against the DOM, never a cached pointer, because a morph
		// can re-emit the surface markup, leaving duplicate
		// [data-neo-color-field-surface] siblings. Keep 1 surface + 1 handle
		// as the host's only child; drop extras and strays. The reconciling
		// mutations only fire when the DOM isn't already canonical, which
		// makes a re-entrant observer call post-reconcile a no-op. That
		// fixpoint breaks the childObserver loop.
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
	}

	#onChildrenChanged = () => {
		if (!this.#ready) return;
		this.#ensureStructure();
		this.#sync(false);
	};

	#sync(reflect: boolean) {
		const color = hsvToHex(this.#hueValue, this.#xValue, 100 - this.#yValue);
		this.style.setProperty("--neo-color-field-hue", String(this.#hueValue));
		this.style.setProperty("--neo-color-field-x", `${this.#xValue}%`);
		this.style.setProperty("--neo-color-field-y", `${this.#yValue}%`);
		this.setAttribute("aria-valuemin", "0");
		this.setAttribute("aria-valuemax", "100");
		this.setAttribute("aria-valuenow", String(Math.round(this.#xValue)));
		this.setAttribute("aria-valuetext", color);
		const disabled = boolAttr(this, "disabled", false);
		this.toggleAttribute("aria-disabled", disabled);
		if (disabled) this.setAttribute("tabindex", "-1");
		else this.setAttribute("tabindex", "0");

		if (reflect) {
			this.#syncingValue = true;
			this.setAttribute("value", color);
			this.#syncingValue = false;
		}
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

	#setFromEvent(e: PointerEvent, commit: boolean) {
		if (!this.#surface) return;
		const rect = this.#surface.getBoundingClientRect();
		this.#xValue = clamp(((e.clientX - rect.left) / rect.width) * 100);
		this.#yValue = clamp(((e.clientY - rect.top) / rect.height) * 100);
		this.#sync(true);
		this.#emit("neo-color-field-input");
		if (commit) this.#emit("neo-color-field-change");
	}

	#onPointerDown = (e: PointerEvent) => {
		if (boolAttr(this, "disabled", false)) return;
		if (e.button !== 0) return;
		e.preventDefault();
		this.focus();
		this.#active = { pointerId: e.pointerId };
		this.setPointerCapture(e.pointerId);
		this.addEventListener("pointermove", this.#onPointerMove);
		this.addEventListener("pointerup", this.#onPointerUp);
		this.addEventListener("pointercancel", this.#onPointerCancel);
		this.#setFromEvent(e, false);
	};

	#onPointerMove = (e: PointerEvent) => {
		if (!this.#active || e.pointerId !== this.#active.pointerId) return;
		if ((e.buttons & 1) === 0) {
			this.#endDrag();
			return;
		}
		this.#setFromEvent(e, false);
	};

	#onPointerUp = (e: PointerEvent) => {
		if (!this.#active || e.pointerId !== this.#active.pointerId) return;
		this.#setFromEvent(e, true);
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

	#endDrag() {
		if (!this.#active) return;
		try {
			if (this.hasPointerCapture(this.#active.pointerId)) {
				this.releasePointerCapture(this.#active.pointerId);
			}
		} catch {
			// Pointer capture may already be gone after cancellation.
		}
		this.removeEventListener("pointermove", this.#onPointerMove);
		this.removeEventListener("pointerup", this.#onPointerUp);
		this.removeEventListener("pointercancel", this.#onPointerCancel);
		this.#active = null;
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
		this.#xValue = clamp(this.#xValue + dx);
		this.#yValue = clamp(this.#yValue + dy);
		this.#sync(true);
		this.#emit("neo-color-field-input");
		this.#emit("neo-color-field-change");
	};
}

if (!customElements.get("neo-color-field")) {
	customElements.define("neo-color-field", NeoColorField);
}
