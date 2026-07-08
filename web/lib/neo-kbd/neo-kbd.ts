import { formatKey } from "../platform";

export class NeoKbd extends HTMLElement {
	static observedAttributes = ["key"];

	// A fat-morph reconciles the glyph away: the authored source is the empty
	// <neo-kbd key="…">, so the patch strips the rendered text and fires no
	// lifecycle callback. Re-render whenever the light DOM is mutated back.
	#observer = new MutationObserver(() => this.#render());

	connectedCallback() {
		this.#render();
		this.#observer.observe(this, { childList: true, characterData: true, subtree: true });
	}

	disconnectedCallback() {
		this.#observer.disconnect();
	}

	attributeChangedCallback() {
		// Upgrade fires this before connectedCallback; let connect render first.
		if (this.isConnected) this.#render();
	}

	#render() {
		const key = this.getAttribute("key");
		// Without `key`, the author-provided content stands as-is.
		if (!key) return;
		const glyph = formatKey(key);
		// Write only on a real diff, so our own mutation can't loop the observer.
		if (this.textContent !== glyph) this.textContent = glyph;
	}
}

if (!customElements.get("neo-kbd")) {
	customElements.define("neo-kbd", NeoKbd);
}
