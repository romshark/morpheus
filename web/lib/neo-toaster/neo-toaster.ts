// Stack of transient toasts: app-level (fixed to a viewport corner) or
// contained (absolute, anchored to a positioned ancestor). A
// MutationObserver adopts any <neo-toast> child that appears (including
// via a Datastar SSE morph), assigning it a stack id and tracking its
// `duration`. The <neo-toast> element renders its own icon and close button.

import "../neo-button";
import "../neo-icon";
import "../neo-spinner";
import "../neo-toast";
import { boolAttr } from "../command";
import { resolveTouchDismiss } from "../touch-dismiss";

type ToastVariant = "default" | "success" | "error" | "warning" | "info" | "loading";

// Shadow tree: a positioning stack wrapper around a single slot that
// projects every <neo-toast> child. Both the stack markup and the
// slot live in shadow, so a fat morph reaching into the toaster can
// only touch the projected toasts themselves, never the wrapper.
const TOASTER_SHADOW_TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - [data-neo-toaster-stack]: inner positioning + scroll container. Toasts
//   (light-DOM children of the host) project through the slot and
//   absolutely-position themselves relative to this wrapper. The wrapper's
//   explicit height (set inline by updateLayout) gives the host real
//   overflow content in expanded mode; without it the host's overflow-y:
//   auto wouldn't trigger a scrollbar because absolutely-positioned
//   children contribute nothing to scroll size. Collapsed mode leaves the
//   height unset (= 0) so the stack doesn't reserve space behind the front
//   toast.
TOASTER_SHADOW_TEMPLATE.innerHTML = `
<style>
  :host { display: block; }
  :host([hidden]) { display: none; }
  [data-neo-toaster-stack] {
    position: relative;
    width: calc(
      100% -
        var(--neo-toast-shadow-bleed) -
        var(--neo-toast-shadow-bleed)
    );
    margin-inline: var(--neo-toast-shadow-bleed);
  }
  :host([data-neo-expanded]) [data-neo-toaster-stack] {
    height: calc(
      var(--neo-toaster-stack-height, 0px) +
        var(--neo-toast-shadow-bleed) +
        var(--neo-toast-shadow-bleed)
    );
  }
</style>
<div data-neo-toaster-stack>
  <slot></slot>
</div>
`;

interface ToastAction {
	label: string;
	onClick: () => void;
}

interface ToastOptions {
	title?: string;
	description?: string;
	variant?: ToastVariant;
	duration?: number;
	action?: ToastAction;
	dismissible?: boolean;
}

interface ToastEntry {
	id: number;
	el: HTMLElement;
	duration: number;
	timer: number | null;
	removalTimer: number | null;
	// Absolute auto-dismiss timestamp (0 = not started). Tracking a
	// deadline rather than pause/resume with `remaining` makes hover
	// behave naturally: while expanded the timer is cleared but the
	// deadline keeps counting down, so a long read doesn't leak extra
	// dwell time after un-hover.
	deadline: number;
}

interface TouchDrag {
	entry: ToastEntry;
	startX: number;
	startY: number;
	startTime: number;
	width: number;
	threshold: number;
	decided: boolean;
	cancelled: boolean;
}

const DEFAULT_DURATION = 4000;
const MAX_COLLAPSED_PEEK = 2;
const REMOVE_DELAY_MS = 500;
const TOUCH_FLICK_PX_PER_MS = 0.6;

let nextId = 0;

// A <neo-toast> element. Tag name only; by upgrade time the class is
// registered, and unupgraded instances still have the right tag
// (HTMLUnknownElement until customElements.define resolves). Returns
// a plain boolean (no type predicate) because narrowing-by-tag-name
// isn't a thing in TS: a predicate of `el is HTMLElement` here would
// over-narrow the else branch to `never`.
function isToast(el: Element): boolean {
	return el.tagName.toLowerCase() === "neo-toast";
}

export class NeoToaster extends HTMLElement {
	static instance: NeoToaster | null = null;
	static observedAttributes = ["stack"];

	constructor() {
		super();
		// The stack lives in shadow, so morphs can't reach it. Toasts are
		// direct light-DOM children projected through the default slot.
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(TOASTER_SHADOW_TEMPLATE.content.cloneNode(true));
		this.#stack = root.querySelector<HTMLElement>("[data-neo-toaster-stack]")!;
	}

