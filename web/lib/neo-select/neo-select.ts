// Shadow DOM owns the trigger/panel/scroll shell. Light DOM stays the
// option/template source and is projected into the shell, so rich option
// content keeps its real custom-element lifecycle instead of being cloned.

import { boolAttr } from "../command";
import { NavEngine } from "../nav-engine";
import { NeoListbox, POPOVER_ATTRS } from "../neo-listbox";
import { deepActiveElement } from "../shadow-utils";

const SELECT_SHADOW_TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - [data-neo-select-trigger] box-shadow: contrast-more edge. Inherited
//   no-op shadow until prefers-contrast, then a 1px inset ring; avoids the
//   reflow a wider border would cause.
// - [data-neo-select-trigger]:focus: ring lives on :host, not the trigger.
//   A trigger ring would be clipped by a host overflow:hidden (e.g. inside
//   neo-input-group). JS mirrors the trigger's :focus-visible onto the host
//   via the attribute.
// - :host([data-neo-focus-visible]): radius matches the trigger so the host
//   ring rounds like neo-button's; --neo-button-radius is 0 inside
//   neo-input-group, keeping it square there.
// - [data-neo-select-trigger]:disabled: the trigger's native disabled flag
//   (host `disabled` or a containing <fieldset disabled>) fades it and blocks
//   pointer/hover; :host([disabled]) adds the not-allowed cursor. The disabled
//   button already drops focus and swallows clicks/keys.
// - [data-neo-select-trigger-slot]: rich trigger face. When the kit (or an
//   author slot="trigger" child) fills the trigger with markup, swap the
//   text label for the slot and let the trigger grow to fit a multi-line card.
// - :host([data-neo-trigger-rich]): sizes to the cloned card (host auto,
//   trigger auto); floor both at the single-line control height so a short
//   card isn't shorter than a plain trigger.
// - :host([popover-fit-content]) [data-neo-select-list]: size to the option
//   rows instead of forcing the trigger width, capped like max-width.
// - [data-neo-select-options] gap: options slot straight in (bare, or via a
//   display:contents <neo-datalist> container), so the row gap lives here.
// - ::slotted([hidden]): the inline <neo-datalist> source is hidden while its
//   async placeholder is cloned into the loading slot. !important beats the
//   component/source display rules so the template does not render alongside
//   its clone.
// - [data-neo-select-empty-message], ::slotted([slot="loading"]): reset the
//   cursor:pointer inherited from [data-neo-select-list]; these are static
//   status messages, not clickable rows. Loading content is projected light
//   DOM so authors can style its layout.
SELECT_SHADOW_TEMPLATE.innerHTML = `
<style>
  :host {
    display: inline-block;
    --neo-select-min-width: 12rem;
  }
  :host([hidden]) { display: none; }
  button { font: inherit; }
  [data-neo-select-trigger] {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: var(--neo-select-min-width);
    width: 100%;
    height: 100%;
    padding: var(--neo-button-padding, 0.45rem 0.75rem);
    border: var(--neo-button-border-width, 1px) solid var(--neo-button-border-color, rgba(0, 0, 0, 0.16));
    border-radius: var(--neo-button-radius, var(--page-radius, 0.5rem));
    background: var(--neo-button-bg, var(--btn-bg, #fff));
    color: var(--neo-button-color, var(--page-fg, #111));
    box-shadow: var(--neo-contrast-ring, 0 0 0 0 transparent);
    line-height: 1;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    box-sizing: border-box;
    transition:
      background-color var(--neo-duration-hover, calc(120ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease),
      border-color var(--neo-duration-hover, calc(120ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease);
  }
  [data-neo-select-trigger]:hover {
    background: var(--neo-button-hover-bg, rgba(0, 0, 0, 0.04));
  }
  [data-neo-select-trigger]:focus,
  [data-neo-select-trigger]:focus-visible {
    outline: none;
  }
  :host([data-neo-focus-visible]) {
    outline: 2px solid var(--neo-button-focus-ring, currentColor);
    outline-offset: 2px;
    border-radius: var(--neo-button-radius, var(--page-radius, 0.5rem));
  }
  :host([disabled]:not([disabled="false"])) { cursor: not-allowed; }
  [data-neo-select-trigger]:disabled {
    opacity: 0.55;
    background-image: var(--neo-disabled-overlay);
    pointer-events: none;
  }
  [data-neo-select-label] {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: var(--neo-select-option-gap, 0.5rem);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    line-height: 1.3;
    margin-block: -0.15em;
  }
  [data-neo-select-trigger-slot] { display: none; }
  :host([data-neo-trigger-rich]) [data-neo-select-label] { display: none; }
  :host([data-neo-trigger-rich]) [data-neo-select-trigger-slot] {
    display: block;
    flex: 1 1 auto;
    min-width: 0;
  }
  :host([data-neo-trigger-rich]) { min-height: var(--neo-control-height); }
  :host([data-neo-trigger-rich]) [data-neo-select-trigger] { height: auto; }
  [data-neo-select-caret] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 1em;
    height: 1em;
    opacity: 0.6;
    margin-left: 0.5rem;
  }
  [data-neo-select-list] {
    position: fixed;
    top: 0;
    left: 0;
    min-width: var(--neo-select-min-width);
    max-width: min(var(--neo-popover-max-width, 22rem), calc(100vw - 1rem));
    max-height: calc(100dvh - 1rem);
    overflow: auto;
    overscroll-behavior: none;
    padding: 0.25rem;
    box-sizing: border-box;
    background: var(--neo-popover-bg, #ffffff);
    color: var(--neo-popover-color, var(--page-fg, #111827));
    border: var(--neo-popover-border-width, 1px) solid var(--neo-popover-border-color, rgba(0, 0, 0, 0.08));
    border-radius: var(--neo-popover-radius, var(--page-radius, 0.25rem));
    box-shadow: var(--neo-popover-shadow, 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05));
    z-index: var(--neo-popover-z-index, 1000);
    cursor: pointer;
    opacity: 1;
    transform: none;
    transition:
      opacity var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease-out),
      transform var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease-out),
      display var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) allow-discrete;
  }
  :host([popover-fit-content]:not([popover-fit-content="false"])) [data-neo-select-list] {
    /* The positioner leaves width unset in this mode, so size to the option
       rows, floored by min-width (trigger width) and capped by max-width. */
    width: max-content;
  }
  [data-neo-select-list][hidden] {
    display: none;
    opacity: 0;
    transform: translateY(-4px);
  }
  @starting-style {
    [data-neo-select-list]:not([hidden]) {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-neo-select-list] { transition: none; }
  }
  [data-neo-select-options] {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: var(--neo-navgroup-gap, 0.5rem);
  }
  ::slotted([data-neo-select-options]) {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: var(--neo-navgroup-gap, 0.5rem);
  }
  ::slotted([hidden]) {
    display: none !important;
  }
  [data-neo-select-empty-message] { cursor: default; }
  ::slotted([slot="loading"]) { cursor: default; }
  [data-neo-select-empty-message] {
    padding: var(--neo-select-option-padding, 0.4rem 0.6rem);
  }
  [data-neo-select-loading][hidden],
  [data-neo-select-empty-message][hidden] {
    display: none !important;
  }
</style>
<button type="button" data-neo-select-trigger aria-haspopup="listbox" aria-expanded="false">
  <span part="label" data-neo-select-label></span>
  <slot name="trigger" data-neo-select-trigger-slot></slot>
  <neo-icon name="chevrons-up-down" part="caret" data-neo-select-caret aria-hidden="true"></neo-icon>
</button>
<div data-neo-select-list role="listbox" tabindex="-1" hidden>
  <div data-neo-select-loading hidden><slot name="loading"></slot></div>
  <div data-neo-select-empty-message hidden>No options</div>
  <div data-neo-select-options>
    <slot name="options"></slot>
  </div>
</div>
`;

