// The header is CSS (::before with attr(label)) and role and aria-label
// are server-rendered. No JS-built subtree exists for a morph to strip.
// JS only mirrors label to aria-label.
export class NeoOptgroup extends HTMLElement {
	static readonly observedAttributes = ["label"];

	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (name !== "label") return;
		if (value) this.setAttribute("aria-label", value);
		else this.removeAttribute("aria-label");
	}
}

if (!customElements.get("neo-optgroup")) {
	customElements.define("neo-optgroup", NeoOptgroup);
}
