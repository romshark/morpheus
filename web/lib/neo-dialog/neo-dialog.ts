// Host owns trigger/close wiring and ARIA; the platform <dialog> provides
// the modal lifecycle, top layer, focus trap, and Esc handling. No portal,
// so markup stays in light DOM and the kit's CSS can theme it directly.

let nextId = 0;

import { boolAttr, openCommand } from "../command";
import { DialogBackdropClickTracker, lockBodyScroll, unlockBodyScroll } from "../native-dialog";

export class NeoDialog extends HTMLElement {
	static readonly observedAttributes = ["open"];

	#trigger: HTMLElement | null = null;
	#dialog: HTMLDialogElement | null = null;
	#previousFocus: Element | null = null;
	#childObserver: MutationObserver | null = null;
	#ready = false;
	// Tracks whether this instance holds a scroll-lock refcount, so
	// disconnects / out-of-order [open] flips don't leak an extra
	// unlock or skip a release.
	#holdsScrollLock = false;
	// Rendered open state; `open` is its reflection. Survives a morph
	// strip so a re-created <dialog> re-enters the top layer.
	#openIntent = false;
	#reflecting = false;
	#recoverScheduled = false;
	// Id of the dialog-body descendant that held focus, to reseat after a
	// morph re-creates it (showModal otherwise lands on the first focusable).
	#focusedDescendantId = "";
	#backdropClick = new DialogBackdropClickTracker();

	// Captured once at connect: asyncSlot = parent of the
	// [data-neo-async-placeholder]; asyncSlotInitialHTML = the
	// placeholder content as authored. On close we restore so the
	// next open shows the placeholder again.
	#asyncSlot: Element | null = null;
	#asyncSlotInitialHTML: string | null = null;
	// The close event fires synchronously but the dialog is still
	// mid-fade-out, so restoring innerHTML in that window flashes the
	// skeleton through the closing dialog. Defer the restore until
	// after the transition; a re-open clears the timer.
	#asyncRestoreTimer: number | null = null;

