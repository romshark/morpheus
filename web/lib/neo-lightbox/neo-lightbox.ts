import { boolAttr, openCommand } from "../command";
import { deepActiveElement, eventEnters } from "../shadow-utils";

let nextId = 0;

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
	"select:not([disabled]), textarea:not([disabled]), " +
	'[tabindex]:not([tabindex="-1"]):not([tabindex=""])';

// Module-scoped scroll lock for open screen-scope lightboxes. Mirrors
// neo-dialog: the top layer inerts clicks but not wheel/touch scroll on
// the page behind. CSS overflow locks reflow stickies; blocking the
// scroll *input* outside any open surface reflows nothing. Ref-counted
// so stacked lightboxes share one listener pair.
const openScreen = new Set<NeoLightbox>();
let scrollBlockBound = false;

function blockScrollOutsideSurface(e: WheelEvent | TouchEvent) {
	// No open screen lightbox: never block (guards against a leaked listener).
	if (openScreen.size === 0) return;
	let x: number;
	let y: number;
	if ("clientX" in e) {
		x = e.clientX;
		y = e.clientY;
	} else {
		const t = e.touches[0] ?? e.changedTouches[0];
		if (!t) {
			e.preventDefault();
			return;
		}
		x = t.clientX;
		y = t.clientY;
	}
	for (const lb of openScreen) {
		const r = lb.surfaceRect();
		if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return;
	}
	e.preventDefault();
}

function lockScroll(lb: NeoLightbox) {
	openScreen.add(lb);
	if (scrollBlockBound) return;
	scrollBlockBound = true;
	document.addEventListener("wheel", blockScrollOutsideSurface, { passive: false });
	document.addEventListener("touchmove", blockScrollOutsideSurface, { passive: false });
}

function unlockScroll(lb: NeoLightbox) {
	if (!openScreen.delete(lb)) return;
	if (openScreen.size > 0 || !scrollBlockBound) return;
	scrollBlockBound = false;
	document.removeEventListener("wheel", blockScrollOutsideSurface);
	document.removeEventListener("touchmove", blockScrollOutsideSurface);
}

