// Hover/focus tooltip on the same positioning primitives as <neo-popover>
// but with tooltip semantics (no focus stealing, no click dismissal,
// pointer-events: none, role="tooltip", aria-describedby on the trigger).
//
// Behavior lives in TooltipController so components can render the same
// bubble without registering this element; this class is the custom-element
// wrapper that forwards lifecycle and attribute changes to a controller
// bound to itself.

import { assignChildren, attachSlotRoot } from "../slot-root";
import { TooltipController } from "../tooltip-controller";

// The controller positions the shadow panel, not the content,
// because the content is page markup whose `style` the server owns.
// The content renders in the panel through the "content" slot.
const SHADOW_HTML = `<style>
[data-neo-tooltip-panel] {
	position: fixed;
	top: 0;
	left: 0;
	z-index: var(--neo-tooltip-z-index, 1100);
	pointer-events: none;
}
</style><slot></slot><div data-neo-tooltip-panel><slot name="content"></slot></div>`;

export class NeoTooltip extends HTMLElement {
	static readonly observedAttributes = ["open", "text", "placement"];

	#ctrl: TooltipController;
	#slot: HTMLSlotElement;
	#contentSlot: HTMLSlotElement;
	#childObserver: MutationObserver | null = null;

	constructor() {
		super();
		this.#slot = attachSlotRoot(this, SHADOW_HTML);
		const root = this.shadowRoot!;
		this.#contentSlot = root.querySelector<HTMLSlotElement>('slot[name="content"]')!;
		this.#ctrl = new TooltipController(this, root.querySelector<HTMLElement>("[data-neo-tooltip-panel]"));
	}

	connectedCallback() {
		// connect() may append the content span generated from `text`.
		this.#ctrl.connect();
		this.#assign();
		this.#childObserver = new MutationObserver(() => this.#assign());
		this.#childObserver.observe(this, { childList: true });
	}

	disconnectedCallback() {
		this.#ctrl.disconnect();
		this.#childObserver?.disconnect();
		this.#childObserver = null;
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

	#assign(): void {
		const content = this.querySelector<HTMLElement>(":scope > [data-neo-tooltip-content]");
		assignChildren(this, this.#slot, content ? new Set([content]) : undefined);
		this.#contentSlot.assign(...(content ? [content] : []));
	}
}

if (!customElements.get("neo-tooltip")) {
	customElements.define("neo-tooltip", NeoTooltip);
}
