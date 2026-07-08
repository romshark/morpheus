import { boolAttr } from "../command";
import { observeManagedAttrs, removeAttrIfPresent, setAttrIfChanged } from "../neo-morph-resilient";

const RESILIENT_ATTRS = ["role", "tabindex", "aria-disabled"];

export class NeoButton extends HTMLElement {
	static readonly observedAttributes = ["disabled"];

	#callerTabIndex: string | null = null;
	#morphObserver: MutationObserver | null = null;

	connectedCallback() {
		// A disabled host carries our own managed tabindex="-1". Never
		// capture that as the caller's preference: a fat-morph can
		// reconnect a still-disabled button, and restoring "-1" on
		// re-enable would silently drop it out of the tab order.
		this.#callerTabIndex = boolAttr(this, "disabled", false) ? null : this.getAttribute("tabindex");
		this.#resync();
		this.addEventListener("keydown", this.#onKeyDown);
		this.addEventListener("click", this.#onClickCapture, true);
		// A button may host a dropdown <neo-menu> (it wires itself as the
		// trigger). Exactly one is supported.
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
		if (name === "disabled") this.#syncDisabledState();
	}

	#resync = () => {
		if (!this.hasAttribute("role")) this.setAttribute("role", "button");
		this.#syncDisabledState();
	};

	#syncDisabledState() {
		if (boolAttr(this, "disabled", false)) {
			setAttrIfChanged(this, "aria-disabled", "true");
			setAttrIfChanged(this, "tabindex", "-1");
		} else {
			removeAttrIfPresent(this, "aria-disabled");
			// Composite widgets (navgroup etc.) manage tabindex themselves.
			setAttrIfChanged(this, "tabindex", this.#callerTabIndex ?? "0");
		}
	}

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
