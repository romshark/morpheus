// The compared content stays in light DOM, assigned to the before and after
// slots, where a morph reconciles it. The layers, divider and handle render
// in the shadow root, which a morph can't reach, so the divider stays where
// the user left it.

import { boolAttr } from "../command";
import { isRTL, logicalArrow } from "../direction";
import { retryWhileParsing } from "../document-parsing";
import { setState } from "../internal-state";
import { labelAttr } from "../label-name";
import { clamp, num } from "../num";
import { IS_APPLE } from "../platform";
import { scopeCssToHost } from "../shadow-utils";
import compareCss from "./neo-compare.css";

const ATTR_VALUE = "value";
const ATTR_VERTICAL = "vertical";
const ATTR_DISABLED = "disabled";
const ATTR_DIVIDER_LABEL = "divider-label";
const ATTR_RECENTER = "recenter";
const ATTR_MIN = "min";
const ATTR_MAX = "max";
const CENTER = 50;
// 4px matches the OS click-vs-drag threshold. A touch or pen press moves the
// divider only past it, which keeps a swipe that scrolls the page along the
// other axis from moving the divider.
const DRAG_THRESHOLD = 4;
const PROP_TILT = "--neo-compare-tilt";

const SHEET = new CSSStyleSheet();
SHEET.replaceSync(scopeCssToHost(compareCss, "neo-compare"));

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
<div data-neo-compare-root>
  <div data-neo-compare-frame>
    <div data-neo-compare-layer="before" part="before"><slot name="before"></slot></div>
    <div data-neo-compare-layer="after" part="after"><slot name="after"></slot></div>
    <div data-neo-compare-divider part="divider"></div>
  </div>
  <div data-neo-compare-grip>
    <div data-neo-compare-handle part="handle" role="slider" tabindex="0">
      <slot name="handle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 7-5 5 5 5M15 7l5 5-5 5"/>
        </svg>
      </slot>
    </div>
  </div>
