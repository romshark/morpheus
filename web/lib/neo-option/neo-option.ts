// No behavior. Defining the element shows the options,
// which _placeholders.css hides while they are :not(:defined).
export class NeoOption extends HTMLElement {}

if (!customElements.get("neo-option")) {
	customElements.define("neo-option", NeoOption);
}
