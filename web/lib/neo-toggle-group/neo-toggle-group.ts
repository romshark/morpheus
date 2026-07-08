import { boolAttr, warnBadAxis } from "../command";
import { setAttrIfChanged } from "../neo-morph-resilient";
import { joinValues as joinValueList, parseValues } from "../value-list";

function joinValues(values: string[]): string {
	return joinValueList(values, "neo-toggle-group");
}

export class NeoToggleGroup extends HTMLElement {
	// `orientation` is a CSS-only layout hook (see neo-toggle-group.css);
	// arrow-key nav is orientation-agnostic, so JS never reads it.
	static readonly observedAttributes = ["value"];

	#ready = false;
	#applyingValue = false;
	// Command keep-on-absent contract: the value list is the source of truth.
	// A morph stripping `value` (newValue null) must not clear selection;
	// re-reflect this kept value instead of treating absence as a command.
	#valueIntent: string | null = null;
	#childObserver: MutationObserver | null = null;
	// Value of the toggle that last held focus, for restoration after a morph.
	#focusedValue: string | null = null;

	connectedCallback() {
		warnBadAxis(this);
		this.#valueIntent = this.getAttribute("value");
		if (!this.hasAttribute("role")) {
			this.setAttribute("role", "group");
		}
		this.addEventListener("neo-toggle-change", this.#onToggleChange);
		this.addEventListener("keydown", this.#onKeyDown);
		this.addEventListener("focusin", this.#onFocusIn);
		this.addEventListener("focusout", this.#onFocusOut);

		// Re-sync on toggle add/remove/reorder (external morph, dynamic
		// option lists) and on child value/disabled changes. Children are
		// queried live so a child swap can't leave selection on stale
		// nodes. `pressed` is omitted from the filter to avoid looping on
		// syncFromValue's own writes.
		// A morph re-creates the toggles, blurring the focused one to <body>;
		// reseat it after resync re-stamps the child state.
		this.#childObserver = new MutationObserver(() => {
			this.#resync();
			this.#restoreFocusIfLost();
		});
		this.#childObserver.observe(this, {
			childList: true,
			subtree: true,
			attributes: true,
			// tabindex: catch a morph stripping the kit-managed tabindex in
			// place (neo-toggle isn't focusable without it).
			attributeFilter: ["value", "disabled", "tabindex"],
		});

		this.#ready = true;
		this.#resync();
	}

	disconnectedCallback() {
		this.removeEventListener("neo-toggle-change", this.#onToggleChange);
		this.removeEventListener("keydown", this.#onKeyDown);
		this.removeEventListener("focusin", this.#onFocusIn);
		this.removeEventListener("focusout", this.#onFocusOut);
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		this.#ready = false;
	}

	// Reseat focus on the toggle whose value matches focusedValue if a morph
	// blurred it to <body>. Drops the target when the toggle is gone.
	#restoreFocusIfLost() {
		if (this.#focusedValue === null) return;
		if (this.contains(document.activeElement)) return;
		const ae = document.activeElement;
		if (ae && ae !== document.body) return;
		const toggle = this.#toggles().find((t) => t.getAttribute("value") === this.#focusedValue);
		if (!toggle || !this.contains(toggle)) {
			this.#focusedValue = null;
			return;
		}
		toggle.focus();
	}

	#onFocusIn = (e: FocusEvent) => {
		const toggle = this.#toggles().find((t) => t === e.target || t.contains(e.target as Node));
		this.#focusedValue = toggle ? toggle.getAttribute("value") : null;
	};

	#onFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		if (next) {
			this.#focusedValue = null;
			return;
		}
		queueMicrotask(() => {
			if (this.contains(document.activeElement)) return;
			this.#focusedValue = null;
		});
	};

	// Connect/morph seed: pressed state follows the kept value list once the group
	// is value-controlled, else `value` is derived from children. A morph
	// stripping `value` keeps the intent, so absence here means uncontrolled
	// (never had a value), not a command to clear. Never dispatches.
	#resync() {
		this.#syncHostRole();
		if (this.#valueIntent !== null) {
			this.#reflectValue(this.#valueIntent);
			this.#syncFromValue();
		} else {
			this.#rebuildValueFromChildren(false);
		}
		this.#syncChildTabIndex();
	}

