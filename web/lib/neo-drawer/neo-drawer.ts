// Same foundation as <neo-dialog> (native <dialog>: modal lifecycle, top
// layer, focus trap, scroll lock, Esc), anchored to one viewport edge and
// slid in with a transform. Light DOM throughout.

import { boolAttr, openCommand } from "../command";
import { DialogBackdropClickTracker, lockBodyScroll, unlockBodyScroll } from "../native-dialog";
import { resolveTouchDismiss } from "../touch-dismiss";

let nextId = 0;

export class NeoDrawer extends HTMLElement {
	static readonly observedAttributes = ["open", "side"];

	#trigger: HTMLElement | null = null;
	#dialog: HTMLDialogElement | null = null;
	#childObserver: MutationObserver | null = null;
	#previousFocus: Element | null = null;
	#ready = false;
	#holdsScrollLock = false;
	// Rendered open state; `open` is its reflection (see command).
	// Survives a morph strip; cleared only by onDialogClose.
	#openIntent = false;
	// Guards reflective attribute writes so they aren't read as commands.
	#reflecting = false;
	// Coalesces post-morph showModal() recovery rAFs.
	#recoverScheduled = false;
	// Id of the drawer-body descendant that held focus, to reseat after
	// recovery (showModal otherwise lands on the first focusable).
	#focusedDescendantId = "";
	#backdropClick = new DialogBackdropClickTracker();

	// Async placeholder slot: same lifecycle as <neo-dialog>'s. Capture
	// once at connect, reinstate on close. asyncSlot is the *parent*
	// of the placeholder (the morph patch targets this wrapper).
	#asyncSlot: Element | null = null;
	#asyncSlotInitialHTML: string | null = null;
	#asyncRestoreTimer: number | null = null;