	// Static methods route to `instance`; no-op when none is mounted.
	static show(input: ToastOptions | string): number {
		const opts: ToastOptions = typeof input === "string" ? { title: input } : input;
		return NeoToaster.instance?.show(opts) ?? -1;
	}
	static success(t: string, o?: Partial<ToastOptions>): number {
		return NeoToaster.show({ ...o, title: t, variant: "success" });
	}
	static error(t: string, o?: Partial<ToastOptions>): number {
		return NeoToaster.show({ ...o, title: t, variant: "error" });
	}
	static warning(t: string, o?: Partial<ToastOptions>): number {
		return NeoToaster.show({ ...o, title: t, variant: "warning" });
	}
	static info(t: string, o?: Partial<ToastOptions>): number {
		return NeoToaster.show({ ...o, title: t, variant: "info" });
	}
	static loading(t: string, o?: Partial<ToastOptions>): number {
		return NeoToaster.show({
			...o,
			title: t,
			variant: "loading",
			duration: o?.duration ?? 0,
		});
	}
	static dismiss(id?: number): void {
		NeoToaster.instance?.dismiss(id);
	}
	static promise<T>(
		promise: Promise<T>,
		opts: {
			loading: string;
			success: string | ((result: T) => string);
			error: string | ((err: unknown) => string);
		},
	): Promise<T> {
		const id = NeoToaster.loading(opts.loading);
		return promise.then(
			(result) => {
				NeoToaster.dismiss(id);
				NeoToaster.success(typeof opts.success === "function" ? opts.success(result) : opts.success);
				return result;
			},
			(err) => {
				NeoToaster.dismiss(id);
				NeoToaster.error(typeof opts.error === "function" ? opts.error(err) : opts.error);
				throw err;
			},
		);
	}

	#toasts: ToastEntry[] = [];
	#resizeObserver: ResizeObserver | null = null;
	#mutationObserver: MutationObserver | null = null;
	// Inner positioning + scroll container, owned by the shadow root.
	// Toasts stay `position: absolute` (preserving the translateY
	// animation) while the wrapper's measured height (set in
	// `updateLayout`) gives the host real overflow content for native
	// scrolling. Morph-immune because it lives in shadow DOM.
	#stack: HTMLElement;
	#touchDrag: TouchDrag | null = null;
	#clickExpanded = false;

