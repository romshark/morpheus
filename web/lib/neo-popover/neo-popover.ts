import { boolAttr, openCommand } from "../command";
import { observeManagedAttrs, setAttrIfChanged } from "../neo-morph-resilient";
import {
	applyOpenSizeDuringScroll,
	type Placement,
	type PositionResult,
	positionPanelResult,
	resolveCssLengthPx,
	resolveCssLengthPxOrContent,
	resolveOptionalCssLengthPx,
	scrollAnchorIntoOpenView,
} from "../neo-position";
import { deepActiveElement, eventEnters, isIndependentBoundaryScroll, scopingBoundary } from "../shadow-utils";

let nextId = 0;
const TRIGGER_RESILIENT_ATTRS = ["aria-controls", "aria-expanded", "aria-haspopup", "role", "tabindex"];

// Shadow tree: a default slot for the trigger followed by a positioned
// panel that contains a named slot for the content. The panel is
// shadow-owned so the inline top/left/max-*/positioned marker the
// component writes can't be stripped by a fat morph (which can only
// reach light DOM). The user's `[data-neo-popover-content]` div still
// lives in light DOM and is projected into the panel via manual slot
// assignment: bindChildren calls slot.assign(node) on both slots, so
// projection survives a morph that strips the `slot=` attribute the
// auto-assignment mode would otherwise depend on.
const POPOVER_SHADOW_TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - [data-neo-popover-panel]:not([data-neo-popover-positioned]): bridge
//   between [open] flipping on and JS writing inline top/left. Suppress the
//   first paint at the CSS-default (0,0) until position() has stamped
//   data-neo-popover-positioned on the panel.
POPOVER_SHADOW_TEMPLATE.innerHTML = `
<style>
  :host { display: inline-block; }
  :host([hidden]) { display: none; }

  [data-neo-popover-panel] {
    position: fixed;
    top: 0;
    left: 0;
    box-sizing: border-box;
    background-color: var(--neo-popover-bg, #ffffff);
    color: var(--neo-popover-color, var(--page-fg, #111827));
    border: var(--neo-popover-border-width, 1px) solid
      var(--neo-popover-border-color, rgba(0, 0, 0, 0.08));
    border-radius: var(--neo-popover-radius, var(--page-radius, 0.25rem));
    background-clip: border-box;
    padding: var(--neo-popover-padding, calc(var(--page-spacing, 0.25rem) * 4));
    box-shadow: var(--neo-popover-shadow,
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05));
    min-width: var(--neo-popover-min-width, 14rem);
    max-width: min(
      var(--neo-popover-max-width, 22rem),
      calc(100vw - 2 * var(--neo-popover-screen-offset, 8px))
    );
    max-height: calc(100dvh - 2 * var(--neo-popover-screen-offset, 8px));
    overflow: auto;
    overscroll-behavior: none;
    -webkit-overflow-scrolling: auto;
    z-index: var(--neo-popover-z-index, 1000);
    opacity: 1;
    transform: none;
    transition:
      opacity var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease-out),
      transform var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease-out),
      display var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) allow-discrete;
  }
  :host(:not([open])) [data-neo-popover-panel] {
    display: none;
    opacity: 0;
    transform: translateY(-4px);
  }
  [data-neo-popover-panel]:not([data-neo-popover-positioned]) {
    visibility: hidden;
  }
  @starting-style {
    :host([open]) [data-neo-popover-panel] {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  [data-neo-popover-panel]:focus { outline: none; }
  [data-neo-popover-panel]:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    [data-neo-popover-panel] { transition: none; }
  }
</style>
<slot></slot>
<div data-neo-popover-panel role="dialog">
  <slot name="content"></slot>
</div>
`;

export class NeoPopover extends HTMLElement {
	static readonly observedAttributes = [
		"open",
		"placement",
		"screen-offset",
		"clamp-placement",
		"min-fit-height",
		"min-fit-width",
		"min-open-height",
		"min-open-width",
		"match-trigger-width",
		"flip",
	];

	#trigger: HTMLElement | null = null;
	#content: HTMLElement | null = null;
	// Shadow slots, manually populated by bindChildren via slot.assign().
	// We avoid the `slot=` attribute path because a fat morph reconciles
	// the content's attributes back to source HTML (which doesn't carry
	// `slot=`), so any attribute-driven projection would land in the
	// default slot, i.e. render inline next to the trigger.
	#defaultSlot!: HTMLSlotElement;
	#contentSlot!: HTMLSlotElement;
	// Shadow-owned positioning structure. `content` (light DOM) is slotted
	// into this panel. position() writes inline coords / max-* here so
	// they survive a morph; the panel's data-neo-popover-positioned
	// marker gates the visibility CSS in the shadow stylesheet above.
	#panel!: HTMLElement;
	#previousFocus: Element | null = null;
	#resizeObserver: ResizeObserver | null = null;
	#childObserver: MutationObserver | null = null;
	#triggerAttrObserver: MutationObserver | null = null;
	#ready = false;

	// Resize observer target. When the panel grows / shrinks (slotted
	// content changed size), re-anchor via position().
	#resizeTarget: HTMLElement | null = null;

