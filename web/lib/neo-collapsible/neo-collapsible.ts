// The summary button and the animated panel render in the shadow root, which
// a morph can't reach. The summary label and the content stay in light DOM,
// assigned to the summary and default slots, where a morph reconciles them.

import { boolCommand } from "../command";
import { retryWhileParsing } from "../document-parsing";
import { setState } from "../internal-state";

const TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops them.
// Anchored by selector:
// - [data-neo-collapsible-summary]: a role="button" with tabindex, not a <button>.
//   Safari's default Tab order skips <button> but stops on an element with tabindex.
//   The z-index keeps its focus ring over the content below, which paints later.
// - [data-neo-collapsible-panel]: the grid 0fr -> 1fr transition animates to
//   the content height without measuring it.
// - [data-neo-collapsible-content] overflow: clip, not hidden. A hidden box
//   is a scroll container, and find-in-page would scroll the match inside
//   the 0-height box and leave the content scrolled once open.
// - :state(moving): set while the panel transitions. Open content unclips
//   once it settles, which keeps focus rings in the content whole.
// - :state(instant): no transition, for the first render and for an open by
//   find-in-page, which scrolls to the match right after it opens.
// - slot[name="summary-open"]: replaces the summary slot while open,
//   if it has nodes, which :state(has-summary-open) tracks.
// - durations: scaled by --neo-duration-scale, which reduced motion sets to 0.
TEMPLATE.innerHTML = `
<style>
  :host {
    --_duration: calc(var(--neo-collapsible-duration, 200ms) * var(--neo-duration-scale, 1));
    --_easing: var(--neo-easing, ease);
    display: block;
  }
  [data-neo-collapsible-summary] {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--neo-collapsible-gap, calc(var(--page-spacing, 0.25rem) * 2));
    padding: var(--neo-collapsible-summary-padding, calc(var(--page-spacing, 0.25rem) * 2) 0);
    border-radius: calc(var(--page-radius, 0.625rem) * 0.4);
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  [data-neo-collapsible-summary]:focus-visible {
    outline: 2px solid var(--neo-collapsible-focus-ring, var(--focus-ring, var(--accent, Highlight)));
    outline-offset: 2px;
  }
  [data-neo-collapsible-label] {
    flex: 1 1 auto;
    min-width: 0;
  }
  [data-neo-collapsible-icon] {
    flex: none;
    width: var(--neo-collapsible-icon-size, 1em);
    height: var(--neo-collapsible-icon-size, 1em);
    color: var(--neo-collapsible-icon-color, var(--muted, currentColor));
    transition: rotate var(--_duration) var(--_easing);
  }
  :host([open]:not([open="false"])) [data-neo-collapsible-icon] {
    rotate: 180deg;
  }
  [data-neo-collapsible-panel] {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows var(--_duration) var(--_easing);
  }
  :host([open]:not([open="false"])) [data-neo-collapsible-panel] {
    grid-template-rows: 1fr;
  }
  [data-neo-collapsible-content] {
    min-height: 0;
    overflow: clip;
  }
  :host([open]:not([open="false"]):not(:state(moving))) [data-neo-collapsible-content] {
    overflow: visible;
  }
  :host(:state(instant)) :is([data-neo-collapsible-icon], [data-neo-collapsible-panel]) {
    transition: none;
  }
  :host(:is(:not([open]), [open="false"])) slot[name="summary-open"],
  :host([open]:not([open="false"]):state(has-summary-open)) slot[name="summary"] {
    display: none;
  }
</style>
<div role="button" tabindex="0" data-neo-collapsible-summary part="summary" aria-expanded="false" aria-controls="panel">
  <span data-neo-collapsible-label><slot name="summary"></slot><slot name="summary-open"></slot></span>
  <svg data-neo-collapsible-icon part="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6"/>
  </svg>
</div>
<div data-neo-collapsible-panel part="panel" id="panel">
  <div data-neo-collapsible-content hidden="until-found"><slot></slot></div>
</div>
`;

export class NeoCollapsible extends HTMLElement {
	static readonly observedAttributes = ["open"];

	#internals: ElementInternals;
	#summary: HTMLElement;
	#icon: SVGElement;
	#panel: HTMLElement;
	#content: HTMLElement;
	// Source of truth for the state. `open` mirrors it,
	// and a morph that strips `open` leaves the element as it is.
	#open = false;
	#reflecting = false;
	#connected = false;
	// Counts renders, which lets a transition that ends after
	// a newer render skip its cleanup.
	#renders = 0;