	attributeChangedCallback() {
		if (this.isConnected && this.#stack) this.#updateLayout();
	}

	connectedCallback() {
		if (!this.hasAttribute("position")) {
			this.setAttribute("position", "bottom-right");
		}
		// Only app-level (non-contained) toasters claim the static-API
		// instance. Contained ones are scoped to their parent frame and
		// mustn't intercept window-attached NeoToast calls; otherwise
		// an in-frame demo toaster appearing earlier in document order
		// would swallow every page-level `NeoToast.show()`.
		if (!boolAttr(this, "contained", false)) {
			NeoToaster.instance = this;
		}
		this.addEventListener("mouseenter", this.#onHostEnter);
		this.addEventListener("mouseleave", this.#onHostLeave);
		this.addEventListener("focusin", this.#onHostEnter);
		this.addEventListener("focusout", this.#onHostLeave);
		this.addEventListener("click", this.#onHostClick);
		this.addEventListener("touchstart", this.#onTouchStart, { passive: true });
		this.addEventListener("touchmove", this.#onTouchMove, { passive: false });
		this.addEventListener("touchend", this.#onTouchEnd);
		this.addEventListener("touchcancel", this.#onTouchCancel);
		document.addEventListener("pointerdown", this.#onDocumentPointerDown);
		// Close button presses inside each <neo-toast> bubble up as a
		// composed event; one delegate handles every toast.
		this.addEventListener("neo-toast-close", this.#onToastDismiss);

		this.#resizeObserver = new ResizeObserver(() => this.#updateLayout());

		// Declaratively-inserted toasts get the same entry animation,
		// timer, and stacking as imperative `show()`. subtree: true lets
		// us notice content morphs *inside* a toast (e.g. patched title)
		// so the duration can refresh; child neo-toast adds/removes are
		// direct light-DOM children of the host.
		this.#mutationObserver = new MutationObserver((records) => {
			for (const record of records) {
				// Datastar's morph removes any attribute the source doesn't
				// list. Re-apply kit bookkeeping the tracking entry still
				// holds: `data-neo-mounted` loss re-triggers the pre-mount
				// slide-off; `data-neo-toast-id` loss breaks `dismiss(id)`.
				if (record.type === "attributes") {
					const el = record.target;
					if (!(el instanceof HTMLElement) || !isToast(el)) continue;
					const entry = this.#toasts.find((t) => t.el === el);
					if (!entry) continue;
					if (
						record.attributeName === "data-neo-toast-leaving" &&
						!el.hasAttribute("data-neo-toast-leaving") &&
						entry.removalTimer !== null
					) {
						this.#cancelToastRemoval(entry);
					}
					if (
						record.attributeName === "data-neo-mounted" &&
						!el.hasAttribute("data-neo-mounted") &&
						!el.hasAttribute("data-neo-toast-leaving")
					) {
						el.setAttribute("data-neo-mounted", "");
					}
					if (record.attributeName === "data-neo-toast-id" && !el.hasAttribute("data-neo-toast-id")) {
						el.setAttribute("data-neo-toast-id", String(entry.id));
					}
					if (record.attributeName === "duration") {
						this.#refreshToastDuration(entry);
					}
					continue;
				}
				const handledAdded = new Set<HTMLElement>();
				const handledRemoved = new Set<HTMLElement>();
				const refreshedToasts = new Set<ToastEntry>();

				if (record.type === "childList") {
					let toast: HTMLElement | null = null;
					if (record.target instanceof HTMLElement) {
						toast = isToast(record.target) ? record.target : record.target.closest<HTMLElement>("neo-toast");
					}
					const entry = toast ? this.#toasts.find((t) => t.el === toast) : undefined;
					if (entry && toast && !toast.hasAttribute("data-neo-toast-leaving")) {
						refreshedToasts.add(entry);
					}
				}

				// Fat morph presenting a same-id toast as remove+add (or a
				// duplicated id) is treated as an update. HTML id is the
				// declarative identity boundary; preserving the entry keeps
				// timers, mounted state, and stack position intact.
				record.addedNodes.forEach((n) => {
					if (!(n instanceof HTMLElement) || !isToast(n)) return;
					const patched = this.#patchToastByHtmlId(n);
					if (!patched) return;
					handledAdded.add(n);
					handledRemoved.add(patched.el);
				});

				record.removedNodes.forEach((n) => {
					if (!(n instanceof HTMLElement) || !isToast(n) || handledRemoved.has(n)) {
						return;
					}
					const entry = this.#toasts.find((t) => t.el === n);
					if (entry) {
						// Tracked toast removed by a fat morph: re-attach and
						// run the animated leave; `removeToast` pulls it out for
						// real after `REMOVE_DELAY_MS`.
						this.appendChild(n);
						this.#removeToast(entry);
						return;
					}
					this.#releaseToast(n);
				});
				record.addedNodes.forEach((n) => {
					if (!(n instanceof HTMLElement) || !isToast(n) || handledAdded.has(n)) {
						return;
					}
					if (n.parentNode === this) this.#adoptToast(n);
				});

				for (const entry of refreshedToasts) {
					this.#bindCloseButton(entry.el, entry.id);
					this.#refreshToastDuration(entry);
					this.#updateLayout();
				}
			}
		});
		this.#mutationObserver.observe(this, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-neo-mounted", "duration", "data-neo-toast-id", "data-neo-toast-leaving"],
		});

		for (const child of Array.from(this.children)) {
			if (child instanceof HTMLElement && isToast(child)) {
				this.#adoptToast(child);
			}
		}
	}

	disconnectedCallback() {
		if (NeoToaster.instance === this) NeoToaster.instance = null;
		this.removeEventListener("mouseenter", this.#onHostEnter);
		this.removeEventListener("mouseleave", this.#onHostLeave);
		this.removeEventListener("focusin", this.#onHostEnter);
		this.removeEventListener("focusout", this.#onHostLeave);
		this.removeEventListener("click", this.#onHostClick);
		this.removeEventListener("touchstart", this.#onTouchStart);
		this.removeEventListener("touchmove", this.#onTouchMove);
		this.removeEventListener("touchend", this.#onTouchEnd);
		this.removeEventListener("touchcancel", this.#onTouchCancel);
		document.removeEventListener("pointerdown", this.#onDocumentPointerDown);
		this.#cancelTouchDrag();
		for (const t of this.#toasts.slice()) {
			if (t.timer !== null) window.clearTimeout(t.timer);
			if (t.removalTimer !== null) window.clearTimeout(t.removalTimer);
		}
		this.#toasts = [];
		this.#resizeObserver?.disconnect();
		this.#resizeObserver = null;
		this.#mutationObserver?.disconnect();
		this.#mutationObserver = null;
	}

	show(options: ToastOptions): number {
		const id = ++nextId;
		const variant = options.variant ?? "default";
		const duration = options.duration ?? (variant === "loading" ? 0 : DEFAULT_DURATION);
		const dismissible = options.dismissible !== false;

		const el = this.#makeToastElement(id, options, variant, dismissible);
		if (duration > 0) el.setAttribute("duration", String(duration));

		// Direct light-DOM child of the host; the shadow stack's <slot>
		// projects it into the positioning wrapper.
		this.insertBefore(el, this.firstChild);
		// Adopt synchronously so the caller gets back a fully-wired
		// toast. The observer sees the node a microtask later but skips
		// it (data-neo-toast-tracked already set).
		this.#adoptToast(el, { id, action: options.action });
		return id;
	}

	dismiss(id?: number): void {
		if (id === undefined) {
			for (const t of this.#toasts.slice()) this.#removeToast(t);
			return;
		}
		const t = this.#toasts.find((t) => t.id === id);
		if (t) this.#removeToast(t);
	}

	// Idempotent. The optional `seed` lets `show()` thread a
	// pre-allocated id + action callback through; declarative toasts
	// generate their own id and don't get an action callback (those
	// would be wired declaratively, e.g. via `data-on:click`).
	#adoptToast(el: HTMLElement, seed?: { id?: number; action?: ToastAction }): void {
		// Tracking lives in `this.toasts` (not on the element) so a
		// morph stripping `data-neo-toast-tracked` can't make us
		// double-track.
		if (this.#toasts.some((t) => t.el === el)) return;
		el.setAttribute("data-neo-toast-tracked", "");

		let id: number;
		if (seed?.id !== undefined) {
			id = seed.id;
		} else {
			const fromAttr = Number(el.getAttribute("data-neo-toast-id"));
			id = Number.isFinite(fromAttr) && fromAttr > 0 ? fromAttr : ++nextId;
		}
		el.setAttribute("data-neo-toast-id", String(id));

		if (seed?.action) {
			const actionBtn = el.querySelector<HTMLElement>(":scope > [slot='action']");
			if (actionBtn) {
				const cb = seed.action.onClick;
				actionBtn.addEventListener("click", () => {
					try {
						cb();
					} finally {
						this.dismiss(id);
					}
				});
			}
		}

		const entry: ToastEntry = {
			id,
			el,
			duration: this.#readToastDuration(el),
			timer: null,
			removalTimer: null,
			deadline: 0,
		};
		this.#toasts.unshift(entry);
		this.#resizeObserver?.observe(el);
		this.#updateLayout();

		void el.offsetWidth;
		requestAnimationFrame(() => {
			el.setAttribute("data-neo-mounted", "");
		});

		this.#startTimer(entry);
	}

	#patchToastByHtmlId(incoming: HTMLElement): ToastEntry | null {
		if (!incoming.id) return null;
		const entry = this.#toasts.find((t) => t.el !== incoming && t.el.id === incoming.id);
		if (!entry) return null;

		// Untrack `incoming` if it's tracked, otherwise the removedNodes
		// salvage branch re-attaches it after `.remove()` and re-fires
		// this patch causing an infinite loop.
		if (this.#toasts.some((t) => t.el === incoming)) {
			this.#releaseToast(incoming);
		}

		const wasConnected = entry.el.isConnected;
		this.#cancelToastRemoval(entry);
		this.#patchToastElement(entry, incoming);

		if (wasConnected) {
			incoming.remove();
		} else if (incoming.parentNode === this) {
			incoming.replaceWith(entry.el);
		} else {
			incoming.remove();
			this.insertBefore(entry.el, this.firstChild);
		}

		this.#resizeObserver?.observe(entry.el);
		this.#updateLayout();
		return entry;
	}

	#patchToastElement(entry: ToastEntry, incoming: HTMLElement): void {
		const preservedAttrs = [
			"data-neo-mounted",
			"data-neo-toast-id",
			"data-neo-toast-tracked",
			"data-neo-toast-leaving",
			"data-neo-toast-hidden",
		];
		const preserved = new Map<string, string | null>();
		for (const name of preservedAttrs) {
			preserved.set(name, entry.el.hasAttribute(name) ? entry.el.getAttribute(name) : null);
		}

		for (const attr of Array.from(entry.el.attributes)) {
			if (!preservedAttrs.includes(attr.name)) {
				entry.el.removeAttribute(attr.name);
			}
		}
		for (const attr of Array.from(incoming.attributes)) {
			if (!preservedAttrs.includes(attr.name)) {
				entry.el.setAttribute(attr.name, attr.value);
			}
		}
		for (const [name, value] of preserved) {
			if (value === null) {
				entry.el.removeAttribute(name);
			} else {
				entry.el.setAttribute(name, value);
			}
		}

		entry.el.replaceChildren(...Array.from(incoming.childNodes));
		this.#refreshToastDuration(entry);
	}

	// For animated dismiss call `NeoToast.dismiss(id)` first, or
	// render `[data-neo-toast-leaving]` in the patch a frame before
	// the actual removal; by the time releaseToast runs the element
	// is already detached.
	#releaseToast(el: HTMLElement): void {
		const entry = this.#toasts.find((t) => t.el === el);
		if (!entry) return;
		if (entry.timer !== null) {
			window.clearTimeout(entry.timer);
			entry.timer = null;
		}
		if (entry.removalTimer !== null) {
			window.clearTimeout(entry.removalTimer);
			entry.removalTimer = null;
		}
		this.#toasts = this.#toasts.filter((t) => t !== entry);
		this.#resizeObserver?.unobserve(el);
		this.#updateLayout();
	}

	// Toast markup (variant icon, close button, aria-live semantics)
	// lives in <neo-toast>'s shadow root, nothing to enhance from the
	// toaster side. The close button fires a composed `neo-toast-
	// dismiss` event; the host listens via event delegation, so there
	// are no per-button click bindings to register either.
	#bindCloseButton(_el: HTMLElement, _id: number): void {
		/* no-op, kept for call-site stability */
	}

	#onToastDismiss = (e: Event) => {
		const target = (e.composedPath()[0] ?? e.target) as Element | null;
		const toast = target?.closest<HTMLElement>("neo-toast");
		if (!toast) return;
		const entry = this.#toasts.find((t) => t.el === toast);
		if (entry) this.dismiss(entry.id);
	};

	#getTouchDismissThreshold(width: number): number | null {
		// Probe in the shadow stack so it never leaks into light DOM.
		return resolveTouchDismiss(this.getAttribute("touch-dismiss"), width, Math.max(40, width / 3), this.#stack);
	}

	#touchStartIneligible(target: EventTarget | null): boolean {
		let el: Element | null = target instanceof Element ? target : null;
		while (el && el !== this) {
			if (
				el.matches(
					"[data-neo-toast-touch-ignore]," +
						"button,a,input,select,textarea," +
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
		if (e.touches.length !== 1) return;
		const target = e.target instanceof Element ? e.target : null;
		const toast = target?.closest<HTMLElement>("neo-toast");
		if (!toast || !this.contains(toast)) return;
		if (!boolAttr(toast, "dismissible", true)) return;
		if (toast.hasAttribute("data-neo-toast-leaving")) return;
		if (this.#touchStartIneligible(e.target)) return;
		const entry = this.#toasts.find((t) => t.el === toast);
		if (!entry) return;
		const rect = toast.getBoundingClientRect();
		if (rect.width <= 0) return;
		const threshold = this.#getTouchDismissThreshold(rect.width);
		if (threshold === null) return;
		const t = e.touches[0];
		this.#touchDrag = {
			entry,
			startX: t.clientX,
			startY: t.clientY,
			startTime: performance.now(),
			width: rect.width,
			threshold,
			decided: false,
			cancelled: false,
		};
	};

	#onTouchMove = (e: TouchEvent) => {
		const d = this.#touchDrag;
		if (!d || d.cancelled) return;
		if (e.touches.length !== 1) {
			this.#cancelTouchDrag();
			return;
		}
		const t = e.touches[0];
		const dx = t.clientX - d.startX;
		const dy = t.clientY - d.startY;
		if (!d.decided) {
			if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
			if (Math.abs(dy) >= Math.abs(dx)) {
				d.cancelled = true;
				return;
			}
			d.decided = true;
			this.#pauseTimer(d.entry);
			d.entry.el.setAttribute("data-neo-toast-dragging", "");
			d.entry.el.style.transition = "none";
		}
		e.preventDefault();
		const offset = Math.max(-d.width, Math.min(d.width, dx));
		d.entry.el.style.transform = `translateX(${offset}px)`;
	};

	#onTouchEnd = (e: TouchEvent) => {
		const d = this.#touchDrag;
		if (!d) return;
		this.#touchDrag = null;
		if (!d.decided) return;
		const t = e.changedTouches[0];
		const dx = (t?.clientX ?? d.startX) - d.startX;
		const elapsed = Math.max(1, performance.now() - d.startTime);
		const flick = Math.abs(dx) / elapsed > TOUCH_FLICK_PX_PER_MS;
		const shouldClose = Math.abs(dx) >= d.threshold || flick;
		if (shouldClose) {
			const closeDir = dx < 0 ? -1 : 1;
			this.#finishSwipeDismiss(d.entry, closeDir);
		} else {
			this.#clearTouchDragStyles(d.entry.el);
			this.#startTimer(d.entry);
		}
	};

	#onTouchCancel = () => {
		this.#cancelTouchDrag();
	};

	#cancelTouchDrag() {
		const d = this.#touchDrag;
		if (!d) return;
		this.#touchDrag = null;
		if (d.decided) {
			this.#clearTouchDragStyles(d.entry.el);
			this.#startTimer(d.entry);
		}
	}

	#clearTouchDragStyles(el: HTMLElement) {
		el.removeAttribute("data-neo-toast-dragging");
		el.style.transform = "";
		el.style.transition = "";
	}

	#finishSwipeDismiss(entry: ToastEntry, closeDir: -1 | 1) {
		entry.el.removeAttribute("data-neo-toast-dragging");
		entry.el.setAttribute("data-neo-toast-swipe-dismiss", "");
		entry.el.style.setProperty("--toast-swipe-exit", `${closeDir * 120}%`);
		entry.el.style.transition = "";
		this.#removeToast(entry);
		entry.el.style.transform = "";
	}

	#getStackLimit(): number {
		const raw = this.getAttribute("stack");
		if (raw === null || raw.trim() === "") return 0;
		const n = Number(raw);
		return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
	}

	#updateLayout(): void {
		// Iterate live light-DOM toasts. The shadow stack only holds a
		// <slot>; the toasts themselves are direct host children.
		const live = (Array.from(this.children) as HTMLElement[]).filter(
			(c) => isToast(c) && !c.hasAttribute("data-neo-toast-leaving"),
		);
		if (live.length === 0) {
			this.#clickExpanded = false;
			this.removeAttribute("data-neo-expanded");
			this.#stack.style.removeProperty("--neo-toaster-stack-height");
			return;
		}

		const gap = this.#parseLength("--neo-toaster-gap", 10);
		const stackOffset = this.#parseLength("--neo-toaster-stack-offset", 14);
		const scaleStep = this.#parseLength("--neo-toaster-stack-scale-step", 0.05);
		const stackLimit = this.#getStackLimit();
		let expandedOffset = 0;
		let collapsedReach = 0;
		for (let i = 0; i < live.length; i++) {
			const el = live[i];
			let scale = 1;
			let collapsedOffset = expandedOffset;
			let hidden = false;

			if (stackLimit > 0 && i >= stackLimit) {
				const peekIndex = i - stackLimit + 1;
				scale = Math.max(0, 1 - peekIndex * scaleStep);
				const scaledHeight = el.offsetHeight * scale;
				const anchorOffset = live[stackLimit - 1]
					? Number.parseFloat(live[stackLimit - 1].style.getPropertyValue("--toast-collapsed-offset")) || 0
					: 0;
				collapsedOffset = Math.max(anchorOffset + peekIndex * stackOffset, collapsedReach - scaledHeight + stackOffset);
				hidden = peekIndex > MAX_COLLAPSED_PEEK;
			}

			const scaledHeight = el.offsetHeight * scale;
			collapsedReach = collapsedOffset + scaledHeight;
			el.style.setProperty("--toast-stack-index", String(i));
			el.style.setProperty("--toast-collapsed-offset", `${collapsedOffset}px`);
			el.style.setProperty("--toast-collapsed-scale", String(scale));
			el.style.setProperty("--toast-expanded-offset", `${expandedOffset}px`);
			if (hidden) {
				el.setAttribute("data-neo-toast-hidden", "");
			} else {
				el.removeAttribute("data-neo-toast-hidden");
			}
			expandedOffset += el.offsetHeight + gap;
		}

		// Total expanded vertical extent (no trailing gap). The
		// wrapper takes this height in expanded mode so the host gets
		// real overflow content and the cursor-gaps between toasts
		// stay inside the host's bounding rect (no mid-read mouseleave).
		const stackHeight = Math.max(0, expandedOffset - gap);
		if (stackHeight > 0) {
			this.#stack.style.setProperty("--neo-toaster-stack-height", `${stackHeight}px`);
		} else {
			this.#stack.style.removeProperty("--neo-toaster-stack-height");
		}
	}

	#parseLength(prop: string, fallback: number): number {
		const v = getComputedStyle(this).getPropertyValue(prop).trim();
		const n = parseFloat(v);
		return Number.isFinite(n) ? n : fallback;
	}

	// Opt-in auto-dismiss via the `duration` attribute: only a strictly
	// positive number arms the timer; anything else = persistent.
	#readToastDuration(el: HTMLElement): number {
		const durAttr = el.getAttribute("duration");
		if (durAttr === null) return 0;
		const parsedDur = Number(durAttr);
		return Number.isFinite(parsedDur) && parsedDur > 0 ? parsedDur : 0;
	}

	#refreshToastDuration(entry: ToastEntry): void {
		if (entry.timer !== null) {
			window.clearTimeout(entry.timer);
			entry.timer = null;
		}
		entry.duration = this.#readToastDuration(entry.el);
		entry.deadline = 0;
		this.#startTimer(entry);
	}

	// Builds a <neo-toast> for the imperative API. Variant icon and
	// close button come from the toast's own shadow markup; the
	// toaster only attaches user-authored body / action via named
	// slots.
	#makeToastElement(id: number, options: ToastOptions, variant: ToastVariant, dismissible: boolean): HTMLElement {
		const el = document.createElement("neo-toast") as HTMLElement;
		if (variant !== "default") el.setAttribute("variant", variant);
		el.setAttribute("data-neo-toast-id", String(id));
		if (!dismissible) el.setAttribute("dismissible", "false");

		if (options.title) {
			const t = document.createElement("span");
			t.setAttribute("slot", "title");
			t.textContent = options.title;
			el.appendChild(t);
		}
		if (options.description) {
			const d = document.createElement("span");
			d.setAttribute("slot", "description");
			d.textContent = options.description;
			el.appendChild(d);
		}
		if (options.action) {
			const action = document.createElement("neo-button");
			action.setAttribute("variant", "secondary");
			action.setAttribute("slot", "action");
			action.textContent = options.action.label;
			el.appendChild(action);
			// Click handler is wired by adoptToast, which needs the id.
		}
		return el;
	}

	#startTimer(entry: ToastEntry): void {
		if (entry.duration <= 0) return; // persistent
		if (entry.el.hasAttribute("data-neo-toast-leaving")) return;
		if (this.hasAttribute("data-neo-expanded")) return; // paused while expanded

		const now = Date.now();
		if (entry.deadline === 0) {
			entry.deadline = now + entry.duration;
		}

		const remaining = Math.max(0, entry.deadline - now);
		if (remaining === 0) {
			// Deadline elapsed during a previous hover.
			this.#removeToast(entry);
			return;
		}

		entry.timer = window.setTimeout(() => {
			entry.timer = null;
			this.#removeToast(entry);
		}, remaining);
	}

	#pauseTimer(entry: ToastEntry): void {
		if (entry.timer === null) return;
		window.clearTimeout(entry.timer);
		entry.timer = null;
		// Deadline is intentionally NOT shifted; see ToastEntry comment.
	}

	#removeToast(entry: ToastEntry): void {
		if (entry.el.hasAttribute("data-neo-toast-leaving")) return;
		if (entry.timer !== null) {
			window.clearTimeout(entry.timer);
			entry.timer = null;
		}
		if (!entry.el.isConnected) {
			this.#resizeObserver?.unobserve(entry.el);
			this.#toasts = this.#toasts.filter((t) => t !== entry);
			this.#updateLayout();
			return;
		}

		entry.el.setAttribute("data-neo-toast-leaving", "");
		this.#updateLayout();

		entry.removalTimer = window.setTimeout(() => {
			entry.removalTimer = null;
			this.#resizeObserver?.unobserve(entry.el);
			this.#toasts = this.#toasts.filter((t) => t !== entry);
			entry.el.remove();
			this.#updateLayout();
		}, REMOVE_DELAY_MS);
	}

	#cancelToastRemoval(entry: ToastEntry): void {
		if (entry.removalTimer !== null) {
			window.clearTimeout(entry.removalTimer);
			entry.removalTimer = null;
		}
		entry.el.removeAttribute("data-neo-toast-leaving");
		entry.el.removeAttribute("data-neo-toast-dragging");
		entry.el.removeAttribute("data-neo-toast-swipe-dismiss");
		entry.el.style.removeProperty("--toast-swipe-exit");
		entry.el.style.transition = "";
		this.#resizeObserver?.observe(entry.el);
		this.#updateLayout();
		this.#refreshToastDuration(entry);
	}