// Shadow tree: a default slot for the triggers followed by an overlay
// (backdrop + surface). The overlay is shadow-owned so the open state
// and the popover top-layer promotion survive a fat morph (which only
// reaches light DOM). The user's content lives in light DOM and is
// projected into the surface via manual slot assignment; assign()
// doesn't depend on the `slot=` attribute a morph would reconcile away.
const LIGHTBOX_SHADOW_TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - [data-neo-lightbox-overlay] display: hidden until open. Author-origin
//   display beats the UA popover rule, so a closed screen overlay must be
//   explicitly none, else it stays a viewport-covering fixed box that eats
//   pointer / scroll input. The :popover-open / [open] rules flip it to flex.
// - [data-neo-lightbox-overlay][popover]: screen scope, Popover API top layer
//   covering the viewport.
// - :host([contained]) [data-neo-lightbox-overlay]: container scope,
//   absolute fill of the positioned host.
// - [data-neo-lightbox-surface] opacity/transform: resting state, and the
//   default for transition="zoom" / "none": no CSS entry animation. Zoom is
//   driven by WAAPI (flipOpen/flipClose); none is instant. The fade variant
//   adds the scale + opacity.
// - [data-neo-lightbox-overlay]:popover-open [data-neo-lightbox-backdrop]:
//   backdrop fades in for every transition mode, keyed on popover state
//   (screen) or [open] (container). The FLIP reads its duration / easing from
//   this transition, so it stays themed even when the surface has no CSS
//   transition of its own.
// - :host([transition="fade"]) [data-neo-lightbox-surface]: the centered scale
//   + opacity entry. The default "zoom" uses WAAPI and "none" is instant, so
//   both leave the surface at its resting opacity:1 / transform:none above.
LIGHTBOX_SHADOW_TEMPLATE.innerHTML = `
<style>
  :host { display: inline-block; }
  :host([hidden]) { display: none; }
  :host([contained]) {
    display: block;
    position: relative;
    overflow: clip;
  }

  [data-neo-lightbox-overlay] {
    box-sizing: border-box;
    display: none;
    align-items: center;
    justify-content: center;
    padding: var(--neo-lightbox-screen-offset, 1rem);
    border: 0;
    margin: 0;
    background: transparent;
  }

  [data-neo-lightbox-overlay][popover] {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    overflow: clip;
    transition:
      display var(--neo-lightbox-enter-duration, calc(200ms * var(--neo-duration-scale, 1))) allow-discrete,
      overlay var(--neo-lightbox-enter-duration, calc(200ms * var(--neo-duration-scale, 1))) allow-discrete;
  }
  [data-neo-lightbox-overlay][popover]:popover-open {
    display: flex;
  }

  :host([contained]) [data-neo-lightbox-overlay] {
    position: absolute;
    inset: 0;
    z-index: var(--neo-lightbox-z-index, 50);
    transition: display var(--neo-lightbox-enter-duration, calc(200ms * var(--neo-duration-scale, 1))) allow-discrete;
  }
  :host([contained][open]) [data-neo-lightbox-overlay] {
    display: flex;
  }

  [data-neo-lightbox-backdrop] {
    position: absolute;
    inset: 0;
    background: var(--neo-lightbox-overlay-bg, rgba(0, 0, 0, 0.72));
    -webkit-backdrop-filter: blur(var(--neo-lightbox-overlay-blur, 0px));
    backdrop-filter: blur(var(--neo-lightbox-overlay-blur, 0px));
    opacity: 0;
    transition: opacity var(--neo-lightbox-enter-duration, calc(200ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease-out);
  }

  [data-neo-lightbox-surface] {
    position: relative;
    box-sizing: border-box;
    max-width: var(--neo-lightbox-max-width, 90vw);
    max-height: var(--neo-lightbox-max-height, 90vh);
    background: var(--neo-lightbox-surface-bg, transparent);
    color: var(--neo-lightbox-color, var(--page-fg, #111827));
    border-radius: var(--neo-lightbox-radius, 0);
    padding: var(--neo-lightbox-surface-padding, 0);
    box-shadow: var(--neo-lightbox-shadow, none);
    opacity: 1;
    transform: none;
  }
  :host([contained]) [data-neo-lightbox-surface] {
    max-width: 100%;
    max-height: 100%;
  }
  [data-neo-lightbox-surface]:focus { outline: none; }
  [data-neo-lightbox-surface]:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  [data-neo-lightbox-overlay]:popover-open [data-neo-lightbox-backdrop],
  :host([contained][open]) [data-neo-lightbox-backdrop] {
    opacity: 1;
  }
  @starting-style {
    [data-neo-lightbox-overlay]:popover-open [data-neo-lightbox-backdrop],
    :host([contained][open]) [data-neo-lightbox-backdrop] {
      opacity: 0;
    }
  }

  :host([transition="fade"]) [data-neo-lightbox-surface] {
    opacity: 0;
    transform: scale(var(--neo-lightbox-enter-scale, 0.94));
    transition:
      opacity var(--neo-lightbox-enter-duration, calc(200ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease-out),
      transform var(--neo-lightbox-enter-duration, calc(200ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease-out);
  }
  :host([transition="fade"]) [data-neo-lightbox-overlay]:popover-open [data-neo-lightbox-surface],
  :host([transition="fade"][contained][open]) [data-neo-lightbox-surface] {
    opacity: 1;
    transform: none;
  }
  @starting-style {
    :host([transition="fade"]) [data-neo-lightbox-overlay]:popover-open [data-neo-lightbox-surface],
    :host([transition="fade"][contained][open]) [data-neo-lightbox-surface] {
      opacity: 0;
      transform: scale(var(--neo-lightbox-enter-scale, 0.94));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [data-neo-lightbox-backdrop],
    [data-neo-lightbox-surface] { transition: none; }
  }
</style>
<slot></slot>
<div data-neo-lightbox-overlay>
  <div data-neo-lightbox-backdrop part="backdrop"></div>
  <div data-neo-lightbox-surface part="surface" role="dialog" tabindex="-1">
    <slot name="content"></slot>
  </div>
</div>
`;

export class NeoLightbox extends HTMLElement {
	static readonly observedAttributes = ["open", "contained", "dismissible"];

