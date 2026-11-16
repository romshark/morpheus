import { boolAttr } from "./command";
import { setAttrIfChanged } from "./neo-morph-resilient";

// DisabledFocus mirrors a focusable host's `disabled` into aria-disabled and tabindex.
// `disabled` swaps tabindex for "-1" and puts the replaced value back when it clears.
// Any other tabindex stays as found, because a composite such as <neo-navgroup> moves
// its roving tab stop by writing tabindex on its items.
// Only a missing tabindex gets the default "0".
export class DisabledFocus {
	#host: HTMLElement;
	#synced = false;
	#disabled = false;
	// The tabindex `disabled` replaced. null when the host is disabled at its
	// first sync, where a "-1" in the markup is the server's prerender of the
	// disabled state, not a caller's value.
	#replaced: string | null = null;

	constructor(host: HTMLElement) {
		this.#host = host;
	}

	// sync is idempotent, which lets an observeManagedAttrs resync call it.
	sync(): void {
		const host = this.#host;
		if (boolAttr(host, "disabled", false)) {
			if (!this.#disabled) {
				this.#disabled = true;
				this.#replaced = this.#synced ? host.getAttribute("tabindex") : null;
			}
			setAttrIfChanged(host, "aria-disabled", "true");
			setAttrIfChanged(host, "tabindex", "-1");
		} else {
			host.removeAttribute("aria-disabled");
			if (this.#disabled) {
				this.#disabled = false;
				setAttrIfChanged(host, "tabindex", this.#replaced ?? "0");
			} else if (!host.hasAttribute("tabindex")) {
				host.setAttribute("tabindex", "0");
			}
		}
		this.#synced = true;
	}
}
