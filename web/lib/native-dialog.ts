import { type AriaRef, setAriaRef } from "./aria-ref";
import { observeManagedAttrs, setAttrIfChanged } from "./neo-morph-resilient";

const TRIGGER_ATTRS = ["aria-haspopup", "aria-controls", "aria-expanded"];
const DIALOG_ATTRS = ["role", "aria-modal", "aria-labelledby", "aria-describedby"];

// DialogAria links a trigger to its <dialog> and the dialog to its title and
// description parts, and re-applies the links after a morph strips them.
// Without a title or description part, an author's own aria-labelledby or
// aria-describedby stays; only a link this wrote is removed.
export class DialogAria {
	#titleSel: string;
	#descSel: string;
	#expanded: () => boolean;
	#trigger: HTMLElement | null = null;
	#dialog: HTMLDialogElement | null = null;
	#observers: MutationObserver[] = [];
	#ownsLabel = false;
	#ownsDesc = false;

	constructor(titleSel: string, descSel: string, expanded: () => boolean) {
		this.#titleSel = titleSel;
		this.#descSel = descSel;
		this.#expanded = expanded;
	}

	bind(trigger: HTMLElement | null, dialog: HTMLDialogElement): void {
		if (trigger !== this.#trigger || dialog !== this.#dialog) {
			this.disconnect();
			this.#trigger = trigger;
			this.#dialog = dialog;
			if (trigger) this.#observers.push(observeManagedAttrs(trigger, TRIGGER_ATTRS, this.sync));
			this.#observers.push(observeManagedAttrs(dialog, DIALOG_ATTRS, this.sync));
		}
		this.sync();
	}

	sync = (): void => {
		const trigger = this.#trigger;
		const dialog = this.#dialog;
		if (!dialog) return;
		if (trigger) {
			setAttrIfChanged(trigger, "aria-haspopup", "dialog");
			setAriaRef(trigger, "aria-controls", [dialog]);
			setAttrIfChanged(trigger, "aria-expanded", String(this.#expanded()));
		}
		if (!dialog.hasAttribute("role")) dialog.setAttribute("role", "dialog");
		setAttrIfChanged(dialog, "aria-modal", "true");
		this.#ownsLabel = linkPart(dialog, "aria-labelledby", this.#titleSel, this.#ownsLabel);
		this.#ownsDesc = linkPart(dialog, "aria-describedby", this.#descSel, this.#ownsDesc);
	};

	disconnect(): void {
		for (const o of this.#observers) o.disconnect();
		this.#observers = [];
		this.#trigger = null;
		this.#dialog = null;
		this.#ownsLabel = false;
		this.#ownsDesc = false;
	}
}

// Points `name` at the dialog's part and returns whether the link is this
// module's, which decides whether a later pass without the part removes it.
function linkPart(dialog: HTMLElement, name: AriaRef, partSel: string, owned: boolean): boolean {
	const part = dialog.querySelector(partSel);
	if (part) {
		setAriaRef(dialog, name, [part]);
		return true;
	}
	if (owned) dialog.removeAttribute(name);
	return false;
}

// On a native <dialog>, ::backdrop and dialog-box clicks both target <dialog>.

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

// showModal() inerts clicks but doesn't reliably block wheel/touch scroll on the body
// (Chromium scrolls the page behind the modal on mouse-wheel over the backdrop).
// CSS-based locks (`html{overflow:hidden}`, `body{position:fixed}`) bounce visibly
// as the scroll container changes mid-toggle. Blocking the scroll input events
// reflows nothing. wheel/touchmove pass through inside an open overlay and
// are preventDefault'd elsewhere. Hit-test by coordinates against any
// open native <dialog>, which lets 1 lock cover both <neo-dialog> and <neo-drawer>.
// Ref-counted with a single shared listener pair. A dialog and a drawer open at once
// share 1 lock instead of 2 that each block the other's surface.
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
