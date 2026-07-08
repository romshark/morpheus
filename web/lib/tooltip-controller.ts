// Tooltip behavior shared by the <neo-tooltip> element and components that
// render a value bubble without registering that element (e.g. <neo-slider>,
// <neo-slider-range>). Operates on a host element: resolves trigger + content
// from the host's children, runs hover/focus show-hide with the same
// pointer-events: none, role="tooltip", aria-describedby semantics, and
// positions the content on the same primitives as <neo-popover>.
//
// The host carries the config attributes (text, placement,
// hover-open-delay, hover-close-delay) and the reflected `open` state, so a caller reads `open` and
// sets `text` on the host exactly as on the element. connect()/disconnect()
// are idempotent and reconnect-safe: a shadow-internal host is re-bound by its
// owner's connectedCallback (no nested element lifecycle fires for it).

import { openCommand } from "./command";
import { type Placement, positionPanel, resolveCssLengthPx } from "./neo-position";

const DEFAULT_OPEN_DELAY_MS = 350;
const DEFAULT_CLOSE_DELAY_MS = 0;

let nextId = 0;

export class TooltipController {
	#host: HTMLElement;
	#trigger: HTMLElement | null = null;
	#content: HTMLElement | null = null;
	#openTimer: number | null = null;
	#closeTimer: number | null = null;
	#resizeObserver: ResizeObserver | null = null;
	#childObserver: MutationObserver | null = null;
	#connected = false;
	#ready = false;
	// Rendered open state; `open` is its guarded reflection (see command).
	// The attribute mirrors this for the `[open]` CSS; intent is the truth.
	#openIntent = false;
	// Guards reflective `open` writes so they aren't read back as commands.
	#reflecting = false;

	constructor(host: HTMLElement) {
		this.#host = host;
	}

