// Two-thumb slider sharing <neo-slider>'s markup. Internals render into a
// shadow root on connect with no <slot>, so a fat morph of value-min /
// value-max keeps the same thumb and fill nodes and the `easing` transition
// runs instead of rebuilding and snapping.

import { boolAttr } from "../command";
import {
	collectMarks,
	type MarkRailConfig,
	type MarkSpec,
	markValueNearPointer,
	measureMarkLabelOverlaps,
	renderMarks as renderMarkRail,
	syncHoveredMarkLabel,
	syncActiveMarkLabelVisibility as syncMarkLabelVisibility,
} from "../neo-marks";
import tooltipCss from "../neo-tooltip/tooltip-pill.css";
import { num } from "../num";
import { scopeCssToHost } from "../shadow-utils";
import { TooltipController } from "../tooltip-controller";
import sliderRangeCss from "./neo-slider-range.css";

const ATTR_MIN = "min";
const ATTR_MAX = "max";
const ATTR_STEP = "step";
const ATTR_VALUE_MIN = "value-min";
const ATTR_VALUE_MAX = "value-max";
const ATTR_LABEL = "label";
const ATTR_UNIT = "unit";
const ATTR_HIDE_VALUE = "hide-value";
const ATTR_HIDE_TOOLTIP = "hide-tooltip";
const ATTR_VERTICAL = "vertical";
const ATTR_EASING = "easing";
const ATTR_DISABLED = "disabled";
const ATTR_STATIC_MARKS = "static-marks";

type Side = "min" | "max";

const MARK_CFG: MarkRailConfig = {
	markAttr: "data-neo-slider-mark",
	anchorAttr: "data-neo-slider-anchor",
	markLabelAttr: "data-neo-slider-mark-label",
};

// The whole module stylesheet, tag selectors rewritten to `:host`,
// adopted into every instance's shadow root. Built once and shared. The
// internals live in the shadow so a Datastar fat-morph of the light host
// can't wipe them. The thumb / fill nodes persist, so an `easing`
// transition runs on a plain value change instead of snapping after a
// rebuild. The tooltip pill CSS is adopted here too because both thumbs'
// [data-neo-tooltip-host] bubbles live inside this shadow root and global
// tooltip rules cannot reach them.
const SHEET = new CSSStyleSheet();
SHEET.replaceSync(`${scopeCssToHost(sliderRangeCss, "neo-slider-range")}\n${tooltipCss}`);

export class NeoSliderRange extends HTMLElement {
	static readonly observedAttributes = [
		ATTR_MIN,
		ATTR_MAX,
		ATTR_STEP,
		ATTR_VALUE_MIN,
		ATTR_VALUE_MAX,
		ATTR_LABEL,
		ATTR_UNIT,
		ATTR_HIDE_VALUE,
		ATTR_HIDE_TOOLTIP,
		ATTR_VERTICAL,
		ATTR_EASING,
		ATTR_DISABLED,
		ATTR_STATIC_MARKS,
	];

	#rendered = false;
	// Current thumb values; `value-min`/`value-max` reflect them (see
	// command). Source of truth so a fat morph that strips either attribute
	// keeps that thumb where it is instead of snapping to the rail end.
	// Raw (per-thumb clamp to [min,max], no cross-ordering); the public
	// getters sort the pair.
	#valueMinIntent = 0;
	#valueMaxIntent = 0;
	// writeValue()/reflect write the value attributes via setAttribute, which
	// would otherwise be read back as a command in attributeChangedCallback.
	#reflectingValue = false;
	#headerEl: HTMLElement | null = null;
	#labelEl: HTMLElement | null = null;
	#outputEl: HTMLElement | null = null;
	#valueMinEl: HTMLElement | null = null;
	#valueMaxEl: HTMLElement | null = null;
	#unitEl: HTMLElement | null = null;
	#trackEl: HTMLElement | null = null;
	#fillEl: HTMLElement | null = null;
	#thumbMinEl: HTMLElement | null = null;
	#thumbMaxEl: HTMLElement | null = null;
	// Host elements wrapping each thumb; the controllers drive the value
	// bubbles on them without a registered <neo-tooltip>. Null when hide-tooltip.
	#tooltipMinEl: HTMLElement | null = null;
	#tooltipMaxEl: HTMLElement | null = null;
	#tooltipMinCtrl: TooltipController | null = null;
	#tooltipMaxCtrl: TooltipController | null = null;
	#marksEl: HTMLElement | null = null;
	#marks: MarkSpec[] = [];
	#childObserver: MutationObserver | null = null;
	#dragPointerId: number | null = null;
	#dragWhich: Side | null = null;
	#dragStartX = 0;
	#dragStartY = 0;
	#dragStarted = false;
	#tooltipTrackFrame: number | null = null;
	#tooltipTrackStartedAt = 0;
	#markResizeObserver: ResizeObserver | null = null;
	#markLayoutFrame: number | null = null;

