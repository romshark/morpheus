import { boolAttr, openCommand } from "../command";
import { observeManagedAttrs, setAttrIfChanged } from "../neo-morph-resilient";
import { deepActiveElement, eventEnters } from "../shadow-utils";
import { resolveTouchDismiss } from "../touch-dismiss";

const RESILIENT_ATTRS = ["role", "tabindex"];
const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
	"select:not([disabled]), textarea:not([disabled]), " +
	'[tabindex]:not([tabindex="-1"]):not([tabindex=""])';

export class NeoSidebar extends HTMLElement {
	static readonly observedAttributes = ["open", "overlay-breakpoint"];

	#backdropEl: HTMLDivElement | null = null;
	// Stable ref so re-adopting a morph-preserved backdrop doesn't stack
	// click listeners (addEventListener dedups identical refs).
	#onBackdropClick = () => this.hide();
	// True when the original markup didn't pin a state. Auto-mode
	// tracks the host's PARENT width so the sidebar stays in sync
	// across breakpoint crossings (window resize, preview pane drag).
	#autoMode = false;
	#parentResizeObserver: ResizeObserver | null = null;
	#wideMode: boolean | null = null;
	// Persistent "user wants the sidebar closed in wide layouts" flag.
	// Only updated by explicit user actions while in wide mode; narrow-
	// mode toggles are transient overlay opens/closes and shouldn't
	// bleed into the wide preference.
	#wideClosed = false;
	// Rendered open state; `open` is its reflection (see command).
	// Moved by auto-mode and explicit commands, never a bare morph strip.
	#openIntent = false;
	// Guards reflective attribute writes so they aren't read as commands.
	#reflecting = false;
	// Set during auto-mode's programmatic show()/hide() on breakpoint
	// crossings so those calls don't count as user actions.
	#suspendUserOverride = false;
	#readyRaf = 0;
	#morphObserver: MutationObserver | null = null;
	#previousFocus: Element | null = null;

	// Async placeholder slot (`[data-neo-async-placeholder]`): same
	// lifecycle as <neo-drawer>. Captured once at connect, reinstated on
	// close so the next open loads fresh. asyncSlot is the placeholder's
	// *parent* (the morph target). Restore is deferred past the width/slide
	// transition so the placeholder doesn't flash through the closing panel.
	#asyncSlot: Element | null = null;
	#asyncSlotInitialHTML: string | null = null;
	#asyncRestoreTimer = 0;

