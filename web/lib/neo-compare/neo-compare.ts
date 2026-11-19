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

const ATTR_VALUE = "value";
const ATTR_VERTICAL = "vertical";
const ATTR_DISABLED = "disabled";
const ATTR_DIVIDER_LABEL = "divider-label";
const ATTR_RECENTER = "recenter";
const ATTR_MIN = "min";
const ATTR_MAX = "max";
const CENTER = 50;
// 4px matches the OS click-vs-drag threshold. A touch that scrolls the page
// along the other axis never crosses it and leaves the divider in place.
const DRAG_THRESHOLD = 4;
const PROP_TILT = "--neo-compare-tilt";
const DEG_PER_UNIT: Record<string, number> = { deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360 };

const TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops them.
// Anchored by selector:
// - :host touch-action: the page still scrolls along the other axis.
// - [data-neo-compare-root]: display: contents. It holds --_v (the value as
//   a fraction) and --_w/--_h (the frame size), which its children inherit.
//   A morph can't strip them, as it would the host's style attribute.
// - --_d: the tilt offset of the line ends from its midpoint, from the frame
//   size across the axis. The tilt is physical, as rotate() is, and a
//   right-to-left page mirrors only the sides.
// - --_at: the midpoint of the line from the start edge. The range stretches
//   by |--_d| at both ends, which lets 0 and 100 show 1 layer fully.
// - [data-neo-compare-frame]: clips the rounded corners and the tilted line,
//   whose ends reach past the edges near 0 and 100.
// - [data-neo-compare-layer]: both layers fill grid area 1/1 and each clips
//   to its side of the line, which keeps a transparent area of one layer
//   from showing the other. The after layer reaches 1px under the before
//   layer. 2 cuts that meet edge to edge each cover the edge pixels only in
//   part, and the page shows through the seam.
// - [data-neo-compare-frame] isolation: contains the z-index that puts the
//   before layer over that overlap, which keeps the handle on top.
// - [data-neo-compare-layer] ::slotted(*): fills the layer; the larger content
//   sizes both layers.
// - [data-neo-compare-divider]: an absolute grid item, whose containing block
//   is the grid area and not the padding box. The skew pivots on its
//   midpoint, which stays on --_at.
// - [data-neo-compare-grip]: a 0-size box at the line midpoint that centers
//   the handle. It sits outside the frame, which keeps the handle whole at 0
//   and 100, and it owns the position, which ::part(handle) can't override.
//   The clamp stops the handle at the edge while a tilted line moves on.
// - transition: set once for both axes. An axis rule that sets it would
//   outrank the :state(dragging) rule.
// - :state(dragging): no transition, which keeps the divider on the pointer.
// - :state(instant): no transition for 1 frame after an axis or size change.
//   Clip paths eased between the axes leave a corner that neither layer
//   covers, and a resize would let the tilted edges lag the box.
// - :state(grabbed): the handle is held. A press on the handle sets it at
//   once, a press elsewhere at the drag threshold, which keeps a touch that
//   turns into a page scroll from popping the handle up and down.
// - durations: scaled by --neo-duration-scale, which reduced motion sets to 0.
TEMPLATE.innerHTML = `
<style>
  :host {
    --_duration: calc(var(--neo-compare-duration, 200ms) * var(--neo-duration-scale, 1));
    --_easing: var(--neo-compare-easing, var(--neo-easing, ease));
    --_divider-width: var(--neo-compare-divider-width, 2px);
    position: relative;
    display: grid;
    width: fit-content;
    max-width: 100%;
    touch-action: pan-y;
    cursor: ew-resize;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  :host([vertical]:not([vertical="false"])) {
    touch-action: pan-x;
    cursor: ns-resize;
  }
  :host([disabled]:not([disabled="false"])) {
    touch-action: auto;
    cursor: default;
  }
  [data-neo-compare-root] {
    display: contents;
    --_d: calc(tan(var(${PROP_TILT}, 0deg)) * var(--_h, 0px) / 2);
    --_ad: max(var(--_d), -1 * var(--_d));
    --_at: calc((100% + 2 * var(--_ad)) * var(--_v, 0.5) - var(--_ad));
  }
  :host([vertical]:not([vertical="false"])) [data-neo-compare-root] {
    --_d: calc(tan(var(${PROP_TILT}, 0deg)) * var(--_w, 0px) / 2);
  }
  [data-neo-compare-frame] {
    grid-area: 1 / 1;
    position: relative;
    display: grid;
    min-width: 0;
    overflow: hidden;
    border-radius: inherit;
    isolation: isolate;
  }
  [data-neo-compare-layer] {
    grid-area: 1 / 1;
    display: grid;
    min-width: 0;
    min-height: 0;
    transition: clip-path var(--_duration) var(--_easing);
  }
  [data-neo-compare-layer="before"] {
    z-index: 1;
    clip-path: polygon(0 0, calc(var(--_at) + var(--_d)) 0, calc(var(--_at) - var(--_d)) 100%, 0 100%);
  }
  [data-neo-compare-layer="after"] {
    clip-path: polygon(calc(var(--_at) + var(--_d) - 1px) 0, 100% 0, 100% 100%, calc(var(--_at) - var(--_d) - 1px) 100%);
  }
  [data-neo-compare-layer="before"]:dir(rtl) {
    clip-path: polygon(calc(100% - var(--_at) + var(--_d)) 0, 100% 0, 100% 100%, calc(100% - var(--_at) - var(--_d)) 100%);
  }
  [data-neo-compare-layer="after"]:dir(rtl) {
    clip-path: polygon(0 0, calc(100% - var(--_at) + var(--_d) + 1px) 0, calc(100% - var(--_at) - var(--_d) + 1px) 100%, 0 100%);
  }
  :host([vertical]:not([vertical="false"])) [data-neo-compare-layer="before"] {
    clip-path: polygon(0 0, 100% 0, 100% calc(var(--_at) + var(--_d)), 0 calc(var(--_at) - var(--_d)));
  }
  :host([vertical]:not([vertical="false"])) [data-neo-compare-layer="after"] {
    clip-path: polygon(0 calc(var(--_at) - var(--_d) - 1px), 100% calc(var(--_at) + var(--_d) - 1px), 100% 100%, 0 100%);
  }
  [data-neo-compare-layer] > slot::slotted(*) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  [data-neo-compare-divider] {
    grid-area: 1 / 1;
    position: absolute;
    z-index: 1;
    inset-block: 0;
    inset-inline-start: var(--_at);
    width: var(--_divider-width);
    margin-inline-start: calc(var(--_divider-width) / -2);
    transform: skewX(calc(-1 * var(${PROP_TILT}, 0deg)));
    background: var(--neo-compare-divider-color, var(--btn-bg, #fff));
    box-shadow: var(--neo-compare-shadow, 0 0 4px rgb(0 0 0 / 0.35));
    transition-property: inset-inline-start, inset-block-start;
    transition-duration: var(--_duration);
    transition-timing-function: var(--_easing);
  }
  :host([vertical]:not([vertical="false"])) [data-neo-compare-divider] {
    inset-inline: 0;
    inset-block: var(--_at) auto;
    width: auto;
    height: var(--_divider-width);
    margin: calc(var(--_divider-width) / -2) 0 0;
    transform: skewY(var(${PROP_TILT}, 0deg));
  }
  [data-neo-compare-grip] {
    grid-area: 1 / 1;
    position: absolute;
    inset-inline-start: clamp(0%, var(--_at), 100%);
    inset-block-start: 50%;
    width: 0;
    height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition-property: inset-inline-start, inset-block-start;
    transition-duration: var(--_duration);
    transition-timing-function: var(--_easing);
  }
  :host([vertical]:not([vertical="false"])) [data-neo-compare-grip] {
    inset-inline-start: 50%;
    inset-block-start: clamp(0%, var(--_at), 100%);
  }
  :host(:is(:state(dragging), :state(instant))) :is([data-neo-compare-layer], [data-neo-compare-divider], [data-neo-compare-grip]) {
    transition: none;
  }
  [data-neo-compare-handle] {
    flex: none;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: var(--neo-compare-handle-size, 2.5rem);
    height: var(--neo-compare-handle-size, 2.5rem);
    border: 1px solid var(--neo-compare-handle-border, var(--btn-border, transparent));
    border-radius: var(--neo-compare-handle-radius, 50%);
    background: var(--neo-compare-handle-bg, var(--neo-compare-divider-color, var(--btn-bg, #fff)));
    color: var(--neo-compare-handle-fg, var(--btn-fg, #171717));
    box-shadow: var(--neo-compare-shadow, 0 0 4px rgb(0 0 0 / 0.35));
    outline: none;
    transition-property: scale, box-shadow;
    transition-duration: calc(var(--neo-compare-grab-duration, 150ms) * var(--neo-duration-scale, 1));
    transition-timing-function: var(--_easing);
  }
  :host(:state(grabbed)) [data-neo-compare-handle] {
    scale: var(--neo-compare-handle-grab-scale, 1.15);
    box-shadow: var(--neo-compare-handle-grab-shadow, 0 4px 12px rgb(0 0 0 / 0.4));
  }
  [data-neo-compare-handle]:focus-visible {
    outline: 2px solid var(--neo-compare-focus-ring, var(--focus-ring, var(--accent, Highlight)));
    outline-offset: 2px;
  }
  :host([disabled]:not([disabled="false"])) [data-neo-compare-handle] {
    opacity: 0.5;
  }
  [data-neo-compare-handle] svg {
    width: 55%;
    height: 55%;
  }
  :host([vertical]:not([vertical="false"])) [data-neo-compare-handle] svg {
    rotate: 90deg;
  }
  @media (forced-colors: active) {
    [data-neo-compare-divider] {
      background: CanvasText;
    }
    [data-neo-compare-handle] {
      border: 2px solid CanvasText;
      background: Canvas;
      color: CanvasText;
    }
  }
</style>
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
	started: boolean;
	onHandle: boolean;
	// Pointer distance from the line along the axis, kept while dragging the
	// handle so the divider doesn't jump under it.
	grabOffset: number;
	rect: DOMRect;
	vertical: boolean;
	rtl: boolean;
	// Offset of the line ends from its midpoint, which the tilt sets.
	tiltOffset: number;
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
	#drag: Drag | null = null;
	#jumpFrame = 0;
	// The min/max pair last warned about, which keeps the per-attribute
	// callbacks of an upgrade from repeating the warning.
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
		const raw = this.getAttribute(ATTR_VALUE);
		if (raw !== null) this.#value = clamp(num(raw, this.#value), 0, 100);
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
			this.#syncRange();
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

	// The clockwise tilt in degrees. neo-compare.css registers the property
	// as an <angle>, which computes to deg; the other units cover a page
	// that loads the script without that sheet.
	#tiltDegrees(): number {
		const raw = getComputedStyle(this).getPropertyValue(PROP_TILT).trim();
		const m = /^(-?[\d.]+(?:e-?\d+)?)(deg|rad|grad|turn)$/.exec(raw);
		return m ? Number(m[1]) * DEG_PER_UNIT[m[2]] : 0;
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
		this.#handle.focus({ preventScroll: true, focusVisible: false });
		const vertical = this.#vertical();
		const rect = this.#frame.getBoundingClientRect();
		const across = vertical ? rect.width : rect.height;
		const d: Drag = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			startValue: this.#value,
			started: false,
			onHandle: e.composedPath().includes(this.#handle),
			grabOffset: 0,
			rect,
			vertical,
			rtl: !vertical && isRTL(this),
			tiltOffset: (Math.tan((this.#tiltDegrees() * Math.PI) / 180) * across) / 2,
		};
		if (d.onHandle) {
			const span = (vertical ? rect.height : rect.width) + 2 * Math.abs(d.tiltOffset);
			const at = (this.#value / 100) * span - Math.abs(d.tiltOffset);
			d.grabOffset = this.#lineAt(e, d) - at;
			setState(this.#internals, "grabbed", true);
		}
		try {
			this.setPointerCapture(e.pointerId);
		} catch {
			// Synthetic pointers can refuse capture;
			// the drag still works while the pointer stays over the host.
		}
		this.#drag = d;
	};

	#onPointerMove = (e: PointerEvent) => {
		const d = this.#drag;
		if (!d || e.pointerId !== d.pointerId) return;
		if (!d.started) {
			const delta = d.vertical ? e.clientY - d.startY : e.clientX - d.startX;
			if (Math.abs(delta) < DRAG_THRESHOLD) return;
			d.started = true;
			setState(this.#internals, "dragging", true);
			setState(this.#internals, "grabbed", true);
		}
		this.#set(this.#pointerValue(e, d), "input");
	};

	#onPointerUp = (e: PointerEvent) => {
		const d = this.#drag;
		if (!d || e.pointerId !== d.pointerId) return;
		if (d.started) {
			this.#set(this.#pointerValue(e, d), "input");
		} else {
			// A click without a drag moves the divider to the pointer.
			// A click on the handle keeps it, because the grab offset cancels the move.
			this.#set(this.#pointerValue(e, d), "change");
		}
		this.#handleClicks = d.onHandle && !d.started ? this.#handleClicks + 1 : 0;
		this.#endDrag();
	};

	// Only after 2 clicks on the handle, which leave the divider in place.
	// Elsewhere the 1st click has already moved it to the pointer,
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
		if (d.started && this.#value !== d.startValue) this.#emit("change");
	}

	// The value whose line, after the grab offset, passes through the pointer.
	// The range spans the frame plus the tilt offset at both ends, as --_at does in CSS.
	#pointerValue(e: PointerEvent, d: Drag): number {
		const reach = Math.abs(d.tiltOffset);
		const span = (d.vertical ? d.rect.height : d.rect.width) + 2 * reach;
		if (span <= 0) return this.#value;
		return ((this.#lineAt(e, d) - d.grabOffset + reach) / span) * 100;
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
