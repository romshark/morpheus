import { boolAttr, warnBadAxis } from "../command";
import { observeManagedAttrs, removeAttrIfPresent, setAttrIfChanged } from "../neo-morph-resilient";

// `aria-checked` and `tabindex` are written by the enclosing group's
// refresh(); when the morph strips them and bypasses the group's
// observer (which only watches child `disabled`/`value` and childList),
// the radio's own observer re-asserts a safe default. The group's
// next refresh, fired by any subsequent click/value/disabled, will
// overwrite both to the correct roving-state value.
const RESILIENT_ATTRS = ["role", "aria-checked", "aria-disabled", "tabindex"];

export class NeoRadio extends HTMLElement {
	static readonly observedAttributes = ["disabled"];

	#morphObserver: MutationObserver | null = null;

	connectedCallback() {
		this.#resync();
		// Custom elements with explicit ARIA roles don't inherit naming
		// from a wrapping <label> the way a native <input> does. If we're
		// wrapped in a label and don't have an explicit aria-label /
		// aria-labelledby, fold the label's visible text into aria-label
		// so AT announces the option name.
		if (!this.hasAttribute("aria-label") && !this.hasAttribute("aria-labelledby")) {
			const label = this.closest("label");
			const text = label?.textContent?.trim();
			if (text) this.setAttribute("aria-label", text);
		}
		this.#morphObserver = observeManagedAttrs(this, RESILIENT_ATTRS, this.#resync);
	}

	disconnectedCallback() {
		this.#morphObserver?.disconnect();
		this.#morphObserver = null;
	}

	attributeChangedCallback(name: string) {
		if (name === "disabled") this.#syncDisabledState();
	}

	get value(): string {
		return this.getAttribute("value") ?? "";
	}

	set value(v: string) {
		this.setAttribute("value", v);
	}

	get checked(): boolean {
		return this.getAttribute("aria-checked") === "true";
	}

	#resync = () => {
		if (!this.hasAttribute("role")) this.setAttribute("role", "radio");
		if (!this.hasAttribute("aria-checked")) {
			this.setAttribute("aria-checked", "false");
		}
		this.#syncDisabledState();
	};

	#syncDisabledState() {
		if (boolAttr(this, "disabled", false)) {
			setAttrIfChanged(this, "aria-disabled", "true");
		} else {
			removeAttrIfPresent(this, "aria-disabled");
		}
	}
}

if (!customElements.get("neo-radio")) {
	customElements.define("neo-radio", NeoRadio);
}

export class NeoRadioGroup extends HTMLElement {
	// `orientation` is a CSS-only layout hook (see neo-radio-group.css);
	// arrow-key nav is orientation-agnostic, so JS never reads it.
	static readonly observedAttributes = ["value", "disabled"];

	#applyingValue = false;
	#ready = false;
	#radioObserver: MutationObserver | null = null;
	// Value of the radio that last held focus, for restoration after a morph.
	#focusedValue: string | null = null;
	// Source of truth for the selected value. The attribute is a state mirror
	// (kept reflected so refresh()'s getAttribute reads stay correct); the
	// client keeps this on a morph that strips `value`.
	#valueIntent: string | null = null;

	connectedCallback() {
		warnBadAxis(this);
		if (!this.hasAttribute("role")) this.setAttribute("role", "radiogroup");
		this.#valueIntent = this.getAttribute("value");
		this.addEventListener("click", this.#onClick);
		this.addEventListener("keydown", this.#onKeyDown);
		this.addEventListener("focusin", this.#onFocusIn);
		this.addEventListener("focusout", this.#onFocusOut);

		// Re-sync on radio add/remove (Datastar morph, dynamic option lists)
		// and on child `disabled` changes so roving tabindex and skip
		// behaviour stay truthful. A morph also blurs a focused radio to
		// <body>; reseat it after refresh re-stamps the roving state.
		this.#radioObserver = new MutationObserver(() => {
			this.#refresh();
			this.#restoreFocusIfLost();
		});
		this.#radioObserver.observe(this, {
			childList: true,
			subtree: true,
			attributes: true,
			// tabindex: catch a morph stripping the kit roving tabindex
			// in place (custom elements aren't focusable without it).
			attributeFilter: ["disabled", "value", "tabindex"],
		});

		this.#ready = true;
		this.#refresh();
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("keydown", this.#onKeyDown);
		this.removeEventListener("focusin", this.#onFocusIn);
		this.removeEventListener("focusout", this.#onFocusOut);
		this.#radioObserver?.disconnect();
		this.#radioObserver = null;
		this.#ready = false;
	}

	// Reseat focus on the radio whose value matches focusedValue if a morph
	// blurred it to <body>. Drops the target when the radio is gone.
	#restoreFocusIfLost() {
		if (this.#focusedValue === null) return;
		if (this.contains(document.activeElement)) return;
		const ae = document.activeElement;
		if (ae && ae !== document.body) return;
		const radio = this.#radios().find((r) => r.getAttribute("value") === this.#focusedValue);
		if (!radio || !this.contains(radio)) {
			this.#focusedValue = null;
			return;
		}
		radio.focus();
	}

	#onFocusIn = (e: FocusEvent) => {
		const radio = (e.target as Element | null)?.closest<NeoRadio>("neo-radio");
		this.#focusedValue = radio && this.contains(radio) ? radio.getAttribute("value") : null;
	};

	#onFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		if (next) {
			this.#focusedValue = null;
			return;
		}
		// Blur to nothing: morph strip (observer reseats first) or click-away.
		queueMicrotask(() => {
			if (this.contains(document.activeElement)) return;
			this.#focusedValue = null;
		});
	};

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		if (!this.#ready) return;
		// Our own reflective write (writeValue / keep-on-absent); not a command.
		if (this.#applyingValue) return;
		if (name === "value") {
			// Fat morph dropped `value`: no command, keep the current selection
			// (command contract). Re-reflect intent so the attribute stays the
			// state mirror, then refresh; don't clear the selection.
			if (newValue === null) {
				this.#reflectValue();
				this.#refresh();
				return;
			}
			this.#applyValue(newValue, { silent: true });
		} else if (name === "disabled") {
			this.#refresh();
		}
	}

	get value(): string | null {
		return this.#valueIntent;
	}

	set value(v: string | null) {
		this.#writeValue(v);
		this.#refresh();
	}

	// Single writer for the selected value: intent is the source of truth, the
	// attribute its guarded mirror so refresh()'s getAttribute reads stay true.
	#writeValue(value: string | null) {
		this.#valueIntent = value;
		this.#reflectValue();
	}

