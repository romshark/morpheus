// Native <dialog>: ::backdrop and dialog-box clicks both target <dialog>.

export class DialogBackdropClickTracker {
	#pointerDownOutside = false;

	reset(): void {
		this.#pointerDownOutside = false;
	}

	onPointerDown(dialog: HTMLDialogElement, e: PointerEvent): void {
		this.#pointerDownOutside = e.target === dialog && !dialogPointContains(dialog, e.clientX, e.clientY);
	}

	shouldDismiss(dialog: HTMLDialogElement, e: MouseEvent): boolean {
		const pointerDownOutside = this.#pointerDownOutside;
		this.#pointerDownOutside = false;
		if (e.target !== dialog) return false;
		if (!pointerDownOutside) return false;
		return !dialogPointContains(dialog, e.clientX, e.clientY);
	}
}

export function dialogPointContains(dialog: HTMLDialogElement, clientX: number, clientY: number): boolean {
	const r = dialog.getBoundingClientRect();
	return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

// showModal() inerts clicks but doesn't reliably block wheel/touch scroll on
// the body (Chromium scrolls the page behind the modal on mouse-wheel over the
// backdrop). CSS-based locks (`html{overflow:hidden}`, `body{position:fixed}`)
// bounce visibly as the scroll container changes mid-toggle. Blocking the
// scroll *input* events reflows nothing: wheel/touchmove pass through inside an
// open overlay, preventDefault'd elsewhere. Hit-test by coordinates against any
// open native <dialog>, so one lock covers both <neo-dialog> and <neo-drawer>.
// Ref-counted with a single shared listener pair: a dialog and a drawer open at
// once share one lock instead of two that each block the other's surface.
let scrollLockCount = 0;

function blockScrollOutsideOverlay(e: WheelEvent | TouchEvent): void {
	let x: number;
	let y: number;
	if ("clientX" in e) {
		x = e.clientX;
		y = e.clientY;
	} else {
		const t = e.touches[0] ?? e.changedTouches[0];
		if (!t) {
			if (e.cancelable) e.preventDefault();
			return;
		}
		x = t.clientX;
		y = t.clientY;
	}
	for (const el of document.elementsFromPoint(x, y)) {
		if ((el.tagName === "DIALOG" && (el as HTMLDialogElement).open) || el.closest?.("dialog[open]")) return;
	}
	if (e.cancelable) e.preventDefault();
}

export function lockBodyScroll(): void {
	if (scrollLockCount++ > 0) return;
	window.addEventListener("wheel", blockScrollOutsideOverlay, { passive: false, capture: true });
	window.addEventListener("touchmove", blockScrollOutsideOverlay, { passive: false, capture: true });
}

export function unlockBodyScroll(): void {
	if (scrollLockCount === 0) return;
	if (--scrollLockCount > 0) return;
	window.removeEventListener("wheel", blockScrollOutsideOverlay, { capture: true });
	window.removeEventListener("touchmove", blockScrollOutsideOverlay, { capture: true });
}
