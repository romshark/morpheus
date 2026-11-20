// Shadow DOM owns the markup (variant icon, body wrapper, close button) so a
// fat morph reaching <neo-toaster>'s children can't strip it; the user's
// title/description/action live in light DOM via named slots.
// <neo-toaster> writes the stack layout into the toast's :host rule and its
// stack state into the toast's custom states, both out of a morph's reach.

import "../neo-icon";
import "../neo-spinner";
import { attachHostStyle, type HostStyle } from "../host-style";
import { setState } from "../internal-state";
import { labelAttr } from "../label-name";
import { observeManagedAttrs, setAttrIfChanged } from "../neo-morph-resilient";

type ToastVariant = "default" | "success" | "error" | "warning" | "info" | "loading";

export type ToastStackState = "mounted" | "leaving" | "hidden" | "dragging" | "swipe-dismiss";

const VARIANT_ICON: Record<Exclude<ToastVariant, "default" | "loading">, string> = {
	success: "circle-check",
	error: "circle-x",
	warning: "triangle-alert",
	info: "info",
};

const TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - :host custom properties: defaults for a stand-alone <neo-toast>.
//   The toaster overrides them through setStackProperty to lay out the Sonner pile.
// - :host(:not([variant])) [data-neo-toast-icon]: hide the icon slot entirely
//   when there's nothing to show.
// - [data-empty]: hide empty rows. data-empty is toggled from JS via slotchange
//   (CSS has no portable way to query whether a slot has assigned nodes;
//   :has-slotted is still behind flags in Safari/Firefox).
// - [data-neo-toast-close] tabindex="0": Safari's default Tab order skips a
//   <button> without an explicit tabindex.
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
  <button data-neo-toast-close type="button" tabindex="0">
    <neo-icon name="x"></neo-icon>
  </button>
</div>
`;

export class NeoToast extends HTMLElement {
	static readonly observedAttributes = ["variant", "dismiss-label"];

	#internals: ElementInternals;
	#hostStyle: HostStyle;
	#iconSlot!: HTMLSlotElement;
	#closeBtn!: HTMLButtonElement;
	#emptyTrackers: Array<[HTMLSlotElement, HTMLElement]> = [];
	#ariaObserver: MutationObserver | null = null;
	// The last role and aria-live this wrote.
	// A different present value is the author's and stays.
	#writtenRole: string | null = null;
	#writtenLive: string | null = null;

	constructor() {
		super();
		this.#internals = this.attachInternals();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(TEMPLATE.content.cloneNode(true));
		this.#hostStyle = attachHostStyle(root);
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
		this.#ariaObserver ??= observeManagedAttrs(this, ["role", "aria-live"], this.#syncAriaLive);
		this.#syncDismissLabel();
		for (const [slot, wrap] of this.#emptyTrackers) {
			const update = () => {
				wrap.toggleAttribute("data-empty", slot.assignedNodes().length === 0);
			};
			slot.addEventListener("slotchange", update);
			update();
		}
	}

	disconnectedCallback() {
		this.#ariaObserver?.disconnect();
		this.#ariaObserver = null;
	}

	setStackState(name: ToastStackState, on: boolean): void {
		setState(this.#internals, name, on);
	}

	hasStackState(name: ToastStackState): boolean {
		return this.#internals.states.has(name);
	}

	// Sets a `--toast-*` layout property, or removes it for null.
	setStackProperty(name: `--toast-${string}`, value: string | null): void {
		if (value === null) this.#hostStyle.removeProperty(name);
		else this.#hostStyle.setProperty(name, value);
	}

	attributeChangedCallback(name: string) {
		if (name === "dismiss-label") {
			this.#syncDismissLabel();
			return;
		}
		this.#syncDefaultIcon();
		this.#syncAriaLive();
	}

	#syncDismissLabel(): void {
		this.#closeBtn.setAttribute("aria-label", labelAttr(this, "dismiss-label", "Dismiss notification"));
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

	#syncAriaLive = (): void => {
		const error = this.getAttribute("variant") === "error";
		this.#writtenRole = this.#writeDefault("role", error ? "alert" : "status", this.#writtenRole);
		this.#writtenLive = this.#writeDefault("aria-live", error ? "assertive" : "polite", this.#writtenLive);
	};

	// Writes value where the attribute is absent or still holds the last write,
	// and returns the attribute's value when it is this component's.
	#writeDefault(name: string, value: string, written: string | null): string | null {
		const cur = this.getAttribute(name);
		if (cur !== null && cur !== written) return null;
		setAttrIfChanged(this, name, value);
		return value;
	}
}

if (!customElements.get("neo-toast")) {
	customElements.define("neo-toast", NeoToast);
}
