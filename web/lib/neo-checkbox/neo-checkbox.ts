import { boolAttr, boolCommand } from "../command";
import { nameFromLabel } from "../label-name";
import { observeManagedAttrs, setAttrIfChanged } from "../neo-morph-resilient";

const RESILIENT_ATTRS = ["role", "tabindex", "aria-disabled", "aria-checked", "aria-label", "aria-required"];

export class NeoCheckbox extends HTMLElement {
	// Form-associated, which also makes it labelable: the browser forwards
	// <label> clicks to it.
	static readonly formAssociated = true;
	static readonly observedAttributes = ["checked", "indeterminate", "disabled", "value", "required"];

	#internals = this.attachInternals();
	// Set by a containing <fieldset disabled>, or by `disabled` present in any form.
	#formDisabled = false;
	// `checked` as first rendered, which form reset restores.
	#defaultChecked: boolean | null = null;
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
		this.#defaultChecked ??= this.#checkedIntent;
		const indeterminateCmd = boolCommand(this, "indeterminate");
		if (indeterminateCmd !== null) this.#indeterminateIntent = indeterminateCmd;
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
		if (!this.hasAttribute("role")) this.setAttribute("role", "checkbox");
		nameFromLabel(this);
		this.#syncDisabledState();
		this.#reflectState();
	};

	attributeChangedCallback(name: string) {
		if (name === "disabled") this.#syncDisabledState();
		if (name === "value" || name === "required") this.#syncForm();
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

	// State -> attributes, guarded so they aren't read back as commands.
	#reflectState() {
		this.#reflecting = true;
		try {
			this.#reflectBool("checked", this.#checkedIntent);
			this.#reflectBool("indeterminate", this.#indeterminateIntent);
		} finally {
			this.#reflecting = false;
		}
		this.#syncCheckedState();
		this.#syncForm();
	}

	// A checked box submits `value` ("on" by default) under its name, as a
	// native checkbox does; an unchecked one submits nothing.
	#syncForm() {
		const checked = this.#checkedIntent;
		this.#internals.setFormValue(checked ? (this.getAttribute("value") ?? "on") : null, checked ? "on" : "off");
		const required = boolAttr(this, "required", false);
		if (required) setAttrIfChanged(this, "aria-required", "true");
		else this.removeAttribute("aria-required");
		if (required && !checked) {
			this.#internals.setValidity({ valueMissing: true }, "Check this box to continue.");
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

	#reflectBool(name: string, on: boolean) {
		if (on) {
			if (this.getAttribute(name) !== "") this.setAttribute(name, "");
		} else if (this.hasAttribute(name)) {
			this.removeAttribute(name);
		}
	}

	toggle(): void {
		if (this.#isDisabled()) return;
		// Per the native rule, user input on a mixed checkbox resolves to
		// checked.
		// Sticky 3-state requires re-setting indeterminate after the event.
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
		if (this.#isDisabled()) {
			setAttrIfChanged(this, "aria-disabled", "true");
			setAttrIfChanged(this, "tabindex", "-1");
		} else {
			this.removeAttribute("aria-disabled");
			setAttrIfChanged(this, "tabindex", this.#callerTabIndex ?? "0");
		}
	}

	#onClick = (e: MouseEvent) => {
		if (this.#isDisabled()) {
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

if (!customElements.get("neo-checkbox")) {
	customElements.define("neo-checkbox", NeoCheckbox);
}
