import { boolAttr } from "../command";
import { setState } from "../internal-state";
import { clampInt } from "../num";

const SIDES = ["top", "bottom"];

// Keyboard focus or an open disclosure inside keeps the bar on screen.
const HOLD = ':has(:focus-visible, [open]:not([open="false"]))';

// A scroll after a pause this long starts a new run.
const PAUSE_MS = 200;

// The wrapper moves, not the host. The host clips it while hidden; a moved
// host would add to the scroll container's scrollable overflow.
const SHEET = new CSSStyleSheet();
SHEET.replaceSync(`
[data-neo-autohide-bar] {
	transition: translate var(--neo-autohide-duration) var(--neo-easing, ease);
}
:host(:state(hidden)) [data-neo-autohide-bar] {
	translate: 0 -100%;
}
:host([side="bottom"]:state(hidden)) [data-neo-autohide-bar] {
	translate: 0 100%;
}
:host(:state(instant)) [data-neo-autohide-bar] {
	transition: none;
}
`);

export class NeoAutohide extends HTMLElement {
	static observedAttributes = ["side", "disabled"];

	#internals = this.attachInternals();
	// null for the viewport.
	#scroller: HTMLElement | null = null;
	#target: HTMLElement | Window = window;
	#lastY = 0;
	#lastTime = 0;
	// Distance scrolled in the current run, negative upward.
	#travel = 0;
	// Whether the bar was at its edge at the last scroll.
	#atEdge = false;
	// Whether the current downward run began with the bar at its edge.
	// A bar that reaches the edge during a run stays until the next run.
	#armed = false;

