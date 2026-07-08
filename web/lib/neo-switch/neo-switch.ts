import { boolAttr, boolCommand } from "../command";
import { observeManagedAttrs, removeAttrIfPresent, setAttrIfChanged } from "../neo-morph-resilient";

const RESILIENT_ATTRS = ["role", "tabindex", "aria-disabled", "aria-checked"];

export class NeoSwitch extends HTMLElement {
	static readonly observedAttributes = ["checked", "disabled"];

	#morphObserver: MutationObserver | null = null;
	// Checked intent; `checked` is its reflection (see command). Survives a
	// morph that strips the attribute so a fat morph omitting `checked` can't
	// reset the toggle.
	#checkedIntent = false;
	#reflectingChecked = false;

	connectedCallback() {
		// Explicit checked / checked="false" commands intent; absent keeps the
		// prior intent (persists across a morph re-attach).
		const cmd = boolCommand(this, "checked");
		if (cmd !== null) this.#checkedIntent = cmd;
		this.#resync();
		this.addEventListener("click", this.#onClick);
		this.addEventListener("keydown", this.#onKeyDown);
		// Label-click forwarding listens on `document` and resolves the
		// wrapping label per click. Never caches the label node, so a
		// morph that swaps an ancestor label can't strand the listener.
		document.addEventListener("click", this.#onDocumentClick);
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
		if (!this.hasAttribute("role")) this.setAttribute("role", "switch");
		this.#syncDisabledState();
		this.#reflectChecked();
	};

	attributeChangedCallback(name: string) {
		if (name === "disabled") this.#syncDisabledState();
		if (name === "checked") {
			if (this.#reflectingChecked) return;
			const cmd = boolCommand(this, "checked");
			if (cmd !== null) this.#checkedIntent = cmd;
			// Absent re-asserts intent for the [checked] CSS; explicit normalizes
			// the "true"/"false" form to bare / removed.
			this.#reflectChecked();
		}
	}

	get checked(): boolean {
		return this.#checkedIntent;
	}

	set checked(v: boolean) {
		this.#checkedIntent = v;
		this.#reflectChecked();
	}

	// State → attribute, guarded so it isn't read back as a command.
	#reflectChecked() {
		this.#reflectingChecked = true;
		try {
			if (this.#checkedIntent) {
				if (this.getAttribute("checked") !== "") this.setAttribute("checked", "");
			} else if (this.hasAttribute("checked")) {
				this.removeAttribute("checked");
			}
		} finally {
			this.#reflectingChecked = false;
		}
		this.#syncCheckedState();
	}

	toggle(): void {
		if (boolAttr(this, "disabled", false)) return;
		this.checked = !this.checked;
		this.dispatchEvent(
			new CustomEvent("neo-switch-change", {
				bubbles: true,
				detail: { checked: this.checked },
			}),
		);
	}

	#syncCheckedState() {
		setAttrIfChanged(this, "aria-checked", String(this.checked));
	}

	#syncDisabledState() {
		if (boolAttr(this, "disabled", false)) {
			setAttrIfChanged(this, "aria-disabled", "true");
			setAttrIfChanged(this, "tabindex", "-1");
		} else {
			removeAttrIfPresent(this, "aria-disabled");
			if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
		}
	}

	#onClick = (e: MouseEvent) => {
		if (boolAttr(this, "disabled", false)) {
			// Prevent a containing label from forwarding this click.
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
		// Mirror native <label>: a click on another interactive element
		// inside the label does not activate the labelled control.
		const interactive = target.closest(
			'a, button, [role="button"], input, select, textarea, details, summary, [contenteditable=""], [contenteditable="true"], neo-button, neo-toggle, neo-switch, neo-radio, neo-checkbox, neo-slider, neo-tab',
		);
		if (interactive && interactive !== this && label.contains(interactive)) return;
		e.preventDefault();
		this.toggle();
		// Match native <label>+checkbox: focus follows the click.
		this.focus();
	};
}

if (!customElements.get("neo-switch")) {
	customElements.define("neo-switch", NeoSwitch);
}
