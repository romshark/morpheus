// Shadow DOM owns the trigger/search/panel/scroll geometry. The light-DOM
// option source is slotted into that panel, so components inside options
// stay live instead of being cloned.

import { boolAttr } from "../command";
import {
	cloneAsyncPlaceholder,
	cloneTemplateSource,
	NeoListbox,
	POPOVER_ATTRS,
	setHiddenIfChanged,
} from "../neo-listbox";
import type { Placement } from "../neo-position";
import { deepActiveElement } from "../shadow-utils";
import { joinValues, parseValues } from "../value-list";

const COMBOBOX_SHADOW_TEMPLATE = document.createElement("template");
// The ::slotted([hidden]) rule below needs !important because the
// component's own ::slotted([data-neo-combobox-options]) display:flex rule
// outranks the browser's [hidden] UA style. Without it, an empty async source
// container can remain in layout and leave a phantom flex gap after the error row.
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - [data-neo-combobox-trigger] box-shadow: contrast-more edge. Inherited
//   no-op shadow until prefers-contrast, then a 1px inset ring; avoids the
//   reflow a wider border causes.
// - [data-neo-combobox-trigger]:focus: only the trigger gets the chunky ring
//   by default. The search input sits inside the popover panel, whose border
//   plus the caret already frame focus. High-contrast modes re-add the ring on
//   the input via --neo-input-focus-outline (set on :root[data-pref-contrast-
//   more]) and via the forced-colors media query. Ring lives on the host, not
//   the trigger: a trigger ring would be clipped by a host overflow: hidden
//   (e.g. inside neo-input-group). JS mirrors the trigger's :focus-visible onto
//   the host via the attribute.
// - :host([data-neo-focus-visible]): match the trigger's radius so the host
//   ring rounds like neo-button's; --neo-button-radius is 0 inside
//   neo-input-group, keeping it square there.
// - [data-neo-combobox-trigger]:disabled: the trigger's native disabled flag
//   (host `disabled` or a containing <fieldset disabled>) fades it and blocks
//   pointer/hover; :host([disabled]) adds the not-allowed cursor. The disabled
//   button already drops focus and swallows clicks/keys.
// - [data-neo-combobox-trigger-slot]: rich trigger face. When the kit (or an
//   author slot="trigger" child) fills the trigger with markup, swap the text
//   label for the slot and let the trigger grow to fit a multi-line card.
// - :host([data-neo-trigger-rich]): rich trigger sizes to the cloned card
//   (host auto, trigger auto); floor the host at the single-line control
//   height.
// - :host([data-neo-trigger-rich]) [data-neo-combobox-trigger]: floor the
//   visible button too, not just the host. With height:auto a single short row
//   (one chip / one-line face) would leave the bordered trigger shorter than a
//   single-select trigger. min-height keeps them equal; taller content still
//   grows.
// - :host([multiple]) [data-neo-combobox-trigger]: multi-select fills the
//   trigger with chips, each carrying its own pill padding, so the trigger's
//   own vertical padding is redundant and would push a single chip row past the
//   single-select height. Trim it; min-height holds the floor, and wrapped chip
//   rows still grow it.
// - :host([popover-fit-content]) [data-neo-combobox-list]: size to the option
//   rows instead of forcing the trigger width, capped like max-width.
// - [data-neo-combobox-options] gap: options slot straight in here (bare, or
//   via a display:contents <neo-datalist> container), so the row gap lives on
//   this container.
// - [data-neo-empty-results] cursor: reset the cursor:pointer inherited from
//   [data-neo-combobox-list]; these are static status messages, not clickable
//   rows.
// - ::slotted([slot="loading"]): loading content is projected light DOM so the
//   author's placeholder (and its light-DOM-styled <neo-skeleton> rows) render
//   styled.
COMBOBOX_SHADOW_TEMPLATE.innerHTML = `
<style>
  :host {
    display: inline-block;
    --neo-combobox-min-width: var(--neo-select-min-width, 12rem);
    --neo-combobox-search-padding:
      calc(var(--page-spacing, 0.25rem) * 2)
      calc(var(--page-spacing, 0.25rem) * 3);
    --neo-combobox-search-divider: color-mix(in srgb, currentColor 12%, transparent);
    --neo-combobox-search-divider-width: 1px;
  }
  :host([hidden]) { display: none; }
  button, input { font: inherit; }
  [data-neo-combobox-trigger] {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: var(--neo-combobox-min-width);
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
  [data-neo-combobox-trigger]:hover {
    background: var(--neo-button-hover-bg, rgba(0, 0, 0, 0.04));
  }
  [data-neo-combobox-trigger]:focus,
  [data-neo-combobox-trigger]:focus-visible {
    outline: none;
  }
  :host([data-neo-focus-visible]) {
    outline: 2px solid var(--neo-button-focus-ring, currentColor);
    outline-offset: 2px;
    border-radius: var(--neo-button-radius, var(--page-radius, 0.5rem));
  }
  :host([disabled]:not([disabled="false"])) { cursor: not-allowed; }
  [data-neo-combobox-trigger]:disabled {
    opacity: 0.55;
    background-image: var(--neo-disabled-overlay);
    pointer-events: none;
  }
  [data-neo-combobox-input]:focus-visible {
    outline: var(--neo-input-focus-outline, none);
    outline-offset: 2px;
  }
  @media (forced-colors: active) {
    [data-neo-combobox-input]:focus-visible {
      outline: 2px solid CanvasText;
      outline-offset: 2px;
    }
  }
  [data-neo-combobox-label] {
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
  [data-neo-combobox-trigger-slot] { display: none; }
  :host([data-neo-trigger-rich]) [data-neo-combobox-label] { display: none; }
  :host([data-neo-trigger-rich]) [data-neo-combobox-trigger-slot] {
    display: block;
    flex: 1 1 auto;
    min-width: 0;
  }
  :host([data-neo-trigger-rich]) { min-height: var(--neo-control-height); }
  :host([data-neo-trigger-rich]) [data-neo-combobox-trigger] { height: auto; min-height: var(--neo-control-height); }
  :host([multiple]:not([multiple="false"])) [data-neo-combobox-trigger] { padding-block: 0.15rem; }
  [data-neo-combobox-caret] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 1em;
    height: 1em;
    opacity: 0.6;
    margin-left: 0.5rem;
  }
  [data-neo-combobox-list] {
    position: fixed;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    min-width: var(--neo-combobox-min-width);
    max-width: min(var(--neo-popover-max-width, 22rem), calc(100vw - 1rem));
    max-height: calc(100dvh - 1rem);
    overflow: hidden;
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
  :host([popover-fit-content]:not([popover-fit-content="false"])) [data-neo-combobox-list] {
    /* The positioner leaves width unset in this mode, so size to the option
       rows, floored by min-width (trigger width) and capped by max-width. */
    width: max-content;
  }
  [data-neo-combobox-list][hidden] {
    display: none;
    opacity: 0;
    transform: translateY(-4px);
  }
  @starting-style {
    [data-neo-combobox-list]:not([hidden]) {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-neo-combobox-list] { transition: none; }
  }
  [data-neo-combobox-search] {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: var(--neo-combobox-search-padding);
    border-bottom: var(--neo-combobox-search-divider-width) solid var(--neo-combobox-search-divider);
    color: var(--muted, #6b7280);
    flex: 0 0 auto;
    background: var(--neo-popover-bg, #ffffff);
    cursor: text;
  }
  [data-neo-combobox-list][data-neo-combobox-above] > [data-neo-combobox-search] {
    order: 1;
    border-top: var(--neo-combobox-search-divider-width) solid var(--neo-combobox-search-divider);
    border-bottom: 0;
  }
  [data-neo-combobox-list][data-neo-combobox-above] > [data-neo-combobox-options] {
    order: 0;
  }
  [data-neo-combobox-search] neo-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 1.1em;
    height: 1.1em;
    color: var(--muted, #6b7280);
  }
  [data-neo-combobox-input] {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
    border: 0;
    border-radius: 0;
    padding: 1px 0;
    background: transparent;
    color: var(--page-fg, currentColor);
    line-height: 1.4;
    outline: none;
    margin: 0;
    box-shadow: none;
    appearance: none;
  }
  [data-neo-combobox-input]::placeholder {
    color: var(--muted, #6b7280);
    opacity: 1;
  }
  [data-neo-combobox-options] {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: var(--neo-navgroup-gap, 0.5rem);
    padding: 0.25rem;
    box-sizing: border-box;
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }
  ::slotted([data-neo-combobox-options]) {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: var(--neo-navgroup-gap, 0.5rem);
  }
  ::slotted([hidden]) {
    display: none !important;
  }
  [data-neo-empty-results] {
    padding: var(--neo-select-option-padding, 0.4rem 0.6rem);
    cursor: default;
  }
  [data-neo-empty-results] .popover-async-failed {
    --popover-async-warning: var(--neo-toast-warning, oklch(0.78 0.16 80));
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.2rem 0.5rem;
    width: fit-content;
    max-width: 100%;
    min-height: 0;
    margin: 0;
    padding: 0;
    color: var(--muted);
    font-size: 0.9rem;
    font-style: normal;
    text-align: left;
  }
  [data-neo-empty-results] .popover-async-failed:not(:has(> neo-icon)) {
    grid-template-columns: minmax(0, 1fr);
  }
  [data-neo-empty-results] neo-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: content-box;
    width: var(--neo-icon-size, 1em);
    height: var(--neo-icon-size, 1em);
    vertical-align: -0.125em;
    flex-shrink: 0;
    line-height: 0;
  }
  [data-neo-empty-results] .popover-async-failed neo-icon {
    grid-row: 1 / span 2;
    color: color-mix(in srgb, var(--popover-async-warning) 78%, var(--muted));
    --neo-icon-size: 0.95rem;
  }
  [data-neo-empty-results] .popover-async-failed strong {
    line-height: 1.25;
    font-size: inherit;
    font-weight: 500;
    color: var(--muted);
  }
  [data-neo-empty-results] neo-button[data-neo-popover-async-retry] {
    justify-self: start;
    width: fit-content;
    padding: 0;
    border-color: transparent;
    background: transparent;
    color: var(--accent);
    font-size: inherit;
    white-space: nowrap;
    cursor: pointer;
    box-shadow: none;
    transform: none;
  }
  [data-neo-empty-results] neo-button[data-neo-popover-async-retry]:hover {
    background: transparent;
    color: var(--accent-hover, var(--accent));
    text-decoration: underline;
    text-underline-offset: 0.18em;
    box-shadow: none;
    transform: none;
  }
  ::slotted([slot="loading"]) { cursor: default; }
  [data-neo-combobox-loading][hidden],
  [data-neo-empty-results][hidden] {
    display: none !important;
  }
</style>
<button type="button" data-neo-combobox-trigger aria-haspopup="listbox" aria-expanded="false">
  <span part="label" data-neo-combobox-label></span>
  <slot name="trigger" data-neo-combobox-trigger-slot></slot>
  <neo-icon name="chevrons-up-down" part="caret" data-neo-combobox-caret aria-hidden="true"></neo-icon>
</button>
<div data-neo-combobox-list hidden>
  <div data-neo-combobox-search>
    <neo-icon name="search" aria-hidden="true"></neo-icon>
    <input type="text" data-neo-combobox-input autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
  </div>
  <div data-neo-combobox-options role="listbox">
    <div data-neo-combobox-loading hidden><slot name="loading"></slot></div>
    <div data-neo-empty-results hidden>No results</div>
    <slot name="options"></slot>
  </div>
</div>
`;