	// Re-assert valueIntent to the attribute, guarded so the write isn't read
	// back as a command in attributeChangedCallback.
	#reflectValue() {
		const v = this.#valueIntent;
		if (this.getAttribute("value") === v) return;
		this.#applyingValue = true;
		try {
			if (v === null) this.removeAttribute("value");
			else this.setAttribute("value", v);
		} finally {
			this.#applyingValue = false;
		}
	}

	// DOM order, including label-wrapped radios.
	#radios(): NeoRadio[] {
		return Array.from(this.querySelectorAll<NeoRadio>("neo-radio"));
	}

	#enabledRadios(): NeoRadio[] {
		const groupDisabled = boolAttr(this, "disabled", false);
		return this.#radios().filter((r) => {
			if (groupDisabled) return false;
			return !boolAttr(r, "disabled", false);
		});
	}

	#refresh() {
		const value = this.#valueIntent;
		const groupDisabled = boolAttr(this, "disabled", false);
		const all = this.#radios();

		// Group-disabled propagates via aria-disabled, not the child's own
		// `disabled` attribute, so removing the group flag preserves any
		// per-radio disabled state authors set explicitly.
		for (const r of all) {
			const isChecked = value !== null && r.getAttribute("value") === value;
			r.setAttribute("aria-checked", isChecked ? "true" : "false");
			if (groupDisabled) {
				r.setAttribute("aria-disabled", "true");
			} else if (!boolAttr(r, "disabled", false)) {
				r.removeAttribute("aria-disabled");
			}
		}

		// Roving tabindex: one tab stop, the checked radio if any, else
		// the first enabled. Disabled radios always tabindex=-1.
		const enabled = this.#enabledRadios();
		const checkedEnabled = enabled.find((r) => r.checked);
		const stopRadio = checkedEnabled ?? enabled[0] ?? null;
		// setAttrIfChanged so the radioObserver (which now watches tabindex
		// to catch the morph stripping it) settles after one no-op pass.
		for (const r of all) {
			const stop = r === stopRadio && !groupDisabled && !boolAttr(r, "disabled", false);
			setAttrIfChanged(r, "tabindex", stop ? "0" : "-1");
		}
	}

	#applyValue(value: string | null, opts: { silent?: boolean } = {}) {
		// Intent is the source of truth; the writer keeps the attribute mirrored.
		this.#writeValue(value);
		this.#refresh();
		if (!opts.silent) {
			this.dispatchEvent(
				new CustomEvent("neo-radio-group-change", {
					bubbles: true,
					detail: { value },
				}),
			);
		}
	}

	#onClick = (e: MouseEvent) => {
		if (boolAttr(this, "disabled", false)) return;
		const el = e.target as Element | null;
		// Clicks inside the radio resolve via closest("neo-radio"); clicks
		// on label text bubble through the wrapping <label>, not the radio,
		// so fall back to closest("label") and pick the radio within.
		let target = el?.closest<NeoRadio>("neo-radio") ?? null;
		if (!target) {
			const label = el?.closest("label");
			if (label && this.contains(label)) {
				// Mirror native <label>: another interactive element inside
				// the label intercepts the click, so don't activate the radio.
				const interactive = el?.closest(
					'a, button, [role="button"], input, select, textarea, details, summary, [contenteditable=""], [contenteditable="true"], neo-button, neo-toggle, neo-switch, neo-checkbox, neo-slider, neo-tab',
				);
				if (interactive && label.contains(interactive)) return;
				target = label.querySelector<NeoRadio>("neo-radio");
			}
		}
		if (!target || !this.contains(target)) return;
		if (boolAttr(target, "disabled", false)) return;
		e.preventDefault();
		this.#applyValue(target.getAttribute("value"));
		target.focus();
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (boolAttr(this, "disabled", false)) return;
		if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		const target = (e.target as Element | null)?.closest<NeoRadio>("neo-radio");
		if (!target || !this.contains(target)) return;

		if (e.key === " " || e.key === "Enter") {
			if (boolAttr(target, "disabled", false)) return;
			e.preventDefault();
			this.#applyValue(target.getAttribute("value"));
			return;
		}

		if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") {
			return;
		}

		const enabled = this.#enabledRadios();
		if (enabled.length === 0) return;
		const idx = enabled.indexOf(target);
		if (idx === -1) return;
		e.preventDefault();
		const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? +1 : -1;
		const next = enabled[(idx + dir + enabled.length) % enabled.length];
		next.focus();
		// Manual activation by default (like neo-tabs): arrows only move
		// focus; Enter / Space commit. `auto-activate` selects on move.
		if (boolAttr(this, "auto-activate", false)) {
			this.#applyValue(next.getAttribute("value"));
		}
	};
}

if (!customElements.get("neo-radio-group")) {
	customElements.define("neo-radio-group", NeoRadioGroup);
}
