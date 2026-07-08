import { boolAttr, boolCommand } from "../command";
import { observeManagedAttrs, removeAttrIfPresent, setAttrIfChanged } from "../neo-morph-resilient";

// `role` is already in observedAttributes so syncPressedState can swap
// aria-pressed/aria-checked when the role flips; the morph-resilience
// observer covers the strip case (role going from "button" to absent).
const RESILIENT_ATTRS = ["role", "tabindex", "aria-disabled", "aria-pressed", "aria-checked"];

export class NeoToggle extends HTMLElement {
	static readonly observedAttributes = ["pressed", "disabled", "role"];

	#morphObserver: MutationObserver | null = null;
	// Pressed intent; `pressed` is its reflection (see command). Survives a
	// morph that strips the attribute so a fat morph omitting `pressed` can't
	// reset the toggle.
	#pressedIntent = false;
	#reflectingPressed = false;

	connectedCallback() {
		// Explicit pressed / pressed="false" commands intent; absent keeps it.
		const cmd = boolCommand(this, "pressed");
		if (cmd !== null) this.#pressedIntent = cmd;
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

	attributeChangedCallback(name: string) {
		if (name === "disabled") this.#syncDisabledState();
		if (name === "role") this.#syncPressedState();
		if (name === "pressed") {
			if (this.#reflectingPressed) return;
			const cmd = boolCommand(this, "pressed");
			if (cmd !== null) this.#pressedIntent = cmd;
			// Absent re-asserts intent for the [pressed] CSS; explicit normalizes
			// the "true"/"false" form to bare / removed.
			this.#reflectPressed();
		}
	}

	get pressed(): boolean {
		return this.#pressedIntent;
	}

	set pressed(v: boolean) {
		this.#pressedIntent = v;
		this.#reflectPressed();
	}

	// State → attribute, guarded so it isn't read back as a command.
	#reflectPressed() {
		this.#reflectingPressed = true;
		try {
			if (this.#pressedIntent) {
				if (this.getAttribute("pressed") !== "") this.setAttribute("pressed", "");
			} else if (this.hasAttribute("pressed")) {
				this.removeAttribute("pressed");
			}
		} finally {
			this.#reflectingPressed = false;
		}
		this.#syncPressedState();
	}

	toggle(): void {
		if (boolAttr(this, "disabled", false)) return;
		this.pressed = !this.pressed;
		this.dispatchEvent(
			new CustomEvent("neo-toggle-change", {
				bubbles: true,
				detail: { pressed: this.pressed },
			}),
		);
	}

	#resync = () => {
		if (!this.hasAttribute("role")) this.setAttribute("role", "button");
		this.#syncDisabledState();
		this.#reflectPressed();
	};

	#syncPressedState() {
		const pressed = String(this.pressed);
		if (this.getAttribute("role") === "radio") {
			setAttrIfChanged(this, "aria-checked", pressed);
			removeAttrIfPresent(this, "aria-pressed");
		} else {
			setAttrIfChanged(this, "aria-pressed", pressed);
			removeAttrIfPresent(this, "aria-checked");
		}
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
}

if (!customElements.get("neo-toggle")) {
	customElements.define("neo-toggle", NeoToggle);
}
