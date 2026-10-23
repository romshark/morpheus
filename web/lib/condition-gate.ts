// Base of the <neo-if-*> gates. Each gate's stylesheet hides the host
// until :state(match), so the wrong branch never flashes. A custom state,
// not an inline style: a morph strips a runtime style attribute and the
// branch would stay hidden.
//
// Each condition is a boolean command attribute (see command.ts),
// so the server can drive it: absent means no requirement.

import { setState } from "./internal-state";

export abstract class ConditionGate extends HTMLElement {
	#internals = this.attachInternals();

	// holds reports whether the gate's attributes hold now.
	// Not `matches`, which is Element.matches.
	protected abstract holds(): boolean;

	connectedCallback() {
		this.update();
	}

	attributeChangedCallback() {
		if (this.isConnected) this.update();
	}

	protected update() {
		setState(this.#internals, "match", this.holds());
	}
}
