import { boolAttr, boolCommand } from "../command";
import { observeManagedAttrs, removeAttrIfPresent, setAttrIfChanged } from "../neo-morph-resilient";

const RESILIENT_ATTRS = ["role", "tabindex", "aria-disabled", "aria-checked"];

export class NeoCheckbox extends HTMLElement {
	static readonly observedAttributes = ["checked", "indeterminate", "disabled"];

	#callerTabIndex: string | null = null;
	#morphObserver: MutationObserver | null = null;
	// Checked / indeterminate intent; the attributes reflect them (see
	// command). Survive a morph that strips them so a fat morph omitting them
	// can't reset the box.
	#checkedIntent = false;
	#indeterminateIntent = false;
	#reflecting = false;

	connectedCallback() {
		this.#callerTabIndex = this.getAttribute("tabindex");
		// Explicit value commands intent; absent keeps prior intent.
		const checkedCmd = boolCommand(this, "checked");
		if (checkedCmd !== null) this.#checkedIntent = checkedCmd;
		const indeterminateCmd = boolCommand(this, "indeterminate");
		if (indeterminateCmd !== null) this.#indeterminateIntent = indeterminateCmd;
		this.#resync();
		this.addEventListener("click", this.#onClick);
		this.addEventListener("keydown", this.#onKeyDown);
		// Label-click forwarding listens on `document` and resolves the
		// wrapping label per click, never caching the label node, so a
		// morph that swaps an ancestor label can't strand the listener.
		document.addEventListener("click", this.#onDocumentClick);

		// Custom elements with role="checkbox" don't inherit naming from a
		// wrapping <label> the way a native <input> does. Fold the label's
		// visible text into aria-label so AT announces the option name.
		const label = this.closest("label");
		if (label && !this.hasAttribute("aria-label") && !this.hasAttribute("aria-labelledby")) {
			const text = label.textContent?.trim();
			if (text) this.setAttribute("aria-label", text);
		}
		this.#morphObserver = observeManagedAttrs(this, RESILIENT_ATTRS, this.#resync);
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("keydown", this.#onKeyDown);
		document.removeEventListener("click", this.#onDocumentClick);
		this.#morphObserver?.disconnect();
		this.#morphObserver = null;
	}

	#resync = () => {
		if (!this.hasAttribute("role")) this.setAttribute("role", "checkbox");
		this.#syncDisabledState();
		this.#reflectState();
	};

	attributeChangedCallback(name: string) {
		if (name === "disabled") this.#syncDisabledState();
		if (name === "checked" || name === "indeterminate") {
			if (this.#reflecting) return;
			const cmd = boolCommand(this, name);
			if (cmd !== null) {
				if (name === "checked") this.#checkedIntent = cmd;
				else this.#indeterminateIntent = cmd;
			}
			// Absent re-asserts intent for the [checked]/[indeterminate] CSS;
			// explicit normalizes the "true"/"false" form to bare / removed.
			this.#reflectState();
		}
	}

	get checked(): boolean {
		return this.#checkedIntent;
	}

	set checked(v: boolean) {
		this.#checkedIntent = v;
		this.#reflectState();
	}

	get indeterminate(): boolean {
		return this.#indeterminateIntent;
	}

	set indeterminate(v: boolean) {
		this.#indeterminateIntent = v;
		this.#reflectState();
	}

	// State → attributes, guarded so they aren't read back as commands.
	#reflectState() {
		this.#reflecting = true;
		try {
			this.#reflectBool("checked", this.#checkedIntent);
			this.#reflectBool("indeterminate", this.#indeterminateIntent);
		} finally {
			this.#reflecting = false;
		}
		this.#syncCheckedState();
	}

	#reflectBool(name: string, on: boolean) {
		if (on) {
			if (this.getAttribute(name) !== "") this.setAttribute(name, "");
		} else if (this.hasAttribute(name)) {
			this.removeAttribute(name);
		}
	}

	toggle(): void {
		if (boolAttr(this, "disabled", false)) return;
		// Native rule: user input on a mixed checkbox resolves to checked.
		// Sticky three-state requires re-setting indeterminate after the event.
		if (this.indeterminate) {
			this.indeterminate = false;
			this.checked = true;
		} else {
			this.checked = !this.checked;
		}
		this.dispatchEvent(
			new CustomEvent("neo-checkbox-change", {
				bubbles: true,
				detail: {
					checked: this.checked,
					indeterminate: this.indeterminate,
				},
			}),
		);
	}

	#syncCheckedState() {
		if (this.indeterminate) {
			setAttrIfChanged(this, "aria-checked", "mixed");
		} else {
			setAttrIfChanged(this, "aria-checked", String(this.checked));
		}
	}

	#syncDisabledState() {
		if (boolAttr(this, "disabled", false)) {
			setAttrIfChanged(this, "aria-disabled", "true");
			setAttrIfChanged(this, "tabindex", "-1");
		} else {
			removeAttrIfPresent(this, "aria-disabled");
			setAttrIfChanged(this, "tabindex", this.#callerTabIndex ?? "0");
		}
	}

	#onClick = (e: MouseEvent) => {
		if (boolAttr(this, "disabled", false)) {
			e.stopImmediatePropagation();
			e.preventDefault();
			return;
		}
		e.preventDefault();
		this.toggle();
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (boolAttr(this, "disabled", false)) return;
		if (e.defaultPrevented) return;
		if (e.key !== " " && e.key !== "Enter") return;
		e.preventDefault();
		this.toggle();
	};

	// Forward clicks landing in a wrapping <label> (resolved per click,
	// not cached). Clicks inside the host are handled by onClick; acting
	// here too would double-toggle.
	#onDocumentClick = (e: MouseEvent) => {
		if (boolAttr(this, "disabled", false)) return;
		const target = e.target as Element | null;
		if (!target || this.contains(target)) return;
		const label = target.closest("label");
		if (!label?.contains(this)) return;
		// Mirror native <label> behaviour: a click on another interactive
		// element inside the label (a button, link, etc.) does not
		// activate the labelled control.
		const interactive = target.closest(
			'a, button, [role="button"], input, select, textarea, details, summary, [contenteditable=""], [contenteditable="true"], neo-button, neo-toggle, neo-switch, neo-radio, neo-slider, neo-tab',
		);
		if (interactive && interactive !== this && label.contains(interactive)) return;
		e.preventDefault();
		this.toggle();
		this.focus();
	};
}

if (!customElements.get("neo-checkbox")) {
	customElements.define("neo-checkbox", NeoCheckbox);
}