	connectedCallback() {
		if (!this.shadowRoot) {
			const root = this.attachShadow({ mode: "open" });
			root.adoptedStyleSheets = [SHEET];
		}
		this.#adoptValueAttr("min");
		this.#adoptValueAttr("max");
		this.#render();
		// On a reconnect #render early-returns (internals persist), so the
		// tooltip controllers disconnected on the prior detach must re-bind
		// their window listeners here. Idempotent when already connected.
		this.#tooltipMinCtrl?.connect();
		this.#tooltipMaxCtrl?.connect();
		this.#syncAll();
		this.#observeMarkLayout();
		this.#scheduleMarkLayoutSync();
		this.#observeChildren();
		// Focus events cross the shadow boundary, so they still fire on the
		// host; the active-mark-label preference reads which thumb holds
		// focus from the shadow's activeElement.
		this.addEventListener("focusin", this.#onFocusChange);
		this.addEventListener("focusout", this.#onFocusChange);
	}

	disconnectedCallback() {
		this.#endDrag();
		this.removeEventListener("focusin", this.#onFocusChange);
		this.removeEventListener("focusout", this.#onFocusChange);
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		this.#markResizeObserver?.disconnect();
		this.#markResizeObserver = null;
		if (this.#markLayoutFrame !== null) {
			window.cancelAnimationFrame(this.#markLayoutFrame);
			this.#markLayoutFrame = null;
		}
		this.#stopTooltipTracking();
		this.#tooltipMinCtrl?.disconnect();
		this.#tooltipMaxCtrl?.disconnect();
	}

	// Focus moved between (or away from) the shadow's thumbs / value
	// fields: re-resolve which mark label stays visible. The min-thumb
	// preference is read live from the shadow's activeElement, so no
	// per-part field is tracked.
	#onFocusChange = () => {
		this.#syncActiveMarkLabelVisibility();
	};

	#minThumbFocused(): boolean {
		return this.shadowRoot?.activeElement === this.#thumbMinEl;
	}

	// Author marks are [data-neo-slider-mark] light children; the rendered
	// dots/labels live in the shadow. A morph that changes the light marks
	// won't touch the shadow, so re-collect and re-render the rail here.
	// The rendered internals themselves are shadow-only and never wiped.
	#observeChildren() {
		if (this.#childObserver) return;
		this.#childObserver = new MutationObserver((mutations) => {
			if (!this.#rendered) return;
			if (!this.#markSourceChanged(mutations)) return;
			this.#captureUserContent();
			this.#renderMarks();
		});
		this.#childObserver.observe(this, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
		});
	}

	#markSourceChanged(mutations: MutationRecord[]): boolean {
		for (const mutation of mutations) {
			if (mutation.type === "childList") {
				if (mutation.target === this || this.#nodeWithinMark(mutation.target)) return true;
				continue;
			}
			if (mutation.type === "characterData") {
				if (this.#nodeWithinMark(mutation.target)) return true;
				continue;
			}
			if (mutation.type === "attributes") {
				if (mutation.attributeName === MARK_CFG.markAttr || this.#nodeWithinMark(mutation.target)) return true;
			}
		}
		return false;
	}

	#nodeWithinMark(node: Node): boolean {
		const el = node instanceof Element ? node : node.parentElement;
		return el?.closest(`[${MARK_CFG.markAttr}]`) !== null;
	}

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		if (!this.#rendered) return;
		if (name === ATTR_LABEL) {
			this.#syncLabel();
			this.#syncHeaderVisibility();
		} else if (name === ATTR_UNIT) this.#syncUnit();
		else if (name === ATTR_HIDE_VALUE) {
			this.#syncValueVisibility();
			this.#syncHeaderVisibility();
		} else if (name === ATTR_HIDE_TOOLTIP) this.#rebuild();
		else if (name === ATTR_VERTICAL) {
			this.#orderThumbsForOrientation();
			this.#renderMarks();
			this.#syncValues();
		} else if (name === ATTR_EASING) this.#syncEasing();
		else if (name === ATTR_DISABLED) this.#syncDisabled();
		else if (name === ATTR_MIN || name === ATTR_MAX) {
			// Re-clamp both thumbs into the new rail before rendering.
			this.#valueMinIntent = this.#clampToRail(this.#valueMinIntent);
			this.#valueMaxIntent = this.#clampToRail(this.#valueMaxIntent);
			this.#reflectValues();
			this.#renderMarks();
			this.#syncValues();
		} else if (name === ATTR_VALUE_MIN || name === ATTR_VALUE_MAX) {
			// Our own guarded reflect; not a command.
			if (this.#reflectingValue) return;
			const side: Side = name === ATTR_VALUE_MIN ? "min" : "max";
			// Absent: no command, keep this thumb's value; re-reflect so the
			// attribute stays the state mirror. Handled per-side, a morph may
			// strip only one.
			if (newValue === null) this.#reflectValues();
			else this.#adoptValueAttr(side);
			this.#syncValues();
		} else this.#syncValues();
		void newValue;
	}

	get min(): number {
		return num(this.getAttribute(ATTR_MIN), 0);
	}

	get max(): number {
		const m = num(this.getAttribute(ATTR_MAX), 100);
		return m > this.min ? m : this.min + 1;
	}

	get step(): number {
		const s = num(this.getAttribute(ATTR_STEP), 1);
		return s > 0 ? s : 1;
	}

	// Public getters sort the pair so external updates may cross without
	// leaving the rendered range inverted. Read the intents (the source of
	// truth), not the attributes, so a morph that strips either keeps state.
	get valueMin(): number {
		return Math.min(this.#valueMinIntent, this.#valueMaxIntent);
	}

	get valueMax(): number {
		return Math.max(this.#valueMinIntent, this.#valueMaxIntent);
	}

	set valueMin(v: number) {
		this.#writeValue("min", this.#clampSnap(v, this.min, this.max));
	}

	set valueMax(v: number) {
		this.#writeValue("max", this.#clampSnap(v, this.min, this.max));
	}

	// Adopt this thumb's attribute into its intent. Called from connect (no
	// attribute defaults to the rail end so a no-value range spans the whole
	// rail) and from an explicit attribute change. Absence with a prior intent
	// is handled by the caller, which re-reflects instead of adopting.
	#adoptValueAttr(side: Side) {
		const attr = side === "min" ? ATTR_VALUE_MIN : ATTR_VALUE_MAX;
		const dflt = side === "min" ? this.min : this.max;
		const raw = this.getAttribute(attr);
		const v = this.#clampToRail(raw === null ? dflt : num(raw, dflt));
		if (side === "min") this.#valueMinIntent = v;
		else this.#valueMaxIntent = v;
	}

	// Per-thumb clamp to [min, max] without normalizing against the other
	// endpoint; the public getters sort the pair.
	#clampToRail(v: number): number {
		return Math.min(this.max, Math.max(this.min, v));
	}

	// Single writer per thumb: update the intent, reflect to the attribute
	// (guarded so it isn't read back as a command), and re-render.
	#writeValue(side: Side, v: number) {
		if (side === "min") this.#valueMinIntent = v;
		else this.#valueMaxIntent = v;
		this.#reflectValues();
		this.#syncValues();
	}

	// State -> attributes, guarded so the reflect isn't read back as a
	// command in attributeChangedCallback.
	#reflectValues() {
		this.#reflectingValue = true;
		try {
			this.setAttribute(ATTR_VALUE_MIN, String(this.#valueMinIntent));
			this.setAttribute(ATTR_VALUE_MAX, String(this.#valueMaxIntent));
		} finally {
			this.#reflectingValue = false;
		}
	}

	#render() {
		if (this.#rendered) return;
		const root = this.shadowRoot;
		if (!root) return;
		this.#rendered = true;

		// A rebuild replaces the old tooltip hosts; drop the stale
		// controllers (and their window listeners) before rebuilding below.
		this.#tooltipMinCtrl?.disconnect();
		this.#tooltipMaxCtrl?.disconnect();
		this.#tooltipMinCtrl = null;
		this.#tooltipMaxCtrl = null;

		this.#captureUserContent();

		// `part` exposes each internal to page CSS via
		// `neo-slider-range::part(<name>)`, the only styling hook across
		// the shadow boundary.
		this.#headerEl = part(document.createElement("div"), "header");
		this.#headerEl.setAttribute("data-neo-slider-header", "");

		this.#labelEl = part(document.createElement("span"), "label");
		this.#labelEl.setAttribute("data-neo-slider-label", "");

		this.#outputEl = part(document.createElement("span"), "output");
		this.#outputEl.setAttribute("data-neo-slider-output", "");

		this.#valueMinEl = this.#makeValueField("min");
		this.#valueMaxEl = this.#makeValueField("max");

		const separatorEl = part(document.createElement("span"), "separator");
		separatorEl.setAttribute("data-neo-slider-separator", "");
		separatorEl.setAttribute("aria-hidden", "true");
		separatorEl.textContent = "–";

		this.#unitEl = part(document.createElement("span"), "unit");
		this.#unitEl.setAttribute("data-neo-slider-unit", "");

		this.#outputEl.appendChild(this.#valueMinEl);
		this.#outputEl.appendChild(separatorEl);
		this.#outputEl.appendChild(this.#valueMaxEl);
		this.#outputEl.appendChild(this.#unitEl);
		this.#headerEl.appendChild(this.#labelEl);
		this.#headerEl.appendChild(this.#outputEl);

		this.#trackEl = part(document.createElement("div"), "track");
		this.#trackEl.setAttribute("data-neo-slider-track", "");

		this.#fillEl = part(document.createElement("div"), "fill");
		this.#fillEl.setAttribute("data-neo-slider-fill", "");
		this.#trackEl.appendChild(this.#fillEl);

		this.#thumbMinEl = this.#makeThumb("min");
		this.#thumbMaxEl = this.#makeThumb("max");

		if (boolAttr(this, ATTR_HIDE_TOOLTIP, false)) {
			this.#tooltipMinEl = null;
			this.#tooltipMaxEl = null;
			this.#trackEl.appendChild(this.#thumbMinEl);
			this.#trackEl.appendChild(this.#thumbMaxEl);
		} else {
			const min = this.#wrapTooltip(this.#thumbMinEl, this.valueMin);
			const max = this.#wrapTooltip(this.#thumbMaxEl, this.valueMax);
			this.#tooltipMinEl = min.host;
			this.#tooltipMaxEl = max.host;
			this.#tooltipMinCtrl = min.ctrl;
			this.#tooltipMaxCtrl = max.ctrl;
			this.#trackEl.appendChild(this.#tooltipMinEl);
			this.#trackEl.appendChild(this.#tooltipMaxEl);
		}

		this.#marksEl = part(document.createElement("div"), "marks");
		this.#marksEl.setAttribute("data-neo-slider-marks", "");

		root.replaceChildren(this.#headerEl, this.#trackEl, this.#marksEl);

		this.#trackEl.addEventListener("pointerdown", this.#onTrackPointerDown);
		this.#trackEl.addEventListener("pointermove", this.#onTrackMarkPointerMove);
		this.#trackEl.addEventListener("pointerleave", this.#onTrackMarkPointerLeave);
		// Delegate click from track + marks row instead of N listeners.
		this.#trackEl.addEventListener("click", this.#onAnchorClick);
		this.#marksEl.addEventListener("click", this.#onMarkLabelClick);
		this.#marksEl.addEventListener("pointermove", this.#onMarkLabelPointerMove);
		this.#marksEl.addEventListener("pointerleave", this.#onMarkLabelPointerLeave);
		this.#orderThumbsForOrientation();
		// Bind now that the hosts are in the shadow tree. Idempotent, so the
		// connectedCallback re-connect on a reconnect is a no-op here.
		this.#tooltipMinCtrl?.connect();
		this.#tooltipMaxCtrl?.connect();
		this.#renderMarks();
	}

	// Order thumb hosts so tab order matches visual order. Vertical
	// swaps so the top (max) thumb is reached first when tabbing in
	// from the value field above.
	#orderThumbsForOrientation() {
		if (!this.#trackEl) return;
		const minHost = this.#tooltipMinEl ?? this.#thumbMinEl;
		const maxHost = this.#tooltipMaxEl ?? this.#thumbMaxEl;
		if (!minHost || !maxHost) return;
		if (this.#isVertical()) {
			this.#trackEl.insertBefore(maxHost, minHost);
		} else {
			this.#trackEl.insertBefore(minHost, maxHost);
		}
	}

	#captureUserContent() {
		this.#marks = collectMarks(this, MARK_CFG);
	}

	// Anchor dots on the rail + labels beneath, same as <neo-slider>.
	// Active state (inside the [valueMin, valueMax] band) is applied
	// separately by syncMarkActive.
	#renderMarks() {
		if (!this.#trackEl || !this.#marksEl) return;
		renderMarkRail(this.#marks, this.#trackEl, this.#marksEl, {
			min: this.min,
			max: this.max,
			vertical: this.#isVertical(),
			cfg: MARK_CFG,
			// Stack: fill < dots < thumbs. Insert before the front-most
			// thumb host (orderThumbsForOrientation may swap min⇆max).
			insertDot: (track, dot) => {
				const firstThumbHost = track.querySelector<HTMLElement>(
					":scope > [data-neo-slider-thumb-host], :scope > [data-neo-slider-thumb]",
				);
				if (firstThumbHost) track.insertBefore(dot, firstThumbHost);
				else track.appendChild(dot);
			},
		});
		this.#observeMarkLayout();
		this.#scheduleMarkLayoutSync();
	}

	#observeMarkLayout() {
		if (!this.isConnected || typeof ResizeObserver === "undefined") return;
		this.#markResizeObserver ??= new ResizeObserver(() => this.#scheduleMarkLayoutSync());
		this.#markResizeObserver.disconnect();
		this.#markResizeObserver.observe(this);
		if (!this.#marksEl) return;
		for (const label of this.#marksEl.querySelectorAll<HTMLElement>(":scope > [data-neo-slider-mark-label]")) {
			this.#markResizeObserver.observe(label);
		}
	}

	#scheduleMarkLayoutSync() {
		if (!this.isConnected || this.#markLayoutFrame !== null) return;
		this.#markLayoutFrame = window.requestAnimationFrame(() => {
			this.#markLayoutFrame = null;
			if (!this.isConnected) return;
			measureMarkLabelOverlaps(this.#marksEl, MARK_CFG, this.#isVertical());
			this.#syncActiveMarkLabelVisibility();
		});
	}

	#syncActiveMarkLabelVisibility() {
		const preferLowest =
			this.#dragWhich === "min" || this.#minThumbFocused() || this.#thumbMinEl?.matches(":hover") === true;
		syncMarkLabelVisibility(this.#marksEl, MARK_CFG, "extremes", {
			extreme: preferLowest ? "lowest" : "highest",
			range: { min: this.valueMin, max: this.valueMax },
		});
	}

	// Toggle [data-neo-active] on anchors/labels inside [lo, hi].
	// Symmetric with neo-slider's `<= value` rule (which collapses to
	// "below the value" because that slider's fill starts at min).
	#syncMarkActive(lo: number, hi: number) {
		if (!this.#trackEl || !this.#marksEl) return;
		const flip = (el: Element) => {
			const raw = el.getAttribute("data-neo-mark-value");
			if (raw === null) return;
			const mv = Number(raw);
			if (!Number.isFinite(mv)) return;
			if (mv >= lo && mv <= hi) el.setAttribute("data-neo-active", "");
			else el.removeAttribute("data-neo-active");
		};
		this.#trackEl.querySelectorAll(":scope > [data-neo-slider-anchor]").forEach(flip);
		this.#marksEl.querySelectorAll(":scope > [data-neo-slider-mark-label]").forEach(flip);
		this.#syncActiveMarkLabelVisibility();
	}

	#makeValueField(side: Side): HTMLElement {
		const el = part(document.createElement("span"), `value-${side}`);
		el.setAttribute("data-neo-slider-value", "");
		el.setAttribute(`data-neo-slider-value-${side}`, "");
		el.setAttribute("contenteditable", "plaintext-only");
		el.setAttribute("inputmode", "decimal");
		el.setAttribute("spellcheck", "false");
		el.setAttribute("autocapitalize", "off");
		el.setAttribute("autocorrect", "off");
		el.setAttribute("role", "spinbutton");
		el.setAttribute("tabindex", "0");
		el.addEventListener("beforeinput", (e: Event) => this.#onValueBeforeInput(e as InputEvent, side));
		el.addEventListener("keydown", (e: Event) => this.#onValueKeyDown(e as KeyboardEvent, side));
		el.addEventListener("blur", () => this.#onValueBlur(side));
		el.addEventListener("focus", () => this.#onValueFocus(side));
		return el;
	}

	#makeThumb(side: Side): HTMLElement {
		const el = part(document.createElement("div"), `thumb-${side}`);
		el.setAttribute("data-neo-slider-thumb", "");
		el.setAttribute(`data-neo-slider-thumb-${side}`, "");
		el.setAttribute("role", "slider");
		el.setAttribute("tabindex", "0");
		el.addEventListener("keydown", (e: Event) => this.#onThumbKeyDown(e as KeyboardEvent, side));
		el.addEventListener("transitionend", this.#onThumbTransitionEnd);
		if (side === "min") {
			el.addEventListener("pointerenter", this.#onMinThumbHoverChange);
			el.addEventListener("pointerleave", this.#onMinThumbHoverChange);
		}
		return el;
	}

	#onMinThumbHoverChange = () => {
		this.#syncActiveMarkLabelVisibility();
	};

	// Build a [data-neo-tooltip-host] wrapping the thumb and its controller.
	// Both are returned so #render assigns the fields where the control-flow
	// analysis can see it (the caller wires connect()).
	#wrapTooltip(thumb: HTMLElement, initialValue: number): { host: HTMLElement; ctrl: TooltipController } {
		const tip = document.createElement("div");
		tip.setAttribute("data-neo-tooltip-host", "");
		tip.setAttribute("placement", "top");
		tip.setAttribute("hover-open-delay", "0");
		tip.setAttribute("data-neo-slider-thumb-host", "");
		tip.setAttribute("text", formatNumber(initialValue, this.step));
		tip.appendChild(thumb);
		return { host: tip, ctrl: new TooltipController(tip) };
	}

	#rebuild() {
		this.#stopTooltipTracking();
		this.#rendered = false;
		this.#render();
		this.#syncAll();
	}

	#syncAll() {
		this.#syncLabel();
		this.#syncUnit();
		this.#syncValueVisibility();
		this.#syncHeaderVisibility();
		this.#syncEasing();
		this.#syncDisabled();
		this.#syncValues();
	}

	// Set the transition var on the shadow track (the common ancestor of
	// fill + thumbs, so it inherits to all three), NOT the host. A Datastar
	// fat-morph of the bare light host reconciles its attributes to the
	// source, which has no `style`. Putting it on the host would strip the
	// transition on every morph and snap instead of easing. The shadow tree
	// is untouched by the morph.
	#syncEasing() {
		if (!this.#trackEl) return;
		const raw = this.getAttribute(ATTR_EASING);
		if (raw === null) {
			this.#trackEl.style.removeProperty("--neo-slider-thumb-transition");
			return;
		}
		const trimmed = raw.trim() || "200ms";
		const value = /\s/.test(trimmed) ? trimmed : `${trimmed} var(--neo-easing, ease)`;
		this.#trackEl.style.setProperty("--neo-slider-thumb-transition", value);
	}

	#syncValueVisibility() {
		if (!this.#outputEl) return;
		const hidden = boolAttr(this, ATTR_HIDE_VALUE, false);
		this.#outputEl.style.display = hidden ? "none" : "";
		for (const el of [this.#valueMinEl, this.#valueMaxEl]) {
			if (!el) continue;
			if (hidden) {
				el.setAttribute("tabindex", "-1");
				el.setAttribute("aria-hidden", "true");
			} else {
				el.removeAttribute("aria-hidden");
			}
		}
		if (!hidden) this.#syncDisabled();
	}

	#syncHeaderVisibility() {
		if (!this.#headerEl) return;
		const labelHidden = (this.getAttribute(ATTR_LABEL) ?? "") === "";
		const valueHidden = boolAttr(this, ATTR_HIDE_VALUE, false);
		this.#headerEl.style.display = labelHidden && valueHidden ? "none" : "";
	}

	#syncLabel() {
		if (!this.#labelEl) return;
		const label = this.getAttribute(ATTR_LABEL) ?? "";
		this.#labelEl.textContent = label;
		this.#labelEl.style.display = label === "" ? "none" : "";
	}

	#syncUnit() {
		if (!this.#unitEl) return;
		const unit = this.getAttribute(ATTR_UNIT) ?? "";
		this.#unitEl.textContent = unit;
		this.#unitEl.style.display = unit === "" ? "none" : "";
	}

	#syncDisabled() {
		const dis = boolAttr(this, ATTR_DISABLED, false);
		this.setAttribute("aria-disabled", String(dis));
		for (const el of [this.#valueMinEl, this.#valueMaxEl]) {
			if (!el) continue;
			el.setAttribute("contenteditable", dis ? "false" : "plaintext-only");
			el.setAttribute("tabindex", dis ? "-1" : "0");
		}
		for (const el of [this.#thumbMinEl, this.#thumbMaxEl]) {
			if (!el) continue;
			el.setAttribute("aria-disabled", String(dis));
			el.setAttribute("tabindex", dis ? "-1" : "0");
		}
	}

	#isVertical(): boolean {
		return boolAttr(this, ATTR_VERTICAL, false);
	}

	#syncValues() {
		const lo = this.valueMin;
		const hi = this.valueMax;
		const min = this.min;
		const max = this.max;
		const span = max - min;
		const step = this.step;
		const loFmt = formatNumber(lo, step);
		const hiFmt = formatNumber(hi, step);

		// The value fields live in the shadow, so `document.activeElement`
		// retargets to the host; read focus from the shadow root to avoid
		// stomping the user's typing.
		const active = this.shadowRoot?.activeElement;
		if (this.#valueMinEl && active !== this.#valueMinEl) {
			this.#valueMinEl.textContent = loFmt;
		}
		if (this.#valueMaxEl && active !== this.#valueMaxEl) {
			this.#valueMaxEl.textContent = hiFmt;
		}

		const orientation = this.#isVertical() ? "vertical" : "horizontal";
		// Prefer the visible `label`; fall back to the host's `aria-label`
		// so a slider-range with only an aria-label still names its
		// controls. Empty falls through to "Minimum"/"Maximum".
		const labelText = this.getAttribute(ATTR_LABEL) || this.getAttribute("aria-label") || "";
		const minName = labelText ? `${labelText} minimum` : "Minimum";
		const maxName = labelText ? `${labelText} maximum` : "Maximum";
		if (this.#thumbMinEl) {
			this.#thumbMinEl.setAttribute("aria-orientation", orientation);
			this.#thumbMinEl.setAttribute("aria-valuemin", String(min));
			this.#thumbMinEl.setAttribute("aria-valuemax", String(max));
			this.#thumbMinEl.setAttribute("aria-valuenow", String(lo));
			this.#thumbMinEl.setAttribute("aria-label", minName);
		}
		if (this.#thumbMaxEl) {
			this.#thumbMaxEl.setAttribute("aria-orientation", orientation);
			this.#thumbMaxEl.setAttribute("aria-valuemin", String(min));
			this.#thumbMaxEl.setAttribute("aria-valuemax", String(max));
			this.#thumbMaxEl.setAttribute("aria-valuenow", String(hi));
			this.#thumbMaxEl.setAttribute("aria-label", maxName);
		}
		// The editable value spans carry role="spinbutton", which is an
		// input role, so they need their own accessible name plus
		// aria-valuemin/valuemax/valuenow. The min spinbutton's range is
		// capped at the current max thumb (and vice versa), mirroring the
		// edit-commit clamping in onValueBlur.
		if (this.#valueMinEl) {
			this.#valueMinEl.setAttribute("aria-valuemin", String(min));
			this.#valueMinEl.setAttribute("aria-valuemax", String(hi));
			this.#valueMinEl.setAttribute("aria-valuenow", String(lo));
			this.#valueMinEl.setAttribute("aria-label", minName);
		}
		if (this.#valueMaxEl) {
			this.#valueMaxEl.setAttribute("aria-valuemin", String(lo));
			this.#valueMaxEl.setAttribute("aria-valuemax", String(max));
			this.#valueMaxEl.setAttribute("aria-valuenow", String(hi));
			this.#valueMaxEl.setAttribute("aria-label", maxName);
		}

		const loPct = span > 0 ? ((lo - min) / span) * 100 : 0;
		const hiPct = span > 0 ? ((hi - min) / span) * 100 : 100;

		if (this.#isVertical()) {
			if (this.#fillEl) {
				// Anchor bottom+top so insets position both ends of the band.
				this.#fillEl.style.left = "";
				this.#fillEl.style.right = "";
				this.#fillEl.style.width = "";
				this.#fillEl.style.bottom = `${loPct}%`;
				this.#fillEl.style.top = `${100 - hiPct}%`;
				this.#fillEl.style.height = "";
			}
			if (this.#thumbMinEl) {
				this.#thumbMinEl.style.left = "";
				this.#thumbMinEl.style.bottom = `${loPct}%`;
			}
			if (this.#thumbMaxEl) {
				this.#thumbMaxEl.style.left = "";
				this.#thumbMaxEl.style.bottom = `${hiPct}%`;
			}
		} else {
			if (this.#fillEl) {
				this.#fillEl.style.top = "";
				this.#fillEl.style.bottom = "";
				this.#fillEl.style.height = "";
				this.#fillEl.style.left = `${loPct}%`;
				this.#fillEl.style.right = `${100 - hiPct}%`;
				this.#fillEl.style.width = "";
			}
			if (this.#thumbMinEl) {
				this.#thumbMinEl.style.bottom = "";
				this.#thumbMinEl.style.left = `${loPct}%`;
			}
			if (this.#thumbMaxEl) {
				this.#thumbMaxEl.style.bottom = "";
				this.#thumbMaxEl.style.left = `${hiPct}%`;
			}
		}

		if (this.#tooltipMinCtrl) {
			this.#tooltipMinCtrl.setText(loFmt);
			this.#tooltipMinCtrl.reposition();
		}
		if (this.#tooltipMaxCtrl) {
			this.#tooltipMaxCtrl.setText(hiFmt);
			this.#tooltipMaxCtrl.reposition();
		}
		this.#trackTooltipWhileThumbsMove();

		this.#syncMarkActive(lo, hi);
	}

	#trackTooltipWhileThumbsMove() {
		if (!this.hasAttribute(ATTR_EASING)) return;
		if (this.hasAttribute("data-neo-slider-dragging")) return;
		const hasOpenTooltip = this.#tooltipMinEl?.hasAttribute("open") || this.#tooltipMaxEl?.hasAttribute("open");
		if (!hasOpenTooltip) return;
		if (this.#tooltipTrackFrame !== null) return;
		this.#tooltipTrackStartedAt = performance.now();
		const tick = () => {
			this.#tooltipTrackFrame = null;
			const minOpen = this.#tooltipMinEl?.hasAttribute("open");
			const maxOpen = this.#tooltipMaxEl?.hasAttribute("open");
			if (!minOpen && !maxOpen) return;
			if (minOpen) this.#tooltipMinCtrl?.reposition();
			if (maxOpen) this.#tooltipMaxCtrl?.reposition();
			if (performance.now() - this.#tooltipTrackStartedAt > 2000) return;
			this.#tooltipTrackFrame = window.requestAnimationFrame(tick);
		};
		this.#tooltipTrackFrame = window.requestAnimationFrame(tick);
	}

	#stopTooltipTracking() {
		if (this.#tooltipTrackFrame === null) return;
		window.cancelAnimationFrame(this.#tooltipTrackFrame);
		this.#tooltipTrackFrame = null;
	}

	#onThumbTransitionEnd = (e: TransitionEvent) => {
		if (e.propertyName !== (this.#isVertical() ? "bottom" : "left")) return;
		this.#tooltipMinCtrl?.reposition();
		this.#tooltipMaxCtrl?.reposition();
		this.#stopTooltipTracking();
	};

	#clamp(v: number, lo: number, hi: number): number {
		if (!Number.isFinite(v)) return lo;
		return Math.min(hi, Math.max(lo, v));
	}

	// Clamp to [lo, hi] and snap to the step grid anchored at the
	// GLOBAL min (not lo), so both thumbs share aligned ticks
	// regardless of which bound is supplied. Then trim FP debris.
	#clampSnap(v: number, lo: number, hi: number): number {
		if (!Number.isFinite(v)) return lo;
		const step = this.step;
		const baseMin = this.min;
		let x = Math.min(hi, Math.max(lo, v));
		const k = Math.round((x - baseMin) / step);
		x = baseMin + k * step;
		x = Math.min(hi, Math.max(lo, x));
		const decimals = decimalDigits(step);
		return Number(x.toFixed(decimals));
	}

	#commit(side: Side, v: number, kind: "input" | "change", opts: { snap?: boolean } = {}): Side {
		const beforeLo = this.valueMin;
		const beforeHi = this.valueMax;
		let nextLo = beforeLo;
		let nextHi = beforeHi;
		let nextSide = side;
		const snap = opts.snap !== false;
		const proposed = snap ? this.#clampSnap(v, this.min, this.max) : this.#clamp(v, this.min, this.max);

		if (side === "min") {
			if (proposed <= beforeHi) {
				nextLo = proposed;
			} else {
				nextLo = beforeHi;
				nextHi = proposed;
				nextSide = "max";
			}
		} else {
			if (proposed >= beforeLo) {
				nextHi = proposed;
			} else {
				nextLo = proposed;
				nextHi = beforeLo;
				nextSide = "min";
			}
		}

		const changed = nextLo !== beforeLo || nextHi !== beforeHi;
		if (changed) {
			// nextLo/nextHi are already ordered; store the sorted pair and
			// reflect+render through the single value writer.
			this.#valueMinIntent = nextLo;
			this.#valueMaxIntent = nextHi;
			this.#reflectValues();
			this.#syncValues();
		} else {
			// No value change, but typed text may diverge from the committed
			// value (e.g. "9" with min=10), so re-sync.
			this.#syncValues();
		}
		this.dispatchEvent(
			new CustomEvent(`neo-slider-range-${kind}`, {
				bubbles: true,
				detail: { min: nextLo, max: nextHi },
			}),
		);
		return nextSide;
	}

	#allowsNegative(): boolean {
		return this.min < 0;
	}

	#allowsDecimal(): boolean {
		return this.step % 1 !== 0;
	}

	#onValueFocus = (side: Side) => {
		const el = side === "min" ? this.#valueMinEl : this.#valueMaxEl;
		if (!el) return;
		const r = document.createRange();
		r.selectNodeContents(el);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(r);
	};