	// Active single-touch drag state. `decided` flips once the gesture
	// commits to a closing-direction drag; before that we don't
	// preventDefault, so taps and cross-axis scrolls still work.
	#touchDrag: {
		startX: number;
		startY: number;
		startTime: number;
		size: number;
		axis: "x" | "y";
		closeDir: 1 | -1;
		threshold: number;
		decided: boolean;
		cancelled: boolean;
	} | null = null;

	connectedCallback() {
		if (!this.#bindChildren()) return;
		this.#captureAsyncSlot();
		this.addEventListener("click", this.#onContentClick);
		this.addEventListener("focusin", this.#onHostFocusIn);
		this.addEventListener("focusout", this.#onHostFocusOut);
		this.#childObserver = new MutationObserver(this.#onChildMutation);
		this.#childObserver.observe(this, { childList: true });
		// Command `open` on connect: explicit open/close obey; absent
		// keeps prior intent (persists across reconnect/morph).
		const cmd = openCommand(this);
		if (cmd === "open") this.#openIntent = true;
		else if (cmd === "close") this.#openIntent = false;
		this.#ready = true;
		this.#sync();
	}

	#onChildMutation = () => {
		if (!this.#bindChildren()) return;
		// A fat morph can strip the inner <dialog> from the top layer or
		// replace it; if still meant open, re-run showModal() once layout
		// settles. bindChildren already repointed this.dialog.
		if (this.#openIntent) this.#scheduleRecover();
	};

	disconnectedCallback() {
		this.#ready = false;
		this.#trigger?.removeEventListener("click", this.#onTriggerClick);
		this.#dialog?.removeEventListener("pointerdown", this.#onDialogPointerDown);
		this.#dialog?.removeEventListener("click", this.#onDialogClick);
		this.#dialog?.removeEventListener("close", this.#onDialogClose);
		this.#dialog?.removeEventListener("cancel", this.#onDialogCancel);
		this.#dialog?.removeEventListener("keydown", this.#onDialogKeydown, true);
		this.#dialog?.removeEventListener("touchstart", this.#onTouchStart);
		this.#dialog?.removeEventListener("touchmove", this.#onTouchMove);
		this.#dialog?.removeEventListener("touchend", this.#onTouchEnd);
		this.#dialog?.removeEventListener("touchcancel", this.#onTouchCancel);
		this.removeEventListener("click", this.#onContentClick);
		this.removeEventListener("focusin", this.#onHostFocusIn);
		this.removeEventListener("focusout", this.#onHostFocusOut);
		if (this.#touchDrag?.decided) this.#clearDragStyles();
		this.#touchDrag = null;
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		if (this.#holdsScrollLock) {
			unlockBodyScroll();
			this.#holdsScrollLock = false;
		}
		if (this.#asyncRestoreTimer !== null) {
			window.clearTimeout(this.#asyncRestoreTimer);
			this.#asyncRestoreTimer = null;
		}
		this.#backdropClick.reset();
	}

	// `side` is read by CSS attribute selectors; no JS work needed.
	attributeChangedCallback(name: string) {
		if (name !== "open" || !this.#ready || this.#reflecting) return;
		const cmd = openCommand(this);
		if (cmd === null) {
			// Absent: keep state; re-assert, then re-establish the modal.
			// The morph can drop the <dialog> from the top layer.
			if (this.#openIntent) {
				this.#reflectOpen();
				this.#scheduleRecover();
			}
			return;
		}
		if (cmd === "open") {
			this.#openIntent = true;
			this.#reflectOpen();
			this.#sync();
		} else {
			this.#openIntent = false;
			this.#reflectClose();
			this.#sync();
		}
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

	// showModal() + scroll lock, idempotent and event-free, shared by
	// sync()'s open transition and silent morph recovery.
	#openModal(): void {
		if (!this.#dialog || this.#dialog.open) return;
		// Re-open within the close-transition window keeps freshly-loading
		// content; cancel the pending skeleton restore.
		if (this.#asyncRestoreTimer !== null) {
			window.clearTimeout(this.#asyncRestoreTimer);
			this.#asyncRestoreTimer = null;
		}
		this.#dialog.showModal();
		if (!this.#holdsScrollLock) {
			lockBodyScroll();
			this.#holdsScrollLock = true;
		}
	}

	// After a morph settles (post-layout), re-enter the top layer if the
	// <dialog> was dropped from it. Silent: no neo-drawer-open re-fire.
	#scheduleRecover(): void {
		if (this.#recoverScheduled) return;
		this.#recoverScheduled = true;
		requestAnimationFrame(() => {
			this.#recoverScheduled = false;
			if (this.#openIntent && this.#dialog && !this.#dialog.open && this.isConnected) {
				this.#openModal();
				this.#restoreFocusedDescendant();
			}
		});
	}

	// Track / reseat the body control the user was on. showModal lands on
	// the first focusable; if a specific descendant (by id) had focus,
	// restore it after recovery.
	#onHostFocusIn = (e: FocusEvent) => {
		const t = e.target as Element | null;
		if (t instanceof HTMLElement && this.#dialog?.contains(t)) {
			this.#focusedDescendantId = t.id || "";
		}
	};

	#onHostFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		if (next) {
			this.#focusedDescendantId = "";
			return;
		}
		queueMicrotask(() => {
			if (this.contains(document.activeElement)) return;
			this.#focusedDescendantId = "";
		});
	};

	#restoreFocusedDescendant(): void {
		if (!this.#focusedDescendantId || !this.#dialog) return;
		const el = this.#dialog.querySelector<HTMLElement>(`#${CSS.escape(this.#focusedDescendantId)}`);
		el?.focus();
	}

	show(): void {
		if (this.#openIntent) return;
		this.#openIntent = true;
		this.#previousFocus = document.activeElement;
		this.#reflectOpen();
		this.#sync();
	}

	hide(): void {
		if (!this.#openIntent) {
			this.#reflectClose();
			return;
		}
		this.#openIntent = false;
		this.#reflectClose();
		this.#sync();
	}

	toggle(): void {
		if (this.#openIntent) this.hide();
		else this.show();
	}

	#bindChildren(): boolean {
		const newTrigger = this.querySelector<HTMLElement>("[data-neo-drawer-trigger]");
		const newDialog = this.querySelector<HTMLDialogElement>("dialog");
		if (!newDialog) {
			// Trigger is optional; drawers can be opened purely via
			// [open]/.show(). Only the dialog is required.
			if (!this.#dialog) {
				console.warn("<neo-drawer> requires a <dialog> child.");
			}
			return false;
		}

		if (newTrigger !== this.#trigger) {
			this.#trigger?.removeEventListener("click", this.#onTriggerClick);
			this.#trigger = newTrigger;
			this.#trigger?.addEventListener("click", this.#onTriggerClick);
		}
		if (newDialog !== this.#dialog) {
			this.#dialog?.removeEventListener("pointerdown", this.#onDialogPointerDown);
			this.#dialog?.removeEventListener("click", this.#onDialogClick);
			this.#dialog?.removeEventListener("close", this.#onDialogClose);
			this.#dialog?.removeEventListener("cancel", this.#onDialogCancel);
			this.#dialog?.removeEventListener("keydown", this.#onDialogKeydown, true);
			this.#dialog?.removeEventListener("touchstart", this.#onTouchStart);
			this.#dialog?.removeEventListener("touchmove", this.#onTouchMove);
			this.#dialog?.removeEventListener("touchend", this.#onTouchEnd);
			this.#dialog?.removeEventListener("touchcancel", this.#onTouchCancel);
			this.#dialog = newDialog;
			this.#dialog.addEventListener("pointerdown", this.#onDialogPointerDown);
			this.#dialog.addEventListener("click", this.#onDialogClick);
			this.#dialog.addEventListener("close", this.#onDialogClose);
			this.#dialog.addEventListener("cancel", this.#onDialogCancel);
			// Capture-phase Esc swallow: belt-and-suspenders alongside the
			// cancel handler. Stops descendant Esc handlers (popover etc.)
			// from acting when the drawer is locked open.
			this.#dialog.addEventListener("keydown", this.#onDialogKeydown, true);
			// Listen on the dialog (the panel), not the host (`display:
			// contents`). touchmove is non-passive so we can preventDefault
			// page scroll once the drag commits.
			this.#dialog.addEventListener("touchstart", this.#onTouchStart, {
				passive: true,
			});
			this.#dialog.addEventListener("touchmove", this.#onTouchMove, {
				passive: false,
			});
			this.#dialog.addEventListener("touchend", this.#onTouchEnd);
			this.#dialog.addEventListener("touchcancel", this.#onTouchCancel);
		}

		if (!this.#dialog.id) this.#dialog.id = `neo-drawer-${++nextId}`;
		this.#trigger?.setAttribute("aria-haspopup", "dialog");
		this.#trigger?.setAttribute("aria-controls", this.#dialog.id);
		if (!this.#dialog.hasAttribute("role")) {
			this.#dialog.setAttribute("role", "dialog");
		}
		this.#dialog.setAttribute("aria-modal", "true");

		const title = this.#dialog.querySelector<HTMLElement>("[data-neo-drawer-title]");
		if (title) {
			if (!title.id) title.id = `${this.#dialog.id}-title`;
			this.#dialog.setAttribute("aria-labelledby", title.id);
		} else {
			this.#dialog.removeAttribute("aria-labelledby");
		}
		const desc = this.#dialog.querySelector<HTMLElement>("[data-neo-drawer-description]");
		if (desc) {
			if (!desc.id) desc.id = `${this.#dialog.id}-desc`;
			this.#dialog.setAttribute("aria-describedby", desc.id);
		} else {
			this.#dialog.removeAttribute("aria-describedby");
		}

		this.#trigger?.setAttribute("aria-expanded", String(this.#openIntent));
		return true;
	}

	#sync() {
		if (!this.#dialog) return;
		const want = this.#openIntent;
		const have = this.#dialog.open;
		this.#trigger?.setAttribute("aria-expanded", String(want));
		if (want && !have) {
			if (!this.#previousFocus) this.#previousFocus = document.activeElement;
			this.#openModal();
			this.dispatchEvent(new CustomEvent("neo-drawer-open", { bubbles: true }));
		} else if (!want && have) {
			this.#dialog.close();
		}
	}

	#isDismissible(): boolean {
		return boolAttr(this, "dismissible", true);
	}

	#onTriggerClick = (e: MouseEvent) => {
		e.preventDefault();
		this.toggle();
	};

	#onDialogPointerDown = (e: PointerEvent) => {
		if (!this.#dialog) return;
		this.#backdropClick.onPointerDown(this.#dialog, e);
	};

	// Backdrop click: native <dialog> sets `e.target === dialog` for both
	// backdrop clicks and clicks on the dialog box itself. Require the press
	// and release to both be outside so selection drags out of the panel do
	// not dismiss the drawer.
	#onDialogClick = (e: MouseEvent) => {
		if (!this.#dialog) return;
		const backdropDismiss = this.#backdropClick.shouldDismiss(this.#dialog, e);
		if (!this.#isDismissible()) return;
		if (backdropDismiss) this.hide();
	};

	// Esc fires `cancel`; preventDefault keeps it open when
	// non-dismissible.
	#onDialogCancel = (e: Event) => {
		if (!this.#isDismissible()) {
			e.preventDefault();
		}
	};

	// Capture-phase Esc swallow when locked open. Stops propagation so
	// descendant Esc handlers (popover, combobox) don't fire either.
	// A non-dismissible drawer should feel completely inert to Esc.
	#onDialogKeydown = (e: KeyboardEvent) => {
		if (e.key !== "Escape") return;
		if (this.#isDismissible()) return;
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	};

	// The authoritative "actually closed" signal (Esc, backdrop,
	// [data-neo-drawer-close], programmatic close()). Clear intent so a
	// later silent fat-morph recovery won't re-open it.
	#onDialogClose = () => {
		this.#openIntent = false;
		this.#reflectClose();
		if (this.#holdsScrollLock) {
			unlockBodyScroll();
			this.#holdsScrollLock = false;
		}
		if (this.#previousFocus instanceof HTMLElement) {
			this.#previousFocus.focus();
		}
		this.#previousFocus = null;
		this.dispatchEvent(new CustomEvent("neo-drawer-close", { bubbles: true }));
		// Defer placeholder restore until after slide-out so the skeleton
		// doesn't flash through the closing drawer.
		this.#scheduleAsyncSlotRestore();
	};

	#scheduleAsyncSlotRestore() {
		if (!this.#dialog) return;
		if (!this.#asyncSlot || this.#asyncSlotInitialHTML === null) return;
		if (this.#asyncRestoreTimer !== null) {
			window.clearTimeout(this.#asyncRestoreTimer);
		}
		// Read computed transition duration so the wait tracks the active
		// theme's --neo-duration-scale. parseFloat takes the first value.
		const computed = getComputedStyle(this.#dialog).transitionDuration;
		const seconds = parseFloat(computed);
		const ms = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 250;
		this.#asyncRestoreTimer = window.setTimeout(() => {
			this.#asyncRestoreTimer = null;
			// Re-check `[open]`: a fresh close inside the wait could have
			// replaced an earlier timer that was meant to be cancelled.
			if (this.hasAttribute("open")) return;
			this.#restoreAsyncSlot();
		}, ms);
	}

	// Snapshot the placeholder's parent (the slot) and its initial
	// innerHTML. Captured once; re-captures are skipped so a morph
	// before close doesn't replace the saved skeleton.
	#captureAsyncSlot() {
		if (this.#asyncSlotInitialHTML !== null) return;
		if (!this.#dialog) return;
		const placeholder = this.#dialog.querySelector("[data-neo-async-placeholder]");
		if (!placeholder) return;
		const parent = placeholder.parentElement;
		if (!parent) return;
		this.#asyncSlot = parent;
		this.#asyncSlotInitialHTML = parent.innerHTML;
	}

	#restoreAsyncSlot() {
		if (!this.#asyncSlot || this.#asyncSlotInitialHTML === null) return;
		// Slot wrapper got patched away; invalidate so future closes
		// don't keep retrying.
		if (!document.contains(this.#asyncSlot)) {
			this.#asyncSlot = null;
			this.#asyncSlotInitialHTML = null;
			return;
		}
		// `data-neo-async-restore="false"` opts out of restoration.
		if (!boolAttr(this.#asyncSlot as Element, "data-neo-async-restore", true)) {
			this.#asyncSlot = null;
			this.#asyncSlotInitialHTML = null;
			return;
		}
		// Drawer opened and closed before the patch landed: placeholder
		// is still live, skip the redundant innerHTML reset.
		if (this.#asyncSlot.querySelector("[data-neo-async-placeholder]")) {
			return;
		}
		this.#asyncSlot.innerHTML = this.#asyncSlotInitialHTML;
	}

	#onContentClick = (e: MouseEvent) => {
		const target = (e.target as Element | null)?.closest("[data-neo-drawer-close]");
		if (!target || !this.contains(target)) return;
		e.preventDefault();
		this.hide();
	};

	// Axis + closing direction derived from `side`. Default = right.
	#getAxisAndCloseDir(): { axis: "x" | "y"; closeDir: 1 | -1 } {
		const side = this.getAttribute("side");
		if (side === "left") return { axis: "x", closeDir: -1 };
		if (side === "top") return { axis: "y", closeDir: -1 };
		if (side === "bottom") return { axis: "y", closeDir: 1 };
		return { axis: "x", closeDir: 1 };
	}

	// Threshold in px, or null when explicitly disabled. Missing/bare
	// -> half the panel's relevant dimension. Probe in the dialog for
	// the panel's own font/layout context.
	#getTouchDismissThreshold(size: number): number | null {
		if (!this.#dialog) return Math.max(40, size / 2);
		return resolveTouchDismiss(this.getAttribute("touch-dismiss"), size, Math.max(40, size / 2), this.#dialog);
	}

	// Walk target -> host, bailing on any element that owns a same-axis
	// gesture. Cross-axis scrollers are left alone; that contest is
	// resolved in onTouchMove by comparing dx vs dy.
	#touchStartIneligible(target: EventTarget | null, axis: "x" | "y"): boolean {
		let el: Element | null = target instanceof Element ? target : null;
		while (el && el !== this) {
			if (
				el.matches(
					"[data-neo-drawer-touch-ignore]," +
						'input[type="range"],' +
						"neo-slider,neo-slider-range,neo-resizable," +
						"neo-color-field",
				)
			) {
				return true;
			}
			const cs = getComputedStyle(el);
			if (axis === "x") {
				if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth - el.clientWidth > 1) {
					return true;
				}
			} else {
				if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight - el.clientHeight > 1) {
					return true;
				}
			}
			el = el.parentElement;
		}
		return false;
	}

	#onTouchStart = (e: TouchEvent) => {
		if (this.#touchDrag) return;
		if (!this.#dialog?.open) return;
		if (!this.#isDismissible()) return;
		if (e.touches.length !== 1) return;
		const rect = this.#dialog.getBoundingClientRect();
		const { axis, closeDir } = this.#getAxisAndCloseDir();
		const size = axis === "x" ? rect.width : rect.height;
		if (size <= 0) return;
		const threshold = this.#getTouchDismissThreshold(size);
		if (threshold === null) return;
		if (this.#touchStartIneligible(e.target, axis)) return;
		const t = e.touches[0];
		this.#touchDrag = {
			startX: t.clientX,
			startY: t.clientY,
			startTime: performance.now(),
			size,
			axis,
			closeDir,
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
		const along = d.axis === "x" ? dx : dy;
		const across = d.axis === "x" ? dy : dx;
		const alongClose = along * d.closeDir;
		if (!d.decided) {
			// Dead zone.
			if (Math.abs(along) < 8 && Math.abs(across) < 8) return;
			// Cross-axis wins -> user is scrolling; back off.
			if (Math.abs(across) >= Math.abs(along)) {
				d.cancelled = true;
				return;
			}
			// Opening direction -> drawer can't open further; not ours.
			if (alongClose <= 0) {
				d.cancelled = true;
				return;
			}
			d.decided = true;
			this.setAttribute("data-neo-drawer-dragging", "");
			// Disable transition so the panel tracks the finger 1:1
			// instead of chasing the easing curve.
			if (this.#dialog) this.#dialog.style.transition = "none";
		}
		e.preventDefault();
		const offset = Math.max(0, Math.min(alongClose, d.size)) * d.closeDir;
		if (this.#dialog) {
			this.#dialog.style.transform = d.axis === "x" ? `translateX(${offset}px)` : `translateY(${offset}px)`;
		}
	};

	#onTouchEnd = (e: TouchEvent) => {
		const d = this.#touchDrag;
		if (!d) return;
		this.#touchDrag = null;
		if (!d.decided) return;
		const t = e.changedTouches[0];
		const endX = t?.clientX ?? d.startX;
		const endY = t?.clientY ?? d.startY;
		const along = d.axis === "x" ? endX - d.startX : endY - d.startY;
		const alongClose = along * d.closeDir;
		const elapsed = Math.max(1, performance.now() - d.startTime);
		// 0.6 px/ms ≈ a deliberate flick; tuned to avoid twitchy closes.
		const flick = alongClose / elapsed > 0.6;
		const shouldClose = alongClose >= d.threshold || flick;
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

	// Drop inline overrides so the cascade resumes; the transition
	// then animates from the current rendered transform to either
	// translate(0,0) (snap-back) or the closed transform (after hide).
	#clearDragStyles() {
		this.removeAttribute("data-neo-drawer-dragging");
		if (this.#dialog) {
			this.#dialog.style.transform = "";
			this.#dialog.style.transition = "";
		}
	}
}

if (!customElements.get("neo-drawer")) {
	customElements.define("neo-drawer", NeoDrawer);
}