	connectedCallback() {
		if (!this.shadowRoot) {
			const root = this.attachShadow({ mode: "open" });
			root.adoptedStyleSheets = [SHEET];
			root.innerHTML = "<div data-neo-autohide-bar><slot></slot></div>";
			const bar = root.firstElementChild as HTMLElement;
			bar.addEventListener("transitionend", this.#onSlideEnd);
			bar.addEventListener("transitioncancel", this.#onSlideEnd);
		}
		this.addEventListener("focusin", this.#onFocusIn);
		this.#scroller = scrollContainer(this);
		this.#target = this.#scroller ?? window;
		this.#target.addEventListener("scroll", this.#onScroll, { passive: true });
		const { y, max } = this.#scrollPos();
		this.#lastY = y;
		this.#travel = 0;
		this.#atEdge = this.#gap() <= 0.5;
		setState(this.#internals, "scrolled", y > 0);
		if (y <= 0 || this.#atEnd(y, max)) this.#setHidden(false);
	}

	disconnectedCallback() {
		this.removeEventListener("focusin", this.#onFocusIn);
		this.#target.removeEventListener("scroll", this.#onScroll);
	}

	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (name === "disabled") {
			if (this.#disabled()) this.#setHidden(false);
		} else if (value !== null && !SIDES.includes(value)) {
			console.warn(`<neo-autohide>: unsupported side="${value}"; use "top" or "bottom".`);
		}
	}

	#disabled(): boolean {
		return boolAttr(this, "disabled", false);
	}

	// scrollTop can stop a fraction short of the whole-pixel max.
	#atEnd(y: number, max: number): boolean {
		return y >= max - 1 && boolAttr(this, "show-at-end", true);
	}

	// Chrome scrolls toward the start to reveal a focused hidden bar, before
	// focusin. Undo it. The scroll event has not fired, and #lastY still
	// holds the old position. Showing at once covers engines that scroll
	// after focusin.
	#onFocusIn = () => {
		if (!this.#internals.states.has("hidden")) return;
		const el = this.#scroller ?? document.scrollingElement ?? document.documentElement;
		if (Math.abs(el.scrollTop - this.#lastY) >= 1) el.scrollTo({ top: this.#lastY, behavior: "instant" });
		setState(this.#internals, "instant", true);
		this.#setHidden(false);
		requestAnimationFrame(() => setState(this.#internals, "instant", false));
	};

	#onSlideEnd = (e: Event) => {
		if (e.target === e.currentTarget) setState(this.#internals, "sliding", false);
	};

	#onScroll = () => {
		const { y, max } = this.#scrollPos();
		const dy = y - this.#lastY;
		this.#lastY = y;
		const now = performance.now();
		const paused = now - this.#lastTime > PAUSE_MS;
		this.#lastTime = now;
		setState(this.#internals, "scrolled", y > 0);
		if (dy === 0) return;
		const wasAtEdge = this.#atEdge;
		this.#atEdge = this.#gap() <= 0.5;
		if (paused || Math.sign(dy) !== Math.sign(this.#travel)) {
			this.#travel = 0;
			this.#armed = dy > 0 && wasAtEdge;
		}
		this.#travel += dy;
		const tolerance = clampInt(this.getAttribute("tolerance"), 0, Number.MAX_SAFE_INTEGER, 8);
		if (y <= 0 || this.#atEnd(y, max) || !this.#atEdge || this.#travel < -tolerance) this.#setHidden(false);
		else if (this.#armed && this.#travel > tolerance && !this.#disabled() && !this.matches(HOLD)) this.#setHidden(true);
	};

	// Clamped, which ignores overscroll bounce.
	#scrollPos(): { y: number; max: number } {
		const el = this.#scroller ?? document.scrollingElement ?? document.documentElement;
		const max = Math.max(0, el.scrollHeight - el.clientHeight);
		return { y: Math.min(Math.max(el.scrollTop, 0), max), max };
	}

	// Distance from the bar to the edge it sticks at, 0 while stuck.
	#gap(): number {
		const style = getComputedStyle(this);
		if (style.position !== "sticky") return 0;
		const box = this.getBoundingClientRect();
		const port = this.#port();
		if (this.getAttribute("side") === "bottom") return port.bottom - px(style.bottom) - box.bottom;
		return box.top - (port.top + px(style.top));
	}

	// The scrollport in viewport coordinates.
	#port(): { top: number; bottom: number } {
		const s = this.#scroller;
		if (!s) return { top: 0, bottom: document.documentElement.clientHeight };
		const top = s.getBoundingClientRect().top + s.clientTop;
		return { top, bottom: top + s.clientHeight };
	}

	#setHidden(hidden: boolean) {
		const states = this.#internals.states;
		if (states.has("hidden") === hidden) return;
		// A bottom bar's host keeps clipping until the slide in ends.
		// Unclipped, the bar below the edge extends the scroll range, and a
		// scroll into that space jumps back when the slide ends.
		const bar = this.shadowRoot?.firstElementChild;
		const slides =
			!hidden &&
			this.getAttribute("side") === "bottom" &&
			!states.has("instant") &&
			!!bar &&
			px(getComputedStyle(bar).transitionDuration) > 0;
		setState(this.#internals, "sliding", slides);
		setState(this.#internals, "hidden", hidden);
		this.dispatchEvent(new CustomEvent("neo-autohide-toggle", { bubbles: true, detail: { hidden } }));
	}
}

// The box a sticky element sticks in, null for the viewport.
function scrollContainer(el: Element): HTMLElement | null {
	const root = document.documentElement;
	for (let p = parentOf(el); p && p !== root; p = parentOf(p)) {
		if (!(p instanceof HTMLElement)) continue;
		// <body> overflow moves to the viewport unless <html> clips too.
		if (p === document.body && !clipsY(root)) continue;
		if (clipsY(p)) return p;
	}
	return null;
}

function px(length: string): number {
	return Number.parseFloat(length) || 0;
}

function clipsY(el: Element): boolean {
	const y = getComputedStyle(el).overflowY;
	return y !== "visible" && y !== "clip";
}

// The flat-tree parent.
function parentOf(el: Element): Element | null {
	if (el.assignedSlot) return el.assignedSlot;
	if (el.parentElement) return el.parentElement;
	const root = el.parentNode;
	return root instanceof ShadowRoot ? root.host : null;
}

if (!customElements.get("neo-autohide")) {
	customElements.define("neo-autohide", NeoAutohide);
}
