import { boolCommand } from "../command";
import { ConditionGate } from "../condition-gate";
import { clampInt } from "../num";

export class NeoIfNetwork extends ConditionGate {
	static observedAttributes = ["online"];

	// Trails `navigator.onLine` by `delay`. `navigator.onLine` false is reliable;
	// true only means a LAN or router is reachable.
	#online = true;
	#delayTimer: number | null = null;

	override connectedCallback() {
		window.addEventListener("online", this.#onNetworkChange);
		window.addEventListener("offline", this.#onNetworkChange);
		// No delay on connect: a page loaded offline shows it at once.
		this.#online = navigator.onLine;
		super.connectedCallback();
	}

	disconnectedCallback() {
		window.removeEventListener("online", this.#onNetworkChange);
		window.removeEventListener("offline", this.#onNetworkChange);
		this.#clearDelayTimer();
	}

	protected holds(): boolean {
		const want = boolCommand(this, "online");
		return want === null || want === this.#online;
	}

	// Each event restarts the delay, so the change applies only after
	// `navigator.onLine` holds for the whole delay.
	// A drop shorter than the delay never shows.
	#onNetworkChange = () => {
		this.#clearDelayTimer();
		if (navigator.onLine === this.#online) return;
		const delay = clampInt(this.getAttribute("delay"), 0, Number.MAX_SAFE_INTEGER, 0);
		if (delay === 0) {
			this.#settle();
			return;
		}
		this.#delayTimer = window.setTimeout(this.#settle, delay);
	};

	#settle = () => {
		this.#delayTimer = null;
		this.#online = navigator.onLine;
		this.update();
	};

	#clearDelayTimer() {
		if (this.#delayTimer !== null) {
			window.clearTimeout(this.#delayTimer);
			this.#delayTimer = null;
		}
	}
}

if (!customElements.get("neo-if-network")) {
	customElements.define("neo-if-network", NeoIfNetwork);
}
