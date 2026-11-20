import { observeManagedAttrs, setAttrIfChanged } from "../neo-morph-resilient";

// The header is CSS (::before with attr(label)). JS mirrors label to aria-label
// and defaults role to "group", and re-applies both after a morph strips them.
// A server-rendered role stays.
export class NeoOptgroup extends HTMLElement {
	static readonly observedAttributes = ["label"];

	#ownsRole: boolean | null = null;
	#observer: MutationObserver | null = null;

	connectedCallback() {
		this.#ownsRole ??= !this.hasAttribute("role");
		this.#sync();
		this.#observer ??= observeManagedAttrs(this, ["role", "aria-label"], this.#sync);
	}

	disconnectedCallback() {
		this.#observer?.disconnect();
		this.#observer = null;
	}

	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (name !== "label") return;
		if (!value) this.removeAttribute("aria-label");
		this.#sync();
	}

	#sync = () => {
		if (this.#ownsRole) setAttrIfChanged(this, "role", "group");
		const label = this.getAttribute("label");
		if (label) setAttrIfChanged(this, "aria-label", label);
	};
}

if (!customElements.get("neo-optgroup")) {
	customElements.define("neo-optgroup", NeoOptgroup);
}
