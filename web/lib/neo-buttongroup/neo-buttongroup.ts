import { boolAttr, warnBadAxis } from "../command";
import { setAttrIfChanged } from "../neo-morph-resilient";

export class NeoButtonGroup extends HTMLElement {
	static readonly observedAttributes = ["value"];

	#segmented = false;
	#ready = false;
	#applyingValue = false;
	#childObserver: MutationObserver | null = null;
	// Value of the segment that last held focus, for restoration after a morph.
	#focusedValue: string | null = null;
	// Source of truth for the selected segment, kept reflected to `value`.
	// A morph that strips `value` keeps this and re-reflects it (command
	// keep-on-absent contract); internal reads stay correct.
	#valueIntent: string | null = null;

	connectedCallback() {
		warnBadAxis(this);
		this.#segmented = this.hasAttribute("value");
		this.#valueIntent = this.getAttribute("value");
		this.addEventListener("click", this.#onClick);
		if (this.#segmented) {
			if (!this.hasAttribute("role")) this.setAttribute("role", "radiogroup");
			this.addEventListener("keydown", this.#onKeyDown);
			this.addEventListener("focusin", this.#onFocusIn);
			this.addEventListener("focusout", this.#onFocusOut);
		}

		// Re-sync segmented ARIA / roving tabindex on button add / remove /
		// reorder (Datastar morph, dynamic option lists) and on child
		// value/disabled changes. Children are queried live, never cached,
		// so an in-place child morph can't strand selection on stale nodes.
		// attributeFilter excludes the attributes syncSegmentedAttrs writes
		// (role/aria-checked/tabindex) so it can't observe its own writes.
		this.#childObserver = new MutationObserver(() => {
			if (!this.#segmented) return;
			this.#syncSegmentedAttrs();
			// A morph re-creates the segments, blurring the focused one to
			// <body>; reseat it after the roving state is re-stamped.
			this.#restoreFocusIfLost();
		});
		this.#childObserver.observe(this, {
			childList: true,
			subtree: true,
			attributes: true,
			// Not tabindex: neo-button re-asserts its own tabindex, so
			// observing it here would ping-pong. The in-place strip is
			// recovered via onFocusOut instead.
			attributeFilter: ["disabled", "value", "aria-disabled"],
		});

		this.#ready = true;
		if (this.#segmented) this.#syncSegmentedAttrs();
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("keydown", this.#onKeyDown);
		this.removeEventListener("focusin", this.#onFocusIn);
		this.removeEventListener("focusout", this.#onFocusOut);
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		this.#ready = false;
	}

	// Reseat focus on the segment whose value matches focusedValue if a
	// morph blurred it to <body>. Drops the target when the segment is gone.
	#restoreFocusIfLost() {
		if (this.#focusedValue === null) return;
		if (this.contains(document.activeElement)) return;
		const ae = document.activeElement;
		if (ae && ae !== document.body) return;
		const btn = this.#buttons().find((b) => b.getAttribute("value") === this.#focusedValue);
		if (!btn || !this.contains(btn)) {
			this.#focusedValue = null;
			return;
		}
		btn.focus();
	}

	#onFocusIn = (e: FocusEvent) => {
		const btn = this.#buttons().find((b) => b === e.target || b.contains(e.target as Node));
		this.#focusedValue = btn ? btn.getAttribute("value") : null;
	};

	#onFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		if (next) {
			this.#focusedValue = null;
			return;
		}
		// Blur to nothing. A morph strips the segment's tabindex in place
		// (so it's absent at this synchronous focusout); neo-button re-adds
		// one async, so reseat focus once it has. A genuine click-away
		// leaves the tabindex intact, so stop tracking.
		const btn = this.#buttons().find((b) => b === e.target || b.contains(e.target as Node));
		if (btn && !btn.hasAttribute("tabindex")) {
			queueMicrotask(() => {
				if (this.contains(document.activeElement)) return;
				this.#syncSegmentedAttrs();
				this.#restoreFocusIfLost();
			});
			return;
		}
		queueMicrotask(() => {
			if (this.contains(document.activeElement)) return;
			this.#focusedValue = null;
		});
	};

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		if (!this.#ready || !this.#segmented) return;
		if (name !== "value") return;
		// Our own re-reflect write (writeValue / keep-on-absent below); not a command.
		if (this.#applyingValue) return;
		if (newValue === null) {
			// Fat morph dropped `value`: no command, keep the current selection
			// and re-reflect it so the attribute stays the state mirror and
			// internal getAttribute("value") reads stay correct.
			this.#writeValue(this.#valueIntent);
			return;
		}
		// Explicit value="x" (incl. value=""): adopt it.
		this.#valueIntent = newValue;
		this.#syncSegmentedAttrs();
	}

	get value(): string | null {
		return this.#valueIntent;
	}

	set value(v: string | null) {
		this.#writeValue(v);
	}

	// Single writer: intent is the source of truth, reflected to `value`
	// (guarded so the reflection isn't read back as a command), then synced.
	#writeValue(v: string | null) {
		this.#valueIntent = v;
		this.#applyingValue = true;
		if (v === null) this.removeAttribute("value");
		else this.setAttribute("value", v);
		this.#applyingValue = false;
		this.#syncSegmentedAttrs();
	}

	/** Direct element children, queried live (never cached, since a morph
	 * can replace/reorder them while the host stays connected). */
	#buttons(): HTMLElement[] {
		return Array.from(this.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
	}

	#syncSegmentedAttrs() {
		const value = this.#valueIntent;
		for (const btn of this.#buttons()) {
			btn.setAttribute("role", "radio");
			const bv = btn.getAttribute("value");
			const checked = bv !== null && bv === value;
			btn.setAttribute("aria-checked", String(checked));
			// setAttrIfChanged so observing tabindex doesn't loop on our writes.
			setAttrIfChanged(btn, "tabindex", checked ? "0" : "-1");
		}
	}

	#focusableButtons(): HTMLElement[] {
		return this.#buttons().filter((b) => !b.hasAttribute("disabled") && b.getAttribute("aria-disabled") !== "true");
	}

	#onClick = (e: MouseEvent) => {
		if (!this.#segmented) return;
		const btn = this.#buttons().find((b) => b === e.target || b.contains(e.target as Node));
		if (!btn) return;
		if (btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true") {
			return;
		}
		const value = btn.getAttribute("value");
		if (value === null) return;
		this.#select(value);
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		const items = this.#focusableButtons();
		if (items.length === 0) return;
		const active = document.activeElement as HTMLElement | null;
		const currentIdx = items.indexOf(active as HTMLElement);

		let nextIdx = -1;
		switch (e.key) {
			case "ArrowLeft":
			case "ArrowUp":
				nextIdx = currentIdx <= 0 ? items.length - 1 : currentIdx - 1;
				break;
			case "ArrowRight":
			case "ArrowDown":
				nextIdx = currentIdx < 0 || currentIdx >= items.length - 1 ? 0 : currentIdx + 1;
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
		const next = items[nextIdx];
		next.focus();
		if (boolAttr(this, "auto-activate", false)) {
			const v = next.getAttribute("value");
			if (v !== null) this.#select(v);
		}
	};

	#select(value: string) {
		if (this.#valueIntent === value) return;
		this.#writeValue(value);
		this.dispatchEvent(
			new CustomEvent("neo-buttongroup-change", {
				bubbles: true,
				detail: { value },
			}),
		);
	}
}

if (!customElements.get("neo-buttongroup")) {
	customElements.define("neo-buttongroup", NeoButtonGroup);
}