</div>
`;

interface Drag {
	pointerId: number;
	startX: number;
	startY: number;
	startValue: number;
	// The divider follows the pointer. A mouse press sets it at once,
	// a touch or pen press at the drag threshold.
	following: boolean;
	// The pointer crossed the drag threshold, which rules out a click.
	dragged: boolean;
	onHandle: boolean;
	// Value offset from the pointer's line to the divider, kept while dragging
	// the handle so the divider doesn't jump under it.
	grabOffset: number;
	rect: DOMRect;
	vertical: boolean;
	rtl: boolean;
	// Offset of the line ends from its midpoint, which the tilt sets.
	tiltOffset: number;
	// The frame along the axis plus the tilt offset at both ends, the range
	// --_at spans in CSS.
	span: number;
}

export class NeoCompare extends HTMLElement {
	static readonly observedAttributes = [
		ATTR_VALUE,
		ATTR_MIN,
		ATTR_MAX,
		ATTR_VERTICAL,
		ATTR_DISABLED,
		ATTR_DIVIDER_LABEL,
	];

	#internals: ElementInternals;
	#root: HTMLElement;
	#frame: HTMLElement;
	#handle: HTMLElement;
	// Source of truth for the divider position. `value` mirrors it,
	// and a morph that strips `value` keeps the divider where it is.
	#value = CENTER;
	#reflecting = false;
	#connectedOnce = false;
	#drag: Drag | null = null;
	#jumpFrame = 0;
	// The min/max pair last warned about, which keeps a reconnect or a
	// rewrite of the same pair from repeating the warning.
	#rangeWarned = "";
	// Consecutive clicks on the handle without a drag. A dblclick can't tell
	// where its presses landed, because the pointer capture retargets it to
	// the host, and the browser counts a dragged press as a click.
	#handleClicks = 0;
	// The tilt offset needs the frame size in px, which CSS can't read.
	#resize = new ResizeObserver((entries) => {
		const box = entries[entries.length - 1].contentRect;
		this.#root.style.setProperty("--_w", `${box.width}px`);
		this.#root.style.setProperty("--_h", `${box.height}px`);
		this.#jump();
	});

	constructor() {
		super();
		this.#internals = this.attachInternals();
		const root = this.attachShadow({ mode: "open" });
		root.adoptedStyleSheets = [SHEET];
		root.appendChild(TEMPLATE.content.cloneNode(true));
		this.#root = root.querySelector("[data-neo-compare-root]") as HTMLElement;
		this.#frame = root.querySelector("[data-neo-compare-frame]") as HTMLElement;
		this.#handle = root.querySelector("[data-neo-compare-handle]") as HTMLElement;
		// The host and its shadow outlive a morph and a reconnect, which lets
		// these listeners bind once.
		this.addEventListener("pointerdown", this.#onPointerDown);
		this.addEventListener("pointermove", this.#onPointerMove);
		this.addEventListener("pointerup", this.#onPointerUp);
		this.addEventListener("pointercancel", this.#onPointerCancel);
		this.addEventListener("lostpointercapture", this.#onPointerCancel);
		// A native image drag would steal the pointer from the divider.
		this.addEventListener("dragstart", (e) => e.preventDefault());
		this.addEventListener("dblclick", this.#onDoubleClick);
		this.#handle.addEventListener("keydown", this.#onKeyDown);
	}

	connectedCallback() {
		this.#connectedOnce = true;
		this.#syncRange();
		this.#syncPosition();
		this.#syncAria();
		this.#syncDisabled();
		this.#resize.observe(this.#frame);
		this.#checkSlots();
	}

	disconnectedCallback() {
		this.#endDrag();
		this.#resize.disconnect();
	}

	attributeChangedCallback(name: string, _old: string | null, next: string | null) {
		if (name === ATTR_VALUE) {
			if (this.#reflecting) return;
			// Absent keeps the position. An invalid or out-of-range value
			// reflects back as the value in use.
			const v = this.#clampValue(next === null ? this.#value : num(next, this.#value));
			// A 2-way binding echoes every input event back into `value`.
			const moved = v !== this.#value;
			this.#value = v;
			this.#reflect();
			if (moved) this.#syncPosition();
			return;
		}
		if (name === ATTR_DISABLED) {
			this.#endDrag();
			this.#syncDisabled();
			return;
		}
		if (name === ATTR_MIN || name === ATTR_MAX) {
			// Before the first connect, a parse or upgrade can still have the `value`
			// callback queued, and a reflect here would overwrite the authored value.
			if (this.#connectedOnce) this.#syncRange();
			return;
		}
		if (name === ATTR_VERTICAL) this.#jump();
		this.#syncAria();
	}

	// Sets `instant` for the frame that styles an axis or size change.
	// The first frame's style pass sees the state; the second frame clears it.
	#jump() {
		setState(this.#internals, "instant", true);
		cancelAnimationFrame(this.#jumpFrame);
		this.#jumpFrame = requestAnimationFrame(() => {
			this.#jumpFrame = requestAnimationFrame(() => setState(this.#internals, "instant", false));
		});
	}

	get value(): number {
		return this.#value;
	}

	set value(v: number) {
		if (!Number.isFinite(v)) return;
		this.#value = this.#clampValue(v);
		this.#reflect();
		this.#syncPosition();
	}

	// The allowed values. A max below min pins the divider at min.
	#range(): [number, number] {
		const lo = clamp(num(this.getAttribute(ATTR_MIN), 0), 0, 100);
		return [lo, clamp(num(this.getAttribute(ATTR_MAX), 100), lo, 100)];
	}

	#clampValue(v: number): number {
		const [lo, hi] = this.#range();
		return clamp(v, lo, hi);
	}

	// Applies the range from min and max: moves a value outside it to the
	// nearest limit and updates the handle's ARIA range. Fires no event,
	// as a `value` command fires none.
	#syncRange() {
		const [lo, hi] = this.#range();
		this.#handle.setAttribute("aria-valuemin", String(lo));
		this.#handle.setAttribute("aria-valuemax", String(hi));
		const v = clamp(this.#value, lo, hi);
		if (v !== this.#value) {
			this.#value = v;
			this.#syncPosition();
		}
		this.#reflect();
		const min = this.getAttribute(ATTR_MIN);
		const max = this.getAttribute(ATTR_MAX);
		const pair = `${min} ${max}`;
		if (hi === lo && num(max, 100) < num(min, 0) && pair !== this.#rangeWarned) {
			this.#rangeWarned = pair;
			console.warn(`<neo-compare>: max="${max}" is below min="${min}"; the divider stays at ${lo}.`);
		}
	}

	#reflect() {
		const s = String(this.#value);
		if (this.getAttribute(ATTR_VALUE) === s) return;
		this.#reflecting = true;
		try {
			this.setAttribute(ATTR_VALUE, s);
		} finally {
			this.#reflecting = false;
		}
	}

	#syncPosition() {
		this.#root.style.setProperty("--_v", String(this.#value / 100));
		this.#handle.setAttribute("aria-valuenow", String(this.#value));
		this.#handle.setAttribute("aria-valuetext", `${Math.round(this.#value)}%`);
	}

	#syncAria() {
		this.#handle.setAttribute("aria-orientation", this.#vertical() ? "vertical" : "horizontal");
		this.#handle.setAttribute("aria-label", labelAttr(this, ATTR_DIVIDER_LABEL, "Divider position"));
	}

	#syncDisabled() {
		const off = this.#disabled();
		this.#handle.setAttribute("tabindex", off ? "-1" : "0");
		this.#handle.setAttribute("aria-disabled", String(off));
	}

	#vertical(): boolean {
		return boolAttr(this, ATTR_VERTICAL, false);
	}

	#disabled(): boolean {
		return boolAttr(this, ATTR_DISABLED, false);
	}

	// The clockwise tilt in degrees. neo-compare.global.css registers the
	// property as an <angle>, which computes to deg.
	#tiltDegrees(): number {
		return Number.parseFloat(getComputedStyle(this).getPropertyValue(PROP_TILT)) || 0;
	}

	#checkSlots() {
		const missing = ["before", "after"].filter((name) => !this.querySelector(`:scope > [slot="${name}"]`));
		if (missing.length === 0) return;
		if (retryWhileParsing(this, () => this.#checkSlots())) return;
		for (const name of missing) console.warn(`<neo-compare>: no child with slot="${name}".`);
	}

	// Moves the divider, rounded to 0.01%, which is under 1px up to 10000px.
	// Fires `input` for a live drag and `change` for a commit,
	// each only when the value moved.
	#set(v: number, kind: "input" | "change") {
		// Round first, which keeps a rounded value from leaving the range.
		const next = this.#clampValue(Math.round(v * 100) / 100);
		if (next === this.#value) return;
		this.#value = next;
		// Mid-drag the attribute waits for the commit,
		// because every write restyles page rules keyed on `value`.
		if (kind === "change") this.#reflect();
		this.#syncPosition();
		this.#emit(kind);
	}

	#emit(kind: "input" | "change") {
		this.dispatchEvent(
			new CustomEvent(`neo-compare-${kind}`, {
				bubbles: true,
				detail: { value: this.#value },
			}),
		);
	}

	#onKeyDown = (e: KeyboardEvent) => {
		if (this.#disabled()) return;
		// Alt and the platform's other modifier keep their browser and OS
		// meaning, such as Alt+Left for history back.
		if (e.altKey || (IS_APPLE ? e.ctrlKey : e.metaKey)) return;
		const vertical = this.#vertical();
		const key = vertical ? e.key : logicalArrow(this, e.key);
		// A vertical value grows downward, which makes Down and PageDown
		// move the divider the way they point. Horizontal follows the APG slider,
		// where Up and PageUp increase the value.
		const down = vertical ? 1 : -1;
		const arrows: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: down, ArrowUp: -down };
		const dir = arrows[key];
		let next: number | null = null;
		if (dir !== undefined) {
			// Cmd+Arrow (Ctrl+Arrow off Apple) jumps to the edge the arrow
			// points at, as it jumps to the end of a line in a text field.
			if (IS_APPLE ? e.metaKey : e.ctrlKey) next = dir > 0 ? 100 : 0;
			else next = this.#value + dir * (e.shiftKey ? 10 : 1);
		} else if (key === "PageDown") next = this.#value + 10 * down;
		else if (key === "PageUp") next = this.#value - 10 * down;
		else if (key === "Home") next = 0;
		else if (key === "End") next = 100;
		if (next === null) return;
		e.preventDefault();
		this.#set(next, "change");
	};

	#onPointerDown = (e: PointerEvent) => {
		if (this.#drag || e.button !== 0 || this.#disabled()) return;
		// Stops text selection; focus moves to the handle by hand.
		// The browser sees no mousedown and would treat the script focus as
		// keyboard focus, with a focus ring.
		e.preventDefault();
		const following = e.pointerType === "mouse";
		// A touch or pen press focuses once it drags or taps. A swipe that scrolls
		// the page must not blur a text field, which closes the on-screen keyboard.
		if (following) this.#focusHandle();
		const vertical = this.#vertical();
		const rect = this.#frame.getBoundingClientRect();
		const across = vertical ? rect.width : rect.height;
		const tiltOffset = (Math.tan((this.#tiltDegrees() * Math.PI) / 180) * across) / 2;
		const d: Drag = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			startValue: this.#value,
			following,
			dragged: false,
			onHandle: e.composedPath().includes(this.#handle),
			grabOffset: 0,
			rect,
			vertical,
			rtl: !vertical && isRTL(this),
			tiltOffset,
			span: (vertical ? rect.height : rect.width) + 2 * Math.abs(tiltOffset),
		};
		if (d.onHandle) d.grabOffset = this.#pointerValue(e, d) - this.#value;
		if (d.onHandle || d.following) setState(this.#internals, "grabbed", true);
		try {
			this.setPointerCapture(e.pointerId);
		} catch {
			// Synthetic pointers can refuse capture;
			// the drag still works while the pointer stays over the host.
		}
		this.#drag = d;
		// Without `dragging`, the transition eases this jump as it eases a click.
		// A drag past the threshold sets `dragging`, which drops the rest of it.
		if (d.following && !d.onHandle) this.#set(this.#pointerValue(e, d), "input");
	};

	#onPointerMove = (e: PointerEvent) => {
		const d = this.#drag;
		if (!d || e.pointerId !== d.pointerId) return;
		// A drag whose pointerup went missing, as after a refused capture, ends
		// on the next move without the primary button.
		if ((e.buttons & 1) === 0) {
			this.#handleClicks = 0;
			this.#endDrag();
			return;
		}
		if (!d.dragged) {
			const delta = d.vertical ? e.clientY - d.startY : e.clientX - d.startX;
			d.dragged = Math.abs(delta) >= DRAG_THRESHOLD;
			if (!d.dragged && !d.following) return;
			if (!d.following) this.#focusHandle();
			d.following = true;
			// Below the threshold, a press off the handle retargets the click
			// transition, which a jittery click would otherwise cut short.
			if (d.dragged || d.onHandle) setState(this.#internals, "dragging", true);
			setState(this.#internals, "grabbed", true);
		}
		this.#set(this.#pointerValue(e, d), "input");
	};

	#onPointerUp = (e: PointerEvent) => {
		const d = this.#drag;
		if (!d || e.pointerId !== d.pointerId) return;
		// A touch or pen tap elsewhere moves the divider to the pointer.
		// A tap on the handle leaves it, even when the pointer
		// moved a few px below the drag threshold.
		if (d.following) this.#set(this.#pointerValue(e, d), "input");
		else if (!d.onHandle) this.#set(this.#pointerValue(e, d), "change");
		if (!d.following) this.#focusHandle();
		this.#handleClicks = d.onHandle && !d.dragged ? this.#handleClicks + 1 : 0;
		this.#endDrag();
	};

	#focusHandle() {
		this.#handle.focus({ preventScroll: true, focusVisible: false });
	}

	// Only after 2 clicks on the handle, which move the divider less than
	// the drag threshold. Elsewhere the 1st click has already moved it to the pointer,
	// and a recenter would follow a visible detour. A drag would snap back.
	#onDoubleClick = () => {
		if (this.#disabled() || !boolAttr(this, ATTR_RECENTER, true) || this.#handleClicks < 2) return;
		this.#set(CENTER, "change");
	};

	#onPointerCancel = (e: PointerEvent) => {
		if (e.pointerId !== this.#drag?.pointerId) return;
		this.#handleClicks = 0;
		this.#endDrag();
	};

	// Commits a drag that moved the divider: reflects `value` and fires `change`.
	// Safe to call without a drag.
	#endDrag() {
		const d = this.#drag;
		if (!d) return;
		this.#drag = null;
		if (this.hasPointerCapture(d.pointerId)) this.releasePointerCapture(d.pointerId);
		setState(this.#internals, "dragging", false);
		setState(this.#internals, "grabbed", false);
		this.#reflect();
		if (d.following && this.#value !== d.startValue) this.#emit("change");
	}

	// The value whose line, after the grab offset, passes through the pointer.
	#pointerValue(e: PointerEvent, d: Drag): number {
		if (d.span <= 0) return this.#value;
		return ((this.#lineAt(e, d) + Math.abs(d.tiltOffset)) / d.span) * 100 - d.grabOffset;
	}

	// Distance from the start edge to the midpoint of the line through the pointer.
	// A positive tilt turns the line clockwise: its top end moves right,
	// or with `vertical` its right end moves down.
	#lineAt(e: PointerEvent, d: Drag): number {
		const x = e.clientX - d.rect.left;
		const y = e.clientY - d.rect.top;
		const t = d.tiltOffset;
		if (d.vertical) return d.rect.width > 0 ? y + t - (2 * t * x) / d.rect.width : y;
		const mid = d.rect.height > 0 ? x - t + (2 * t * y) / d.rect.height : x;
		return d.rtl ? d.rect.width - mid : mid;
	}
}

if (!customElements.get("neo-compare")) {
	customElements.define("neo-compare", NeoCompare);
}