	// Rendered open state; `open` is its reflection (see command).
	// Survives a morph strip; cleared only by a genuine dismissal.
	#openIntent = false;
	// Guards reflective attribute writes so they aren't read as commands.
	#reflectingOpen = false;
	// Coalesces post-morph reposition rAFs.
	#repositionScheduled = false;
	#recoveryRepositionScheduled = false;
	#openScrollHoldUntil = 0;
	#openScrollPositionFrame: number | null = null;
	#openScrollPositionUntil = 0;
	// First connectedCallback distinguishes a genuine open-on-load (layout
	// may not be settled, defer the anchor) from a morph re-attach (settled).
	#firstConnect = true;
	#initialOpenPending = false;
	// Identity-keyed resolver for the last focused descendant. A bare
	// node ref would go stale on a morph that swaps the node; this
	// re-queries the live content by id / data-neo-value.
	#lastFocusedResolver: ((root: Element) => HTMLElement | null) | null = null;
	// Last observed content scrollTop; restored after a morph re-emits at 0.
	#lastContentScrollTop = 0;

	// Hover-open timers. open/close are mutually exclusive: scheduling
	// one cancels the other so a quick re-entry doesn't open-then-close.
	#hoverOpenTimer: number | null = null;
	#hoverCloseTimer: number | null = null;

	constructor() {
		super();
		// Shadow owns the positioned panel so the inline top/left/max-*
		// and the data-neo-popover-positioned marker can't be stripped by
		// a morph (morphs only reach light DOM). The trigger renders via
		// the default slot, the user's [data-neo-popover-content] via the
		// named slot inside the panel.
		//
		// slotAssignment: "manual" so projection doesn't depend on the
		// `slot=` attribute the morph would otherwise reconcile away;
		// bindChildren calls slot.assign(node) and the pairing persists
		// for the element's lifetime regardless of any light-DOM attribute
		// changes the morph applies.
		const root = this.attachShadow({ mode: "open", slotAssignment: "manual" });
		root.appendChild(POPOVER_SHADOW_TEMPLATE.content.cloneNode(true));
		this.#panel = root.querySelector<HTMLElement>("[data-neo-popover-panel]")!;
		this.#defaultSlot = root.querySelector<HTMLSlotElement>("slot:not([name])")!;
		this.#contentSlot = root.querySelector<HTMLSlotElement>("slot[name='content']")!;
	}

