import { boolAttr, openCommand } from "./command";
import { cloneDatalistOptionsInto, externalDatalistFor } from "./neo-datalist";
import {
	anchorPopoverResult,
	applyOpenSizeDuringScroll,
	type Placement,
	scrollAnchorIntoOpenView,
} from "./neo-position";
import { TriggerFace } from "./neo-trigger-face";
import { eventEnters, isIndependentBoundaryScroll, scopingBoundary } from "./shadow-utils";

export { POPOVER_ATTRS } from "./neo-position";

export interface OptionData {
	value: string;
	label: string;
	disabled: boolean;
	el: HTMLElement;
}

export function setAttrIfChanged(el: Element, name: string, value: string) {
	if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

export function readOptionData(el: HTMLElement): OptionData {
	return {
		value: el.getAttribute("value") ?? el.getAttribute("data-neo-value") ?? "",
		label: el.getAttribute("label") ?? el.textContent?.trim() ?? "",
		disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
		el,
	};
}

export function cloneTemplateSource(source: HTMLElement | null, fallback: () => Node): Node[] {
	const root = source instanceof HTMLTemplateElement ? source.content : source;
	const nodes = root ? Array.from(root.childNodes).map((n) => n.cloneNode(true)) : [];
	return nodes.length > 0 ? nodes : [fallback()];
}

// Instantiate a loading placeholder for the light-DOM loading slot. Unlike
// cloneTemplateSource, the [data-neo-async-placeholder] marker element itself
// must land in the clone: the loading-content CSS and author styling key on
// it. An element source clones wholesale; a <template> source instantiates as
// a div carrying the template's attributes (marker included) around its
// content clone.
export function cloneAsyncPlaceholder(source: HTMLElement | null, fallback: () => HTMLElement): HTMLElement {
	if (!source) return fallback();
	if (!(source instanceof HTMLTemplateElement)) return source.cloneNode(true) as HTMLElement;
	const el = document.createElement("div");
	for (const name of source.getAttributeNames()) {
		el.setAttribute(name, source.getAttribute(name) ?? "");
	}
	el.appendChild(source.content.cloneNode(true));
	return el;
}

export function setHiddenIfChanged(el: HTMLElement, hidden: boolean) {
	if (el.hidden !== hidden) el.hidden = hidden;
}

// Shared option wiring for the listbox controls (<neo-select>, <neo-combobox>)
// and <neo-textinput>'s suggestions. Options are keyed by data-neo-value and
// never get an `id`, so a fat morph patches them in place instead of replacing
// id-mismatched nodes (which tears down and re-animates an open popover).
// `roving` gives each option a focusable tabindex so the control can move
// focus into the list; a textbox-with-suggestions keeps focus in the field and
// omits it.
export function wireOptionEl(el: HTMLElement, opt: OptionData, roving: boolean) {
	setAttrIfChanged(el, "role", "option");
	setAttrIfChanged(el, "data-neo-value", opt.value);
	if (roving && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
	if (!el.hasAttribute("aria-selected")) el.setAttribute("aria-selected", "false");
	if (opt.disabled) setAttrIfChanged(el, "aria-disabled", "true");
	else if (!el.hasAttribute("disabled") && el.hasAttribute("aria-disabled")) {
		el.removeAttribute("aria-disabled");
	}
}

// Light-DOM attributes a control reconciles when an option set changes in place
// (a morph patching disabled/value/etc. without replacing the node).
export const OPTION_OBSERVE_ATTRS = ["value", "label", "disabled", "aria-disabled", "slot", "hidden"];

// Shared base for <neo-select> and <neo-combobox>: a trigger button opening a
// fixed-position listbox of <neo-option> children. Holds the option wiring,
// caret, popover positioning, outside-dismiss, Escape, and light-DOM observer
// the two share verbatim. The search input, multi-select, filtering, and the
// keyboard/focus model live in the subclasses. `ns` selects the component's
// symmetric shadow attributes ("select" | "combobox").
export abstract class NeoListbox extends HTMLElement {
	protected abstract readonly ns: string;

	// Form-associated so a bare control submits its value under `name` like a
	// native <select>, no framework binding required. setFormValue tracks the
	// value; the browser reads `name` and the disabled state at submit time.
	static readonly formAssociated = true;
	protected internals: ElementInternals;

	constructor() {
		super();
		this.internals = this.attachInternals();
	}

	protected trigger!: HTMLButtonElement;
	protected labelEl!: HTMLElement;
	protected listEl!: HTMLElement;
	protected caretEl!: HTMLElement;
	protected triggerFace!: TriggerFace;
	protected observer: MutationObserver | null = null;
	protected observerPauseDepth = 0;
	protected ready = false;
	protected applyingValue = false;
	protected open = false;
	protected reflectingOpen = false;
	protected loading = false;
	protected lastFocusedOptionValue: string | null = null;
	protected loadingTemplateEl: HTMLElement | null = null;
	// Disabled by a containing <fieldset> or the host's own `disabled`, tracked
	// via formDisabledCallback and OR'd into isDisabled().
	protected formDisabled = false;
	// Authored `value`, captured on connect; restored on form reset.
	protected defaultValue: string | null = null;

	abstract show(opts?: { focus?: boolean; scrollIntoView?: boolean }): void;
	abstract hide(opts?: { restoreFocus?: boolean }): void;
	protected abstract reconcileOpenCommandPatch(): void;

	#hoverOpenTimer: number | null = null;
	#hoverCloseTimer: number | null = null;
	#resizeObserver: ResizeObserver | null = null;
	#repositionScheduled = false;
	#openCommandReconcileScheduled = false;
	#openCommandScrollHoldUntil = 0;
	#openScrollPositionFrame: number | null = null;
	#openScrollPositionUntil = 0;
	#trackedTriggerRect: DOMRect | null = null;

	protected initTriggerFace() {
		this.triggerFace = new TriggerFace(this, this.labelEl, `data-neo-${this.ns}-trigger-view`, (fn) =>
			this.withLightDomObserverPaused(fn),
		);
	}

	// hover: a mouse over the trigger opens the panel (after hover-open-delay)
	// without moving focus, so hovering can't pull the caret out of a field
	// the user is typing in; leaving the trigger or panel closes it after
	// hover-close-delay, long enough to bridge the gap between them. Mouse
	// only. Touch fires a synthetic mouseenter, so the click path (which
	// always shows, never toggles, while `hover` is set) is the touch and
	// keyboard route to the panel. Same contract and defaults as <neo-popover>.
	protected wireHoverOpen() {
		this.trigger.addEventListener("mouseenter", this.onTriggerMouseEnter);
		this.trigger.addEventListener("mouseleave", this.onHoverMouseLeave);
		this.listEl.addEventListener("mouseenter", this.onPanelMouseEnter);
		this.listEl.addEventListener("mouseleave", this.onHoverMouseLeave);
	}

	protected unwireHoverOpen() {
		this.trigger?.removeEventListener("mouseenter", this.onTriggerMouseEnter);
		this.trigger?.removeEventListener("mouseleave", this.onHoverMouseLeave);
		this.listEl?.removeEventListener("mouseenter", this.onPanelMouseEnter);
		this.listEl?.removeEventListener("mouseleave", this.onHoverMouseLeave);
		this.#clearHoverTimers();
	}

	#clearHoverTimers() {
		if (this.#hoverOpenTimer !== null) {
			clearTimeout(this.#hoverOpenTimer);
			this.#hoverOpenTimer = null;
		}
		if (this.#hoverCloseTimer !== null) {
			clearTimeout(this.#hoverCloseTimer);
			this.#hoverCloseTimer = null;
		}
	}

	protected onTriggerMouseEnter = () => {
		if (boolAttr(this, "hover", false)) this.#scheduleHoverOpen();
	};

	// Pointer reached the panel, so cancel the pending close so crossing the
	// trigger→panel gap doesn't dismiss it.
	protected onPanelMouseEnter = () => {
		if (!boolAttr(this, "hover", false) || this.#hoverCloseTimer === null) return;
		clearTimeout(this.#hoverCloseTimer);
		this.#hoverCloseTimer = null;
	};

	protected onHoverMouseLeave = () => {
		if (boolAttr(this, "hover", false)) this.#scheduleHoverClose();
	};

	#scheduleHoverOpen() {
		if (this.open) return;
		if (this.#hoverCloseTimer !== null) {
			clearTimeout(this.#hoverCloseTimer);
			this.#hoverCloseTimer = null;
		}
		if (this.#hoverOpenTimer !== null) return;
		this.#hoverOpenTimer = window.setTimeout(
			() => {
				this.#hoverOpenTimer = null;
				if (boolAttr(this, "hover", false) && !this.open) this.show({ focus: false });
			},
			this.#hoverDelay("hover-open-delay", 100),
		);
	}

	#scheduleHoverClose() {
		// Left before the open delay elapsed: just cancel the open.
		if (this.#hoverOpenTimer !== null) {
			clearTimeout(this.#hoverOpenTimer);
			this.#hoverOpenTimer = null;
		}
		if (!this.open || this.#hoverCloseTimer !== null) return;
		this.#hoverCloseTimer = window.setTimeout(
			() => {
				this.#hoverCloseTimer = null;
				if (boolAttr(this, "hover", false) && this.open) this.hide();
			},
			this.#hoverDelay("hover-close-delay", 200),
		);
	}

	#hoverDelay(attr: string, fallback: number): number {
		const raw = this.getAttribute(attr);
		if (raw === null || raw === "") return fallback;
		const n = Number(raw);
		return Number.isFinite(n) && n >= 0 ? n : fallback;
	}

	// Click always shows (never toggles) while `hover` is set: the
	// touch/keyboard path to the panel, not a dismiss; cancels a pending
	// hover-open so the show is instant. Returns true if it handled the click.
	protected hoverClickShow(): boolean {
		if (!boolAttr(this, "hover", false)) return false;
		if (this.#hoverOpenTimer !== null) {
			clearTimeout(this.#hoverOpenTimer);
			this.#hoverOpenTimer = null;
		}
		this.show();
		return true;
	}

	toggle(): void {
		if (this.isDisabled()) return;
		if (this.open) this.hide({ restoreFocus: true });
		else this.show();
	}

	protected isDisabled(): boolean {
		return this.formDisabled || boolAttr(this, "disabled", false);
	}

	// Host `disabled` is config (read, never written by the kit). It drives the
	// native disabled flag on the shadow trigger, which owns focus, keyboard,
	// clicks, and the AT announcement; the trigger lives in the shadow root, so
	// a light-DOM morph never strips that flag and no morph re-assert is needed.
	// A runtime disable dismisses an open panel.
	protected syncDisabledState(): void {
		const disabled = this.isDisabled();
		this.trigger.disabled = disabled;
		if (disabled && this.open) this.hide();
	}

	// Fired when a containing <fieldset disabled> or the host's own `disabled`
	// toggles. A disabled form control is barred from submission by the browser.
	formDisabledCallback(disabled: boolean): void {
		this.formDisabled = disabled;
		this.syncDisabledState();
	}

	// Restore the authored value on form reset; the observed `value` change
	// re-renders the trigger and re-submits through updateFormValue.
	formResetCallback(): void {
		if (this.defaultValue === null) this.removeAttribute("value");
		else this.setAttribute("value", this.defaultValue);
	}

	// Submit the current value under the host `name`; no value present submits
	// nothing. Multi-select overrides this to emit one entry per value.
	protected updateFormValue(): void {
		this.internals.setFormValue(this.getAttribute("value"));
	}

	// The trigger owns focus (shadow DOM), so delegate host focus to it; a
	// wrapping <label> then reaches the real control.
	override focus(opts?: FocusOptions): void {
		this.trigger?.focus(opts);
	}

	override blur(): void {
		this.trigger?.blur();
	}

	protected applyOpenCommand(): void {
		if (this.reflectingOpen) return;
		const cmd = openCommand(this);
		if (cmd === "open") {
			this.show({ focus: false });
			this.scheduleOpenCommandReconcile();
			return;
		}
		if (cmd === "close") {
			this.hide();
			return;
		}
		if (this.open) this.reflectOpen();
	}

	protected reflectOpen(): void {
		if (this.hasAttribute("open") && openCommand(this) === "open") return;
		this.reflectingOpen = true;
		try {
			this.setAttribute("open", "");
		} finally {
			this.reflectingOpen = false;
		}
	}

	protected reflectClosed(): void {
		this.#trackedTriggerRect = null;
		if (!this.hasAttribute("open")) return;
		this.reflectingOpen = true;
		try {
			this.removeAttribute("open");
		} finally {
			this.reflectingOpen = false;
		}
	}

	protected scheduleOpenCommandReconcile(): void {
		this.#openCommandScrollHoldUntil = performance.now() + 150;
		this.scheduleListboxReconcile();
	}

	protected scheduleListboxReconcile(): void {
		if (this.#openCommandReconcileScheduled) return;
		this.#openCommandReconcileScheduled = true;
		requestAnimationFrame(() => {
			this.#openCommandReconcileScheduled = false;
			if (!this.isConnected) return;
			this.reconcileOpenCommandPatch();
		});
	}

	// Read options from the external <neo-datalist> this control's list="<id>"
	// points at, when it has no inline source. Public so a datalist can re-trigger it (duck-typed)
	// when patched; called on connect so a control upgrading after its datalist
	// still picks it up. Clones land in a managed container, so the normal
	// source-root projection and keyboard model drive them unchanged.
	syncDatalist(): void {
		if (!this.ready) return;
		const datalist = externalDatalistFor(this);
		const managed = this.querySelector<HTMLElement>(":scope > [data-neo-datalist-managed]");
		if (!datalist) {
			// Inline source won (or none matches): drop prior clones. A
			// container we created goes entirely; a reused author/wrapper
			// container is just emptied. Either reconciles via the observer.
			if (managed?.hasAttribute("data-neo-datalist-created")) managed.remove();
			else if (managed) {
				managed.replaceChildren();
				managed.removeAttribute("data-neo-datalist-managed");
			}
			return;
		}
		cloneDatalistOptionsInto(managed ?? this.#ensureManagedContainer(), datalist);
	}

	// The container external-datalist clones live in: the control's own
	// `#<id>-options` container (the wrapper ships one), else a fresh
	// <neo-datalist> (the kit's option-data container, display: contents).
	// Mark a freshly created one so cleanup removes it rather than an author's.
	#ensureManagedContainer(): HTMLElement {
		const optionsID = this.id ? `${this.id}-options` : "";
		let container =
			(optionsID ? this.querySelector<HTMLElement>(`:scope > #${CSS.escape(optionsID)}`) : null) ??
			this.querySelector<HTMLElement>(":scope > [data-neo-datalist-managed]");
		if (!container) {
			container = document.createElement("neo-datalist");
			if (optionsID) container.id = optionsID;
			container.setAttribute("data-neo-datalist-created", "");
			this.appendChild(container);
		}
		container.setAttribute("data-neo-datalist-managed", "");
		return container;
	}

	protected sourceRoot(): HTMLElement {
		if (this.id) {
			const byID = this.querySelector<HTMLElement>(`:scope > #${CSS.escape(`${this.id}-options`)}`);
			if (byID) return byID;
		}
		return (
			this.querySelector<HTMLElement>(`:scope > [data-neo-${this.ns}-options]`) ??
			this.querySelector<HTMLElement>(":scope > neo-datalist") ??
			this
		);
	}

	protected optionEls(): HTMLElement[] {
		const source = this.sourceRoot();
		const selector = "neo-option";
		const opts =
			source === this
				? Array.from(this.querySelectorAll<HTMLElement>(`:scope > ${selector}, :scope > neo-optgroup > ${selector}`))
				: Array.from(source.querySelectorAll<HTMLElement>(selector));
		return opts.filter((el) => !el.closest("[data-neo-async-placeholder]"));
	}

	protected optionData(): OptionData[] {
		return this.optionEls().map((el) => readOptionData(el));
	}

	protected wireOption(opt: OptionData) {
		wireOptionEl(opt.el, opt, true);
	}

	protected observeLightDom() {
		this.observer?.observe(this, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: OPTION_OBSERVE_ATTRS,
		});
	}

	protected withLightDomObserverPaused(fn: () => void) {
		this.observerPauseDepth += 1;
		if (this.observerPauseDepth === 1) this.observer?.disconnect();
		try {
			fn();
		} finally {
			this.observerPauseDepth -= 1;
			if (this.observerPauseDepth === 0 && this.isConnected) this.observeLightDom();
		}
	}

	protected setAttrIfChanged(el: Element, name: string, value: string) {
		if (el.getAttribute(name) !== value) el.setAttribute(name, value);
	}

	// Trigger caret glyph: absent -> the up/down chevrons; caret="<name>"
	// swaps the icon (routed through <neo-icon>, so it follows the active
	// icon theme); caret="" (present but empty) hides the caret entirely.
	protected syncCaret() {
		const caret = this.getAttribute("caret");
		this.caretEl.style.display = caret === "" ? "none" : "";
		if (caret !== "") this.caretEl.setAttribute("name", caret || "chevrons-up-down");
	}

	// Mirror the trigger's live :focus-visible onto the host, which paints
	// the ring (the trigger's own outline is suppressed). A fat morph
	// reconciles the host's attributes against SSR and strips this
	// kit-managed attribute while the trigger keeps focus, so the morph
	// path re-asserts it through this same sync.
	protected syncFocusVisible() {
		if (this.trigger?.matches(":focus-visible")) {
			this.setAttribute("data-neo-focus-visible", "");
		} else {
			this.removeAttribute("data-neo-focus-visible");
		}
	}

	protected onTriggerFocus = () => this.syncFocusVisible();

	protected onTriggerBlur = () => this.syncFocusVisible();

	// Escape closes the open popover and returns focus to the trigger, from
	// any focus state (option, list, trigger). stopPropagation so an enclosing
	// dialog/drawer doesn't also dismiss on the same press.
	protected onEscapeKeyDown = (e: KeyboardEvent) => {
		if (e.key !== "Escape" || !this.open || e.isComposing) return;
		e.preventDefault();
		e.stopPropagation();
		this.hide({ restoreFocus: true });
	};

	protected onDocPointerDown = (e: PointerEvent) => {
		if (!this.open) return;
		if (eventEnters(e, this) || eventEnters(e, this.listEl)) return;
		const boundary = scopingBoundary(this, "dismiss");
		if (boundary && !eventEnters(e, boundary)) return;
		this.hide();
	};

	protected onDocFocusIn = (e: FocusEvent) => {
		if (!this.open) return;
		// `contains` stops at the shadow boundary, so it misses the trigger
		// (shadow DOM); use the composed path. Otherwise focusing the
		// trigger to close reads as focus leaving and we hide-then-reopen.
		if (eventEnters(e, this) || eventEnters(e, this.listEl)) return;
		const boundary = scopingBoundary(this, "dismiss");
		if (boundary && !eventEnters(e, boundary)) return;
		this.hide();
	};

	protected onWindowScroll = (e: Event) => {
		if (!this.open) return;
		if (e.target instanceof Node && this.listEl.contains(e.target)) return;
		// Captured scroll sees every document scroller. Listboxes react to
		// anchor movement, not to unrelated scrollable regions.
		if (!this.#triggerRectMoved()) return;
		// Scoped scroll: an independent scroller outside the boundary follows
		// the trigger instead of dismissing. Scrollers inside the boundary, and
		// ancestor scrollers that carry it, keep the default behavior.
		const sb = scopingBoundary(this, "scroll");
		if (sb && isIndependentBoundaryScroll(sb, e.target)) {
			this.position();
			return;
		}
		const mode = this.#followScrollMode();
		if (mode === "always") {
			this.position();
			return;
		}
		if (mode === "until-trigger-invisible") {
			// keepWhenUnfit: a keyboard-shrunk fit failure follows the trigger
			// rather than dismissing; only a genuinely hidden trigger closes.
			if (intersectsLayoutViewport(this.trigger)) {
				this.position({ keepWhenUnfit: true });
			} else {
				this.hide();
			}
			return;
		}
		if (performance.now() < this.#openCommandScrollHoldUntil) {
			this.#applyOpenScrollPosition();
			return;
		}
		this.hide();
	};

	protected reposition = () => {
		if (this.open) this.position();
	};

	// Re-anchor when the panel's own size changes (slotted options grew or
	// shrank, an icon finished loading) or the trigger's does (multi-select
	// chips wrapping onto a new row). The mutation-driven position() is
	// synchronous and catches childList swaps; this catches the async size
	// changes those miss. Safe from a resize loop: position() writes only
	// panel top/left/max-*, derived from the trigger position, so a stable
	// layout re-triggers neither observation.
	protected observePanelResize() {
		this.#resizeObserver ??= new ResizeObserver(() => {
			if (this.open) this.position();
		});
		this.#resizeObserver.observe(this.listEl);
		this.#resizeObserver.observe(this.trigger);
	}

	protected disconnectPanelResize() {
		this.#resizeObserver?.disconnect();
		this.cancelOpenScrollPositioning();
	}

	// Reposition after the surrounding morph settles (post-layout), coalesced
	// into one rAF. A fat morph can move the trigger by reflowing siblings
	// (e.g. async CodeMirror blocks above it) after the synchronous position()
	// already ran; without this the panel stays anchored to the trigger's old
	// spot until an unrelated scroll/resize. Mirrors <neo-popover>.
	protected scheduleReposition() {
		if (this.#repositionScheduled) return;
		this.#repositionScheduled = true;
		requestAnimationFrame(() => {
			this.#repositionScheduled = false;
			if (this.open) this.position();
		});
	}

	protected position(opts: { scrollIntoView?: boolean; keepWhenUnfit?: boolean } = {}): boolean {
		if (this.#shouldCloseForHiddenTrigger()) {
			this.hide();
			return false;
		}
		if (!opts.scrollIntoView && performance.now() < this.#openCommandScrollHoldUntil) {
			const fits = this.#applyOpenScrollPosition();
			if (!fits) this.#scheduleOpenScrollPositioning();
			return true;
		}
		if (this.#applyPosition()) return true;
		if (opts.scrollIntoView) {
			this.#openCommandScrollHoldUntil = performance.now() + 1000;
			scrollAnchorIntoOpenView(this.trigger);
			if (!this.#applyOpenScrollPosition()) this.#scheduleOpenScrollPositioning();
			return true;
		}
		if (opts.keepWhenUnfit) return false;
		this.hide();
		return false;
	}

	// The scrollable box holding the option rows; the panel itself by default.
	// The combobox overrides this: its panel is a flex column whose inner
	// options container scrolls.
	protected optionsScroller(): HTMLElement {
		return this.listEl;
	}

	// anchorPopoverResult clears the panel's inline max-* to measure its
	// natural size. While cleared, the options scroller fits its whole
	// content, which clamps scrollTop to 0; re-applying max-height does not
	// bring the scroll back, so every reposition would reset the list to the
	// top. Snapshot and restore around the pass.
	#anchorPreservingScroll(opts?: { ignorePositioningBoundary?: boolean }): ReturnType<typeof anchorPopoverResult> {
		const scroller = this.optionsScroller();
		const scrollTop = scroller.scrollTop;
		const result = anchorPopoverResult(this, this.trigger, this.listEl, opts);
		if (scroller.scrollTop !== scrollTop) scroller.scrollTop = scrollTop;
		return result;
	}

	#applyPosition(): boolean {
		const result = this.#anchorPreservingScroll();
		if (!result.fitsOpenSize) {
			return false;
		}
		this.#applyPositionResult(result);
		return true;
	}

	#applyOpenScrollPosition(): boolean {
		const result = this.#anchorPreservingScroll({ ignorePositioningBoundary: true });
		if (result.fitsOpenSize) {
			this.#applyPositionResult(result);
			return true;
		}
		applyOpenSizeDuringScroll(this.listEl, result);
		this.afterPosition(result.placement);
		this.#rememberTriggerRect();
		this.dispatchEvent(
			new CustomEvent("neo-popover-position", {
				bubbles: true,
				detail: { placement: result.placement },
			}),
		);
		return false;
	}

	#applyPositionResult(result: ReturnType<typeof anchorPopoverResult>): void {
		this.cancelOpenScrollPositioning();
		this.afterPosition(result.placement);
		this.#rememberTriggerRect();
		this.dispatchEvent(
			new CustomEvent("neo-popover-position", {
				bubbles: true,
				detail: { placement: result.placement },
			}),
		);
	}

	protected cancelOpenScrollPositioning(): void {
		if (this.#openScrollPositionFrame !== null) {
			cancelAnimationFrame(this.#openScrollPositionFrame);
			this.#openScrollPositionFrame = null;
		}
	}

	#scheduleOpenScrollPositioning(): void {
		this.#openScrollPositionUntil = performance.now() + 1000;
		if (this.#openScrollPositionFrame !== null) return;
		const tick = () => {
			this.#openScrollPositionFrame = null;
			if (!this.open || !this.isConnected) return;
			if (this.#shouldCloseForHiddenTrigger()) {
				this.hide();
				return;
			}
			if (this.#applyOpenScrollPosition()) {
				return;
			}
			if (performance.now() < this.#openScrollPositionUntil) {
				this.#openScrollPositionFrame = requestAnimationFrame(tick);
				return;
			}
			this.hide();
		};
		this.#openScrollPositionFrame = requestAnimationFrame(tick);
	}

	// Hook after the panel is placed, before the position event. Default
	// no-op; the combobox uses it to reorder the search field when opening up.
	protected afterPosition(_placement: Placement): void {}

	// Center `el` in `scroller` (open-with-selection UX). Not
	// scrollIntoView({block:"center"}): that would also center every
	// scrollable ancestor, and a page scroll under an open listbox trips
	// the scroll-dismiss path.
	protected centerOptionInScroller(scroller: HTMLElement, el: HTMLElement) {
		const c = scroller.getBoundingClientRect();
		const r = el.getBoundingClientRect();
		scroller.scrollTop += r.top + r.height / 2 - (c.top + c.height / 2);
	}

	#followScrollMode(): "off" | "always" | "until-trigger-invisible" {
		const value = this.getAttribute("follow-scroll");
		if (value === "always" || value === "until-trigger-invisible") return value;
		return "off";
	}

	// visualViewport resize/scroll fire as the mobile keyboard insets the view.
	// keepWhenUnfit re-anchors without dismissing when the panel no longer fits.
	protected onViewportChange = () => {
		if (this.open) this.position({ keepWhenUnfit: true });
	};

	#shouldCloseForHiddenTrigger(): boolean {
		// Layout viewport, not visual: the keyboard shrinks the visual viewport
		// but leaves the trigger in place (see intersectsLayoutViewport).
		return this.#followScrollMode() === "until-trigger-invisible" && !intersectsLayoutViewport(this.trigger);
	}

	#rememberTriggerRect(): void {
		this.#trackedTriggerRect = this.trigger.getBoundingClientRect();
	}

	#triggerRectMoved(): boolean {
		const now = this.trigger.getBoundingClientRect();
		const prev = this.#trackedTriggerRect;
		this.#trackedTriggerRect = now;
		return !prev || prev.x !== now.x || prev.y !== now.y || prev.width !== now.width || prev.height !== now.height;
	}
}

// Intersects the layout viewport, ignoring the visual-viewport inset the mobile
// keyboard adds: a keyboard-covered trigger has not scrolled away, so
// until-trigger-invisible must not dismiss for it. Genuine scroll-away still hides.
function intersectsLayoutViewport(el: HTMLElement): boolean {
	const rect = el.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) return false;
	const vw = document.documentElement.clientWidth;
	const vh = document.documentElement.clientHeight;
	return rect.right > 0 && rect.left < vw && rect.bottom > 0 && rect.top < vh;
}