export class NeoCombobox extends NeoListbox {
	static readonly observedAttributes = [
		"value",
		"name",
		"open",
		"disabled",
		"multiple",
		"placeholder",
		"search-placeholder",
		"aria-label",
		"caret",
		"list",
		...POPOVER_ATTRS,
	];

	protected readonly ns = "combobox";

	#input!: HTMLInputElement;
	#optionsEl!: HTMLElement;
	#optionsSlot!: HTMLSlotElement;
	#loadingEl!: HTMLElement;
	#emptyResultsEl!: HTMLElement;
	#searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	#emptyResultsTemplateEl: HTMLElement | null = null;
	#emptyTriggerTemplateEl: HTMLElement | null = null;
	#lastFocusedKind: "search" | "option" | null = null;
	#lastInputSelectionStart = 0;
	#lastInputSelectionEnd = 0;
	#lastInputSelectionDirection: "forward" | "backward" | "none" = "none";
	#lastOptionsScrollTop = 0;
	#closeCleanupGeneration = 0;

	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(COMBOBOX_SHADOW_TEMPLATE.content.cloneNode(true));
	}

	connectedCallback() {
		if (this.ready) return;
		this.defaultValue = this.getAttribute("value");
		this.trigger = this.shadowRoot!.querySelector("[data-neo-combobox-trigger]")!;
		this.labelEl = this.shadowRoot!.querySelector("[data-neo-combobox-label]")!;
		this.listEl = this.shadowRoot!.querySelector("[data-neo-combobox-list]")!;
		this.#input = this.shadowRoot!.querySelector("[data-neo-combobox-input]")!;
		this.#optionsEl = this.shadowRoot!.querySelector("[data-neo-combobox-options]")!;
		this.#optionsSlot = this.shadowRoot!.querySelector('slot[name="options"]')!;
		this.#loadingEl = this.shadowRoot!.querySelector("[data-neo-combobox-loading]")!;
		this.#emptyResultsEl = this.shadowRoot!.querySelector("[data-neo-empty-results]")!;
		this.caretEl = this.shadowRoot!.querySelector("[data-neo-combobox-caret]")!;
		this.initTriggerFace();

		this.trigger.addEventListener("click", this.#onTriggerClick);
		this.trigger.addEventListener("keydown", this.#onTriggerKeyDown);
		this.trigger.addEventListener("focus", this.onTriggerFocus);
		this.trigger.addEventListener("blur", this.onTriggerBlur);
		this.#input.addEventListener("input", this.#onSearchInput);
		this.#input.addEventListener("input", this.#onInputSnapshot);
		this.#input.addEventListener("keydown", this.#onSearchKeyDown);
		this.#input.addEventListener("keyup", this.#onInputSnapshot);
		this.#input.addEventListener("mouseup", this.#onInputSnapshot);
		this.#input.addEventListener("focusin", this.#onInputFocusIn);
		this.#optionsEl.addEventListener("click", this.#onOptionClick);
		this.#optionsEl.addEventListener("scroll", this.#onOptionsScroll, { passive: true });
		this.#optionsSlot.addEventListener("slotchange", this.#onOptionsSlotChange);
		this.wireHoverOpen();
		this.addEventListener("focusin", this.#onHostFocusIn);
		this.addEventListener("click", this.#onHostClick);
		this.addEventListener("keydown", this.onEscapeKeyDown);
		this.addEventListener("keydown", this.#onLightDomOptionKeyDown, true);
		document.addEventListener("pointerdown", this.onDocPointerDown, true);
		document.addEventListener("focusin", this.onDocFocusIn, true);
		window.addEventListener("resize", this.reposition);
		window.addEventListener("scroll", this.onWindowScroll, true);
		// visualViewport.resize/scroll cover pinch-zoom and the iOS virtual-keyboard
		// inset; neither fires window.resize. onViewportChange (not reposition) so
		// the keyboard can't dismiss an open combobox.
		window.visualViewport?.addEventListener("resize", this.onViewportChange);
		window.visualViewport?.addEventListener("scroll", this.onViewportChange);

		this.observer = new MutationObserver(this.#onLightDomMutation);
		this.observePanelResize();
		this.ready = true;
		this.syncCaret();
		this.withLightDomObserverPaused(() => {
			this.#cacheTemplates();
			this.#syncA11y();
			this.#syncOptionSlot();
			this.#syncOptions();
			this.#applyValuesFromAttr();
		});
		this.syncDisabledState();
		// Read options from the external <neo-datalist> this host's list="<id>"
		// points at; its writes reconcile through the light-DOM observer.
		this.syncDatalist();
		this.applyOpenCommand();
	}

	disconnectedCallback() {
		this.observer?.disconnect();
		this.observer = null;
		this.observerPauseDepth = 0;
		this.ready = false;
		this.disconnectPanelResize();
		this.trigger?.removeEventListener("click", this.#onTriggerClick);
		this.trigger?.removeEventListener("keydown", this.#onTriggerKeyDown);
		this.trigger?.removeEventListener("focus", this.onTriggerFocus);
		this.trigger?.removeEventListener("blur", this.onTriggerBlur);
		this.#input?.removeEventListener("input", this.#onSearchInput);
		this.#input?.removeEventListener("input", this.#onInputSnapshot);
		this.#input?.removeEventListener("keydown", this.#onSearchKeyDown);
		this.#input?.removeEventListener("keyup", this.#onInputSnapshot);
		this.#input?.removeEventListener("mouseup", this.#onInputSnapshot);
		this.#input?.removeEventListener("focusin", this.#onInputFocusIn);
		this.#optionsEl?.removeEventListener("click", this.#onOptionClick);
		this.#optionsEl?.removeEventListener("scroll", this.#onOptionsScroll);
		this.#optionsSlot?.removeEventListener("slotchange", this.#onOptionsSlotChange);
		this.unwireHoverOpen();
		this.removeEventListener("focusin", this.#onHostFocusIn);
		this.removeEventListener("click", this.#onHostClick);
		this.removeEventListener("keydown", this.onEscapeKeyDown);
		this.removeEventListener("keydown", this.#onLightDomOptionKeyDown, true);
		document.removeEventListener("pointerdown", this.onDocPointerDown, true);
		document.removeEventListener("focusin", this.onDocFocusIn, true);
		window.removeEventListener("resize", this.reposition);
		window.removeEventListener("scroll", this.onWindowScroll, true);
		window.visualViewport?.removeEventListener("resize", this.onViewportChange);
		window.visualViewport?.removeEventListener("scroll", this.onViewportChange);
		this.#clearSearchDebounceTimer();
		this.#closeCleanupGeneration += 1;
	}

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		if (!this.ready) return;
		if (name === "open") {
			this.applyOpenCommand();
			return;
		}
		if (name === "disabled") {
			this.syncDisabledState();
			return;
		}
		if (name === "name") {
			this.updateFormValue();
			return;
		}
		if (name === "value") {
			if (!this.applyingValue) this.#applyValuesFromAttr();
			return;
		}
		if (name === "placeholder" || name === "multiple") {
			this.#applyValuesFromAttr();
			this.#syncA11y();
			return;
		}
		if (name === "search-placeholder") {
			this.#input.placeholder = newValue ?? "Search…";
			return;
		}
		if (name === "aria-label") {
			this.#syncA11y();
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

	isMultiple(): boolean {
		return boolAttr(this, "multiple", false);
	}

	get selectedValues(): string[] {
		return this.#parseValueAttr(this.getAttribute("value"));
	}

	show(opts: { focus?: boolean; scrollIntoView?: boolean } = {}): void {
		if (this.isDisabled()) return;
		if (this.open) return;
		this.#closeCleanupGeneration += 1;
		this.open = true;
		this.reflectOpen();
		this.trigger.setAttribute("aria-expanded", "true");
		this.listEl.hidden = false;
		// Programmatic value writes fire no input event, so no suppression
		// around this is needed.
		this.#input.value = "";
		this.#prepareOpenState();
		this.#syncOptions();
		this.#applyFilter();
		const scrollIntoView = opts.scrollIntoView ?? opts.focus !== false;
		if (!this.position({ scrollIntoView })) return;
		this.#dispatchOpen();
		// `loading` means options need fetching now: `async` (every open)
		// or a lazy combobox's first open. Fire the load request only then;
		// neo-popover-open stays honest as "panel opened", so a wired-up
		// lazy combobox doesn't re-fetch (and re-morph) on reopen.
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
		this.#clearSearchDebounceTimer();
		this.reflectClosed();
		this.trigger.setAttribute("aria-expanded", "false");
		this.listEl.hidden = true;
		this.#cleanupAfterClose();
		this.dispatchEvent(new CustomEvent("neo-popover-close", { bubbles: true }));
		this.#clearFocusSnapshot();
		if (opts.restoreFocus) {
			// The trigger lives in the shadow root; reading
			// document.activeElement from outside the shadow only ever
			// returns the host, which isn't focusable. Focus the trigger
			// directly; standard combobox close-restore UX.
			this.trigger?.focus();
		}
	}

	#cleanupAfterClose() {
		const generation = ++this.#closeCleanupGeneration;
		const finish = () => {
			if (generation !== this.#closeCleanupGeneration || this.open || !this.isConnected) return;
			this.#input.value = "";
			this.#clearFilter();
			this.#syncOptions();
		};
		// Keep the filtered rows stable while the panel fades out. Clearing
		// them earlier changes its contents and height during the transition.
		const animations = this.listEl.getAnimations();
		if (animations.length === 0) {
			queueMicrotask(finish);
			return;
		}
		Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
	}

	#cacheTemplates() {
		// Retain the last-seen placeholder when the live one is gone: an async
		// combobox's first options morph replaces it, but reopen and reload()
		// still render the author's skeleton from the retained ref. Lifecycle
		// (lazy trigger, loading done) keys on live presence via
		// #sourceHasAsyncPlaceholder(), never on this possibly detached ref.
		this.loadingTemplateEl = this.#findLightTemplate("[data-neo-async-placeholder]") ?? this.loadingTemplateEl;
		// Re-find each time (not ??=): a morph that replaces the source
		// container also replaces its descendant template divs, so a cached
		// ref would otherwise stay on the old detached element.
		this.#emptyResultsTemplateEl = this.#findLightTemplate("[data-neo-empty-results]");
		this.#emptyTriggerTemplateEl = this.#findLightTemplate("[data-neo-combobox-empty]");
		// [data-neo-empty-results] is a template source cloned into the
		// shadow on demand; hide the source so it isn't a stray listbox row.
		// ([data-neo-combobox-empty] is hidden the same way by the light
		// stylesheet; it renders only, cloned, inside the trigger.)
		if (
			this.#emptyResultsTemplateEl &&
			!(this.#emptyResultsTemplateEl instanceof HTMLTemplateElement) &&
			!this.#emptyResultsTemplateEl.hidden
		) {
			this.#emptyResultsTemplateEl.hidden = true;
		}
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

			const source = this.sourceRoot();
			const showLoading = this.loading;
			const hideSource =
				showLoading ||
				(source !== this &&
					options.length === 0 &&
					!!this.#emptyResultsTemplateEl &&
					source.contains(this.#emptyResultsTemplateEl));
			if (source !== this) setHiddenIfChanged(source, hideSource);
			setHiddenIfChanged(this.#loadingEl, !showLoading);
			if (showLoading) {
				// Project the clone through a light-DOM slot so the author's
				// placeholder (and its light-DOM-styled <neo-skeleton> rows)
				// render styled instead of unstyled inside the shadow root.
				this.#ensureLoadingContent().replaceChildren(
					cloneAsyncPlaceholder(this.loadingTemplateEl, () => this.#defaultLoadingNode()),
				);
			} else {
				this.#loadingContent?.remove();
			}
			const showEmpty = !showLoading && this.#shownOptions().length === 0;
			setHiddenIfChanged(this.#emptyResultsEl, !showEmpty);
			if (showEmpty) this.#renderEmptyResults();
		});
	}

	// Live placeholder presence, checked in the same two scopes
	// #findLightTemplate reads (host child, source-root child).
	#sourceHasAsyncPlaceholder(): boolean {
		return !!this.#findLightTemplate("[data-neo-async-placeholder]");
	}

	#renderEmptyResults() {
		this.#emptyResultsEl.replaceChildren(
			...cloneTemplateSource(this.#emptyResultsTemplateEl, () => document.createTextNode("No results")),
		);
		for (const q of Array.from(this.#emptyResultsEl.querySelectorAll<HTMLElement>("[data-neo-empty-query]"))) {
			q.textContent = this.#input.value;
		}
	}

	get #loadingContent(): HTMLElement | null {
		return this.querySelector<HTMLElement>(":scope > [data-neo-combobox-loading-content]");
	}

	#ensureLoadingContent(): HTMLElement {
		let el = this.#loadingContent;
		if (!el) {
			el = document.createElement("div");
			el.setAttribute("data-neo-combobox-loading-content", "");
			el.slot = "loading";
			this.append(el);
		}
		return el;
	}

	// Stand-in when the author supplies no [data-neo-async-placeholder]:
	// the kit's spinner plus a label. Carries the placeholder marker so
	// it inherits the loading-content layout from neo-combobox.css.
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
		// Live presence, not the retained loadingTemplateEl: a morph that
		// removed the placeholder without delivering options means loading is
		// done (or was never wanted), not perpetually pending.
		this.loading = this.#sourceHasAsyncPlaceholder() && this.optionData().length === 0;
	}

	#dispatchOpen() {
		this.dispatchEvent(new CustomEvent("neo-popover-open", { bubbles: true }));
	}

	#dispatchLoad() {
		this.dispatchEvent(new CustomEvent("neo-combobox-load", { bubbles: true }));
	}

	// Re-enter the loading state and re-request options. An async retry
	// calls this to re-run the load action in place; no reopen needed.
	reload(): void {
		this.loading = true;
		this.#syncOptions();
		this.#dispatchLoad();
	}

	#syncA11y() {
		this.#input.placeholder = this.getAttribute("search-placeholder") ?? "Search…";
		const label = this.getAttribute("aria-label");
		if (label) {
			this.trigger.setAttribute("aria-label", label);
			this.#optionsEl.setAttribute("aria-label", label);
			this.#input.setAttribute("aria-label", `${label}: search`);
		} else {
			this.trigger.removeAttribute("aria-label");
			this.#optionsEl.removeAttribute("aria-label");
			this.#input.setAttribute("aria-label", "Search");
		}
		if (this.id) {
			const listID = `${this.id}-list`;
			this.listEl.id = listID;
			this.trigger.setAttribute("aria-controls", listID);
		}
		if (this.isMultiple()) this.#optionsEl.setAttribute("aria-multiselectable", "true");
		else this.#optionsEl.removeAttribute("aria-multiselectable");
	}

	#parseValueAttr(raw: string | null): string[] {
		if (raw == null || raw === "") return [];
		if (!this.isMultiple()) return [raw];
		return parseValues(raw);
	}

	#applyValuesFromAttr() {
		this.#syncOptionSelection();
		this.updateFormValue();
		this.#renderTrigger(this.#displaySelection());
	}

	// Multi-select submits one entry per value under the same `name`, like a
	// native <select multiple>; single-select submits the lone value string.
	protected override updateFormValue(): void {
		if (!this.isMultiple()) {
			this.internals.setFormValue(this.getAttribute("value"));
			return;
		}
		const values = this.selectedValues;
		if (values.length === 0) {
			this.internals.setFormValue(null);
			return;
		}
		const name = this.getAttribute("name");
		if (!name) {
			// No name: not submitted anyway, so keep the joined string.
			this.internals.setFormValue(this.getAttribute("value"));
			return;
		}
		const data = new FormData();
		for (const v of values) data.append(name, v);
		this.internals.setFormValue(data);
	}

	// Effective selection for display. Single-select with no value (absent or
	// empty) resolves to the zero-value option ("") when the list has one:
	// "no value" and the empty option are the same selection. Multi-select is
	// unchanged: an empty token is never a value there.
	#displaySelection(options = this.optionData()): string[] {
		const attr = this.getAttribute("value");
		if (this.isMultiple()) return this.#parseValueAttr(attr);
		if (attr !== null && attr !== "") return [attr];
		return options.some((o) => o.value === "") ? [""] : [];
	}

	#syncOptionSelection() {
		this.withLightDomObserverPaused(() => {
			const options = this.optionData();
			const selected = new Set(this.#displaySelection(options));
			for (const opt of options) {
				this.setAttrIfChanged(opt.el, "aria-selected", String(selected.has(opt.value)));
			}
		});
	}

	#renderTrigger(values: string[]) {
		// An author/server-provided slot="trigger" child owns the trigger
		// face: the kit yields (only flips on the rich/text split) so a
		// Datastar app can patch arbitrary content there on selection.
		if (this.querySelector(':scope > [slot="trigger"]:not([data-neo-combobox-trigger-view])')) {
			this.triggerFace.rich(true);
			return;
		}
		if (values.length === 0) {
			this.triggerFace.fromSource(this.#emptyTriggerTemplateEl, null);
			return;
		}
		if (this.isMultiple()) {
			this.#setTriggerChips(values);
			return;
		}
		const optEl = this.optionEls().find((el) => (el.getAttribute("data-neo-value") ?? "") === values[0]) ?? null;
		this.triggerFace.fromSource(optEl, values[0]);
	}

	// Multi-select: one chip per selected value, each carrying the option's
	// trigger face ([data-neo-option-trigger]) when present, else its
	// `label` / text. The chips wrap; the trigger grows to fit.
	#setTriggerChips(values: string[]) {
		if (values.length === 0) {
			this.triggerFace.fromSource(this.#emptyTriggerTemplateEl, null);
			return;
		}
		// One option query for all chips; first occurrence wins on duplicate
		// values, matching find().
		const optByValue = new Map<string, HTMLElement>();
		for (const el of this.optionEls()) {
			const v = el.getAttribute("data-neo-value") ?? "";
			if (!optByValue.has(v)) optByValue.set(v, el);
		}
		const chips = values.map((v) => {
			const opt = optByValue.get(v) ?? null;
			const chip = document.createElement("span");
			chip.setAttribute("data-neo-combobox-trigger-chip", "");
			const face = opt?.querySelector<HTMLElement>(":scope > [data-neo-option-trigger]") ?? null;
			if (face?.childNodes.length) {
				chip.append(...Array.from(face.childNodes).map((n) => n.cloneNode(true)));
			} else {
				chip.textContent = opt?.getAttribute("label") ?? opt?.textContent?.trim() ?? v;
			}
			return chip;
		});
		this.triggerFace.set(chips);
	}

	#onInputFocusIn = () => {
		this.#lastFocusedKind = "search";
		this.lastFocusedOptionValue = null;
		this.#captureInputSelection();
	};

	#onInputSnapshot = () => {
		this.#captureInputSelection();
	};

	#captureInputSelection() {
		this.#lastInputSelectionStart = this.#input.selectionStart ?? 0;
		this.#lastInputSelectionEnd = this.#input.selectionEnd ?? 0;
		this.#lastInputSelectionDirection =
			(this.#input.selectionDirection as "forward" | "backward" | "none" | null) ?? "none";
	}

	#onHostFocusIn = (e: FocusEvent) => {
		const opt = (e.target as Element | null)?.closest<HTMLElement>("neo-option");
		if (!opt || !this.contains(opt)) return;
		this.#lastFocusedKind = "option";
		this.lastFocusedOptionValue = opt.getAttribute("data-neo-value");
	};

	#onOptionsScroll = () => {
		this.#lastOptionsScrollTop = this.#optionsEl.scrollTop;
	};

	#clearFocusSnapshot() {
		this.#lastFocusedKind = null;
		this.lastFocusedOptionValue = null;
		this.#lastInputSelectionStart = 0;
		this.#lastInputSelectionEnd = 0;
		this.#lastInputSelectionDirection = "none";
		this.#lastOptionsScrollTop = 0;
	}

	#activate(el: HTMLElement) {
		if (el.getAttribute("aria-disabled") === "true") return;
		const value = el.getAttribute("data-neo-value") ?? "";
		const current = this.selectedValues;
		const next = this.isMultiple()
			? current.includes(value)
				? current.filter((v) => v !== value)
				: [...current, value]
			: [value];
		this.applyingValue = true;
		// Paused: #applyValuesFromAttr below re-renders synchronously; letting
		// the observer see the host's own value write would re-run the whole
		// reconcile pass a microtask later for nothing.
		this.withLightDomObserverPaused(() => {
			if (next.length === 0) this.removeAttribute("value");
			else this.setAttribute("value", this.isMultiple() ? joinValues(next, "neo-combobox") : (next[0] ?? ""));
		});
		this.applyingValue = false;
		this.#applyValuesFromAttr();

		const data = this.optionData();
		const labels = next.map((v) => data.find((o) => o.value === v)?.label ?? v);
		const detail = this.isMultiple() ? { values: next, labels } : { value: next[0] ?? null, label: labels[0] ?? null };
		this.dispatchEvent(new CustomEvent("neo-combobox-change", { bubbles: true, detail }));
		// Multi-mode keeps the popover open and leaves focus on the toggled
		// row so arrow nav stays anchored where the user was; refocusing the
		// search input would silently rewind ArrowDown to the first option.
		if (this.isMultiple()) this.#focusOption(el, { preventScroll: true });
		else this.hide({ restoreFocus: true });
	}

	#clearValue() {
		const had = this.getAttribute("value");
		this.applyingValue = true;
		this.withLightDomObserverPaused(() => {
			this.removeAttribute("value");
		});
		this.applyingValue = false;
		this.#applyValuesFromAttr();
		if (had === null) return;
		const detail = this.isMultiple() ? { values: [], labels: [] } : { value: null, label: null };
		this.dispatchEvent(new CustomEvent("neo-combobox-change", { bubbles: true, detail }));
	}

	// Rendered rows (not hidden), disabled included. A disabled option that
	// matches the query is still a result, so the empty-results message keys
	// on this, never on focusability.
	#shownOptions(): HTMLElement[] {
		return this.optionEls().filter((el) => !el.hidden);
	}

	// Shown rows the user can move to or activate. Keyboard nav and initial
	// focus skip disabled rows; activate() refuses them anyway.
	#focusableOptions(): HTMLElement[] {
		return this.#shownOptions().filter((el) => el.getAttribute("aria-disabled") !== "true");
	}

	#clearFilter() {
		this.withLightDomObserverPaused(() => {
			for (const el of this.optionEls()) {
				setHiddenIfChanged(el, false);
			}
			for (const group of Array.from(this.sourceRoot().querySelectorAll<HTMLElement>("neo-optgroup"))) {
				setHiddenIfChanged(group, false);
			}
			setHiddenIfChanged(this.#emptyResultsEl, true);
		});
	}

	#applyFilter() {
		this.withLightDomObserverPaused(() => {
			if (this.loading) return;
			const query = this.#input.value.trim().toLowerCase();
			if (boolAttr(this, "live-search", false)) {
				const empty = this.#shownOptions().length === 0;
				setHiddenIfChanged(this.#emptyResultsEl, !empty);
				if (empty) this.#renderEmptyResults();
				return;
			}
			const match = (opt: HTMLElement) => {
				if (query.length === 0) return true;
				const label = opt.getAttribute("label") ?? opt.textContent?.trim() ?? "";
				return label.toLowerCase().includes(query);
			};
			for (const opt of this.optionEls()) {
				setHiddenIfChanged(opt, !match(opt));
			}
			for (const group of Array.from(this.sourceRoot().querySelectorAll<HTMLElement>("neo-optgroup"))) {
				const any = Array.from(group.querySelectorAll<HTMLElement>(":scope > neo-option")).some((opt) => !opt.hidden);
				setHiddenIfChanged(group, !any);
			}
			const empty = this.#shownOptions().length === 0;
			setHiddenIfChanged(this.#emptyResultsEl, !empty);
			if (empty) this.#renderEmptyResults();
		});
	}

	#focusInitialOption() {
		if (!this.open) return;
		const visible = this.#focusableOptions();
		if (visible.length === 0) {
			this.#input.focus({ preventScroll: true });
			this.#input.select();
			return;
		}
		const selected = new Set(this.selectedValues);
		const target = visible.find((o) => selected.has(o.getAttribute("data-neo-value") ?? "")) ?? visible[0];
		this.#focusOption(target, { center: true });
	}

	// `center` puts the row mid-scroller (open-with-selection); the default
	// nearest-edge scroll is for arrow nav, which must not recenter per press.
	#focusOption(el: HTMLElement, opts: { preventScroll?: boolean; center?: boolean } = {}) {
		for (const opt of this.optionEls()) {
			opt.tabIndex = opt === el ? 0 : -1;
		}
		this.#lastFocusedKind = "option";
		this.lastFocusedOptionValue = el.getAttribute("data-neo-value");
		el.focus({ preventScroll: !!opts.preventScroll || !!opts.center });
		if (opts.center) this.centerOptionInScroller(this.#optionsEl, el);
		else if (!opts.preventScroll) el.scrollIntoView({ block: "nearest" });
		// Snapshot synchronously: the scroll event lands a task later, so a
		// morph reconcile arriving first would restore the stale pre-scroll
		// value and yank the list back to the top.
		this.#lastOptionsScrollTop = this.#optionsEl.scrollTop;
	}

	#focusSearch(opts: { preventScroll?: boolean } = {}) {
		this.#lastFocusedKind = "search";
		this.lastFocusedOptionValue = null;
		this.#input.focus({ preventScroll: !!opts.preventScroll });
	}

	#activeVisibleOptionIndex(visible: HTMLElement[]): number {
		const active = deepActiveElement();
		if (!(active instanceof HTMLElement)) return -1;
		const opt = active.closest<HTMLElement>("neo-option");
		return opt ? visible.indexOf(opt) : -1;
	}

	#restoreOpenFocusAfterPatch() {
		if (!this.open) return;
		if (this.#optionsEl.scrollTop !== this.#lastOptionsScrollTop) {
			this.#optionsEl.scrollTop = this.#lastOptionsScrollTop;
		}
		const active = deepActiveElement();
		if (active === this.#input) {
			this.#captureInputSelection();
			return;
		}
		if (active instanceof HTMLElement && active.closest("neo-option") && this.contains(active)) {
			return;
		}
		if (this.#lastFocusedKind === "search") {
			this.#focusSearch({ preventScroll: true });
			this.#restoreInputSelection();
			return;
		}
		if (this.#lastFocusedKind === "option" && this.lastFocusedOptionValue !== null) {
			const restored = this.#focusableOptions().find(
				(opt) => opt.getAttribute("data-neo-value") === this.lastFocusedOptionValue,
			);
			if (restored) {
				this.#focusOption(restored, { preventScroll: true });
				return;
			}
		}
		this.#focusInitialOption();
	}

	#restoreInputSelection() {
		try {
			this.#input.setSelectionRange(
				this.#lastInputSelectionStart,
				this.#lastInputSelectionEnd,
				this.#lastInputSelectionDirection,
			);
		} catch {
			// Some input types/platform states reject selection restoration.
		}
	}

	#forwardPrintableKeyToSearch(e: KeyboardEvent) {
		if (e.key.length !== 1 || e.key === " ") return false;
		e.preventDefault();
		this.#focusSearch({ preventScroll: true });
		const start = this.#input.selectionStart ?? this.#input.value.length;
		const end = this.#input.selectionEnd ?? start;
		this.#input.setRangeText(e.key, start, end, "end");
		this.#captureInputSelection();
		this.#input.dispatchEvent(new Event("input", { bubbles: true }));
		return true;
	}

	#forwardBackspaceToSearch(e: KeyboardEvent) {
		if (this.#input.value.length === 0) {
			this.#focusSearch({ preventScroll: true });
			return true;
		}
		e.preventDefault();
		this.#focusSearch({ preventScroll: true });
		const start = this.#input.selectionStart ?? this.#input.value.length;
		const end = this.#input.selectionEnd ?? start;
		if (start !== end) {
			this.#input.setRangeText("", start, end, "end");
		} else if (start > 0) {
			this.#input.setRangeText("", start - 1, start, "end");
		}
		this.#captureInputSelection();
		this.#input.dispatchEvent(new Event("input", { bubbles: true }));
		return true;
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
		// Closed-and-focused trigger only: the open state's search input
		// owns Backspace for editing the query, so clearing lives here.
		if (
			(e.key === "Backspace" || e.key === "Delete") &&
			boolAttr(this, "clearable", false) &&
			this.getAttribute("value") !== null
		) {
			e.preventDefault();
			this.#clearValue();
			return;
		}
		if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter" && e.key !== " ") return;
		e.preventDefault();
		this.show();
	};

	#onOptionClick = (e: MouseEvent) => {
		const row = (e.target as Element | null)?.closest<HTMLElement>("neo-option");
		if (row && this.contains(row)) this.#activate(row);
	};

	#onLightDomOptionKeyDown = (e: KeyboardEvent) => {
		const row = (e.composedPath()[0] as Element | null)?.closest?.("neo-option");
		if (!(row instanceof HTMLElement) || !this.contains(row)) return;
		this.#onOptionKeyDown(e);
	};

	#onOptionKeyDown = (e: KeyboardEvent) => {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key === "Enter" || e.key === " ") {
			const row = (e.target as Element | null)?.closest<HTMLElement>("neo-option");
			if (row) {
				e.preventDefault();
				e.stopPropagation();
				this.#activate(row);
			}
			return;
		}
		const visible = this.#focusableOptions();
		if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
			e.preventDefault();
			e.stopPropagation();
			if (visible.length === 0) {
				this.#focusSearch({ preventScroll: true });
				return;
			}
			const idx = this.#activeVisibleOptionIndex(visible);
			if (e.key === "Home") {
				this.#focusOption(visible[0]);
				return;
			}
			if (e.key === "End") {
				this.#focusOption(visible[visible.length - 1]);
				return;
			}
			if (e.key === "ArrowDown") {
				if (idx === -1 || idx >= visible.length - 1) this.#focusSearch({ preventScroll: true });
				else this.#focusOption(visible[idx + 1]);
				return;
			}
			if (idx <= 0) this.#focusSearch({ preventScroll: true });
			else this.#focusOption(visible[idx - 1]);
			return;
		}
		if (e.key === "Backspace") {
			e.stopPropagation();
			this.#forwardBackspaceToSearch(e);
			return;
		}
		if (this.#forwardPrintableKeyToSearch(e)) e.stopPropagation();
	};

	#onSearchKeyDown = (e: KeyboardEvent) => {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			const first = this.#focusableOptions()[0];
			if (first) this.#focusOption(first);
			return;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			const visible = this.#focusableOptions();
			const last = visible[visible.length - 1];
			if (last) this.#focusOption(last);
			return;
		}
		if (e.key === "Enter") {
			const first = this.#focusableOptions()[0];
			if (first) {
				e.preventDefault();
				this.#activate(first);
			}
		}
	};

	#onSearchInput = () => {
		this.#clearSearchDebounceTimer();
		const debounceMs = Math.max(0, parseInt(this.getAttribute("search-debounce") ?? "0", 10) || 0);
		if (debounceMs > 0) {
			this.#searchDebounceTimer = setTimeout(() => {
				this.#searchDebounceTimer = null;
				this.#runSearchInput();
			}, debounceMs);
			return;
		}
		this.#runSearchInput();
	};

	#clearSearchDebounceTimer() {
		if (this.#searchDebounceTimer === null) return;
		clearTimeout(this.#searchDebounceTimer);
		this.#searchDebounceTimer = null;
	}

	#runSearchInput() {
		if (boolAttr(this, "live-search", false)) {
			this.loading = true;
			this.#syncOptions();
		} else {
			this.#applyFilter();
			// applyFilter pauses the MO, so the reposition path doesn't
			// fire on the height change. Re-anchor explicitly.
			if (this.open) this.position();
		}
		const query = this.#input.value;
		queueMicrotask(() => {
			this.dispatchEvent(
				new CustomEvent("neo-combobox-search", {
					bubbles: true,
					detail: { query },
				}),
			);
		});
	}

	#onOptionsSlotChange = () => {
		if (!this.ready || this.observerPauseDepth > 0) return;
		this.scheduleListboxReconcile();
	};

	protected override reconcileOpenCommandPatch(): void {
		this.withLightDomObserverPaused(() => {
			this.#cacheTemplates();
			if (this.loading && (this.optionData().length > 0 || !this.#sourceHasAsyncPlaceholder())) this.loading = false;
			this.#syncA11y();
			this.#syncOptionSlot();
			this.#syncOptions();
			this.#applyValuesFromAttr();
			this.#applyFilter();
		});
		this.syncFocusVisible();
		if (this.open) {
			this.position();
			this.#restoreOpenFocusAfterPatch();
			this.scheduleReposition();
		}
	}

	#onLightDomMutation = (records: MutationRecord[]) => {
		if (!this.#isRelevantLightDomMutation(records)) return;
		// Mid-morph reflow can briefly flip `overflow: auto` into a
		// scrollable state (e.g. content height fluctuates as Datastar
		// reconciles children), and on macOS that's enough for the overlay
		// scrollbar to fade in for ~1s. Pin overflow to `hidden` across the
		// mutation+position pass, then restore on the next frame once the
		// post-morph layout has settled.
		const wasOpen = this.open;
		if (wasOpen) this.#optionsEl.style.overflow = "hidden";
		this.withLightDomObserverPaused(() => {
			this.#cacheTemplates();
			if (this.loading && (this.optionData().length > 0 || !this.#sourceHasAsyncPlaceholder())) this.loading = false;
			this.#syncA11y();
			this.#syncOptionSlot();
			this.#syncOptions();
			this.#applyValuesFromAttr();
			this.#applyFilter();
		});
		// The morph stripped the host's kit-managed focus ring; re-derive it.
		this.syncFocusVisible();
		if (this.open) {
			this.position();
			this.#restoreOpenFocusAfterPatch();
			// Trigger may still shift as morphed siblings (async CodeMirror,
			// images) reflow after this synchronous pass; re-anchor next frame.
			this.scheduleReposition();
			requestAnimationFrame(() => {
				this.#optionsEl.style.overflow = "";
			});
		} else if (wasOpen) {
			this.#optionsEl.style.overflow = "";
		}
	};

	#isRelevantLightDomMutation(records: MutationRecord[]): boolean {
		const source = this.sourceRoot();
		for (const r of records) {
			if (r.type === "characterData") {
				const parent = r.target.parentElement;
				if (parent?.closest("neo-option, neo-optgroup, [data-neo-empty-results], [data-neo-combobox-empty]")) {
					return true;
				}
				continue;
			}
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
					n.matches(
						"neo-option, neo-optgroup, neo-datalist, [data-neo-async-placeholder], [data-neo-empty-results], [data-neo-combobox-empty]",
					)
				)
					return true;
			}
			for (const n of Array.from(r.removedNodes)) {
				if (
					n instanceof Element &&
					n.matches(
						"neo-option, neo-optgroup, neo-datalist, [data-neo-async-placeholder], [data-neo-empty-results], [data-neo-combobox-empty]",
					)
				)
					return true;
			}
		}
		return false;
	}

	// Reorder the search field above the options when the popover opens
	// upward, so it stays pinned closest to the trigger.
	protected override afterPosition(placement: Placement) {
		this.listEl.toggleAttribute("data-neo-combobox-above", placement.startsWith("top"));
	}

	protected override optionsScroller(): HTMLElement {
		return this.#optionsEl;
	}
}

if (!customElements.get("neo-combobox")) {
	customElements.define("neo-combobox", NeoCombobox);
}