	constructor() {
		super();
		this.#internals = this.attachInternals();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(TEMPLATE.content.cloneNode(true));
		this.#summary = root.querySelector("[data-neo-collapsible-summary]") as HTMLElement;
		this.#icon = root.querySelector("[data-neo-collapsible-icon]") as SVGElement;
		this.#panel = root.querySelector("[data-neo-collapsible-panel]") as HTMLElement;
		this.#content = root.querySelector("[data-neo-collapsible-content]") as HTMLElement;
		// The host and its shadow outlive a morph and a reconnect,
		// which lets these listeners bind once.
		this.#summary.addEventListener("click", () => this.#set(!this.#open, true));
		// Native <button> keys: Enter acts on keydown, Space on keyup, and
		// Space doesn't scroll the page.
		this.#summary.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				if (!e.repeat) this.#set(!this.#open, true);
			} else if (e.key === " ") {
				e.preventDefault();
			}
		});
		this.#summary.addEventListener("keyup", (e) => {
			if (e.key === " ") this.#set(!this.#open, true);
		});
		// Find-in-page or a text fragment matched closed content.
		this.#content.addEventListener("beforematch", () => this.#set(true, false));
		const summaryOpen = root.querySelector('slot[name="summary-open"]') as HTMLSlotElement;
		summaryOpen.addEventListener("slotchange", () =>
			setState(this.#internals, "has-summary-open", summaryOpen.assignedNodes().length > 0),
		);
	}

	connectedCallback() {
		this.#connected = true;
		const cmd = boolCommand(this, "open");
		if (cmd !== null) this.#open = cmd;
		this.#render(false);
		// Elements connect in page order, which leaves the last one rendered
		// open as the open one, as a later open by click or morph would.
		const closed = this.#open ? this.#closeGroup(false) : [];
		if (closed.length > 0) {
			console.warn(
				`<neo-collapsible>: another element with name="${this.getAttribute("name")}" was already open. This one stays open and closed it.`,
				this,
				...closed,
			);
		}
		this.#checkSummary();
	}

	disconnectedCallback() {
		this.#connected = false;
	}

	attributeChangedCallback() {
		// Before the first connect, connectedCallback reads the attribute.
		if (this.#reflecting || !this.#connected) return;
		const cmd = boolCommand(this, "open");
		// Absent keeps the state and re-asserts `open` for CSS.
		// A repeated command normalizes "true" to bare `open` and "false" to absent.
		if (cmd === null || cmd === this.#open) {
			this.#reflect();
			return;
		}
		this.#open = cmd;
		this.#render(true);
		if (cmd) this.#closeGroup(true);
	}

	// Changes the state from a source other than the element's own `open`
	// attribute and fires the toggle event.
	#set(open: boolean, animate: boolean) {
		if (open === this.#open) return;
		this.#open = open;
		this.#render(animate);
		this.dispatchEvent(
			new CustomEvent("neo-collapsible-toggle", {
				bubbles: true,
				composed: true,
				detail: { open, item: this },
			}),
		);
		if (open) this.#closeGroup(animate);
	}

	// Closes the other open elements with the same name in this document or
	// shadow root, as an exclusive <details name> group does, and returns the
	// elements it closed.
	#closeGroup(animate: boolean): NeoCollapsible[] {
		const closed: NeoCollapsible[] = [];
		const name = this.getAttribute("name");
		if (!name) return closed;
		const root = this.getRootNode();
		if (!(root instanceof Document || root instanceof ShadowRoot)) return closed;
		for (const el of root.querySelectorAll(`neo-collapsible[name="${CSS.escape(name)}"]`)) {
			if (el === this || !(el instanceof NeoCollapsible) || !el.#open) continue;
			el.#set(false, animate);
			closed.push(el);
		}
		return closed;
	}

	#render(animate: boolean) {
		this.#reflect();
		const open = this.#open;
		const render = ++this.#renders;
		this.#summary.setAttribute("aria-expanded", String(open));
		if (!open && this.#focusInContent()) this.#summary.focus({ preventScroll: true });
		if (open) this.#content.removeAttribute("hidden");
		// Closing content leaves the tab order and the accessibility tree at once.
		// hidden="until-found" follows when the transition ends, because it collapses
		// the content box, and inert would hide the content from find-in-page.
		this.#content.inert = !open;
		if (!animate) {
			setState(this.#internals, "instant", true);
			// Computes the end state with no transition,
			// which keeps the next style change from animating to it.
			// The resolved grid-template-rows would also force a layout.
			void getComputedStyle(this.#panel).transitionProperty;
			void getComputedStyle(this.#icon).rotate;
			setState(this.#internals, "instant", false);
		}
		const running = this.#panel.getAnimations();
		setState(this.#internals, "moving", running.length > 0);
		Promise.all(running.map((a) => a.finished)).then(
			() => {
				if (render !== this.#renders) return;
				setState(this.#internals, "moving", false);
				if (open) return;
				this.#content.inert = false;
				this.#content.setAttribute("hidden", "until-found");
			},
			// A newer render cancelled the transition and owns the cleanup.
			() => {},
		);
	}

	// Focus inside the content would fall back to <body> once it is inert.
	// A focused shadow control reports the host, and a nested kit element
	// reports itself, which `contains` still finds.
	#focusInContent(): boolean {
		const active = document.activeElement;
		return active !== null && active !== this && this.contains(active);
	}

	// State -> attribute, guarded so it isn't read back as a command.
	#reflect() {
		if (this.getAttribute("open") === (this.#open ? "" : null)) return;
		this.#reflecting = true;
		try {
			if (this.#open) this.setAttribute("open", "");
			else this.removeAttribute("open");
		} finally {
			this.#reflecting = false;
		}
	}

	#checkSummary() {
		if (this.querySelector(':scope > [slot="summary"]')) return;
		if (retryWhileParsing(this, () => this.#checkSummary())) return;
		console.warn('<neo-collapsible>: no child with slot="summary", which leaves the button unnamed.');
	}
}

if (!customElements.get("neo-collapsible")) {
	customElements.define("neo-collapsible", NeoCollapsible);
}