	#onValueBeforeInput = (e: InputEvent, side: Side) => {
		if (boolAttr(this, ATTR_DISABLED, false)) {
			e.preventDefault();
			return;
		}
		if (e.inputType.startsWith("delete")) return;
		const data = e.data ?? "";
		if (data === "") return;
		if (!this.#isAllowedRun(data)) {
			e.preventDefault();
			return;
		}
		const el = side === "min" ? this.#valueMinEl : this.#valueMaxEl;
		if (!el) return;
		const next = projectInsertion(el, data);
		if (!this.#isPartialNumber(next)) e.preventDefault();
	};

	#isAllowedRun(s: string): boolean {
		for (const ch of s) {
			if (ch >= "0" && ch <= "9") continue;
			if (ch === "-" && this.#allowsNegative()) continue;
			if (ch === "." && this.#allowsDecimal()) continue;
			return false;
		}
		return true;
	}

	#isPartialNumber(s: string): boolean {
		if (s === "" || s === "-" || s === "." || s === "-.") return true;
		const re = this.#allowsNegative()
			? this.#allowsDecimal()
				? /^-?\d*\.?\d*$/
				: /^-?\d*$/
			: this.#allowsDecimal()
				? /^\d*\.?\d*$/
				: /^\d*$/;
		return re.test(s);
	}

