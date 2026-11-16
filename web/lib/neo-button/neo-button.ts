import { boolAttr } from "../command";
import { DisabledFocus } from "../disabled-focus";
import { observeManagedAttrs } from "../neo-morph-resilient";

const RESILIENT_ATTRS = ["role", "tabindex", "aria-disabled"];

export class NeoButton extends HTMLElement {
	static readonly observedAttributes = ["disabled"];

	#disabledFocus = new DisabledFocus(this);
	#morphObserver: MutationObserver | null = null;

	connectedCallback() {
		this.#resync();
		this.addEventListener("keydown", this.#onKeyDown);
		this.addEventListener("click", this.#onClickCapture, true);
		// A button may host a dropdown <neo-menu> (it wires itself as the
		// trigger). Only 1 is supported.
		if (this.querySelectorAll(":scope > neo-menu").length > 1) {
			console.warn("<neo-button> expects at most one <neo-menu> child; extra menus are ignored.");
		}
		this.#morphObserver = observeManagedAttrs(this, RESILIENT_ATTRS, this.#resync);
	}

	disconnectedCallback() {
		this.removeEventListener("keydown", this.#onKeyDown);
		this.removeEventListener("click", this.#onClickCapture, true);
		this.#morphObserver?.disconnect();
		this.#morphObserver = null;
	}

	attributeChangedCallback(name: string) {
		if (name === "disabled") this.#disabledFocus.sync();
	}

	#resync = () => {
		if (!this.hasAttribute("role")) this.setAttribute("role", "button");
		this.#disabledFocus.sync();
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (boolAttr(this, "disabled", false)) return;
		if (e.defaultPrevented) return;
		if (e.key !== "Enter" && e.key !== " ") return;
		e.preventDefault();
		this.click();
	};

	// Swallow disabled clicks so downstream handlers (popover trigger etc.) don't fire.
	#onClickCapture = (e: MouseEvent) => {
		if (!boolAttr(this, "disabled", false)) return;
		e.stopImmediatePropagation();
		e.preventDefault();
	};
}

if (!customElements.get("neo-button")) {
	customElements.define("neo-button", NeoButton);
}