	connectedCallback() {
		if (!this.#bindChildren()) return;

		this.#captureAsyncSlot();

		this.addEventListener("click", this.#onContentClick);
		this.addEventListener("focusin", this.#onHostFocusIn);
		this.addEventListener("focusout", this.#onHostFocusOut);
		// Re-acquire refs after a Datastar morph swaps children; else
		// `this.trigger` points at a detached node.
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
		// replace it; if still meant open, re-enter once layout settles and
		// reseat focus on the row the user was on.
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
		this.removeEventListener("click", this.#onContentClick);
		this.removeEventListener("focusin", this.#onHostFocusIn);
		this.removeEventListener("focusout", this.#onHostFocusOut);
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		// Browser closes the dialog implicitly on host teardown, but
		// no `close` event fires for that path, so release the lock
		// here too or it leaks on navigation away from any page with
		// an open dialog.
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

	attributeChangedCallback(name: string) {
		if (name !== "open" || !this.#ready || this.#reflecting) return;
		const cmd = openCommand(this);
		if (cmd === null) {
			// Absent (e.g. morph strip): keep state; re-assert, then
			// re-establish the modal (the morph can drop it from the top layer).
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

	show(): void {
		if (this.#openIntent) return;
		this.#openIntent = true;
		this.#previousFocus = document.activeElement;
		this.#reflectOpen();
		this.#sync();
	}

	hide(): void {
		if (!this.#openIntent) return;
		this.#openIntent = false;
		this.#reflectClose();
		this.#sync();
	}

	toggle(): void {
		if (this.#openIntent) this.hide();
		else this.show();
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
	// <dialog> was dropped, then reseat focus. Silent: no open re-fire.
	#scheduleRecover(): void {
		if (this.#recoverScheduled) return;
		this.#recoverScheduled = true;
		requestAnimationFrame(() => {
			this.#recoverScheduled = false;
			if (this.#openIntent && this.#dialog && !this.#dialog.open && this.isConnected) {
				this.#openModal();
				this.#trigger?.setAttribute("aria-expanded", "true");
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

	#bindChildren(): boolean {
		const newTrigger = this.querySelector<HTMLElement>("[data-neo-dialog-trigger]");
		const newDialog = this.querySelector<HTMLDialogElement>("dialog");
		if (!newTrigger || !newDialog) {
			if (!this.#trigger || !this.#dialog) {
				console.warn("<neo-dialog> requires a [data-neo-dialog-trigger] and a <dialog> child.");
			}
			return false;
		}

		if (newTrigger !== this.#trigger) {
			this.#trigger?.removeEventListener("click", this.#onTriggerClick);
			this.#trigger = newTrigger;
			this.#trigger.addEventListener("click", this.#onTriggerClick);
		}
		if (newDialog !== this.#dialog) {
			this.#dialog?.removeEventListener("pointerdown", this.#onDialogPointerDown);
			this.#dialog?.removeEventListener("click", this.#onDialogClick);
			this.#dialog?.removeEventListener("close", this.#onDialogClose);
			this.#dialog?.removeEventListener("cancel", this.#onDialogCancel);
			this.#dialog?.removeEventListener("keydown", this.#onDialogKeydown, true);
			this.#dialog = newDialog;
			this.#dialog.addEventListener("pointerdown", this.#onDialogPointerDown);
			this.#dialog.addEventListener("click", this.#onDialogClick);
			this.#dialog.addEventListener("close", this.#onDialogClose);
			this.#dialog.addEventListener("cancel", this.#onDialogCancel);
			// Capture-phase Esc swallow: belt-and-suspenders alongside the
			// cancel handler. Some inner controls (popovers, combobox) also
			// listen for Esc, and we don't want them snapping their own
			// state when the dialog is locked open. Capture phase fires
			// before any descendant listener.
			this.#dialog.addEventListener("keydown", this.#onDialogKeydown, true);
		}

		if (!this.#dialog.id) this.#dialog.id = `neo-dialog-${++nextId}`;
		this.#trigger.setAttribute("aria-haspopup", "dialog");
		this.#trigger.setAttribute("aria-controls", this.#dialog.id);
		if (!this.#dialog.hasAttribute("role")) {
			this.#dialog.setAttribute("role", "dialog");
		}
		this.#dialog.setAttribute("aria-modal", "true");

		const title = this.#dialog.querySelector<HTMLElement>("[data-neo-dialog-title]");
		if (title) {
			if (!title.id) title.id = `${this.#dialog.id}-title`;
			this.#dialog.setAttribute("aria-labelledby", title.id);
		} else {
			this.#dialog.removeAttribute("aria-labelledby");
		}
		const desc = this.#dialog.querySelector<HTMLElement>("[data-neo-dialog-description]");
		if (desc) {
			if (!desc.id) desc.id = `${this.#dialog.id}-desc`;
			this.#dialog.setAttribute("aria-describedby", desc.id);
		} else {
			this.#dialog.removeAttribute("aria-describedby");
		}

		this.#trigger.setAttribute("aria-expanded", String(this.hasAttribute("open")));
		return true;
	}

	#sync() {
		if (!this.#dialog || !this.#trigger) return;
		const want = this.#openIntent;
		const have = this.#dialog.open;
		this.#trigger.setAttribute("aria-expanded", String(want));
		if (want && !have) {
			// Fallback capture for opens driven through [open] (Datastar
			// `data-attr:open`, imperative setAttribute) so focus still
			// restores on close. show() also sets this; only fill when
			// missing so we don't clobber its capture.
			if (!this.#previousFocus) this.#previousFocus = document.activeElement;
			this.#openModal();
			this.dispatchEvent(new CustomEvent("neo-dialog-open", { bubbles: true }));
		} else if (!want && have) {
			this.#dialog.close();
			// close event runs onDialogClose (focus restore +
			// neo-dialog-close emit); don't double-emit here.
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

	// Backdrop clicks and clicks on the dialog box itself both have
	// `e.target === dialog`. Require the press and release to both be
	// outside so selection drags out of the surface do not dismiss it.
	#onDialogClick = (e: MouseEvent) => {
		if (!this.#dialog) return;
		const backdropDismiss = this.#backdropClick.shouldDismiss(this.#dialog, e);
		if (!this.#isDismissible()) return;
		if (backdropDismiss) this.hide();
	};

	#onContentClick = (e: MouseEvent) => {
		const target = e.target as Element | null;
		if (target?.closest("[data-neo-dialog-close]")) {
			this.hide();
		}
	};

	// Esc fires `cancel` before `close`. preventDefault suppresses
	// the close; this is how `dismissible="false"` works.
	#onDialogCancel = (e: Event) => {
		if (!this.#isDismissible()) {
			e.preventDefault();
		}
	};

	// Capture-phase Esc swallow when locked open. Stops propagation so
	// descendant Esc handlers (popover, combobox) don't fire either;
	// a non-dismissible dialog should feel completely inert to Esc.
	#onDialogKeydown = (e: KeyboardEvent) => {
		if (e.key !== "Escape") return;
		if (this.#isDismissible()) return;
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	};

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
		this.dispatchEvent(new CustomEvent("neo-dialog-close", { bubbles: true }));
		// After dispatch (so `data-on:neo-dialog-close` handlers run
		// first) and after the fade-out transition (see
		// scheduleAsyncSlotRestore).
		this.#scheduleAsyncSlotRestore();
	};

	#scheduleAsyncSlotRestore() {
		if (!this.#dialog) return;
		if (!this.#asyncSlot || this.#asyncSlotInitialHTML === null) return;
		if (this.#asyncRestoreTimer !== null) {
			window.clearTimeout(this.#asyncRestoreTimer);
		}
		// Read the dialog's computed transition-duration so the wait
		// tracks the active theme's --neo-duration-scale. parseFloat
		// takes the first numeric value (in seconds); 0s is valid.
		// Fall back to 200ms only on read failure.
		const computed = getComputedStyle(this.#dialog).transitionDuration;
		const seconds = parseFloat(computed);
		const ms = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 200;
		this.#asyncRestoreTimer = window.setTimeout(() => {
			this.#asyncRestoreTimer = null;
			// Re-check [open] in case the user re-opened between now and
			// the timer firing.
			if (this.hasAttribute("open")) return;
			this.#restoreAsyncSlot();
		}, ms);
	}

	// Captured once at connect; re-captures would replace the saved
	// skeleton with loaded content. Datastar keeps DOM identity on
	// morphed-in-place elements so the parent reference survives.
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
		// Wrapper patched away entirely; invalidate so future closes
		// don't keep retrying.
		if (!document.contains(this.#asyncSlot)) {
			this.#asyncSlot = null;
			this.#asyncSlotInitialHTML = null;
			return;
		}
		// Explicit opt-out via `data-neo-async-restore="false"` on the
		// wrapper. Invalidate so subsequent closes also stand down.
		if (!boolAttr(this.#asyncSlot as Element, "data-neo-async-restore", true)) {
			this.#asyncSlot = null;
			this.#asyncSlotInitialHTML = null;
			return;
		}
		// Placeholder still present (dialog opened and closed before
		// the patch landed); resetting innerHTML would re-parse
		// identical markup for nothing.
		if (this.#asyncSlot.querySelector("[data-neo-async-placeholder]")) {
			return;
		}
		this.#asyncSlot.innerHTML = this.#asyncSlotInitialHTML;
	}
}

if (!customElements.get("neo-dialog")) {
	customElements.define("neo-dialog", NeoDialog);
}