	#syncHostRole() {
		const role = this.getAttribute("role");
		if (!role || role === "radiogroup") {
			this.setAttribute("role", "group");
		}
	}

	// Each child stays independently tabbable. Re-apply after morphs
	// because neo-toggle is not focusable without tabindex.
	#syncChildTabIndex() {
		for (const t of this.#toggles()) {
			setAttrIfChanged(t, "tabindex", boolAttr(t, "disabled", false) ? "-1" : "0");
		}
	}

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		if (!this.#ready) return;
		if (name === "value") {
			// Our own re-reflect write (keep-on-absent below); not a command.
			if (this.#applyingValue) return;
			// Fat morph dropped `value`: no command, keep the current value list.
			// Re-reflect it so the attribute stays the state mirror.
			if (newValue === null) {
				this.#reflectValue(this.#valueIntent ?? "");
			} else {
				this.#valueIntent = newValue;
			}
			this.#syncFromValue();
			this.#syncChildTabIndex();
		}
	}

	get value(): string {
		return this.#valueIntent ?? "";
	}

	set value(v: string) {
		this.#writeValue(v, false);
		this.#syncFromValue();
		this.#syncChildTabIndex();
	}

	get values(): string[] {
		return parseValues(this.#valueIntent);
	}

	// Single writer: the value list is the source of truth. Updates the kept intent
	// and reflects it to the attribute (guarded so the reflective write isn't
	// read back as a command), so internal getAttribute("value") reads stay
	// correct. `dispatch` emits the change event for user-driven toggles.
	#writeValue(next: string, dispatch: boolean, values?: string[]) {
		this.#valueIntent = next;
		this.#reflectValue(next);
		if (dispatch) {
			this.dispatchEvent(
				new CustomEvent("neo-toggle-group-change", {
					bubbles: true,
					detail: { value: next, values: values ?? parseValues(next) },
				}),
			);
		}
	}

	#reflectValue(next: string) {
		this.#applyingValue = true;
		setAttrIfChanged(this, "value", next);
		this.#applyingValue = false;
	}

	/** Direct element children, queried live (never cached, since a morph
	 * can replace/reorder them while the host stays connected). */
	#toggles(): HTMLElement[] {
		return Array.from(this.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
	}

	#syncFromValue() {
		const active = new Set(parseValues(this.#valueIntent));
		for (const el of this.#toggles()) {
			const v = el.getAttribute("value");
			const pressed = v !== null && active.has(v);
			this.#setTogglePressed(el, pressed);
		}
	}

	#setTogglePressed(el: HTMLElement, pressed: boolean) {
		const toggle = el as HTMLElement & { pressed?: boolean };
		if (typeof toggle.pressed === "boolean") {
			toggle.pressed = pressed;
			return;
		}
		if (pressed) {
			el.setAttribute("pressed", "");
		} else if (el.hasAttribute("pressed")) {
			el.setAttribute("pressed", "false");
		}
	}

	// Rebuild value from children's `pressed` state. `dispatch=false` skips
	// the change event (used during connect to seed without notifying).
	#rebuildValueFromChildren(dispatch: boolean) {
		const values: string[] = [];
		for (const el of this.#toggles()) {
			if (!boolAttr(el, "pressed", false)) continue;
			const v = el.getAttribute("value");
			if (v !== null && v !== "") values.push(v);
		}
		this.#writeValue(joinValues(values), dispatch, values);
	}

	#onToggleChange = (e: Event) => {
		const target = e.target as HTMLElement | null;
		if (!target || !this.#toggles().includes(target)) return;
		this.#rebuildValueFromChildren(true);
	};

	#focusableToggles(): HTMLElement[] {
		return this.#toggles().filter((t) => !boolAttr(t, "disabled", false) && t.getAttribute("aria-disabled") !== "true");
	}

	#onKeyDown = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		const items = this.#focusableToggles();
		if (items.length === 0) return;
		const active = document.activeElement as HTMLElement | null;
		const currentIdx = items.indexOf(active as HTMLElement);
		if (currentIdx < 0) return;

		let nextIdx = -1;
		switch (e.key) {
			case "ArrowLeft":
			case "ArrowUp":
				nextIdx = currentIdx <= 0 ? items.length - 1 : currentIdx - 1;
				break;
			case "ArrowRight":
			case "ArrowDown":
				nextIdx = currentIdx >= items.length - 1 ? 0 : currentIdx + 1;
				break;
			case "Home":
				nextIdx = 0;
				break;
			case "End":
				nextIdx = items.length - 1;
				break;
			default:
				return;
		}
		e.preventDefault();
		items[nextIdx].focus();
	};
}

if (!customElements.get("neo-toggle-group")) {
	customElements.define("neo-toggle-group", NeoToggleGroup);
}