	#triggers: HTMLElement[] = [];
	#content: HTMLElement | null = null;
	#defaultSlot!: HTMLSlotElement;
	#contentSlot!: HTMLSlotElement;
	#overlay!: HTMLElement;
	#surface!: HTMLElement;
	#backdrop!: HTMLElement;
	#childObserver: MutationObserver | null = null;
	#ready = false;
	// FLIP animation morphing the surface from the opening trigger's rect
	// (transition="zoom"). Cancelled before a new open / close.
	#flipAnim: Animation | null = null;

	// Rendered open state; `open` is its reflection (see command).
	// Survives a morph strip; cleared only by a genuine dismissal.
	#openIntent = false;
	#reflecting = false;
	#recoverScheduled = false;
	// Trigger that opened the overlay; focus returns here on close.
	#opener: HTMLElement | null = null;
	#previousFocus: Element | null = null;

	// Hover-open timers. Scheduling one cancels the other so a quick
	// re-entry can't open-then-close.
	#hoverOpenTimer: number | null = null;
	#hoverCloseTimer: number | null = null;

	constructor() {
		super();
		// Manual slot assignment so projection doesn't depend on the
		// `slot=` attribute a fat morph would reconcile away; bindChildren
		// re-assigns on every connect / mutation.
		const root = this.attachShadow({ mode: "open", slotAssignment: "manual" });
		root.appendChild(LIGHTBOX_SHADOW_TEMPLATE.content.cloneNode(true));
		this.#overlay = root.querySelector<HTMLElement>("[data-neo-lightbox-overlay]")!;
		this.#surface = root.querySelector<HTMLElement>("[data-neo-lightbox-surface]")!;
		this.#backdrop = root.querySelector<HTMLElement>("[data-neo-lightbox-backdrop]")!;
		this.#defaultSlot = root.querySelector<HTMLSlotElement>("slot:not([name])")!;
		this.#contentSlot = root.querySelector<HTMLSlotElement>("slot[name='content']")!;
	}