	#expandStack(): void {
		if (this.hasAttribute("data-neo-expanded")) return;
		this.setAttribute("data-neo-expanded", "");
		for (const t of this.#toasts) this.#pauseTimer(t);
		// Pin scroll to the anchor edge so the freshest toast stays
		// visible when the stack unfolds. Bottom-anchored stacks
		// default to scrollTop=0 (= oldest toasts), so we jump to the
		// bottom; top-anchored already match scrollTop=0 by default.
		if (this.getAttribute("position")?.includes("bottom")) {
			requestAnimationFrame(() => {
				this.scrollTop = this.scrollHeight;
			});
		}
	}

	#collapseStack(): void {
		if (!this.hasAttribute("data-neo-expanded")) return;
		this.removeAttribute("data-neo-expanded");
		for (const t of this.#toasts) this.#startTimer(t);
	}

	#collapseStackIfIdle(): void {
		if (this.#clickExpanded) return;
		if (this.matches(":hover")) return;
		if (this.contains(document.activeElement)) return;
		this.#collapseStack();
	}

	#onHostEnter = () => {
		this.#expandStack();
	};

	#onHostLeave = (e: Event) => {
		const next = (e as FocusEvent).relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		// Stay expanded while the cursor is still over the toaster.
		// Clicking a close button fires `focusout` (button removed from
		// DOM); a naive collapse would tear down the whole stack mid-
		// interaction even though the user is still hovering.
		this.#collapseStackIfIdle();
	};

	#onHostClick = (e: MouseEvent) => {
		const target = e.target instanceof Element ? e.target : null;
		if (!target?.closest("neo-toast")) return;
		if (
			target.closest("[data-neo-toast-close],[data-neo-toast-action]," + "button,a,input,select,textarea,neo-button")
		) {
			return;
		}
		this.#clickExpanded = true;
		this.#expandStack();
	};

	#onDocumentPointerDown = (e: PointerEvent) => {
		if (!this.#clickExpanded) return;
		const target = e.target instanceof Node ? e.target : null;
		if (target && this.contains(target)) return;
		this.#clickExpanded = false;
		this.#collapseStackIfIdle();
	};
}

if (!customElements.get("neo-toaster")) {
	customElements.define("neo-toaster", NeoToaster);
}

(window as unknown as { NeoToast: typeof NeoToaster }).NeoToast = NeoToaster;