	#onValueKeyDown = (e: KeyboardEvent, side: Side) => {
		if (boolAttr(this, ATTR_DISABLED, false)) return;
		const el = side === "min" ? this.#valueMinEl : this.#valueMaxEl;
		if (e.key === "Enter") {
			e.preventDefault();
			el?.blur();
		} else if (e.key === "Escape") {
			e.preventDefault();
			const v = side === "min" ? this.valueMin : this.valueMax;
			if (el) el.textContent = formatNumber(v, this.step);
			el?.blur();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const cur = side === "min" ? this.valueMin : this.valueMax;
			const nextSide = this.#commit(side, cur + this.step * (e.shiftKey ? 10 : 1), "change");
			if (nextSide !== side) this.#focusValue(nextSide);
			this.#refreshValueText(nextSide);
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			const cur = side === "min" ? this.valueMin : this.valueMax;
			const nextSide = this.#commit(side, cur - this.step * (e.shiftKey ? 10 : 1), "change");
			if (nextSide !== side) this.#focusValue(nextSide);
			this.#refreshValueText(nextSide);
		}
	};

	#focusValue(side: Side) {
		const el = side === "min" ? this.#valueMinEl : this.#valueMaxEl;
		el?.focus();
	}

	#refreshValueText(side: Side) {
		const el = side === "min" ? this.#valueMinEl : this.#valueMaxEl;
		if (!el) return;
		const v = side === "min" ? this.valueMin : this.valueMax;
		el.textContent = formatNumber(v, this.step);
		const r = document.createRange();
		r.selectNodeContents(el);
		r.collapse(false);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(r);
	}

	#onValueBlur = (side: Side) => {
		const el = side === "min" ? this.#valueMinEl : this.#valueMaxEl;
		const raw = (el?.textContent ?? "").trim();
		const parsed = Number(raw);
		if (raw === "" || !Number.isFinite(parsed)) {
			const v = side === "min" ? this.valueMin : this.valueMax;
			if (el) el.textContent = formatNumber(v, this.step);
			return;
		}
		this.#commit(side, parsed, "change");
	};

	#onThumbKeyDown = (e: KeyboardEvent, side: Side) => {
		if (boolAttr(this, ATTR_DISABLED, false)) return;
		const cur = side === "min" ? this.valueMin : this.valueMax;
		const big = this.step * 10;
		let next: number | null = null;
		switch (e.key) {
			case "ArrowLeft":
			case "ArrowDown":
				next = cur - this.step;
				break;
			case "ArrowRight":
			case "ArrowUp":
				next = cur + this.step;
				break;
			case "PageDown":
				next = cur - big;
				break;
			case "PageUp":
				next = cur + big;
				break;
			case "Home":
				next = this.min;
				break;
			case "End":
				next = this.max;
				break;
		}
		if (next !== null) {
			e.preventDefault();
			const nextSide = this.#commit(side, next, "change");
			if (nextSide !== side) this.#activateSide(nextSide);
		}
	};

	#activateSide(side: Side) {
		const thumb = side === "min" ? this.#thumbMinEl : this.#thumbMaxEl;
		thumb?.focus();
		this.#showSide(side);
	}

	#showSide(side: Side) {
		const ctrl = side === "min" ? this.#tooltipMinCtrl : this.#tooltipMaxCtrl;
		ctrl?.show();
	}

	// Press ON a thumb forces that thumb; otherwise pick the closer one
	// in value-space. Clicks below value-min always pick low; above
	// value-max always pick high.
	#pickThumb(target: EventTarget | null, valueAtClick: number): Side {
		const t = target as Element | null;
		if (t?.closest("[data-neo-slider-thumb-min]")) return "min";
		if (t?.closest("[data-neo-slider-thumb-max]")) return "max";
		if (valueAtClick <= this.valueMin) return "min";
		if (valueAtClick >= this.valueMax) return "max";
		const dLo = Math.abs(valueAtClick - this.valueMin);
		const dHi = Math.abs(valueAtClick - this.valueMax);
		return dLo <= dHi ? "min" : "max";
	}

	// Anchor dot click (post-drag clicks are suppressed by the
	// browser). Commits the mark's exact value with no step-snap so
	// off-step marks survive the round-trip.
	#onAnchorClick = (e: MouseEvent) => {
		if (boolAttr(this, ATTR_DISABLED, false)) return;
		if (boolAttr(this, ATTR_STATIC_MARKS, false)) return;
		const target = (e.target as Element | null)?.closest("[data-neo-slider-anchor]");
		if (!target || !this.#trackEl?.contains(target)) return;
		const v = readMarkValue(target);
		if (v === null) return;
		const side = this.#pickThumb(null, v);
		this.#commit(side, v, "change", { snap: false });
	};

	#onTrackMarkPointerMove = (e: PointerEvent) => {
		const value = markValueNearPointer(this.#trackEl, MARK_CFG, this.#isVertical(), e.clientX, e.clientY);
		syncHoveredMarkLabel(this.#marksEl, MARK_CFG, value);
	};

	#onTrackMarkPointerLeave = () => {
		syncHoveredMarkLabel(this.#marksEl, MARK_CFG, null);
	};

	#onMarkLabelPointerMove = (e: PointerEvent) => {
		const target = (e.target as Element | null)?.closest("[data-neo-slider-mark-label]");
		const value = target && this.#marksEl?.contains(target) ? target.getAttribute("data-neo-mark-value") : null;
		syncHoveredMarkLabel(this.#marksEl, MARK_CFG, value);
	};

	#onMarkLabelPointerLeave = () => {
		syncHoveredMarkLabel(this.#marksEl, MARK_CFG, null);
	};

	#onMarkLabelClick = (e: MouseEvent) => {
		if (boolAttr(this, ATTR_DISABLED, false)) return;
		if (boolAttr(this, ATTR_STATIC_MARKS, false)) return;
		const target = (e.target as Element | null)?.closest("[data-neo-slider-mark-label]");
		if (!target || !this.#marksEl?.contains(target)) return;
		const v = readMarkValue(target);
		if (v === null) return;
		const side = this.#pickThumb(null, v);
		this.#commit(side, v, "change", { snap: false });
	};

	#onTrackPointerDown = (e: PointerEvent) => {
		if (boolAttr(this, ATTR_DISABLED, false)) return;
		if (e.button !== 0) return;
		if (!this.#trackEl) return;
		// Don't hijack presses inside the contenteditable value field:
		// user intent is text editing, not scrubbing.
		if ((e.target as Element | null)?.closest("[data-neo-slider-value]")) return;
		e.preventDefault();
		const valueAtClick = this.#valueAtPointer(e.clientX, e.clientY);
		const which = this.#pickThumb(e.target, valueAtClick);
		this.#dragWhich = which;
		this.#activateSide(which);
		try {
			this.#trackEl.setPointerCapture(e.pointerId);
		} catch {
			// Best-effort; pointermove still works without capture.
		}
		this.#dragPointerId = e.pointerId;
		this.#dragStartX = e.clientX;
		this.#dragStartY = e.clientY;
		this.#dragStarted = false;
		this.#trackEl.addEventListener("pointermove", this.#onTrackPointerMove);
		this.#trackEl.addEventListener("pointerup", this.#onTrackPointerUp);
		this.#trackEl.addEventListener("pointercancel", this.#onTrackPointerCancel);
		this.#trackEl.addEventListener("lostpointercapture", this.#onTrackLostPointerCapture);
		const nextSide = this.#commit(which, valueAtClick, "input");
		if (nextSide !== which) {
			this.#dragWhich = nextSide;
			this.#activateSide(nextSide);
		}
	};

	#onTrackPointerMove = (e: PointerEvent) => {
		if (e.pointerId !== this.#dragPointerId) return;
		if (this.#dragWhich === null) return;
		if ((e.buttons & 1) === 0) {
			this.#endDrag();
			return;
		}
		if (!this.#dragStarted) {
			const delta = this.#isVertical()
				? Math.abs(e.clientY - this.#dragStartY)
				: Math.abs(e.clientX - this.#dragStartX);
			if (delta < 4) return;
			this.#dragStarted = true;
			this.setAttribute("data-neo-slider-dragging", "");
		}
		this.#showSide(this.#dragWhich);
		const nextSide = this.#commit(this.#dragWhich, this.#valueAtPointer(e.clientX, e.clientY), "input");
		if (nextSide !== this.#dragWhich) {
			this.#dragWhich = nextSide;
			this.#activateSide(nextSide);
		}
	};

	#onTrackPointerUp = (e: PointerEvent) => {
		if (e.pointerId !== this.#dragPointerId) return;
		if (this.#dragWhich !== null) {
			this.#dragWhich = this.#commit(this.#dragWhich, this.#valueAtPointer(e.clientX, e.clientY), "change");
		}
		this.#endDrag();
	};

	#onTrackPointerCancel = (e: PointerEvent) => {
		if (e.pointerId !== this.#dragPointerId) return;
		this.#endDrag();
	};

	#onTrackLostPointerCapture = (e: PointerEvent) => {
		if (e.pointerId !== this.#dragPointerId) return;
		this.#endDrag();
	};

	#endDrag() {
		if (this.#dragPointerId === null) return;
		try {
			if (this.#trackEl?.hasPointerCapture(this.#dragPointerId)) {
				this.#trackEl.releasePointerCapture(this.#dragPointerId);
			}
		} catch {
			// May already have been released by the platform.
		}
		this.#trackEl?.removeEventListener("pointermove", this.#onTrackPointerMove);
		this.#trackEl?.removeEventListener("pointerup", this.#onTrackPointerUp);
		this.#trackEl?.removeEventListener("pointercancel", this.#onTrackPointerCancel);
		this.#trackEl?.removeEventListener("lostpointercapture", this.#onTrackLostPointerCapture);
		this.#dragPointerId = null;
		this.#dragWhich = null;
		this.#dragStarted = false;
		this.removeAttribute("data-neo-slider-dragging");
		this.#tooltipMinCtrl?.reposition();
		this.#tooltipMaxCtrl?.reposition();
	}

	#valueAtPointer(clientX: number, clientY: number): number {
		if (!this.#trackEl) return this.min;
		const rect = this.#trackEl.getBoundingClientRect();
		const vertical = this.#isVertical();
		const spanPx = vertical ? rect.height : rect.width;
		if (spanPx <= 0) return this.min;
		const t = vertical ? (rect.bottom - clientY) / spanPx : (clientX - rect.left) / spanPx;
		const clamped = Math.min(1, Math.max(0, t));
		return this.min + clamped * (this.max - this.min);
	}
}

// Tag a shadow element with a `part` name so page CSS can style it through
// the shadow boundary via neo-slider-range::part(<name>).
function part<E extends Element>(el: E, name: string): E {
	el.setAttribute("part", name);
	return el;
}

// Read `data-neo-mark-value`; returns null for missing/unparseable
// so click handlers can bail cleanly.
function readMarkValue(el: Element): number | null {
	const raw = el.getAttribute("data-neo-mark-value");
	if (raw === null) return null;
	const v = Number(raw);
	return Number.isFinite(v) ? v : null;
}

function decimalDigits(step: number): number {
	if (!Number.isFinite(step) || step <= 0) return 0;
	const s = String(step);
	const dot = s.indexOf(".");
	if (dot < 0) {
		const exp = s.indexOf("e-");
		return exp < 0 ? 0 : Number(s.slice(exp + 2)) || 0;
	}
	return s.length - dot - 1;
}

function formatNumber(v: number, step: number): string {
	return v.toFixed(decimalDigits(step));
}

function projectInsertion(el: HTMLElement, insert: string): string {
	const text = el.textContent ?? "";
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return text + insert;
	const r = sel.getRangeAt(0);
	if (!el.contains(r.startContainer) && el !== r.startContainer) {
		return text + insert;
	}
	const start = textOffset(el, r.startContainer, r.startOffset);
	const end = textOffset(el, r.endContainer, r.endOffset);
	return text.slice(0, start) + insert + text.slice(end);
}

function textOffset(root: HTMLElement, node: Node, offset: number): number {
	if (node === root) {
		let n = 0;
		for (let i = 0; i < offset && i < root.childNodes.length; i++) {
			n += root.childNodes[i].textContent?.length ?? 0;
		}
		return n;
	}
	let n = 0;
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	while (walker.nextNode()) {
		const t = walker.currentNode as Text;
		if (t === node) return n + offset;
		n += t.textContent?.length ?? 0;
	}
	return n;
}

if (!customElements.get("neo-slider-range")) {
	customElements.define("neo-slider-range", NeoSliderRange);
}
