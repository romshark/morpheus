// Shadow DOM owns the markup (variant icon, body wrapper, close button) so a
// fat morph reaching <neo-toaster>'s children can't strip it; the user's
// title/description/action live in light DOM via named slots. Layout
// transforms are inline custom properties written by <neo-toaster> and
// inherited into the shadow.

import "../neo-icon";
import "../neo-spinner";

type ToastVariant = "default" | "success" | "error" | "warning" | "info" | "loading";

const VARIANT_ICON: Record<Exclude<ToastVariant, "default" | "loading">, string> = {
	success: "circle-check",
	error: "circle-x",
	warning: "triangle-alert",
	info: "info",
};

const TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - :host custom properties: shadow inherits these from the host; the toaster
//   writes them inline on the host to drive the Sonner pile. Declared here too
//   so a stand-alone <neo-toast> still renders.
// - :host(:not([variant])) [data-neo-toast-icon]: hide the icon slot entirely
//   when there's nothing to show.
// - [data-empty]: hide empty rows. data-empty is toggled from JS via slotchange
//   (CSS has no portable way to query whether a slot has assigned nodes;
//   :has-slotted is still behind flags in Safari/Firefox).
TEMPLATE.innerHTML = `
<style>
  :host {
    display: block;
    --toast-stack-index: 0;
    --toast-collapsed-offset: 0px;
    --toast-collapsed-scale: 1;
    --toast-expanded-offset: 0px;
  }
  :host([hidden]) { display: none; }
  :host(:focus) { outline: none; }

  [data-neo-toast-wrapper] {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.85rem 1rem;
    width: 100%;
    box-sizing: border-box;
    background: var(--neo-toast-bg);
    color: var(--neo-toast-fg);
    border: 1px solid var(--neo-toast-border);
    border-radius: var(--neo-toast-radius);
    box-shadow: var(--neo-toast-shadow);
  }

  [data-neo-toast-icon] {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.15rem;
    height: 1.15rem;
    margin-top: 0.05rem;
    color: var(--muted);
  }
  :host([variant="success"]) [data-neo-toast-icon] { color: var(--neo-toast-success); }
  :host([variant="error"]) [data-neo-toast-icon] { color: var(--neo-toast-error); }
  :host([variant="warning"]) [data-neo-toast-icon] { color: var(--neo-toast-warning); }
  :host([variant="info"]) [data-neo-toast-icon] { color: var(--neo-toast-info); }
  :host(:not([variant])) [data-neo-toast-icon],
  :host([variant="default"]) [data-neo-toast-icon] { display: none; }
  [data-neo-toast-icon] neo-icon { --neo-icon-size: 1.15rem; }

  [data-neo-toast-content] {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  [data-neo-toast-title] {
    font-weight: 600;
    font-size: 0.9rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  [data-neo-toast-description] {
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  [data-empty] { display: none; }

  [data-neo-toast-action] {
    flex-shrink: 0;
    align-self: center;
  }

  [data-neo-toast-close] {
    flex-shrink: 0;
    background: transparent;
    border: 1px solid transparent;
    color: var(--muted);
    cursor: pointer;
    padding: 0.15rem;
    border-radius: 0.35rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    line-height: 0;
    transition:
      color var(--neo-duration-hover, calc(120ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease),
      background var(--neo-duration-hover, calc(120ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease);
  }
  [data-neo-toast-close]:hover {
    color: var(--page-fg);
    background: color-mix(in srgb, var(--page-fg) 10%, transparent);
  }
  [data-neo-toast-close] neo-icon { --neo-icon-size: 0.95rem; }
  :host([dismissible="false"]) [data-neo-toast-close] { display: none; }
</style>
<div data-neo-toast-wrapper>
  <div data-neo-toast-icon aria-hidden="true">
    <slot name="icon"></slot>
  </div>
  <div data-neo-toast-content>
    <div data-neo-toast-title><slot name="title"></slot></div>
    <div data-neo-toast-description><slot name="description"></slot></div>
  </div>
  <div data-neo-toast-action><slot name="action"></slot></div>
  <button data-neo-toast-close type="button" aria-label="Dismiss notification">
    <neo-icon name="x"></neo-icon>
  </button>
</div>
`;

export class NeoToast extends HTMLElement {
	static readonly observedAttributes = ["variant"];

	#iconSlot!: HTMLSlotElement;
	#closeBtn!: HTMLButtonElement;
	#emptyTrackers: Array<[HTMLSlotElement, HTMLElement]> = [];

	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(TEMPLATE.content.cloneNode(true));
		this.#iconSlot = root.querySelector<HTMLSlotElement>("slot[name='icon']")!;
		this.#closeBtn = root.querySelector<HTMLButtonElement>("[data-neo-toast-close]")!;
		// Pair each "row" slot with its wrapper so we can collapse the row
		// when no light-DOM nodes were projected into the slot.
		for (const name of ["title", "description", "action"] as const) {
			const slot = root.querySelector<HTMLSlotElement>(`slot[name='${name}']`)!;
			const wrap = slot.parentElement!;
			this.#emptyTrackers.push([slot, wrap]);
		}
	}

	connectedCallback() {
		this.#syncDefaultIcon();
		this.#syncAriaLive();
		this.#closeBtn.addEventListener("click", this.#onCloseClick);
		for (const [slot, wrap] of this.#emptyTrackers) {
			const update = () => {
				wrap.toggleAttribute("data-empty", slot.assignedNodes().length === 0);
			};
			slot.addEventListener("slotchange", update);
			update();
		}
	}

	disconnectedCallback() {
		this.#closeBtn.removeEventListener("click", this.#onCloseClick);
	}

	attributeChangedCallback(name: string) {
		if (name !== "variant") return;
		this.#syncDefaultIcon();
		this.#syncAriaLive();
	}

	// Author-slotted icons stay as-is; otherwise we provide a default
	// variant icon as slot fallback content. Re-runs on variant change.
	#syncDefaultIcon(): void {
		if (this.#iconSlot.assignedElements().length > 0) return;
		const variant = (this.getAttribute("variant") ?? "default") as ToastVariant;
		// Replace any prior fallback children so a variant change swaps
		// the icon idempotently.
		while (this.#iconSlot.firstChild) this.#iconSlot.firstChild.remove();
		if (variant === "loading") {
			this.#iconSlot.appendChild(document.createElement("neo-spinner"));
		} else if (variant in VARIANT_ICON) {
			const icon = document.createElement("neo-icon");
			icon.setAttribute("name", VARIANT_ICON[variant as keyof typeof VARIANT_ICON]);
			this.#iconSlot.appendChild(icon);
		}
	}

	// Live-region semantics: only set if absent so authors can override.
	#syncAriaLive(): void {
		const variant = this.getAttribute("variant");
		if (!this.hasAttribute("role")) {
			this.setAttribute("role", variant === "error" ? "alert" : "status");
		}
		if (!this.hasAttribute("aria-live")) {
			this.setAttribute("aria-live", variant === "error" ? "assertive" : "polite");
		}
	}

	#onCloseClick = () => {
		this.dispatchEvent(new CustomEvent("neo-toast-close", { bubbles: true, composed: true }));
	};
}

if (!customElements.get("neo-toast")) {
	customElements.define("neo-toast", NeoToast);
}