	// Active single-touch drag state, populated on touchstart and
	// cleared on touchend / touchcancel. `decided` flips on once the
	// gesture has unambiguously committed to a horizontal closing
	// drag. Until then we leave the browser alone so taps and
	// vertical scrolls inside the sidebar still work.
	#touchDrag: {
		startX: number;
		startY: number;
		startTime: number;
		width: number;
		closeDir: 1 | -1;
		threshold: number;
		decided: boolean;
		cancelled: boolean;
	} | null = null;

	// The breakpoint in CSS pixels. Reads root font-size at evaluation
	// time so a host page that scales `html { font-size }` scales the
	// breakpoint with it. Falls back to 50rem if unparseable.
	get #breakpointPx(): number {
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		const raw = this.getAttribute("overlay-breakpoint");
		if (raw) {
			const parsed = parseCssLength(raw.trim(), rem);
			if (parsed !== null) return parsed;
		}
		return 50 * rem;
	}

	get #breakpointElement(): HTMLElement | null {
		const parent = this.parentElement;
		if (!parent) return null;
		if (parent.localName === "neo-resizable" && parent.parentElement instanceof HTMLElement) {
			return parent.parentElement;
		}
		return parent;
	}

	#syncOverlayMode() {
		const inOverlay = boolAttr(this, "overlay", false) || this.#wideMode === false;
		if (inOverlay) {
			this.setAttribute("data-neo-sidebar-overlay", "");
		} else {
			this.removeAttribute("data-neo-sidebar-overlay");
		}
	}

	connectedCallback() {
		this.#syncManagedAttrs();
		this.#morphObserver ??= observeManagedAttrs(this, RESILIENT_ATTRS, this.#syncManagedAttrs);

		// [open] in markup pins open; absence means "auto". CSS handles
		// the pre-upgrade initial state.
		this.#autoMode =
			!this.hasAttribute("open") && !boolAttr(this, "manual", false) && !boolAttr(this, "overlay", false);

		// Seed wideMode from the actual parent's width; the containing
		// block differs from the viewport in nested previews.
		const parentWidth = this.#breakpointElement?.getBoundingClientRect().width ?? 0;
		this.#wideMode = parentWidth > this.#breakpointPx;
		// Seed from authored markup, then auto-mode derives the responsive
		// default. A later morph strip keeps intent, never re-runs this.
		this.#openIntent = this.hasAttribute("open");
		if (this.#autoMode) {
			if (this.#wideMode && !this.#openIntent) {
				this.#applyOpen();
			} else if (!this.#wideMode && this.#openIntent) {
				this.#applyClose();
			}
		}
		this.#syncOverlayMode();
		this.#syncInert();

		// Track parent-size changes (browser-window resize, drag of an
		// enclosing preview/split-view). For sidebars wrapped by
		// <neo-resizable> we observe the wrapper's parent instead; the
		// resizable host is a width handle, not the responsive shell.
		// Only act on actual breakpoint crossings.
		this.#parentResizeObserver = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width ?? 0;
			const wide = w > this.#breakpointPx;
			if (wide === this.#wideMode) return;
			this.#wideMode = wide;

			// The cascade switch (in-flow ↔ overlay) re-derives `transform`
			// from a different rule set; for a closed sidebar that animates
			// from `none` to `translateX(-100%)`, flickering it into view
			// and back out. Suppress transitions for one frame across the
			// boundary so the new computed values snap in. Open sidebars
			// don't need this; `none` -> `translateX(0)` is a visual no-op.
			const wasOpen = this.hasAttribute("open");
			if (!wasOpen) {
				this.setAttribute("data-neo-mode-snap", "");
			}

			// Auto-mode is asymmetric: going narrow ALWAYS closes (an
			// overlay sidebar would otherwise dump a full-width modal on
			// the reader on every resize down). Going wide auto-opens
			// unless the user has previously closed in wide mode; that
			// preference sticks across narrow round-trips.
			if (this.#autoMode) {
				this.#suspendUserOverride = true;
				if (wide && !this.#wideClosed) this.show();
				else if (!wide) this.hide();
				this.#suspendUserOverride = false;
			}
			// Re-sync after a mode change even when [open] didn't move:
			// narrow+open -> wide+open keeps [open] set, so attributeChanged
			// wouldn't fire, but the backdrop's visibility flipped.
			this.#syncBackdrop();
			this.#syncOverlayMode();

			// Two RAFs: first lands the new computed style with
			// transitions still suppressed, second releases them.
			if (!wasOpen) {
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						this.removeAttribute("data-neo-mode-snap");
					});
				});
			}
		});
		const observed = this.#breakpointElement;
		if (observed) {
			this.#parentResizeObserver.observe(observed);
		}

		this.addEventListener("click", this.#onClick);
		this.addEventListener("touchstart", this.#onTouchStart, { passive: true });
		// touchmove must be non-passive because the gesture preventDefaults
		// page scroll once it commits to a horizontal drag.
		this.addEventListener("touchmove", this.#onTouchMove, { passive: false });
		this.addEventListener("touchend", this.#onTouchEnd);
		this.addEventListener("touchcancel", this.#onTouchCancel);
		document.addEventListener("keydown", this.#onKeyDown);
		this.#ensureBackdrop();
		this.#syncBackdrop();
		this.#captureAsyncSlot();
		this.#readyRaf = requestAnimationFrame(() => {
			this.#readyRaf = requestAnimationFrame(() => {
				this.#readyRaf = 0;
				this.setAttribute("data-neo-sidebar-ready", "");
			});
		});
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("touchstart", this.#onTouchStart);
		this.removeEventListener("touchmove", this.#onTouchMove);
		this.removeEventListener("touchend", this.#onTouchEnd);
		this.removeEventListener("touchcancel", this.#onTouchCancel);
		if (this.#touchDrag?.decided) this.#clearDragStyles();
		this.#touchDrag = null;
		document.removeEventListener("keydown", this.#onKeyDown);
		if (this.#readyRaf) {
			cancelAnimationFrame(this.#readyRaf);
			this.#readyRaf = 0;
		}
		this.removeAttribute("data-neo-sidebar-ready");
		if (this.#asyncRestoreTimer) {
			window.clearTimeout(this.#asyncRestoreTimer);
			this.#asyncRestoreTimer = 0;
		}
		this.#parentResizeObserver?.disconnect();
		this.#parentResizeObserver = null;
		this.#wideMode = null;
		this.#morphObserver?.disconnect();
		this.#morphObserver = null;
		this.#previousFocus = null;
		this.#backdropEl?.remove();
		this.#backdropEl = null;
	}

	attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null) {
		if (name === "overlay-breakpoint") {
			// Only act when the new breakpoint actually crosses the
			// parent's current width.
			if (this.#wideMode === null) return;
			const w = this.#breakpointElement?.getBoundingClientRect().width ?? 0;
			const wide = w > this.#breakpointPx;
			if (wide === this.#wideMode) return;
			this.#wideMode = wide;
			this.#syncBackdrop();
			this.#syncOverlayMode();
			// No transition snap or auto-mode reaction: a programmatic
			// breakpoint change is a configuration tweak, not a user-
			// visible viewport crossing; preserve the existing [open].
			return;
		}
		if (name !== "open" || this.#reflecting) return;
		const cmd = openCommand(this);
		if (cmd === null) {
			// Absent: keep state; re-assert for `[open]` CSS. No
			// auto/breakpoint reconcile here; that's resize-driven.
			if (this.#openIntent) this.#reflectOpen();
			return;
		}
		if (cmd === "open") this.#applyOpen();
		else this.#applyClose();
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

	// Side effects run on intent transitions, not attribute presence.
	#applyOpen(opts: { silent?: boolean } = {}): void {
		const wasOpen = this.#openIntent;
		const focusOverlay = !wasOpen && this.#isOverlayMode && !opts.silent;
		this.#openIntent = true;
		if (focusOverlay) this.#previousFocus = document.activeElement;
		this.#reflectOpen();
		this.#syncBackdrop();
		this.#syncInert();
		// Reopened before a pending restore fired: keep the live content.
		if (this.#asyncRestoreTimer) {
			window.clearTimeout(this.#asyncRestoreTimer);
			this.#asyncRestoreTimer = 0;
		}
		if (!wasOpen && !opts.silent) {
			this.dispatchEvent(new CustomEvent("neo-sidebar-open", { bubbles: true }));
		}
		if (focusOverlay) this.#focusFirstTabbable({ preventScroll: true });
	}

	#applyClose(opts: { silent?: boolean } = {}): void {
		const wasOpen = this.#openIntent;
		const restoreFocus = wasOpen && this.#isOverlayMode && !opts.silent;
		this.#openIntent = false;
		this.#reflectClose();
		this.#syncBackdrop();
		this.#syncInert();
		if (restoreFocus && this.#previousFocus instanceof HTMLElement && this.#previousFocus.isConnected) {
			this.#previousFocus.focus();
		}
		this.#previousFocus = null;
		if (wasOpen) this.#scheduleAsyncSlotRestore();
		if (wasOpen && !opts.silent) {
			this.dispatchEvent(new CustomEvent("neo-sidebar-close", { bubbles: true }));
		}
	}

	// Snapshot the placeholder's parent (the content slot) and its initial
	// innerHTML. Captured once; re-captures are skipped so a morph before
	// close doesn't overwrite the saved placeholder.
	#captureAsyncSlot(): void {
		if (this.#asyncSlotInitialHTML !== null) return;
		const parent = this.querySelector("[data-neo-async-placeholder]")?.parentElement;
		if (!parent) return;
		this.#asyncSlot = parent;
		this.#asyncSlotInitialHTML = parent.innerHTML;
	}

	// Defer restore until the close transition completes so the placeholder
	// doesn't flash through the collapsing/sliding panel.
	#scheduleAsyncSlotRestore(): void {
		if (!this.#asyncSlot || this.#asyncSlotInitialHTML === null) return;
		if (this.#asyncRestoreTimer) window.clearTimeout(this.#asyncRestoreTimer);
		// Read computed duration so the wait tracks --neo-duration-scale.
		const seconds = parseFloat(getComputedStyle(this).transitionDuration);
		const ms = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 200;
		this.#asyncRestoreTimer = window.setTimeout(() => {
			this.#asyncRestoreTimer = 0;
			// A reopen inside the wait re-set [open]; keep the loaded content.
			if (this.hasAttribute("open")) return;
			this.#restoreAsyncSlot();
		}, ms);
	}

	#restoreAsyncSlot(): void {
		if (!this.#asyncSlot || this.#asyncSlotInitialHTML === null) return;
		// Slot wrapper got patched away; invalidate so future closes stop
		// retrying.
		if (!document.contains(this.#asyncSlot)) {
			this.#asyncSlot = null;
			this.#asyncSlotInitialHTML = null;
			return;
		}
		// `data-neo-async-restore="false"` opts out of restoration.
		if (!boolAttr(this.#asyncSlot, "data-neo-async-restore", true)) {
			this.#asyncSlot = null;
			this.#asyncSlotInitialHTML = null;
			return;
		}
		// Opened and closed before the load landed: placeholder is still
		// live, skip the redundant reset.
		if (this.#asyncSlot.querySelector("[data-neo-async-placeholder]")) return;
		this.#asyncSlot.innerHTML = this.#asyncSlotInitialHTML;
	}

	show(): void {
		// Only explicit opens in wide mode update the preference;
		// narrow opens are transient overlay slides.
		if (!this.#suspendUserOverride && this.#wideMode === true) {
			this.#wideClosed = false;
		}
		if (!this.#openIntent) this.#applyOpen();
	}

	hide(): void {
		// Symmetric; see show().
		if (!this.#suspendUserOverride && this.#wideMode === true) {
			this.#wideClosed = true;
		}
		if (this.#openIntent) this.#applyClose();
	}

	toggle(): void {
		if (this.#openIntent) this.hide();
		else this.show();
	}

	// True while the panel is rendering as a fixed overlay, either
	// because the author pinned `[overlay]` or because the JS detected
	// a narrow parent. Touch-dismiss is gated on this: in wide in-flow
	// mode the host is a column whose width animates, not a sliding
	// panel, so a horizontal swipe has nothing to interpolate against.
	get #isOverlayMode(): boolean {
		return boolAttr(this, "overlay", false) || this.hasAttribute("data-neo-sidebar-overlay");
	}

	// Returns the threshold in px, or null if touch-dismiss is
	// explicitly disabled. The gesture is on by default in overlay
	// mode; a missing or bare attribute falls back to half the host's
	// current width (a classic mobile-drawer feel).
	#getTouchDismissThreshold(width: number): number | null {
		return resolveTouchDismiss(this.getAttribute("touch-dismiss"), width, Math.max(40, width / 2), this);
	}

	// Walks from the touch's starting target up to (but not including)
	// the sidebar host, bailing the moment it hits an element that
	// owns horizontal interaction of its own. The host's own
	// `[data-neo-sidebar-content]` slot scrolls VERTICALLY by default
	// so it isn't excluded; vertical-scroll vs. drag is settled
	// later in onTouchMove by comparing dx vs dy.
	#touchStartIneligible(target: EventTarget | null): boolean {
		let el: Element | null = target instanceof Element ? target : null;
		while (el && el !== this) {
			if (
				el.matches(
					"[data-neo-sidebar-touch-ignore]," +
						'input[type="range"],' +
						"neo-slider,neo-slider-range,neo-resizable," +
						"neo-color-field",
				)
			) {
				return true;
			}
			const ox = getComputedStyle(el).overflowX;
			if ((ox === "auto" || ox === "scroll") && el.scrollWidth - el.clientWidth > 1) {
				return true;
			}
			el = el.parentElement;
		}
		return false;
	}

	#onTouchStart = (e: TouchEvent) => {
		if (this.#touchDrag) return;
		if (!this.hasAttribute("open")) return;
		if (!this.#isOverlayMode) return;
		if (e.touches.length !== 1) return;
		const rect = this.getBoundingClientRect();
		if (rect.width <= 0) return;
		const threshold = this.#getTouchDismissThreshold(rect.width);
		if (threshold === null) return;
		if (this.#touchStartIneligible(e.target)) return;
		const t = e.touches[0];
		this.#touchDrag = {
			startX: t.clientX,
			startY: t.clientY,
			startTime: performance.now(),
			width: rect.width,
			closeDir: this.getAttribute("side") === "right" ? 1 : -1,
			threshold,
			decided: false,
			cancelled: false,
		};
	};

	#onTouchMove = (e: TouchEvent) => {
		const d = this.#touchDrag;
		if (!d || d.cancelled) return;
		if (e.touches.length !== 1) {
			this.#cancelDrag();
			return;
		}
		const t = e.touches[0];
		const dx = t.clientX - d.startX;
		const dy = t.clientY - d.startY;
		const dxClose = dx * d.closeDir;
		if (!d.decided) {
			// Dead zone: wait until the gesture commits to a direction.
			if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
			// Vertical wins -> user is scrolling content; let the browser do its job.
			if (Math.abs(dy) >= Math.abs(dx)) {
				d.cancelled = true;
				return;
			}
			// Horizontal but in the OPENING direction (sidebar already
			// open, can't open further) -> leave the gesture to whatever
			// descendant might want it.
			if (dxClose <= 0) {
				d.cancelled = true;
				return;
			}
			d.decided = true;
			this.setAttribute("data-neo-sidebar-dragging", "");
			// Inline `transition: none` while the finger is down so each
			// touchmove repaints the new transform instantaneously instead
			// of chasing the previous frame on a 200ms easing curve.
			this.style.transition = "none";
			if (this.#backdropEl) {
				this.#backdropEl.style.transition = "none";
			}
		}
		e.preventDefault();
		const offset = Math.max(0, Math.min(dxClose, d.width)) * d.closeDir;
		this.style.transform = `translateX(${offset}px)`;
		if (this.#backdropEl) {
			const progress = Math.max(0, Math.min(1, dxClose / d.width));
			this.#backdropEl.style.opacity = String(1 - progress);
		}
	};

	#onTouchEnd = (e: TouchEvent) => {
		const d = this.#touchDrag;
		if (!d) return;
		this.#touchDrag = null;
		if (!d.decided) return;
		const t = e.changedTouches[0];
		const dx = (t?.clientX ?? d.startX) - d.startX;
		const dxClose = dx * d.closeDir;
		const elapsed = Math.max(1, performance.now() - d.startTime);
		// px/ms. 0.6 is roughly a casual-but-deliberate flick. Lower
		// numbers feel twitchy (any nudge closes), higher numbers force
		// users to drag past the absolute threshold.
		const flick = dxClose / elapsed > 0.6;
		const shouldClose = dxClose >= d.threshold || flick;
		this.#clearDragStyles();
		if (shouldClose) this.hide();
	};

	#onTouchCancel = () => {
		this.#cancelDrag();
	};

	#cancelDrag() {
		const d = this.#touchDrag;
		if (!d) return;
		this.#touchDrag = null;
		if (d.decided) this.#clearDragStyles();
	}

	// Clears every inline value stamped on by the drag so the cascade
	// resumes ownership. Browsers compute the transition's from-value
	// from the prior rendered transform, so removing the inline values
	// here lets the snap-back / slide-out animate from the current
	// finger position to either translateX(0) (snap) or the closed
	// -100% (after hide()).
	#clearDragStyles() {
		this.removeAttribute("data-neo-sidebar-dragging");
		this.style.transform = "";
		this.style.transition = "";
		if (this.#backdropEl) {
			this.#backdropEl.style.opacity = "";
			this.#backdropEl.style.transition = "";
		}
	}

	#syncManagedAttrs = (): void => {
		if (!this.hasAttribute("role")) setAttrIfChanged(this, "role", "complementary");
		if (!this.hasAttribute("tabindex")) setAttrIfChanged(this, "tabindex", "-1");
	};

	#tabbables(): HTMLElement[] {
		const out: HTMLElement[] = [];
		for (const el of this.querySelectorAll<HTMLElement>(FOCUSABLE)) {
			if (el.getAttribute("aria-disabled") === "true") continue;
			if (el.closest("[inert]")) continue;
			if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
			out.push(el);
		}
		return out;
	}

	#focusFirstTabbable(opts: { preventScroll?: boolean } = {}): void {
		const target = this.#tabbables()[0] ?? this;
		target.focus({ preventScroll: opts.preventScroll });
	}

	#handleTabKey(e: KeyboardEvent): void {
		if (!this.hasAttribute("open")) return;
		if (!this.#isOverlayMode) return;
		const f = this.#tabbables();
		if (f.length === 0) {
			e.preventDefault();
			this.focus({ preventScroll: true });
			return;
		}
		const first = f[0];
		const last = f[f.length - 1];
		const active = deepActiveElement();
		if (!eventEnters(e, this) && (!active || !this.contains(active))) {
			e.preventDefault();
			(e.shiftKey ? last : first).focus();
		} else if (e.shiftKey && active === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	// Mirrors neo-popover's [data-neo-popover-close] convention.
	#onClick = (e: MouseEvent) => {
		const target = e.target as Element | null;
		if (target?.closest("[data-neo-sidebar-close]")) this.hide();
	};

	// Overlay mode is modal-like; wide mode stays in the page tab order.
	#onKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Tab") {
			this.#handleTabKey(e);
			return;
		}
		if (e.key !== "Escape") return;
		if (!this.hasAttribute("open")) return;
		// Restore the backdrop if a parent morph stripped it, so the
		// visibility gate below reflects reality rather than a stale ref.
		this.#ensureBackdrop();
		if (!this.#backdropEl) return;
		if (getComputedStyle(this.#backdropEl).display === "none") return;
		this.hide();
	};

	// The backdrop is appended next to the host so it shares the host's
	// containing block. For app-level sidebars `position: fixed`
	// resolves to the viewport; for nested previews with `contain:
	// paint` etc. it resolves to that parent, keeping the overlay
	// inside without needing an iframe.
	#ensureBackdrop() {
		// Keep one backdrop, tracked by the cached ref. Recreate it if a
		// morph stripped it or moved it out of the host. Don't scan the
		// parent for a backdrop to reuse: a sibling sidebar under the same
		// parent has its own, and grabbing it would stack a hide() listener
		// so one click closes both.
		const host = this.parentElement ?? document.body;
		let el = this.#backdropEl;
		if (!el?.isConnected || el.parentElement !== host) {
			el = document.createElement("div");
			el.setAttribute("data-neo-sidebar-backdrop", "");
			el.setAttribute("aria-hidden", "true");
			host.appendChild(el);
		}
		// addEventListener dedups the stable #onBackdropClick ref.
		el.addEventListener("click", this.#onBackdropClick);
		this.#backdropEl = el;
	}

	// [data-neo-open] reflects "actually visible right now" (open AND
	// overlay-mode), not just the host's [open]. Driving visibility
	// from combined JS state instead of CSS-gating eliminates a
	// fade-in flicker on breakpoint crossing; CSS recomputes one
	// frame before the ResizeObserver callback runs.
	#syncBackdrop() {
		// Self-heal: a parent-subtree morph can have removed the backdrop
		// while the host stayed connected. ensureBackdrop is idempotent.
		this.#ensureBackdrop();
		if (!this.#backdropEl) return;
		const visible = this.hasAttribute("open") && (this.#wideMode === false || boolAttr(this, "overlay", false));
		if (visible) {
			this.#backdropEl.setAttribute("data-neo-open", "");
		} else {
			this.#backdropEl.removeAttribute("data-neo-open");
		}
	}

	// When closed, the header/content/footer slots are either translated
	// off-screen (overlay) or clipped to zero width (in-flow), but neither
	// removes them from focus or the a11y tree. `inert` does. The
	// minimized rail is exempt: it's the one slot the closed-wide-in-flow
	// state actually renders as visible/interactive.
	#syncInert() {
		const open = this.hasAttribute("open");
		for (const child of Array.from(this.children)) {
			if (!(child instanceof HTMLElement)) continue;
			if (child.matches("[data-neo-sidebar-minimized]")) {
				child.inert = false;
			} else {
				child.inert = !open;
			}
		}
	}
}

// Returns null on malformed input so callers can fall back instead
// of silently treating garbage as 0.
function parseCssLength(s: string, rem: number): number | null {
	const m = s.match(/^([+-]?\d*\.?\d+)(rem|em|px)?$/);
	if (!m) return null;
	const v = parseFloat(m[1]);
	if (!Number.isFinite(v)) return null;
	const unit = m[2] ?? "px";
	if (unit === "rem" || unit === "em") return v * rem;
	return v;
}

if (!customElements.get("neo-sidebar")) {
	customElements.define("neo-sidebar", NeoSidebar);
}