	connect(): void {
		if (this.#connected) return;
		this.#connected = true;
		this.#bind();
		// Re-bind when a morph swaps the trigger/content subtree while the
		// host stays connected (no disconnect/connect fires). Children are
		// re-resolved from the DOM each time, never from a cached pointer.
		this.#childObserver = new MutationObserver(this.#onChildrenChanged);
		this.#childObserver.observe(this.#host, { childList: true, subtree: true });
		window.addEventListener("resize", this.#repositionOnAmbientChange);
		window.addEventListener("scroll", this.#repositionOnAmbientChange, true);
		// visualViewport.resize/scroll cover pinch-zoom and the iOS
		// virtual-keyboard inset; neither fires window.resize.
		window.visualViewport?.addEventListener("resize", this.#repositionOnAmbientChange);
		window.visualViewport?.addEventListener("scroll", this.#repositionOnAmbientChange);
	}

	disconnect(): void {
		if (!this.#connected) return;
		this.#connected = false;
		this.#clearTimers();
		this.#unbind();
		window.removeEventListener("resize", this.#repositionOnAmbientChange);
		window.removeEventListener("scroll", this.#repositionOnAmbientChange, true);
		window.visualViewport?.removeEventListener("resize", this.#repositionOnAmbientChange);
		window.visualViewport?.removeEventListener("scroll", this.#repositionOnAmbientChange);
		this.#childObserver?.disconnect();
		this.#childObserver = null;
	}

	// Resolve trigger + content from the live DOM and wire them. Idempotent:
	// a no-op once the same nodes are bound, so a re-entrant observer call
	// after the auto-created content span settles is the loop fixpoint.
	#bind() {
		const wasReady = this.#ready;
		let content = this.#host.querySelector<HTMLElement>("[data-neo-tooltip-content]");
		const text = this.#host.getAttribute("text");
		if (!content && text !== null) {
			content = document.createElement("span");
			content.setAttribute("data-neo-tooltip-content", "");
			content.textContent = text;
			this.#host.appendChild(content);
		}
		const trigger = this.#findTrigger(content);
		if (!trigger || !content) {
			this.#unbind();
			return;
		}
		if (trigger === this.#trigger && content === this.#content) return;
		this.#unbind();

		this.#trigger = trigger;
		this.#content = content;

		if (!content.id) content.id = `neo-tooltip-${++nextId}`;
		content.setAttribute("role", "tooltip");

		// Chain aria-describedby; callers may have other descriptions already.
		const existing = trigger.getAttribute("aria-describedby");
		const ids = existing ? existing.split(/\s+/).filter(Boolean) : [];
		if (!ids.includes(content.id)) ids.push(content.id);
		trigger.setAttribute("aria-describedby", ids.join(" "));

		trigger.addEventListener("pointerenter", this.#onPointerEnter);
		trigger.addEventListener("pointerleave", this.#onPointerLeave);
		trigger.addEventListener("focus", this.#onFocus);
		trigger.addEventListener("blur", this.#onBlur);
		trigger.addEventListener("keydown", this.#onKeyDown);

		this.#resizeObserver = new ResizeObserver(() => {
			if (this.#openIntent) this.#position();
		});
		this.#resizeObserver.observe(content);
		this.#ready = true;
		// attributeChanged swallows the `open` command while #ready is false, so
		// re-read it once binding completes (initial connect, or a trigger that
		// streams in after connect) to adopt or normalize an authored `open`.
		if (!wasReady) this.#syncOpen();
	}

	#unbind() {
		if (this.#trigger) {
			this.#trigger.removeEventListener("pointerenter", this.#onPointerEnter);
			this.#trigger.removeEventListener("pointerleave", this.#onPointerLeave);
			this.#trigger.removeEventListener("focus", this.#onFocus);
			this.#trigger.removeEventListener("blur", this.#onBlur);
			this.#trigger.removeEventListener("keydown", this.#onKeyDown);
		}
		this.#resizeObserver?.disconnect();
		this.#resizeObserver = null;
		this.#trigger = null;
		this.#content = null;
		this.#ready = false;
	}

	#onChildrenChanged = () => {
		this.#bind();
	};

	// Forwarded from the element's attributeChangedCallback; direct callers
	// use setText() for the same content-text update without an attr round-trip.
	attributeChanged(name: string, newValue: string | null): void {
		if (name === "open") {
			// Skip our own guarded reflection so it isn't read back as a command.
			if (!this.#ready || this.#reflecting) return;
			this.#syncOpen();
		} else if (name === "text") {
			if (this.#content && newValue !== null) this.#content.textContent = newValue;
		} else if (name === "placement") {
			if (this.#ready && this.#openIntent) this.#position();
		}
	}

	// Reconcile the `open` command from author markup, a morph, or a framework
	// binding with the intent (see command). Absent keeps state, re-asserting
	// the attribute after a morph strip; a present/`false` command opens/closes.
	#syncOpen(): void {
		const cmd = openCommand(this.#host);
		if (cmd === null) {
			// Re-assert `[open]` after a morph strip and reposition, since the
			// trigger may have moved with it.
			if (this.#openIntent) {
				this.#reflectOpen();
				this.#position();
			}
			return;
		}
		if (cmd === "open") {
			if (this.#openIntent) this.#position();
			else this.show();
		} else if (this.#openIntent) {
			this.hide();
		} else {
			this.#reflectClose();
		}
	}

	// Set the bubble text. Mirrors to the host `text` attribute so the host
	// stays the single source of truth a later #bind() reads from.
	setText(value: string): void {
		this.#host.setAttribute("text", value);
		if (this.#content) this.#content.textContent = value;
	}

	show(): void {
		this.#clearCloseTimer();
		if (this.#openIntent) return;
		this.#openIntent = true;
		this.#reflectOpen();
		if (this.#ready) this.#position();
	}

	hide(): void {
		this.#clearOpenTimer();
		if (!this.#openIntent) return;
		this.#openIntent = false;
		this.#reflectClose();
	}

	// State → attribute, guarded so the reflected write isn't read back as a
	// command. `open` (value-less) matches the `[open]` CSS the same as the
	// author's `open`/`open="true"`, so leave an existing attribute in place.
	#reflectOpen(): void {
		if (this.#host.hasAttribute("open")) return;
		this.#reflecting = true;
		try {
			this.#host.setAttribute("open", "");
		} finally {
			this.#reflecting = false;
		}
	}

	#reflectClose(): void {
		if (!this.#host.hasAttribute("open")) return;
		this.#reflecting = true;
		try {
			this.#host.removeAttribute("open");
		} finally {
			this.#reflecting = false;
		}
	}

	// Public hook for triggers that move while open (e.g. <neo-slider>
	// thumb): a CSS `left` change fires none of our existing listeners.
	reposition(): void {
		if (this.#openIntent) this.#position();
	}

	#findTrigger(content: HTMLElement | null): HTMLElement | null {
		for (const child of Array.from(this.#host.children)) {
			if (child === content) continue;
			return child as HTMLElement;
		}
		return null;
	}

	// Touch is excluded so a long-press doesn't open the tooltip: finger
	// input has no real "hover" intent and the OS-level long-press
	// (callout / context menu) competes for the gesture anyway. Mouse
	// and pen still go through normally.
	#onPointerEnter = (e: PointerEvent) => {
		if (e.pointerType === "touch") return;
		this.#clearCloseTimer();
		if (this.#openIntent) return;
		const delay = this.#readDelayAttr("hover-open-delay", DEFAULT_OPEN_DELAY_MS);
		if (delay <= 0) {
			this.show();
			return;
		}
		this.#openTimer = window.setTimeout(() => {
			this.#openTimer = null;
			this.show();
		}, delay);
	};

	#onPointerLeave = (e: PointerEvent) => {
		if (e.pointerType === "touch") return;
		this.#clearOpenTimer();
		if (!this.#openIntent) return;
		const delay = this.#readDelayAttr("hover-close-delay", DEFAULT_CLOSE_DELAY_MS);
		if (delay <= 0) {
			this.hide();
			return;
		}
		this.#closeTimer = window.setTimeout(() => {
			this.#closeTimer = null;
			this.hide();
		}, delay);
	};

	// Focus reveals immediately: focus is intentional, hover delay would
	// feel unresponsive. Gated on :focus-visible so a tap-induced focus
	// (which fires after click on iOS Safari and similar) doesn't pop the
	// tooltip back open after the user activated the trigger; keyboard
	// focus still satisfies :focus-visible and opens normally.
	#onFocus = () => {
		this.#clearOpenTimer();
		this.#clearCloseTimer();
		if (!this.#trigger) return;
		try {
			if (!this.#trigger.matches(":focus-visible")) return;
		} catch {
			// Older browsers without :focus-visible: fall through and show.
		}
		this.show();
	};

	#onBlur = () => {
		this.#clearOpenTimer();
		this.hide();
	};

	// APG: Escape dismisses a tooltip without moving focus.
	#onKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape" && this.#openIntent) {
			e.stopPropagation();
			this.hide();
		}
	};

	#repositionOnAmbientChange = () => {
		if (this.#openIntent) this.#position();
	};

	#position() {
		if (!this.#trigger || !this.#content) return;
		const placement = (this.#host.getAttribute("placement") as Placement | null) ?? "bottom-start";
		const edgeOffset = resolveCssLengthPx(this.#host, "--neo-tooltip-screen-offset");
		const triggerGap = 6;

		this.#content.style.maxWidth = "";
		this.#content.style.maxHeight = "";
		if (
			!intersectsVisualViewport(this.#trigger) ||
			!fitsPrimarySlot(this.#trigger, this.#content, placement, edgeOffset, triggerGap)
		) {
			this.#content.style.visibility = "hidden";
			return;
		}
		this.#content.style.visibility = "";
		positionPanel(this.#trigger, this.#content, placement, edgeOffset, triggerGap);
	}

	#readDelayAttr(name: string, fallback: number): number {
		const raw = this.#host.getAttribute(name);
		if (raw === null) return fallback;
		const n = parseInt(raw, 10);
		return Number.isFinite(n) && n >= 0 ? n : fallback;
	}

	#clearOpenTimer() {
		if (this.#openTimer !== null) {
			window.clearTimeout(this.#openTimer);
			this.#openTimer = null;
		}
	}

	#clearCloseTimer() {
		if (this.#closeTimer !== null) {
			window.clearTimeout(this.#closeTimer);
			this.#closeTimer = null;
		}
	}

	#clearTimers() {
		this.#clearOpenTimer();
		this.#clearCloseTimer();
	}
}

function intersectsVisualViewport(el: HTMLElement): boolean {
	const rect = el.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) return false;

	const viewport = visualViewportRect();
	const left = rect.left - viewport.left;
	const right = rect.right - viewport.left;
	const top = rect.top - viewport.top;
	const bottom = rect.bottom - viewport.top;

	return right > 0 && left < viewport.width && bottom > 0 && top < viewport.height;
}

function fitsPrimarySlot(
	trigger: HTMLElement,
	content: HTMLElement,
	placement: Placement,
	edgeOffset: number,
	triggerGap: number,
): boolean {
	const viewport = visualViewportRect();
	const triggerRect = trigger.getBoundingClientRect();
	const contentRect = content.getBoundingClientRect();
	const left = triggerRect.left - viewport.left;
	const right = triggerRect.right - viewport.left;
	const top = triggerRect.top - viewport.top;
	const bottom = triggerRect.bottom - viewport.top;

	if (placement.startsWith("top")) {
		return top - triggerGap - contentRect.height >= edgeOffset;
	}
	if (placement.startsWith("bottom")) {
		return viewport.height - bottom - triggerGap - contentRect.height >= edgeOffset;
	}
	if (placement.startsWith("left")) {
		return left - triggerGap - contentRect.width >= edgeOffset;
	}
	return viewport.width - right - triggerGap - contentRect.width >= edgeOffset;
}

function visualViewportRect(): {
	left: number;
	top: number;
	width: number;
	height: number;
} {
	const visualViewport = window.visualViewport;
	return {
		left: visualViewport?.offsetLeft ?? 0,
		top: visualViewport?.offsetTop ?? 0,
		width: visualViewport?.width ?? document.documentElement.clientWidth,
		height: visualViewport?.height ?? document.documentElement.clientHeight,
	};
}