export class NeoOption extends HTMLElement {}

if (!customElements.get("neo-option")) {
	customElements.define("neo-option", NeoOption);
}

// <neo-optgroup>: declarative section wrapper. The visual header lives
// in CSS (`::before { content: attr(label) }`), and role/aria-label are
// server-rendered, so the element has no JS-managed subtree that a
// morph could strip and re-add. Sync aria-label when the label attr
// changes after hydration.
export class NeoOptgroup extends HTMLElement {
	static readonly observedAttributes = ["label"];

	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (name !== "label") return;
		if (value) this.setAttribute("aria-label", value);
		else this.removeAttribute("aria-label");
	}
}

if (!customElements.get("neo-optgroup")) {
	customElements.define("neo-optgroup", NeoOptgroup);
}

export class NeoSelect extends NeoListbox {
	static readonly observedAttributes = [
		"value",
		"open",
		"disabled",
		"placeholder",
		"aria-label",
		"caret",
		"list",
		...POPOVER_ATTRS,
	];

	protected readonly ns = "select";

	#loadingEl!: HTMLElement;
	#emptyEl!: HTMLElement;
	#optionsSlot!: HTMLSlotElement;
	#emptyTemplateEl: HTMLElement | null = null;
	#nav: NavEngine;

	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(SELECT_SHADOW_TEMPLATE.content.cloneNode(true));
		// Shared keyboard engine for typeahead + Home/End over the options.
		// Arrow nav stays in onOptionKeyDown so it works regardless of
		// orientation; the engine adds typeahead + Home/End.
		this.#nav = new NavEngine({
			host: this,
			getItems: () => this.optionEls().filter((el) => el.getAttribute("aria-disabled") !== "true" && !el.hidden),
			onMove: (item) => item.scrollIntoView({ block: "nearest" }),
			typeaheadEnabled: () => boolAttr(this, "typeahead", true),
		});
	}

	connectedCallback() {
		if (this.ready) return;
		this.defaultValue = this.getAttribute("value");
		this.trigger = this.shadowRoot!.querySelector("[data-neo-select-trigger]")!;
		this.labelEl = this.shadowRoot!.querySelector("[data-neo-select-label]")!;
		this.listEl = this.shadowRoot!.querySelector("[data-neo-select-list]")!;
		this.#optionsSlot = this.shadowRoot!.querySelector('slot[name="options"]')!;
		this.#loadingEl = this.shadowRoot!.querySelector("[data-neo-select-loading]")!;
		this.#emptyEl = this.shadowRoot!.querySelector("[data-neo-select-empty-message]")!;
		this.caretEl = this.shadowRoot!.querySelector("[data-neo-select-caret]")!;
		this.initTriggerFace();

		this.trigger.addEventListener("click", this.#onTriggerClick);
		this.trigger.addEventListener("keydown", this.#onTriggerKeyDown);
		this.trigger.addEventListener("focus", this.onTriggerFocus);
		this.trigger.addEventListener("blur", this.onTriggerBlur);
		this.listEl.addEventListener("click", this.#onOptionClick);
		this.listEl.addEventListener("keydown", this.#onOptionKeyDown);
		this.#optionsSlot.addEventListener("slotchange", this.#onOptionsSlotChange);
		this.wireHoverOpen();
		this.addEventListener("keydown", this.onEscapeKeyDown);
		this.addEventListener("focusin", this.#onHostFocusIn);
		this.addEventListener("click", this.#onHostClick);
		this.#nav.attach();
		document.addEventListener("pointerdown", this.onDocPointerDown, true);
		document.addEventListener("focusin", this.onDocFocusIn, true);
		window.addEventListener("resize", this.reposition);
		window.addEventListener("scroll", this.onWindowScroll, true);
		// visualViewport.resize/scroll cover pinch-zoom and the iOS
		// virtual-keyboard inset; neither fires window.resize.
		window.visualViewport?.addEventListener("resize", this.reposition);
		window.visualViewport?.addEventListener("scroll", this.reposition);

		this.observer = new MutationObserver(this.#onLightDomMutation);
		this.observePanelResize();
		this.ready = true;
		this.syncCaret();
		this.withLightDomObserverPaused(() => {
			this.#cacheTemplates();
			this.#syncA11y();
			this.#syncOptionSlot();
			this.#syncOptions();
			this.#applyValueFromAttr();
		});
		this.syncDisabledState();
		// Read options from the external <neo-datalist> this host's list="<id>"
		// points at; its DOM writes reconcile through the light-DOM observer.
		this.syncDatalist();
		this.applyOpenCommand();
	}

	disconnectedCallback() {
		this.observer?.disconnect();
		this.observer = null;
		this.observerPauseDepth = 0;
		this.disconnectPanelResize();
		this.trigger?.removeEventListener("click", this.#onTriggerClick);
		this.trigger?.removeEventListener("keydown", this.#onTriggerKeyDown);
		this.trigger?.removeEventListener("focus", this.onTriggerFocus);
		this.trigger?.removeEventListener("blur", this.onTriggerBlur);
		this.listEl?.removeEventListener("click", this.#onOptionClick);
		this.listEl?.removeEventListener("keydown", this.#onOptionKeyDown);
		this.#optionsSlot?.removeEventListener("slotchange", this.#onOptionsSlotChange);
		this.unwireHoverOpen();
		this.removeEventListener("keydown", this.onEscapeKeyDown);
		this.removeEventListener("focusin", this.#onHostFocusIn);
		this.removeEventListener("click", this.#onHostClick);
		this.#nav.detach();
		document.removeEventListener("pointerdown", this.onDocPointerDown, true);
		document.removeEventListener("focusin", this.onDocFocusIn, true);
		window.removeEventListener("resize", this.reposition);
		window.removeEventListener("scroll", this.onWindowScroll, true);
		window.visualViewport?.removeEventListener("resize", this.reposition);
		window.visualViewport?.removeEventListener("scroll", this.reposition);
	}

	attributeChangedCallback(name: string) {
		if (!this.ready) return;
		if (name === "open") {
			this.applyOpenCommand();
			return;
		}
		if (name === "disabled") {
			this.syncDisabledState();
			return;
		}
		if (name === "value") {
			if (!this.applyingValue) this.#applyValueFromAttr();
			return;
		}
		if (name === "placeholder" || name === "aria-label") {
			this.#syncA11y();
			this.#applyValueFromAttr();
			return;
		}
		if (name === "caret") {
			this.syncCaret();
			return;
		}
		if (name === "list") {
			this.syncDatalist();
			return;
		}
		if (this.open) this.position();
	}

	get value(): string | null {
		return this.getAttribute("value");
	}

	set value(v: string | null) {
		if (v === null) this.removeAttribute("value");
		else this.setAttribute("value", v);
	}

	show(opts: { focus?: boolean; scrollIntoView?: boolean } = {}): void {
		if (this.isDisabled()) return;
		if (this.open) return;
		this.open = true;
		this.reflectOpen();
		this.trigger.setAttribute("aria-expanded", "true");
		this.listEl.hidden = false;
		this.#prepareOpenState();
		this.#syncOptions();
		const scrollIntoView = opts.scrollIntoView ?? opts.focus !== false;
		if (!this.position({ scrollIntoView })) return;
		this.#dispatchOpen();
		// `loading` means options need fetching now: `async` (every open)
		// or a lazy select's first open. Fire the load request only then;
		// neo-popover-open stays honest as "panel opened", nothing more, so
		// a wired-up lazy select doesn't re-fetch (and re-morph) on reopen.
		if (this.loading) this.#dispatchLoad();
		// Hover-open passes focus:false so it can't pull the caret out of
		// whatever the user is typing in.
		if (opts.focus !== false) queueMicrotask(() => this.#focusInitialOption());
	}

	hide(opts: { restoreFocus?: boolean } = {}): void {
		if (!this.open) return;
		this.cancelOpenScrollPositioning();
		this.open = false;
		this.loading = false;
		this.reflectClosed();
		this.trigger.setAttribute("aria-expanded", "false");
		this.listEl.hidden = true;
		this.#syncOptions();
		this.lastFocusedOptionValue = null;
		this.dispatchEvent(new CustomEvent("neo-popover-close", { bubbles: true }));
		if (opts.restoreFocus) {
			// The trigger lives in the shadow root; document.activeElement
			// read from outside the shadow only ever returns the host,
			// which isn't focusable. Focus the trigger directly.
			this.trigger?.focus();
		}
	}

	#cacheTemplates() {
		this.loadingTemplateEl ??= this.#findLightTemplate("[data-neo-async-placeholder]");
		this.#emptyTemplateEl ??= this.#findLightTemplate("[data-neo-select-empty]");
	}

	#findLightTemplate(selector: string): HTMLElement | null {
		return (
			this.querySelector<HTMLElement>(`:scope > ${selector}`) ??
			this.sourceRoot().querySelector<HTMLElement>(`:scope > ${selector}`)
		);
	}

	#syncOptionSlot() {
		const source = this.sourceRoot();
		if (source === this) {
			for (const child of Array.from(this.children) as HTMLElement[]) {
				if (child.matches("neo-option, neo-optgroup") && child.slot !== "options") {
					child.slot = "options";
				}
			}
			return;
		}
		if (source.slot !== "options") source.slot = "options";
	}

	#syncOptions() {
		this.withLightDomObserverPaused(() => {
			this.#syncOptionSlot();
			const options = this.optionData();
			for (const opt of options) this.wireOption(opt);
			this.#syncOptionSelection();
			this.#nav.refresh();

			const source = this.sourceRoot();
			const showLoading = this.loading;
			if (source !== this && source.hidden !== showLoading) source.hidden = showLoading;
			if (this.#loadingEl.hidden === showLoading) this.#loadingEl.hidden = !showLoading;
			const showEmpty = !showLoading && options.length === 0;
			if (this.#emptyEl.hidden === showEmpty) this.#emptyEl.hidden = !showEmpty;
			if (showLoading) {
				// Project the clone through a light-DOM slot so authors can
				// style and replace the loading content without reaching
				// into the select's shadow root.
				this.#ensureLoadingContent().replaceChildren(
					this.loadingTemplateEl?.cloneNode(true) ?? this.#defaultLoadingNode(),
				);
			} else {
				this.#loadingContent?.remove();
			}
		});
	}

	get #loadingContent(): HTMLElement | null {
		return this.querySelector<HTMLElement>(":scope > [data-neo-select-loading-content]");
	}

	#ensureLoadingContent(): HTMLElement {
		let el = this.#loadingContent;
		if (!el) {
			el = document.createElement("div");
			el.setAttribute("data-neo-select-loading-content", "");
			el.slot = "loading";
			this.append(el);
		}
		return el;
	}

	// Stand-in when the author supplies no [data-neo-async-placeholder]:
	// the kit's spinner plus a label. Carries the placeholder marker so
	// it inherits the loading-content layout from neo-select.css.
	#defaultLoadingNode(): HTMLElement {
		const el = document.createElement("div");
		el.setAttribute("data-neo-async-placeholder", "");
		el.style.cssText = "flex-direction:row;align-items:center;gap:0.5rem";
		el.append(document.createElement("neo-spinner"), document.createTextNode("Loading…"));
		return el;
	}

	#prepareOpenState() {
		if (boolAttr(this, "async", false)) {
			this.loading = true;
			return;
		}
		const lazy = this.loadingTemplateEl ?? this.#findLightTemplate("[data-neo-async-placeholder]");
		this.loading = !!lazy && this.optionData().length === 0;
	}

	#dispatchOpen() {
		this.dispatchEvent(new CustomEvent("neo-popover-open", { bubbles: true }));
	}

	#dispatchLoad() {
		this.dispatchEvent(new CustomEvent("neo-select-load", { bubbles: true }));
	}

	// Re-enter the loading state and re-request options. An async retry
	// calls this to re-run the load action in place, no reopen needed.
	reload(): void {
		this.loading = true;
		this.#syncOptions();
		this.#dispatchLoad();
	}

	#syncA11y() {
		const label = this.getAttribute("aria-label");
		if (label) this.trigger.setAttribute("aria-label", label);
		else this.trigger.removeAttribute("aria-label");
		if (label) this.listEl.setAttribute("aria-label", label);
		else this.listEl.removeAttribute("aria-label");
		if (this.id) {
			const listID = `${this.id}-list`;
			this.listEl.id = listID;
			this.trigger.setAttribute("aria-controls", listID);
		}
	}

	#applyValueFromAttr() {
		this.#syncOptionSelection();
		this.updateFormValue();
		// An author/server-provided slot="trigger" child owns the trigger
		// face; the kit yields and only flips the rich/text split.
		if (this.querySelector(':scope > [slot="trigger"]:not([data-neo-select-trigger-view])')) {
			this.labelEl.textContent = "";
			this.triggerFace.rich(true);
			return;
		}
		const options = this.optionData();
		const value = this.#selectedValue(options);
		const found = value === null ? null : (options.find((o) => o.value === value) ?? null);
		if (found) this.triggerFace.fromSource(found.el, value);
		else this.#renderTriggerEmpty();
	}

	// Effective selected value. An absent `value` resolves to the zero-value
	// option ("") when the list has one: "no value" and the empty option are
	// the same selection, like a native <select> defaulting to its "" option.
	#selectedValue(options = this.optionData()): string | null {
		const attr = this.getAttribute("value");
		if (attr !== null) return attr;
		return options.some((o) => o.value === "") ? "" : null;
	}

	#syncOptionSelection() {
		this.withLightDomObserverPaused(() => {
			const options = this.optionData();
			const value = this.#selectedValue(options);
			for (const opt of options) {
				this.setAttrIfChanged(opt.el, "aria-selected", String(value !== null && opt.value === value));
			}
		});
	}

	#renderTriggerEmpty() {
		this.triggerFace.fromSource(this.#emptyTemplateEl, null);
	}

	#activate(el: HTMLElement) {
		if (el.getAttribute("aria-disabled") === "true") return;
		const value = el.getAttribute("data-neo-value") ?? "";
		const data = this.optionData().find((o) => o.value === value);
		this.applyingValue = true;
		this.setAttribute("value", value);
		this.applyingValue = false;
		this.#applyValueFromAttr();
		this.dispatchEvent(
			new CustomEvent("neo-select-change", {
				bubbles: true,
				detail: { value, label: data?.label ?? value },
			}),
		);
		this.hide({ restoreFocus: true });
	}

	#clearValue() {
		const had = this.getAttribute("value");
		this.applyingValue = true;
		this.removeAttribute("value");
		this.applyingValue = false;
		this.#applyValueFromAttr();
		if (had !== null) {
			this.dispatchEvent(
				new CustomEvent("neo-select-change", {
					bubbles: true,
					detail: { value: null, label: null },
				}),
			);
		}
	}

	#focusInitialOption() {
		const selected = this.optionEls().find((el) => el.getAttribute("aria-selected") === "true");
		const target = selected ?? this.optionEls().find((el) => el.getAttribute("aria-disabled") !== "true");
		target?.focus({ preventScroll: true });
	}

	#focusByDelta(delta: number) {
		const enabled = this.optionEls().filter((el) => el.getAttribute("aria-disabled") !== "true" && !el.hidden);
		if (enabled.length === 0) return;
		const active = deepActiveElement();
		const idx = active instanceof HTMLElement ? enabled.indexOf(active) : -1;
		const next = enabled[(idx + delta + enabled.length) % enabled.length];
		next.focus({ preventScroll: true });
		next.scrollIntoView({ block: "nearest" });
	}

	// A click dispatched directly on the host (composedPath()[0] === host)
	// opens the list, so a <neo-keys for> shortcut reaches a trigger that
	// otherwise lives in the shadow root. Trigger/option clicks target
	// those nodes, not the host, so this never double-toggles.
	#onHostClick = (e: MouseEvent) => {
		if (e.composedPath()[0] === this) this.toggle();
	};

	#onTriggerClick = () => {
		if (this.hoverClickShow()) return;
		this.toggle();
	};

	#onTriggerKeyDown = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		if (
			(e.key === "Backspace" || e.key === "Delete") &&
			boolAttr(this, "clearable", false) &&
			this.getAttribute("value") !== null
		) {
			e.preventDefault();
			this.#clearValue();
			return;
		}
		if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			this.show();
		}
	};

	#onOptionClick = (e: MouseEvent) => {
		const row = (e.target as Element | null)?.closest<HTMLElement>("neo-option");
		if (row && this.contains(row)) this.#activate(row);
	};

	// Arrow nav + activation over the options. Home/End and typeahead come
	// from the host NavEngine; the defaultPrevented guard keeps us from
	// double-stepping the same press.
	#onOptionKeyDown = (e: KeyboardEvent) => {
		if (e.defaultPrevented) return;
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key === "Enter" || (e.key === " " && !boolAttr(this, "typeahead", true))) {
			const row = (e.target as Element | null)?.closest<HTMLElement>("neo-option");
			if (row) {
				e.preventDefault();
				this.#activate(row);
			}
			return;
		}
		if (e.key === "ArrowDown") {
			e.preventDefault();
			this.#focusByDelta(1);
			return;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			this.#focusByDelta(-1);
			return;
		}
	};

	#onHostFocusIn = (e: FocusEvent) => {
		const opt = (e.target as Element | null)?.closest<HTMLElement>("neo-option");
		if (!opt || !this.contains(opt)) return;
		this.lastFocusedOptionValue = opt.getAttribute("data-neo-value");
	};

	// After a morph, the patched-out option may have held focus; the
	// browser then drops focus to <body> and arrow keys go nowhere.
	// Reseat focus on the same value if it survived, else on the initial
	// candidate. Skip if focus is already on a live option.
	#restoreOpenFocusAfterPatch() {
		if (!this.open) return;
		const active = deepActiveElement();
		if (active instanceof HTMLElement && active.closest("neo-option") && this.contains(active)) {
			return;
		}
		if (this.lastFocusedOptionValue !== null) {
			const restored = this.optionEls().find(
				(opt) =>
					opt.getAttribute("data-neo-value") === this.lastFocusedOptionValue &&
					!opt.hidden &&
					opt.getAttribute("aria-disabled") !== "true",
			);
			if (restored) {
				restored.focus({ preventScroll: true });
				return;
			}
		}
		this.#focusInitialOption();
	}

	#onOptionsSlotChange = () => {
		if (!this.ready || this.observerPauseDepth > 0) return;
		this.scheduleListboxReconcile();
	};

	protected override reconcileOpenCommandPatch(): void {
		this.withLightDomObserverPaused(() => {
			this.#cacheTemplates();
			if (this.loading && this.optionData().length > 0) this.loading = false;
			this.#syncOptionSlot();
			this.#syncOptions();
			this.#applyValueFromAttr();
		});
		// The morph stripped the host's kit-managed focus ring; re-derive it.
		this.syncFocusVisible();
		if (this.open) {
			this.position();
			this.#restoreOpenFocusAfterPatch();
			// Trigger may still shift as morphed siblings (async CodeMirror,
			// images) reflow after this synchronous pass; re-anchor next frame.
			this.scheduleReposition();
		}
	}

	#onLightDomMutation = (records: MutationRecord[]) => {
		if (!this.#isRelevantLightDomMutation(records)) return;
		this.reconcileOpenCommandPatch();
	};

	#isRelevantLightDomMutation(records: MutationRecord[]): boolean {
		const source = this.sourceRoot();
		for (const r of records) {
			if (r.type === "attributes") {
				const el = r.target as Element;
				if (el === source || el === this) return true;
				if (el.matches("neo-option, neo-optgroup")) return true;
				continue;
			}
			if (r.type !== "childList") continue;
			if (r.target === this || r.target === source) return true;
			if (r.target instanceof Element && r.target.matches("neo-option, neo-optgroup")) return true;
			for (const n of Array.from(r.addedNodes)) {
				if (
					n instanceof Element &&
					n.matches("neo-option, neo-optgroup, neo-datalist, [data-neo-async-placeholder], [data-neo-select-empty]")
				)
					return true;
			}
			for (const n of Array.from(r.removedNodes)) {
				if (
					n instanceof Element &&
					n.matches("neo-option, neo-optgroup, neo-datalist, [data-neo-async-placeholder], [data-neo-select-empty]")
				)
					return true;
			}
		}
		return false;
	}
}

if (!customElements.get("neo-select")) {
	customElements.define("neo-select", NeoSelect);
}
