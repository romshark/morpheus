// Hover/focus tooltip on the same positioning primitives as <neo-popover>
// but with tooltip semantics: no focus stealing, no click dismissal,
// pointer-events: none, role="tooltip", aria-describedby on the trigger.
//
// Behavior lives in TooltipController so components can render the same
// bubble without registering this element; this class is the custom-element
// wrapper that forwards lifecycle and attribute changes to a controller
// bound to itself.

import { TooltipController } from "../tooltip-controller";

export class NeoTooltip extends HTMLElement {
	static readonly observedAttributes = ["open", "text", "placement"];

	#ctrl = new TooltipController(this);

	connectedCallback() {
		this.#ctrl.connect();
	}

	disconnectedCallback() {
		this.#ctrl.disconnect();
	}

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		this.#ctrl.attributeChanged(name, newValue);
	}

	show(): void {
		this.#ctrl.show();
	}

	hide(): void {
		this.#ctrl.hide();
	}

	reposition(): void {
		this.#ctrl.reposition();
	}
}

if (!customElements.get("neo-tooltip")) {
	customElements.define("neo-tooltip", NeoTooltip);
}