	connectedCallback() {
		if (!this.#bindChildren()) return;
		this.#applyScope();

		this.addEventListener("click", this.#onContentClick);
		this.#overlay.addEventListener("pointerdown", this.#onOverlayPointerDown);
		this.#overlay.addEventListener("keydown", this.#onOverlayKeyDown);
		document.addEventListener("keydown", this.#onDocKeyDown, true);

		// Re-acquire refs after a fat morph swaps children; else our
		// listeners point at detached nodes.
		this.#childObserver = new MutationObserver(this.#onChildMutation);
		this.#childObserver.observe(this, { childList: true, subtree: true });

		// Command `open` on connect: explicit open/close obey; absent
		// keeps prior intent (persists across reconnect / morph).
		const cmd = openCommand(this);
		if (cmd === "open") this.#openIntent = true;
		else if (cmd === "close") this.#openIntent = false;
		this.#ready = true;
		if (this.#openIntent) {
			// Silent re-establish: a morph rebuild must not re-fire load
			// actions wired to neo-lightbox-open.
			this.#applyOpen({ silent: true, noFocus: true });
		}
	}

	disconnectedCallback() {
		this.#ready = false;
		this.#clearHoverTimers();
		this.#unbindTriggers();
		this.removeEventListener("click", this.#onContentClick);
		this.#overlay.removeEventListener("pointerdown", this.#onOverlayPointerDown);
		this.#overlay.removeEventListener("keydown", this.#onOverlayKeyDown);
		document.removeEventListener("keydown", this.#onDocKeyDown, true);
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		this.#cancelFlip();
		unlockScroll(this);
		// Browser teardown closes a top-layer popover with no event; drop
		// our lock bookkeeping so a navigation away can't leak it.
		this.#content = null;
	}

	attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null) {
		if (name === "contained") {
			if (!this.#ready) return;
			// Re-open in the new mode so the top-layer promotion matches.
			const wasOpen = this.#openIntent;
			if (wasOpen) this.#teardownPresentation();
			this.#applyScope();
			// Re-enter the presentation layer in the new mode, no event.
			if (wasOpen) this.#present();
			return;
		}
		if (name === "dismissible") return; // read live in handlers
		if (name !== "open" || !this.#ready || this.#reflecting) return;
		const cmd = openCommand(this);
		if (cmd === null) {
			// Absent (morph strip): keep state; re-assert and re-establish
			// the presentation the morph may have dropped.
			if (this.#openIntent) {
				this.#reflectOpen();
				this.#scheduleRecover();
			}
			return;
		}
		if (cmd === "open") {
			if (!this.#openIntent) this.#applyOpen();
		} else if (this.#openIntent) {
			this.#applyClose();
		} else {
			this.#reflectClose();
		}
	}

	#onChildMutation = () => {
		if (!this.#bindChildren() || !this.#ready || !this.#openIntent) return;
		// Content may have been re-projected; re-establish the surface.
		this.#scheduleRecover();
	};

	// contained → popover attribute + ARIA modality. Screen (default)
	// rides the Popover API top layer; contained stays an in-flow overlay.
	#applyScope(): void {
		if (this.#isContainer()) {
			this.#overlay.removeAttribute("popover");
			this.#surface.setAttribute("aria-modal", "false");
		} else {
			// "manual" so the kit owns dismissal; auto's light-dismiss would
			// race our backdrop / Esc handling.
			this.#overlay.setAttribute("popover", "manual");
			this.#surface.setAttribute("aria-modal", "true");
		}
	}

	#isContainer(): boolean {
		return boolAttr(this, "contained", false);
	}

	#bindChildren(): boolean {
		const newTriggers = Array.from(this.querySelectorAll<HTMLElement>("[data-neo-lightbox-trigger]"));
		const newContent = this.querySelector<HTMLElement>("[data-neo-lightbox-content]");
		if (newTriggers.length === 0 || !newContent) {
			if (this.#triggers.length === 0 || !this.#content) {
				console.warn(
					"<neo-lightbox> requires at least one [data-neo-lightbox-trigger] and a [data-neo-lightbox-content] child.",
				);
			}
			return false;
		}

		this.#unbindTriggers();
		this.#triggers = newTriggers;
		this.#content = newContent;

		if (!this.#surface.id) this.#surface.id = `neo-lightbox-${++nextId}`;
		for (const t of this.#triggers) {
			t.addEventListener("click", this.#onTriggerClick);
			t.addEventListener("mouseenter", this.#onTriggerMouseEnter);
			t.addEventListener("mouseleave", this.#onTriggerMouseLeave);
			t.setAttribute("aria-haspopup", "dialog");
			t.setAttribute("aria-controls", this.#surface.id);
			if (!t.hasAttribute("role")) t.setAttribute("role", "button");
			if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "0");
			t.setAttribute("aria-expanded", String(this.hasAttribute("open")));
		}

		// Hover-close region is the visible surface.
		this.#surface.removeEventListener("mouseenter", this.#onSurfaceMouseEnter);
		this.#surface.removeEventListener("mouseleave", this.#onSurfaceMouseLeave);
		this.#surface.addEventListener("mouseenter", this.#onSurfaceMouseEnter);
		this.#surface.addEventListener("mouseleave", this.#onSurfaceMouseLeave);

		// Label the dialog from a [data-neo-lightbox-title], else fall back
		// to the host's aria-label.
		const title = this.#content.querySelector<HTMLElement>("[data-neo-lightbox-title]");
		if (title) {
			if (!title.id) title.id = `${this.#surface.id}-title`;
			this.#surface.setAttribute("aria-labelledby", title.id);
			this.#surface.removeAttribute("aria-label");
		} else {
			this.#surface.removeAttribute("aria-labelledby");
			const hostLabel = this.getAttribute("aria-label");
			if (hostLabel) this.#surface.setAttribute("aria-label", hostLabel);
			else this.#surface.removeAttribute("aria-label");
		}

		// Project content into the surface, everything else into the
		// default slot. slot.assign only takes the host's direct children,
		// so route the top-level ancestor that contains the content.
		const contentTop = this.#slottable(this.#content);
		const others = Array.from(this.children).filter((c) => c !== contentTop);
		this.#defaultSlot.assign(...others);
		this.#contentSlot.assign(contentTop);
		return true;
	}

	// The host's direct child that contains `node` (or `node` itself when
	// it is already a direct child), the node slot.assign() can project.
	#slottable(node: HTMLElement): HTMLElement {
		let el: HTMLElement = node;
		while (el.parentElement && el.parentElement !== this) {
			el = el.parentElement;
		}
		return el;
	}

	#unbindTriggers(): void {
		for (const t of this.#triggers) {
			t.removeEventListener("click", this.#onTriggerClick);
			t.removeEventListener("mouseenter", this.#onTriggerMouseEnter);
			t.removeEventListener("mouseleave", this.#onTriggerMouseLeave);
		}
		this.#triggers = [];
	}

	show(trigger?: HTMLElement): void {
		if (!this.#openIntent) this.#applyOpen({ trigger });
	}

	hide(opts: { restoreFocus?: boolean } = {}): void {
		if (this.#openIntent) this.#applyClose(opts);
	}

	toggle(): void {
		if (this.#openIntent) this.#applyClose({ restoreFocus: true });
		else this.#applyOpen();
	}

	// surfaceRect feeds the module scroll-lock hit test.
	surfaceRect(): DOMRect | null {
		if (!this.#openIntent || this.#isContainer()) return null;
		return this.#surface.getBoundingClientRect();
	}

	#applyOpen(opts: { trigger?: HTMLElement; silent?: boolean; noFocus?: boolean } = {}): void {
		const wasOpen = this.#openIntent;
		this.#openIntent = true;
		this.#opener = opts.trigger ?? this.#opener ?? this.#triggers[0] ?? null;
		if (!wasOpen) this.#previousFocus = this.#opener ?? document.activeElement;
		this.#reflectOpen();
		for (const t of this.#triggers) t.setAttribute("aria-expanded", "true");
		this.#cancelFlip();
		this.#present();
		// Surface is laid out now; zoom it in from the opener's rect.
		if (this.#transitionMode() === "zoom" && !opts.silent) this.#flipOpen();
		if (!opts.noFocus) this.#focusSurface({ preventScroll: !!opts.silent });
		if (!wasOpen && !opts.silent) {
			this.dispatchEvent(
				new CustomEvent("neo-lightbox-open", {
					bubbles: true,
					detail: { trigger: this.#opener },
				}),
			);
		}
	}

	#applyClose(opts: { silent?: boolean; restoreFocus?: boolean } = {}): void {
		const wasOpen = this.#openIntent;
		this.#openIntent = false;
		this.#clearHoverTimers();
		this.#reflectClose();
		for (const t of this.#triggers) t.setAttribute("aria-expanded", "false");
		this.#cancelFlip();
		// Surface still at its final rect; shrink it back into the opener.
		if (this.#transitionMode() === "zoom" && !opts.silent) this.#flipClose();
		this.#teardownPresentation();
		if (opts.restoreFocus && this.#previousFocus instanceof HTMLElement && this.#previousFocus.isConnected) {
			this.#previousFocus.focus();
		}
		this.#previousFocus = null;
		this.#opener = null;
		if (wasOpen && !opts.silent) {
			this.dispatchEvent(new CustomEvent("neo-lightbox-close", { bubbles: true }));
		}
	}

	// Enter the presentation layer: top-layer popover + scroll lock for
	// screen scope; container scope shows purely through the [open] CSS.
	#present(): void {
		if (this.#isContainer()) return;
		if (this.isConnected && this.#overlay.hasAttribute("popover") && !this.#overlay.matches(":popover-open")) {
			try {
				(this.#overlay as HTMLElement & { showPopover(): void }).showPopover();
			} catch {
				// showPopover throws if already open or disconnected; ignore.
			}
		}
		lockScroll(this);
	}

	#teardownPresentation(): void {
		unlockScroll(this);
		if (this.#isContainer()) return;
		if (this.#overlay.matches(":popover-open")) {
			try {
				(this.#overlay as HTMLElement & { hidePopover(): void }).hidePopover();
			} catch {
				// ignore
			}
		}
	}

	// FLIP: morph the surface between the opening trigger's rect and its
	// natural place. The surface is already laid out at its final position
	// (present() ran / [open] is set), so we measure both rects and animate
	// the transform that maps one onto the other. The surface has no CSS
	// entry animation in zoom mode, so WAAPI solely owns the motion.
	#flipOpen(): void {
		if (this.#prefersReducedMotion()) return;
		const from = this.#triggerTransform();
		if (from === null) return;
		this.#flipAnim = this.#surface.animate([{ transform: from }, { transform: "none" }], {
			duration: this.#flipDurationMs(),
			easing: this.#flipEasing(),
		});
	}

	#flipClose(): void {
		if (this.#prefersReducedMotion()) return;
		const to = this.#triggerTransform();
		if (to === null) return;
		// forwards: hold at the trigger rect until the overlay finishes
		// hiding (same duration); cancelFlip clears it on the next open.
		this.#flipAnim = this.#surface.animate([{ transform: "none" }, { transform: to }], {
			duration: this.#flipDurationMs(),
			easing: this.#flipEasing(),
			fill: "forwards",
		});
	}

	// Transform that maps the surface's current rect onto the opener's.
	#triggerTransform(): string | null {
		const trigger = this.#opener;
		if (!trigger?.isConnected) return null;
		const t = trigger.getBoundingClientRect();
		const s = this.#surface.getBoundingClientRect();
		if (t.width === 0 || t.height === 0 || s.width === 0 || s.height === 0) return null;
		const sx = t.width / s.width;
		const sy = t.height / s.height;
		const dx = t.left + t.width / 2 - (s.left + s.width / 2);
		const dy = t.top + t.height / 2 - (s.top + s.height / 2);
		return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
	}

	// Duration / easing come from the backdrop's live transition (the
	// surface has none in zoom mode), so the FLIP follows the theme
	// tokens and --neo-duration-scale.
	#flipDurationMs(): number {
		const d = parseFloat(getComputedStyle(this.#backdrop).transitionDuration);
		return Number.isFinite(d) && d > 0 ? d * 1000 : 200;
	}

	#flipEasing(): string {
		return getComputedStyle(this.#backdrop).transitionTimingFunction || "ease-out";
	}

	#cancelFlip(): void {
		this.#flipAnim?.cancel();
		this.#flipAnim = null;
	}

	#prefersReducedMotion(): boolean {
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}

	// Entry / exit style. Default "zoom" morphs from the opening trigger's
	// rect (WAAPI); "fade" is the centered scale + opacity (CSS); "none" is
	// instant.
	#transitionMode(): "zoom" | "fade" | "none" {
		const t = this.getAttribute("transition");
		return t === "fade" || t === "none" ? t : "zoom";
	}

	// After a morph settles, re-establish an open overlay (the morph can
	// drop a popover from the top layer / strip [open]). Silent.
	#scheduleRecover(): void {
		if (this.#recoverScheduled) return;
		this.#recoverScheduled = true;
		requestAnimationFrame(() => {
			this.#recoverScheduled = false;
			if (!this.#openIntent || !this.isConnected) return;
			this.#reflectOpen();
			if (!this.#isContainer() && !this.#overlay.matches(":popover-open")) this.#present();
		});
	}

	#focusSurface(opts: { preventScroll?: boolean }): void {
		const target = this.#firstTabbable() ?? this.#surface;
		target.focus({ preventScroll: opts.preventScroll });
	}

	// First natural focus target in the content; skips hidden / disabled /
	// inert. Queries content (light DOM), not the surface, since slotted
	// nodes aren't DOM descendants of the shadow surface.
	#firstTabbable(): HTMLElement | null {
		return this.#tabbables()[0] ?? null;
	}

	#tabbables(): HTMLElement[] {
		if (!this.#content) return [];
		const out: HTMLElement[] = [];
		for (const el of this.#content.querySelectorAll<HTMLElement>(FOCUSABLE)) {
			if (el.getAttribute("aria-disabled") === "true") continue;
			if (el.closest("[inert]")) continue;
			if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
			out.push(el);
		}
		return out;
	}

	// State → attribute, guarded so it isn't read back as a command.
	#reflectOpen(): void {
		if (this.hasAttribute("open")) return;
		this.#reflecting = true;
		try {
			this.setAttribute("open", "");
		} finally {
			this.#reflecting = false;
		}
	}

	#reflectClose(): void {
		if (!this.hasAttribute("open")) return;
		this.#reflecting = true;
		try {
			this.removeAttribute("open");
		} finally {
			this.#reflecting = false;
		}
	}

	#isDismissible(): boolean {
		return boolAttr(this, "dismissible", true);
	}

	#onTriggerClick = (e: MouseEvent) => {
		e.preventDefault();
		const trigger = e.currentTarget as HTMLElement;
		// Under `hover`, click always opens (the touch / keyboard path) and
		// never toggles closed; cancel any pending hover-open so it's instant.
		if (boolAttr(this, "hover", false)) {
			if (this.#hoverOpenTimer !== null) {
				clearTimeout(this.#hoverOpenTimer);
				this.#hoverOpenTimer = null;
			}
			this.show(trigger);
			return;
		}
		if (this.#openIntent) this.#applyClose({ restoreFocus: true });
		else this.#applyOpen({ trigger });
	};

	#onContentClick = (e: MouseEvent) => {
		const target = e.target as Element | null;
		if (target?.closest("[data-neo-lightbox-close]")) {
			this.hide({ restoreFocus: true });
		}
	};

	// Press outside the surface (backdrop, or anywhere off the overlay for
	// container scope) dismisses. Presses on a trigger are ignored so the
	// trigger owns its own toggle.
	#onOverlayPointerDown = (e: PointerEvent) => {
		if (!this.#openIntent || !this.#isDismissible()) return;
		if (eventEnters(e, this.#surface)) return;
		this.hide();
	};

	#onOverlayKeyDown = (e: KeyboardEvent) => {
		if (e.key !== "Tab" || this.#isContainer()) return; // trap only the modal scope
		const f = this.#tabbables();
		if (f.length === 0) {
			e.preventDefault();
			this.#surface.focus();
			return;
		}
		const first = f[0];
		const last = f[f.length - 1];
		const active = deepActiveElement();
		if (e.shiftKey && (active === first || active === this.#surface)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	};

	#onDocKeyDown = (e: KeyboardEvent) => {
		if (e.key !== "Escape" || !this.#openIntent || !this.#isDismissible()) return;
		e.stopPropagation();
		this.hide({ restoreFocus: true });
	};

	#onTriggerMouseEnter = (e: MouseEvent) => {
		if (!boolAttr(this, "hover", false)) return;
		this.#opener = e.currentTarget as HTMLElement;
		this.#scheduleHoverOpen();
	};

	#onTriggerMouseLeave = () => {
		if (!boolAttr(this, "hover", false)) return;
		this.#scheduleHoverClose();
	};

	#onSurfaceMouseEnter = () => {
		if (!boolAttr(this, "hover", false)) return;
		if (this.#hoverCloseTimer !== null) {
			clearTimeout(this.#hoverCloseTimer);
			this.#hoverCloseTimer = null;
		}
	};

	#onSurfaceMouseLeave = () => {
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
		const delay = this.#hoverDelay("hover-open-delay", 100);
		this.#hoverOpenTimer = window.setTimeout(() => {
			this.#hoverOpenTimer = null;
			if (boolAttr(this, "hover", false) && !this.#openIntent) {
				this.#applyOpen({ trigger: this.#opener ?? undefined, noFocus: true });
			}
		}, delay);
	}

	#scheduleHoverClose(): void {
		if (this.#hoverOpenTimer !== null) {
			clearTimeout(this.#hoverOpenTimer);
			this.#hoverOpenTimer = null;
		}
		if (!this.#openIntent) return;
		if (this.#hoverCloseTimer !== null) return;
		const delay = this.#hoverDelay("hover-close-delay", 200);
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

	#hoverDelay(attr: string, fallback: number): number {
		const raw = this.getAttribute(attr);
		if (raw === null || raw === "") return fallback;
		const n = Number(raw);
		return Number.isFinite(n) && n >= 0 ? n : fallback;
	}
}

if (!customElements.get("neo-lightbox")) {
	customElements.define("neo-lightbox", NeoLightbox);
}