	connectedCallback() {
		// Re-anchor on size change (slotted content grew / shrank).
		this.#resizeObserver = new ResizeObserver(() => {
			if (this.hasAttribute("open")) this.#position();
		});

		if (!this.#bindChildren()) return;

		this.#panel.addEventListener("scroll", this.#onPanelScroll, { passive: true });
		this.addEventListener("click", this.#onContentClick);
		this.addEventListener("keydown", this.#onKeyDown);
		document.addEventListener("pointerdown", this.#onDocPointerDown, true);
		document.addEventListener("focusin", this.#onDocFocusIn, true);
		window.addEventListener("resize", this.reposition);
		// Capture so a scroll inside a scoped <neo-boundary> reaches here even
		// though scroll doesn't bubble; the handler dismisses on inside-region
		// scroll, which the rAF tracker can't distinguish from an outside one.
		window.addEventListener("scroll", this.#onWindowScroll, true);
		// iOS keyboard shrinks/translates the visual viewport without
		// firing window resize/scroll, so a panel open across keyboard
		// show/hide would clip behind it without these listeners.
		window.visualViewport?.addEventListener("resize", this.reposition);
		window.visualViewport?.addEventListener("scroll", this.reposition);

		// A fat morph can replace trigger/content with fresh nodes;
		// re-acquire refs and silently re-establish an open panel.
		// subtree:true also catches morphs that update the content's
		// *descendants* (same content element, new children); those
		// changes resize the slotted panel, and without a synchronous
		// reposition the panel paints one frame at old-top + new-size
		// before the ResizeObserver async callback re-anchors it.
		this.#childObserver = new MutationObserver(this.#onChildMutation);
		this.#childObserver.observe(this, { childList: true, subtree: true });

		// Command `open` on connect: explicit open/close obey; absent
		// keeps prior intent (persists across reconnect/morph).
		const cmd = openCommand(this);
		if (cmd === "open") this.#openIntent = true;
		else if (cmd === "close") this.#openIntent = false;
		this.#ready = true;
		if (this.#openIntent) {
			if (this.#firstConnect) this.#initialOpenPending = true;
			// applyOpen would normally focus firstTabbable (e.g. the search
			// input); noFocus skips that and the focused descendant is
			// restored below for a morph re-attach.
			this.#applyOpen({ silent: true, noFocus: true });
			this.#restoreFocusedDescendant();
			this.#restoreContentScroll();
			if (this.#firstConnect) {
				// Open on initial render: applyOpen positioned against a
				// layout that may not be settled, which can strand the panel
				// at a stale rect with nothing to re-run it. Hide it (clear
				// the positioned marker so the gating CSS keeps it invisible)
				// and re-anchor next frame, so it appears once at the trigger.
				delete this.#panel.dataset.neoPopoverPositioned;
				this.#scheduleReposition();
			} else {
				// Morph re-attach of an already-open panel: layout is ready,
				// so snap it back in place without replaying the entry
				// animation.
				this.#suppressEntryAnimation();
			}
		}
		this.#firstConnect = false;
	}

	// Acquire/refresh trigger + content refs and rewire listeners on
	// the live nodes.
	// The host's direct child that contains `node` (or `node` itself when it
	// is already a direct child): the element slot.assign() can project.
	#slottable(node: HTMLElement): HTMLElement {
		let el: HTMLElement = node;
		while (el.parentElement && el.parentElement !== this) {
			el = el.parentElement;
		}
		return el;
	}

	#bindChildren(): boolean {
		const newTrigger = this.querySelector<HTMLElement>("[data-neo-popover-trigger]");
		const newContent = this.querySelector<HTMLElement>("[data-neo-popover-content]");
		if (!newTrigger || !newContent) {
			if (!this.#trigger || !this.#content) {
				console.warn("<neo-popover> requires a [data-neo-popover-trigger] and [data-neo-popover-content] child.");
			}
			return false;
		}

		if (newTrigger !== this.#trigger) {
			this.#trigger?.removeEventListener("click", this.#onTriggerClick);
			this.#trigger?.removeEventListener("mouseenter", this.#onTriggerMouseEnter);
			this.#trigger?.removeEventListener("mouseleave", this.#onTriggerMouseLeave);
			this.#triggerAttrObserver?.disconnect();
			this.#triggerAttrObserver = null;
			this.#trigger = newTrigger;
			this.#trigger.addEventListener("click", this.#onTriggerClick);
			this.#trigger.addEventListener("mouseenter", this.#onTriggerMouseEnter);
			this.#trigger.addEventListener("mouseleave", this.#onTriggerMouseLeave);
		}
		if (newContent !== this.#content) {
			this.#content?.removeEventListener("mouseenter", this.#onContentMouseEnter);
			this.#content?.removeEventListener("mouseleave", this.#onContentMouseLeave);
			this.#content = newContent;
			this.#content.addEventListener("mouseenter", this.#onContentMouseEnter);
			this.#content.addEventListener("mouseleave", this.#onContentMouseLeave);
		}
		// Project both into the shadow via manual slot assignment. slot.assign
		// only accepts the host's direct children (slottables), so assign the
		// top-level child that *contains* each: the trigger or content may be
		// nested (e.g. a button inside a wrapping <neo-input-group>). Assigning
		// a nested node is a silent no-op that would leave the wrapper
		// unrendered (collapsed to 0×0).
		// Idempotent: slot.assign() with the same element is a no-op.
		this.#defaultSlot.assign(this.#slottable(this.#trigger));
		this.#contentSlot.assign(this.#slottable(this.#content));

		// Observe the slotted content (light DOM) so a size change inside
		// the panel (e.g. options arriving, content morphing), re-anchors
		// the panel via position(). The panel itself doesn't need its own
		// observer: its size is determined by its slotted content within
		// the shadow CSS min/max constraints.
		if (this.#resizeTarget !== this.#content) {
			if (this.#resizeTarget) this.#resizeObserver?.unobserve(this.#resizeTarget);
			this.#resizeTarget = this.#content;
			this.#resizeObserver?.observe(this.#resizeTarget);
		}

		// aria-controls points at the shadow panel (the actual dialog
		// surface): it owns role="dialog" and tabindex/aria-modal, while
		// `content` is just a user-authored body slotted inside it.
		if (!this.#panel.id) this.#panel.id = `neo-popover-${++nextId}`;
		if (!this.#panel.hasAttribute("aria-modal")) {
			this.#panel.setAttribute("aria-modal", "false");
		}
		this.#panel.setAttribute("tabindex", "-1");
		this.#syncTriggerAttrs();
		this.#triggerAttrObserver ??= observeManagedAttrs(this.#trigger, TRIGGER_RESILIENT_ATTRS, this.#syncTriggerAttrs);
		return true;
	}

	#syncTriggerAttrs = () => {
		if (!this.#trigger) return;
		setAttrIfChanged(this.#trigger, "aria-haspopup", "dialog");
		setAttrIfChanged(this.#trigger, "aria-controls", this.#panel.id);
		// In-place morphs strip these without re-firing connectedCallback.
		// Guards preserve composite overrides (navgroup roving tabindex,
		// `role="menuitem"` in cascading menus).
		if (!this.#trigger.hasAttribute("role")) {
			setAttrIfChanged(this.#trigger, "role", "button");
		}
		if (!this.#trigger.hasAttribute("tabindex")) {
			setAttrIfChanged(this.#trigger, "tabindex", "0");
		}
		setAttrIfChanged(this.#trigger, "aria-expanded", String(this.hasAttribute("open")));
	};

	disconnectedCallback() {
		this.#ready = false;
		this.#clearHoverTimers();
		this.#trigger?.removeEventListener("click", this.#onTriggerClick);
		this.#trigger?.removeEventListener("mouseenter", this.#onTriggerMouseEnter);
		this.#trigger?.removeEventListener("mouseleave", this.#onTriggerMouseLeave);
		this.#content?.removeEventListener("mouseenter", this.#onContentMouseEnter);
		this.#content?.removeEventListener("mouseleave", this.#onContentMouseLeave);
		this.#panel.removeEventListener("scroll", this.#onPanelScroll);
		this.removeEventListener("click", this.#onContentClick);
		this.removeEventListener("keydown", this.#onKeyDown);
		document.removeEventListener("pointerdown", this.#onDocPointerDown, true);
		document.removeEventListener("focusin", this.#onDocFocusIn, true);
		window.removeEventListener("resize", this.reposition);
		window.removeEventListener("scroll", this.#onWindowScroll, true);
		window.visualViewport?.removeEventListener("resize", this.reposition);
		window.visualViewport?.removeEventListener("scroll", this.reposition);
		this.#stopTriggerTracking();
		this.#triggerAttrObserver?.disconnect();
		this.#triggerAttrObserver = null;
		this.#resizeObserver?.disconnect();
		this.#resizeObserver = null;
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		// Null refs so bindChildren rewires listeners on reconnect; a
		// move (remove+insert) strips them here, and bindChildren's
		// identity guard would otherwise skip re-adding.
		this.#trigger = null;
		this.#content = null;
	}

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		if (name === "placement") {
			if (this.#ready && this.hasAttribute("open")) this.#position();
			return;
		}
		if (name === "screen-offset") {
			if (newValue === null) {
				this.style.removeProperty("--neo-popover-screen-offset");
			} else {
				this.style.setProperty("--neo-popover-screen-offset", newValue);
			}
			if (this.#ready && this.hasAttribute("open")) this.#position();
			return;
		}
		if (name === "clamp-placement") {
			if (this.#ready && this.hasAttribute("open")) this.#position();
			return;
		}
		if (name === "min-fit-height" || name === "min-fit-width") {
			const cssVar = name === "min-fit-height" ? "--neo-popover-min-fit-height" : "--neo-popover-min-fit-width";
			if (newValue === null) this.style.removeProperty(cssVar);
			else this.style.setProperty(cssVar, newValue);
			if (this.#ready && this.hasAttribute("open")) this.#position();
			return;
		}
		if (name === "min-open-height" || name === "min-open-width") {
			const cssVar = name === "min-open-height" ? "--neo-popover-min-open-height" : "--neo-popover-min-open-width";
			if (newValue === null) this.style.removeProperty(cssVar);
			else this.style.setProperty(cssVar, newValue);
			if (this.#ready && this.hasAttribute("open")) this.#position();
			return;
		}
		if (name === "match-trigger-width") {
			if (this.#ready && this.hasAttribute("open")) this.#position();
			return;
		}
		if (name === "flip") {
			if (this.#ready && this.hasAttribute("open")) this.#position();
			return;
		}
		if (name !== "open" || !this.#ready || this.#reflectingOpen) return;
		const cmd = openCommand(this);
		if (cmd === null) {
			// Absent: keep state; re-assert for `[open]` CSS, then
			// reposition. The panel's inline top/left lives in shadow DOM
			// so the morph can't strip it. But the trigger may have moved
			// (other elements morphed around it), so re-run position().
			if (this.#openIntent) {
				this.#reflectOpen();
				this.#position();
				this.#scheduleRecoveryReposition();
			}
			return;
		}
		if (cmd === "open") {
			if (!this.#openIntent) this.#applyOpen();
			else this.#scheduleReposition();
		} else if (this.#openIntent) {
			this.#applyClose();
		} else {
			this.#reflectClose();
		}
	}

	// State → attribute, guarded so it isn't read back as a command.
	#reflectOpen(): void {
		if (!this.hasAttribute("open")) {
			this.#reflectingOpen = true;
			try {
				this.setAttribute("open", "");
			} finally {
				this.#reflectingOpen = false;
			}
		}
		this.#syncTriggerAttrs();
	}

	#reflectClose(): void {
		if (this.hasAttribute("open")) {
			this.#reflectingOpen = true;
			try {
				this.removeAttribute("open");
			} finally {
				this.#reflectingOpen = false;
			}
		}
		this.#syncTriggerAttrs();
	}

	// Reposition after the morph task settles (post-layout), coalesced.
	// Bail if a genuine dismissal landed in the meantime.
	#scheduleReposition(): void {
		if (this.#repositionScheduled) return;
		this.#repositionScheduled = true;
		requestAnimationFrame(() => {
			this.#repositionScheduled = false;
			if (this.#openIntent && this.hasAttribute("open")) this.#position();
		});
	}

	// A morph that strips `[open]` from an already-open popover also
	// strips the inline position style and data-neo-popover-positioned
	// marker from the panel. Restore in a microtask so the morph has
	// finished, but before the browser paints an unpositioned/hidden
	// panel and flashes the scrollbars.
	#scheduleRecoveryReposition(): void {
		if (this.#recoveryRepositionScheduled) return;
		this.#recoveryRepositionScheduled = true;
		queueMicrotask(() => {
			this.#recoveryRepositionScheduled = false;
			if (this.#openIntent && this.hasAttribute("open")) this.#position();
		});
	}

	// Drop the panel's transition for one frame so a recovery rebuild
	// snaps in place; restore so real open/close still animate.
	#suppressEntryAnimation(): void {
		const panel = this.#panel;
		panel.style.transition = "none";
		requestAnimationFrame(() => {
			panel.style.transition = "";
		});
	}

	// childObserver callback: a fat morph re-emitted trigger/content,
	// OR a subtree morph just changed the content's descendants.
	// Re-acquire refs and silently re-establish the panel (no
	// neo-popover-open re-fire). Subtree mutations that don't swap
	// trigger/content still need an immediate position() pass; the
	// ResizeObserver-based path runs one frame late and leaves the
	// panel painted at the old anchor with the new size for that frame.
	#onChildMutation = () => {
		const prevTrigger = this.#trigger;
		const prevContent = this.#content;
		if (!this.#bindChildren() || !this.#ready || !this.#openIntent) return;
		const refsChanged = this.#trigger !== prevTrigger || this.#content !== prevContent;
		if (refsChanged) {
			this.#reflectOpen();
			// A replaced content node is freshly inserted under [open] and
			// would replay the @starting-style entry transition.
			if (this.#content !== prevContent) this.#suppressEntryAnimation();
		}
		if (this.hasAttribute("open")) this.#position();
		if (refsChanged) {
			// Only restore if the morph actually yanked focus out of
			// content. Hosts may restore in a later microtask and supersede
			// this.
			if (this.#content && !this.#content.contains(deepActiveElement())) {
				this.#restoreFocusedDescendant();
			}
			this.#restoreContentScroll();
		}
	};

	// Re-query the live content via the captured resolver; falls back to
	// firstTabbable / content. Resolver re-runs each call so a morphed-in
	// node with the same identifier is found.
	#restoreFocusedDescendant(): void {
		if (!this.#content) return;
		const resolved = this.#lastFocusedResolver?.(this.#content) ?? null;
		const target =
			(resolved && this.#content.contains(resolved) ? resolved : null) ?? this.#firstTabbable() ?? this.#content;
		target.focus({ preventScroll: true });
	}

	#restoreContentScroll(): void {
		if (this.#lastContentScrollTop > 0) {
			this.#panel.scrollTop = this.#lastContentScrollTop;
		}
	}

	show(): void {
		if (!this.#openIntent) this.#applyOpen();
	}

	// Open silently: a fat-morph rebuild mustn't re-fire load actions
	// wired to neo-popover-open.
	silentShow(): void {
		if (!this.#openIntent) this.#applyOpen({ silent: true });
	}

	hide(opts: { restoreFocus?: boolean } = {}): void {
		this.#applyClose({ restoreFocus: opts.restoreFocus });
	}

	toggle(): void {
		if (this.#openIntent) this.#applyClose({ restoreFocus: true });
		else this.#applyOpen();
	}

	// Side effects run on intent transitions, not attribute presence.
	#applyOpen(opts: { silent?: boolean; noFocus?: boolean } = {}): void {
		const wasOpen = this.#openIntent;
		this.#openIntent = true;
		if (!wasOpen) this.#previousFocus = document.activeElement;
		this.#reflectOpen();
		if (!this.#trigger || !this.#content) return;
		const finishOpen = () => {
			if (!this.#openIntent || !this.#trigger || !this.#content) return;
			if (!wasOpen || this.#triggerTrackingFrame === null) this.#startTriggerTracking();
			// noFocus (hover-open): skipping focus avoids spurious :focus-visible
			// on the panel: programmatic focus reads as keyboard-driven until a
			// real click resets the heuristic.
			if (!opts.noFocus) {
				// preventScroll under silent: a morph-driven restore mustn't yank
				// the viewport.
				const target = this.#firstTabbable() ?? this.#content;
				target.focus({ preventScroll: !!opts.silent });
			}
			if (!wasOpen && !opts.silent) {
				this.dispatchEvent(new CustomEvent("neo-popover-open", { bubbles: true }));
			}
		};
		if (!this.#position({ scrollIntoView: !opts.noFocus && !opts.silent })) return;
		finishOpen();
	}

	#applyClose(opts: { silent?: boolean; restoreFocus?: boolean } = {}): void {
		const wasOpen = this.#openIntent;
		this.#openIntent = false;
		this.#initialOpenPending = false;
		this.#stopTriggerTracking();
		this.#cancelOpenScrollPositioning();
		this.#reflectClose();
		// Drop any pending hover open/close so a closed panel can't be
		// re-opened a tick later by a stale timer.
		this.#clearHoverTimers();
		// Scope snapshots to one open session.
		this.#lastFocusedResolver = null;
		this.#lastContentScrollTop = 0;
		if (opts.restoreFocus && this.#previousFocus instanceof HTMLElement) {
			this.#previousFocus.focus();
		}
		this.#previousFocus = null;
		if (wasOpen && !opts.silent) {
			this.dispatchEvent(new CustomEvent("neo-popover-close", { bubbles: true }));
		}
	}

	// First natural focus target in content; skips disabled, removed
	// from tab order, or inert subtrees. Returns null for informational
	// panels so the caller can focus the panel itself.
	#firstTabbable(): HTMLElement | null {
		if (!this.#content) return null;
		const selector =
			'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
			"select:not([disabled]), textarea:not([disabled]), " +
			'[tabindex]:not([tabindex="-1"]):not([tabindex=""])';
		for (const el of this.#content.querySelectorAll<HTMLElement>(selector)) {
			if (el.getAttribute("aria-disabled") === "true") continue;
			if (el.closest("[inert]")) continue;
			if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
			return el;
		}
		return null;
	}

	#onTriggerClick = (e: MouseEvent) => {
		e.preventDefault();
		// `hover`: click always shows (no toggle, no delay); it's the
		// touch/keyboard alternative to hover, not a dismiss. Cancel any
		// pending hover open timer so the open is instant.
		if (boolAttr(this, "hover", false)) {
			if (this.#hoverOpenTimer !== null) {
				clearTimeout(this.#hoverOpenTimer);
				this.#hoverOpenTimer = null;
			}
			this.show();
			return;
		}
		// `trigger-action` overrides default toggle. "show" is the
		// submenu pattern: hover may have already opened it, and a
		// click shouldn't close it.
		const action = this.getAttribute("trigger-action");
		if (action === "show") this.show();
		else if (action === "hide") this.hide();
		else this.toggle();
	};

	// Hover: mouse only; touch fires synthetic mouseenter on tap and
	// the companion click would then toggle closed. hover-* attrs are
	// read live in handlers, so runtime toggling takes effect on the
	// next pointer event without re-binding.
	#onTriggerMouseEnter = () => {
		if (!boolAttr(this, "hover", false)) return;
		this.#scheduleHoverOpen();
	};

	#onTriggerMouseLeave = () => {
		if (!boolAttr(this, "hover", false)) return;
		this.#scheduleHoverClose();
	};

	#onContentMouseEnter = () => {
		if (!boolAttr(this, "hover", false)) return;
		// Cancel any pending close: pointer made it to the panel.
		if (this.#hoverCloseTimer !== null) {
			clearTimeout(this.#hoverCloseTimer);
			this.#hoverCloseTimer = null;
		}
	};

	#onContentMouseLeave = () => {
		if (!boolAttr(this, "hover", false)) return;
		this.#scheduleHoverClose();
	};

	#scheduleHoverOpen(): void {
		if (this.#openIntent) return;
		if (this.#hoverCloseTimer !== null) {
			clearTimeout(this.#hoverCloseTimer);
			this.#hoverCloseTimer = null;
		}
		if (this.#hoverOpenTimer !== null) return;
		const delay = this.#parseHoverDelay("hover-open-delay", 100);
		this.#hoverOpenTimer = window.setTimeout(() => {
			this.#hoverOpenTimer = null;
			if (boolAttr(this, "hover", false) && !this.#openIntent) {
				this.#applyOpen({ noFocus: true });
			}
		}, delay);
	}

	#scheduleHoverClose(): void {
		// Pointer left before the open delay elapsed: just cancel.
		if (this.#hoverOpenTimer !== null) {
			clearTimeout(this.#hoverOpenTimer);
			this.#hoverOpenTimer = null;
		}
		if (!this.#openIntent) return;
		if (this.#hoverCloseTimer !== null) return;
		const delay = this.#parseHoverDelay("hover-close-delay", 200);
		this.#hoverCloseTimer = window.setTimeout(() => {
			this.#hoverCloseTimer = null;
			if (boolAttr(this, "hover", false) && this.#openIntent) this.hide();
		}, delay);
	}

	#clearHoverTimers(): void {
		if (this.#hoverOpenTimer !== null) {
			clearTimeout(this.#hoverOpenTimer);
			this.#hoverOpenTimer = null;
		}
		if (this.#hoverCloseTimer !== null) {
			clearTimeout(this.#hoverCloseTimer);
			this.#hoverCloseTimer = null;
		}
	}

	#parseHoverDelay(attr: string, fallback: number): number {
		const raw = this.getAttribute(attr);
		if (raw === null || raw === "") return fallback;
		const n = Number(raw);
		return Number.isFinite(n) && n >= 0 ? n : fallback;
	}

	#onContentClick = (e: MouseEvent) => {
		const target = e.target as Element | null;
		if (target?.closest("[data-neo-popover-close]")) {
			this.hide({ restoreFocus: true });
		}
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape" && this.hasAttribute("open")) {
			e.stopPropagation();
			this.hide({ restoreFocus: true });
		}
	};

	#onDocPointerDown = (e: PointerEvent) => {
		if (!this.hasAttribute("open")) return;
		// A morph that removed the popover detaches it before
		// disconnectedCallback can unregister this listener; bail so a
		// synchronous focus/pointer side effect doesn't dismiss state the
		// host is about to re-establish on rebuild.
		if (!this.isConnected) return;
		// Inside interactions: the trigger and the shadow panel that hosts
		// the slotted content. Checking the panel (not just content) also
		// covers the panel surface itself: a text-selection drag or a press
		// on the panel padding focuses the tabindex="-1" panel, which must
		// not read as an outside dismiss. Other light-DOM descendants (an
		// input-group sibling sharing the trigger's wrapper) still dismiss.
		if ((this.#trigger && eventEnters(e, this.#trigger)) || eventEnters(e, this.#panel)) return;
		// Scoped light-dismiss: inside a <neo-boundary>, ignore presses
		// outside it (e.g. surrounding UI driving the popover).
		const boundary = scopingBoundary(this, "dismiss");
		if (boundary && !eventEnters(e, boundary)) return;
		this.hide();
	};

	#onDocFocusIn = (e: FocusEvent) => {
		if (!this.hasAttribute("open")) return;
		if (!this.isConnected) return;
		const entersTrigger = !!this.#trigger && eventEnters(e, this.#trigger);
		const entersContent = !!this.#content && eventEnters(e, this.#content);
		// Focus landing on the panel itself (a text-selection drag focuses
		// the tabindex="-1" panel) is inside, even though it isn't within
		// `content`. Don't capture a focus resolver for it (nothing
		// meaningful is focused), just keep the panel open.
		const entersPanel = eventEnters(e, this.#panel);
		if (entersTrigger || entersContent || entersPanel) {
			// Capture identity for post-morph restore. composedPath()[0] is
			// the real target across shadow boundaries; e.target may be
			// retargeted to the host.
			const realTarget = (e.composedPath()[0] ?? e.target) as HTMLElement;
			if (this.#content && entersContent) {
				this.#lastFocusedResolver = makeFocusResolver(realTarget, this.#content);
			}
			return;
		}
		const boundary = scopingBoundary(this, "dismiss");
		if (boundary && !eventEnters(e, boundary)) return;
		this.hide();
	};

	// Overflow lives on the shadow panel, so scroll fires on the panel,
	// not on the user's content div.
	#onPanelScroll = () => {
		this.#lastContentScrollTop = this.#panel.scrollTop;
	};

	// Track the trigger's rect, not scroll events; unrelated scrollers
	// can't dismiss the panel.
	#trackedTriggerRect: DOMRect | null = null;
	#triggerTrackingFrame: number | null = null;

	#startTriggerTracking(): void {
		this.#stopTriggerTracking();
		if (!this.#trigger) return;
		this.#trackedTriggerRect = this.#trigger.getBoundingClientRect();
		const tick = () => {
			this.#triggerTrackingFrame = null;
			if (!this.#openIntent || !this.#trigger || !this.isConnected) return;
			const now = this.#trigger.getBoundingClientRect();
			const prev = this.#trackedTriggerRect;
			const moved =
				!prev || prev.x !== now.x || prev.y !== now.y || prev.width !== now.width || prev.height !== now.height;
			if (moved) {
				this.#trackedTriggerRect = now;
				if (this.#initialOpenPending) {
					this.#position();
					this.#triggerTrackingFrame = requestAnimationFrame(tick);
					return;
				}
				if (performance.now() < this.#openScrollHoldUntil) {
					this.#applyOpenScrollPosition();
					this.#triggerTrackingFrame = requestAnimationFrame(tick);
					return;
				}
				const followMode = this.#followScrollMode();
				// Scoped scroll follows only when the scroll target is independent
				// of the boundary. Inside and ancestor scrollers are handled by
				// onWindowScroll because the rAF can't tell what moved the trigger.
				const scopedScroll = !!scopingBoundary(this, "scroll");
				if (followMode === "off" && !scopedScroll) {
					// Skip the dismiss when focus is inside the panel: iOS lifts
					// the focused input above the virtual keyboard via window
					// scroll, and dismissing would collapse the keyboard.
					if (this.#content?.contains(document.activeElement)) {
						this.#position();
					} else {
						this.hide();
						return;
					}
				} else {
					this.#position();
					if (!scopedScroll && followMode === "until-trigger-invisible" && !intersectsVisualViewport(this.#trigger)) {
						this.hide();
						return;
					}
				}
			}
			this.#triggerTrackingFrame = requestAnimationFrame(tick);
		};
		this.#triggerTrackingFrame = requestAnimationFrame(tick);
	}

	#stopTriggerTracking(): void {
		if (this.#triggerTrackingFrame !== null) {
			cancelAnimationFrame(this.#triggerTrackingFrame);
			this.#triggerTrackingFrame = null;
		}
		this.#trackedTriggerRect = null;
	}

	reposition = () => {
		if (this.hasAttribute("open")) this.#position();
	};

	// A scroll inside a scoped <neo-boundary> dismisses the panel, matching
	// <neo-select>/<neo-combobox>. The rAF tracker follows the trigger on any
	// movement; here we override only the case it can't see: the region's own
	// scroll is a real scroll, so close. Outside-boundary scrolls (and the
	// no-boundary case) are left to the tracker.
	#onWindowScroll = (e: Event) => {
		if (!this.#openIntent || !this.#trigger) return;
		// follow-scroll modes reposition on any scroll; the tracker handles them.
		if (this.#followScrollMode() !== "off") return;
		// Internal panel scroll is not a dismiss.
		if (e.target instanceof Node && this.#panel.contains(e.target)) return;
		const sb = scopingBoundary(this, "scroll");
		if (!sb || !(e.target instanceof Node) || isIndependentBoundaryScroll(sb, e.target)) return;
		// iOS lifts a focused input above the keyboard via window scroll; keep open.
		if (this.#content?.contains(document.activeElement)) return;
		if (performance.now() < this.#openScrollHoldUntil) {
			this.#applyOpenScrollPosition();
			return;
		}
		this.hide();
	};

	#position(opts: { scrollIntoView?: boolean; keepWhenUnfit?: boolean } = {}): boolean {
		if (!this.#trigger || !this.#content) return false;
		if (this.#shouldCloseForHiddenTrigger()) {
			this.hide();
			return false;
		}
		if (!opts.scrollIntoView && performance.now() < this.#openScrollHoldUntil) {
			const fits = this.#applyOpenScrollPosition();
			if (!fits) this.#scheduleOpenScrollPositioning();
			return true;
		}
		if (this.#initialOpenPending && !intersectsVisualViewport(this.#trigger)) {
			delete this.#panel.dataset.neoPopoverPositioned;
			return true;
		}
		this.#initialOpenPending = false;
		this.#syncMatchTriggerWidth();
		const result = this.#measurePosition();
		if (this.#shouldRecoverOpenPosition(result) && opts.scrollIntoView) {
			this.#openScrollHoldUntil = performance.now() + 1000;
			scrollAnchorIntoOpenView(this.#trigger);
			if (!this.#applyOpenScrollPosition()) this.#scheduleOpenScrollPositioning();
			return true;
		}
		if (!result.fitsOpenSize) {
			if (opts.keepWhenUnfit) {
				applyOpenSizeDuringScroll(this.#panel, result);
				this.#writePositionResult(result);
				return false;
			}
			this.hide();
			return false;
		}
		this.#applyPositionResult(result);
		return true;
	}

	#shouldRecoverOpenPosition(result: PositionResult): boolean {
		return !result.fitsOpenSize || (!boolAttr(this, "flip", true) && !result.fitsFitSize);
	}

	#applyOpenScrollPosition(): boolean {
		const result = this.#measurePosition({ ignorePositioningBoundary: true });
		if (result.fitsOpenSize) {
			this.#applyPositionResult(result);
			return true;
		}
		this.#panel.style.visibility = "";
		applyOpenSizeDuringScroll(this.#panel, result);
		this.#writePositionResult(result);
		return false;
	}

	#measurePosition(opts: { ignorePositioningBoundary?: boolean } = {}): PositionResult {
		const placement = (this.getAttribute("placement") as Placement | null) ?? "bottom-start";
		// CSS max-height/max-width already clamp to viewport minus
		// 2×edgeOffset, so positionPanel measures the rendered size.
		const edgeOffset = resolveCssLengthPx(this, "--neo-popover-screen-offset");
		const minFitHeight = resolveCssLengthPxOrContent(this, "--neo-popover-min-fit-height", "content");
		const minFitWidth = resolveCssLengthPxOrContent(this, "--neo-popover-min-fit-width", "content");
		const minOpenHeight = resolveOptionalCssLengthPx(this, "--neo-popover-min-open-height");
		const minOpenWidth = resolveOptionalCssLengthPx(this, "--neo-popover-min-open-width");
		// --neo-popover-max-height isn't a kit token, so pass only the
		// width cap. resolveCssLengthPx returns the fallback if a var is
		// unset; --neo-popover-max-width is :root-defined (22rem) so this
		// always reflects the resolved cap, host-overridden or default.
		const maxWidth = boolAttr(this, "match-trigger-width", false)
			? undefined
			: resolveCssLengthPx(this, "--neo-popover-max-width");
		return positionPanelResult(this.#trigger!, this.#panel, placement, edgeOffset, 8, {
			clamp: boolAttr(this, "clamp-placement", false),
			minFitHeight,
			minFitWidth,
			minOpenHeight,
			minOpenWidth,
			maxWidth,
			ignorePositioningBoundary: opts.ignorePositioningBoundary,
			noFlip: !boolAttr(this, "flip", true),
		});
	}

	#applyPositionResult(result: PositionResult): void {
		this.#cancelOpenScrollPositioning();
		this.#panel.style.visibility = "";
		this.#writePositionResult(result);
	}

	#writePositionResult(result: PositionResult): void {
		const effectivePlacement = result.placement;
		this.dataset.neoPopoverPlacement = effectivePlacement;
		this.#panel.dataset.neoPopoverPlacement = effectivePlacement;
		// Gate the panel's visibility CSS in the shadow stylesheet: until
		// the first position() writes inline top/left, the
		// :not([data-neo-popover-positioned]) rule keeps the panel
		// visibility: hidden so the CSS-default 0,0 corner never paints.
		this.#panel.dataset.neoPopoverPositioned = "";
		this.dispatchEvent(
			new CustomEvent("neo-popover-position", {
				bubbles: true,
				detail: { placement: effectivePlacement },
			}),
		);
	}

	#cancelOpenScrollPositioning(): void {
		if (this.#openScrollPositionFrame !== null) {
			cancelAnimationFrame(this.#openScrollPositionFrame);
			this.#openScrollPositionFrame = null;
		}
		if (this.#panel) this.#panel.style.visibility = "";
	}

	#scheduleOpenScrollPositioning(): void {
		this.#openScrollPositionUntil = performance.now() + 1000;
		if (this.#openScrollPositionFrame !== null) return;
		const tick = () => {
			this.#openScrollPositionFrame = null;
			if (!this.#openIntent || !this.isConnected) {
				this.#panel.style.visibility = "";
				return;
			}
			if (this.#position({ keepWhenUnfit: true })) return;
			if (performance.now() < this.#openScrollPositionUntil) {
				this.#openScrollPositionFrame = requestAnimationFrame(tick);
				return;
			}
			this.hide();
		};
		this.#openScrollPositionFrame = requestAnimationFrame(tick);
	}

	#syncMatchTriggerWidth(): void {
		if (!this.#trigger) return;
		if (!boolAttr(this, "match-trigger-width", false)) {
			this.#panel.style.removeProperty("width");
			this.#panel.style.removeProperty("min-width");
			this.#panel.style.removeProperty("box-sizing");
			return;
		}
		this.#panel.style.boxSizing = "border-box";
		this.#panel.style.minWidth = "0";
		this.#panel.style.width = `${this.#trigger.getBoundingClientRect().width}px`;
	}

	#followScrollMode(): "off" | "always" | "until-trigger-invisible" {
		const value = this.getAttribute("follow-scroll");
		if (value === "always" || value === "until-trigger-invisible") return value;
		return "off";
	}

	#shouldCloseForHiddenTrigger(): boolean {
		return (
			this.#followScrollMode() === "until-trigger-invisible" &&
			!!this.#trigger &&
			!intersectsVisualViewport(this.#trigger)
		);
	}
}

// Closure that re-finds `el` by identifier (id, data-neo-value, or a
// unique data-neo-* marker) so it survives a morph swap. Returns null
// when no stable identifier is available.
function makeFocusResolver(el: HTMLElement, content: Element): ((root: Element) => HTMLElement | null) | null {
	if (el.id) {
		const id = el.id;
		return (root) => root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
	}
	const dataValue = el.getAttribute("data-neo-value");
	if (dataValue !== null) {
		return (root) =>
			Array.from(root.querySelectorAll<HTMLElement>("[data-neo-value]")).find(
				(e) => e.getAttribute("data-neo-value") === dataValue,
			) ?? null;
	}
	for (const a of Array.from(el.attributes)) {
		if (!a.name.startsWith("data-neo-")) continue;
		if (content.querySelectorAll(`[${a.name}]`).length !== 1) continue;
		const name = a.name;
		return (root) => root.querySelector<HTMLElement>(`[${name}]`);
	}
	return null;
}

function intersectsVisualViewport(el: HTMLElement): boolean {
	const rect = el.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) return false;

	const visualViewport = window.visualViewport;
	const vLeft = visualViewport?.offsetLeft ?? 0;
	const vTop = visualViewport?.offsetTop ?? 0;
	const vw = visualViewport?.width ?? document.documentElement.clientWidth;
	const vh = visualViewport?.height ?? document.documentElement.clientHeight;

	const left = rect.left - vLeft;
	const right = rect.right - vLeft;
	const top = rect.top - vTop;
	const bottom = rect.bottom - vTop;

	return right > 0 && left < vw && bottom > 0 && top < vh;
}

if (!customElements.get("neo-popover")) {
	customElements.define("neo-popover", NeoPopover);
}
