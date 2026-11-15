import { boolAttr, boolCommand } from "../command";
import { nameFromLabel } from "../label-name";
import { observeManagedAttrs, setAttrIfChanged } from "../neo-morph-resilient";

const RESILIENT_ATTRS = ["role", "tabindex", "aria-disabled", "aria-checked", "aria-label", "aria-required"];

export class NeoSwitch extends HTMLElement {
	// Form-associated, which also makes it labelable: the browser forwards
	// <label> clicks to it.
	static readonly formAssociated = true;
	static readonly observedAttributes = ["checked", "disabled", "value", "required"];

	#internals = this.attachInternals();
	// Set by a containing <fieldset disabled>, or by `disabled` present in any form.
	#formDisabled = false;
	// `checked` as first rendered, which form reset restores.
	#defaultChecked: boolean | null = null;
	#morphObserver: MutationObserver | null = null;
	// Checked intent; `checked` is its reflection (see command).
	// Survives a morph that strips the attribute so a fat morph omitting `checked`
	// can't reset the toggle.
	#checkedIntent = false;
	#reflectingChecked = false;

	connectedCallback() {
		// Explicit checked / checked="false" commands intent; absent keeps the
		// prior intent (persists across a morph re-attach).
		const cmd = boolCommand(this, "checked");
		if (cmd !== null) this.#checkedIntent = cmd;
		this.#defaultChecked ??= this.#checkedIntent;
		this.#resync();
		this.addEventListener("click", this.#onClick);
		this.addEventListener("keydown", this.#onKeyDown);
		this.#morphObserver = observeManagedAttrs(this, RESILIENT_ATTRS, this.#resync);
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("keydown", this.#onKeyDown);
		this.#morphObserver?.disconnect();
		this.#morphObserver = null;
	}

	#resync = () => {
		if (!this.hasAttribute("role")) this.setAttribute("role", "switch");
		nameFromLabel(this);
		this.#syncDisabledState();
		this.#reflectChecked();
	};

	attributeChangedCallback(name: string) {
		if (name === "disabled") this.#syncDisabledState();
		if (name === "value" || name === "required") this.#syncForm();
		if (name === "checked") {
			if (this.#reflectingChecked) return;
			const cmd = boolCommand(this, "checked");
			if (cmd !== null) this.#checkedIntent = cmd;
			// Absent re-asserts intent for the [checked] CSS;
			// explicit normalizes the "true"/"false" form to bare / removed.
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

	// State -> attribute, guarded so it isn't read back as a command.
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
		this.#syncForm();
	}

	// An on switch submits `value` ("on" by default) under its name, like a
	// native checkbox; an off one submits nothing.
	#syncForm() {
		const checked = this.#checkedIntent;
		this.#internals.setFormValue(checked ? (this.getAttribute("value") ?? "on") : null, checked ? "on" : "off");
		const required = boolAttr(this, "required", false);
		if (required) setAttrIfChanged(this, "aria-required", "true");
		else this.removeAttribute("aria-required");
		if (required && !checked) {
			this.#internals.setValidity({ valueMissing: true }, "Turn this on to continue.");
		} else {
			this.#internals.setValidity({});
		}
	}

	get form(): HTMLFormElement | null {
		return this.#internals.form;
	}

	get validity(): ValidityState {
		return this.#internals.validity;
	}

	get validationMessage(): string {
		return this.#internals.validationMessage;
	}

	get willValidate(): boolean {
		return this.#internals.willValidate;
	}

	checkValidity(): boolean {
		return this.#internals.checkValidity();
	}

	reportValidity(): boolean {
		return this.#internals.reportValidity();
	}

	formDisabledCallback(disabled: boolean) {
		this.#formDisabled = disabled;
		this.#syncDisabledState();
	}

	formResetCallback() {
		this.checked = this.#defaultChecked ?? false;
	}

	formStateRestoreCallback(state: unknown) {
		if (state === "on" || state === "off") this.checked = state === "on";
	}

	#isDisabled(): boolean {
		return this.#formDisabled || boolAttr(this, "disabled", false);
	}

	toggle(): void {
		if (this.#isDisabled()) return;
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
		if (this.#isDisabled()) {
			setAttrIfChanged(this, "aria-disabled", "true");
			setAttrIfChanged(this, "tabindex", "-1");
		} else {
			this.removeAttribute("aria-disabled");
			if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
		}
	}

	#onClick = (e: MouseEvent) => {
		if (this.#isDisabled()) {
			// Prevent a containing label from forwarding this click.
			e.stopImmediatePropagation();
			e.preventDefault();
			return;
		}
		e.preventDefault();
		this.toggle();
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (this.#isDisabled()) return;
		if (e.defaultPrevented) return;
		if (e.key !== " " && e.key !== "Enter") return;
		e.preventDefault();
		this.toggle();
	};
}

if (!customElements.get("neo-switch")) {
	customElements.define("neo-switch", NeoSwitch);
}
