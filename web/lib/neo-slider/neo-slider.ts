// Internals render into a shadow root on connect with no <slot>, so a fat
// morph of the light host keeps the same thumb and fill nodes and the
// `easing` transition runs instead of rebuilding and snapping. The focusable
// thumb (role="slider") and value field (role="spinbutton") live in the
// shadow.

import { boolAttr } from "../command";
import {
	collectMarks,
	type MarkRailConfig,
	type MarkSpec,
	markValueNearPointer,
	measureMarkLabelOverlaps,
	renderMarks as renderMarkRail,
	syncActiveMarkLabelVisibility,
	syncHoveredMarkLabel,
	syncMarkActive as syncMarkRailActive,
} from "../neo-marks";
import tooltipCss from "../neo-tooltip/tooltip-pill.css";
import { num } from "../num";
import { scopeCssToHost, setTextInPlace } from "../shadow-utils";
import { TooltipController } from "../tooltip-controller";
import sliderCss from "./neo-slider.css";

const ATTR_MIN = "min";
const ATTR_MAX = "max";
const ATTR_STEP = "step";
const ATTR_VALUE = "value";
const ATTR_LABEL = "label";
const ATTR_UNIT = "unit";
const ATTR_HIDE_VALUE = "hide-value";
const ATTR_HIDE_TOOLTIP = "hide-tooltip";
const ATTR_VERTICAL = "vertical";
const ATTR_STATIC_MARKS = "static-marks";
const ATTR_MARKS_ONLY = "marks-only";
const ATTR_EASING = "easing";
const ATTR_DISABLED = "disabled";
const ATTR_RENDERING = "data-neo-slider-rendering";

const MARK_CFG: MarkRailConfig = {
	markAttr: "data-neo-slider-mark",
	anchorAttr: "data-neo-slider-anchor",
	markLabelAttr: "data-neo-slider-mark-label",
	anchorPart: "anchor",
};

// The whole module stylesheet, tag selectors rewritten to `:host`,
// adopted into every instance's shadow root. Built once and shared. The
// internals live in the shadow so a fat morph of the light host
// can't wipe them. The thumb / fill nodes persist, so an `easing`
// transition runs on a plain `value` change instead of snapping after a
// rebuild. The tooltip pill CSS is adopted here too because the thumb's
// [data-neo-tooltip-host] bubble lives inside this shadow root and global
// tooltip rules cannot reach it.
const SHEET = new CSSStyleSheet();
SHEET.replaceSync(`${scopeCssToHost(sliderCss, "neo-slider")}\n${tooltipCss}`);

export class NeoSlider extends HTMLElement {
	static readonly observedAttributes = [
		ATTR_MIN,
		ATTR_MAX,
		ATTR_STEP,
		ATTR_VALUE,
		ATTR_LABEL,
		ATTR_UNIT,
		ATTR_HIDE_VALUE,
		ATTR_HIDE_TOOLTIP,
		ATTR_VERTICAL,
		ATTR_STATIC_MARKS,
		ATTR_MARKS_ONLY,
		ATTR_EASING,
		ATTR_DISABLED,
		ATTR_RENDERING,
		// Observed so a runtime aria-label change refreshes the derived
		// aria-label on the thumb / value field (see #syncAriaMeta).
		"aria-label",
	];

	#rendered = false;
	#headerEl: HTMLElement | null = null;
	#labelEl: HTMLElement | null = null;
	#outputEl: HTMLElement | null = null;
	#valueEl: HTMLElement | null = null;
	#unitEl: HTMLElement | null = null;
	#trackEl: HTMLElement | null = null;
	#fillEl: HTMLElement | null = null;
	#thumbEl: HTMLElement | null = null;
	// Host element wrapping the thumb; the controller drives the value
	// bubble on it without a registered <neo-tooltip>. Null when hide-tooltip.
	#tooltipEl: HTMLElement | null = null;
	#tooltipCtrl: TooltipController | null = null;
	#marksEl: HTMLElement | null = null;
	#dragPointerId: number | null = null;
	#dragStartX = 0;
	#dragStartY = 0;
	#dragStarted = false;
	// Track rect captured once at drag start. Reading it per pointermove
	// forces a synchronous layout each move; on a heavy page that reflow is
	// expensive. The track can't move under a captured pointer, so cache it
	// and only re-read on scroll/resize.
	#dragTrackRect: DOMRect | null = null;
	// Thumb position (%) when the current drag crossed its threshold; the
	// tooltip follows by shifting from this baseline (see #syncValue).
	#followBasePct = 0;
	#marks: MarkSpec[] = [];
	// Count of active marks (value <= current) at the last mark sync; -1 forces
	// the next #syncMarkActive to run. Reset on re-render.
	#lastActiveMarkCount = -1;
	#anchorTemplate: DocumentFragment | null = null;
	#thumbTemplate: DocumentFragment | null = null;
	#childObserver: MutationObserver | null = null;
	#renderTransitionTimer: number | null = null;
	#tooltipTrackFrame: number | null = null;
	#tooltipTrackStartedAt = 0;
	#markResizeObserver: ResizeObserver | null = null;
	#markLayoutFrame: number | null = null;
	// Source of truth for the value (clamped live by `get value`). The
	// attribute is a state mirror, not the store: a fat morph that strips
	// `value` must keep the thumb where it is, so intent survives across
	// re-connects when the attribute is absent.
	#valueIntent = NaN;
	// Guards our own reflect writes so attributeChangedCallback doesn't read
	// them back as an external command.
	#reflectingValue = false;

	connectedCallback() {
		if (!this.shadowRoot) {
			const root = this.attachShadow({ mode: "open" });
			root.adoptedStyleSheets = [SHEET];
		}
		// Seed intent from the attribute, but keep a prior value when the
		// attribute is absent on a re-connect (morph that stripped `value`).
		const attr = this.getAttribute(ATTR_VALUE);
		if (attr !== null) this.#valueIntent = this.#clamp(num(attr, this.min));
		else if (!Number.isFinite(this.#valueIntent)) this.#valueIntent = this.min;
		this.#render();
		// On a reconnect #render early-returns (internals persist), so the
		// tooltip controller disconnected on the prior detach must re-bind
		// its window listeners here. Idempotent when already connected.
		this.#tooltipCtrl?.connect();
		// Rect-invalidators live for the slider's lifetime, not per drag, to
		// avoid churning listener objects on every drag. #invalidateDragRect
		// no-ops unless a drag is active. addEventListener dedupes identical
		// (type, fn, capture), so a reconnect re-adds harmlessly.
		window.addEventListener("scroll", this.#invalidateDragRect, true);
		window.addEventListener("resize", this.#invalidateDragRect);
		this.#syncAll();
		this.#observeMarkLayout();
		this.#scheduleMarkLayoutSync();
		this.#observeChildren();
	}

	disconnectedCallback() {
		this.#endDrag();
		window.removeEventListener("scroll", this.#invalidateDragRect, true);
		window.removeEventListener("resize", this.#invalidateDragRect);
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		this.#markResizeObserver?.disconnect();
		this.#markResizeObserver = null;
		if (this.#markLayoutFrame !== null) {
			window.cancelAnimationFrame(this.#markLayoutFrame);
			this.#markLayoutFrame = null;
		}
		if (this.#renderTransitionTimer !== null) {
			window.clearTimeout(this.#renderTransitionTimer);
			this.#renderTransitionTimer = null;
		}
		this.#stopTooltipTracking();
		this.#tooltipCtrl?.disconnect();
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
			// Apply the current value to the fresh dots/labels; a marks-only
			// morph fires no attribute change, so nothing else runs #syncValue
			// and the active state would wait until the first interaction.
			this.#syncValue();
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
		if (name === ATTR_RENDERING) {
			if (newValue !== null && this.#rendered && this.#headerEl) {
				this.#releaseRenderTransitionSuppression();
			}
			return;
		}
		if (name === ATTR_VALUE) {
			// Our own guarded reflect write; not an external command.
			if (this.#reflectingValue) return;
			// Absent: no command, keep the current value; re-reflect so a
			// morph that stripped `value` can't reset the thumb to min.
			if (newValue === null) {
				this.#writeValue(this.value);
				return;
			}
			// Ignore a write that matches the current value. A two-way binding
			// echoes every drag `input` back into this attribute; without this
			// guard each move runs #syncValue twice (24 setAttribute + 5
			// querySelectorAll per move).
			const parsed = this.#clamp(num(newValue, this.value));
			if (parsed !== this.value) this.#writeValue(parsed);
			return;
		}
		if (!this.#rendered) return;
		if (name === ATTR_LABEL) {
			this.#syncLabel();
			this.#syncHeaderVisibility();
			this.#syncAriaMeta();
		} else if (name === "aria-label") this.#syncAriaMeta();
		else if (name === ATTR_UNIT) this.#syncUnit();
		else if (name === ATTR_HIDE_VALUE) {
			this.#syncValueVisibility();
			this.#syncHeaderVisibility();
		} else if (name === ATTR_HIDE_TOOLTIP) this.#rebuild();
		else if (name === ATTR_VERTICAL) {
			this.#renderMarks();
			this.#syncAriaMeta();
			this.#syncValue();
		} else if (name === ATTR_EASING) this.#syncEasing();
		else if (name === ATTR_DISABLED) this.#syncDisabled();
		else if (name === ATTR_MIN || name === ATTR_MAX) {
			// Mark positions depend on min/max.
			this.#renderMarks();
			this.#syncAriaMeta();
			this.#syncValue();
		} else this.#syncValue();
	}

	get min(): number {
		return num(this.getAttribute(ATTR_MIN), 0);
	}

	get max(): number {
		const m = num(this.getAttribute(ATTR_MAX), 100);
		// Guard max <= min: percentage math divides by (max - min).
		return m > this.min ? m : this.min + 1;
	}

	get step(): number {
		const s = num(this.getAttribute(ATTR_STEP), 1);
		return s > 0 ? s : 1;
	}

	get value(): number {
		// Clamp the stored intent live so a later min/max/step change keeps the
		// kept value in range without re-snapping. No step-snapping here: mark
		// clicks commit off-step values verbatim (e.g. a mark at 25 on a
		// step-10 slider) and need to survive the round-trip exactly where the
		// user clicked.
		return this.#clamp(Number.isFinite(this.#valueIntent) ? this.#valueIntent : this.min);
	}

	set value(v: number) {
		this.#writeValue(this.#clampSnap(v));
	}

	// Single value writer: update intent, reflect to the attribute (guarded so
	// it isn't read back as a command), and re-sync the rendered geometry.
	// Every internal value change (drag, click, keyboard, field commit) routes
	// here so the attribute stays a faithful state mirror.
	#writeValue(v: number) {
		this.#valueIntent = v;
		// Skip attribute reflection mid-drag: mutating a light-DOM `value`
		// attribute restyles any page :has() scope keyed on `value`, a
		// document-wide recalc on a large page. Intent + rendered geometry
		// stay live; #endDrag reflects the settled value once.
		if (!this.#dragStarted) this.#reflectValue(v);
		if (this.#rendered) this.#syncValue();
	}

	#reflectValue(v: number) {
		if (this.getAttribute(ATTR_VALUE) === String(v)) return;
		this.#reflectingValue = true;
		try {
			this.setAttribute(ATTR_VALUE, String(v));
		} finally {
			this.#reflectingValue = false;
		}
	}

	#render() {
		if (this.#rendered) return;
		const root = this.shadowRoot;
		if (!root) return;
		this.#rendered = true;
		this.setAttribute(ATTR_RENDERING, "");

		// A rebuild replaces the old tooltip host; drop the stale controller
		// (and its window listeners) before the new host is built below.
		this.#tooltipCtrl?.disconnect();
		this.#tooltipCtrl = null;

		this.#captureUserContent();

		// `part` exposes each internal to page CSS via
		// `neo-slider::part(<name>)`, the only styling hook across the
		// shadow boundary.
		this.#headerEl = part(document.createElement("div"), "header");
		this.#headerEl.setAttribute("data-neo-slider-header", "");

		this.#labelEl = part(document.createElement("span"), "label");
		this.#labelEl.setAttribute("data-neo-slider-label", "");

		this.#outputEl = part(document.createElement("span"), "output");
		this.#outputEl.setAttribute("data-neo-slider-output", "");

		this.#valueEl = part(document.createElement("span"), "value");
		this.#valueEl.setAttribute("data-neo-slider-value", "");
		// plaintext-only blocks formatted paste (no <b>/<br> sneaking in).
		this.#valueEl.setAttribute("contenteditable", "plaintext-only");
		this.#valueEl.setAttribute("inputmode", "decimal");
		this.#valueEl.setAttribute("spellcheck", "false");
		this.#valueEl.setAttribute("autocapitalize", "off");
		this.#valueEl.setAttribute("autocorrect", "off");
		this.#valueEl.setAttribute("role", "spinbutton");
		this.#valueEl.setAttribute("tabindex", "0");

		this.#unitEl = part(document.createElement("span"), "unit");
		this.#unitEl.setAttribute("data-neo-slider-unit", "");

		this.#outputEl.appendChild(this.#valueEl);
		this.#outputEl.appendChild(this.#unitEl);
		this.#headerEl.appendChild(this.#labelEl);
		this.#headerEl.appendChild(this.#outputEl);

		this.#trackEl = part(document.createElement("div"), "track");
		this.#trackEl.setAttribute("data-neo-slider-track", "");

		this.#fillEl = part(document.createElement("div"), "fill");
		this.#fillEl.setAttribute("data-neo-slider-fill", "");
		this.#trackEl.appendChild(this.#fillEl);

		this.#thumbEl = part(document.createElement("div"), "thumb");
		this.#thumbEl.setAttribute("data-neo-slider-thumb", "");
		this.#thumbEl.setAttribute("role", "slider");
		this.#thumbEl.setAttribute("tabindex", "0");
		this.#thumbEl.addEventListener("keydown", this.#onThumbKeyDown);
		this.#thumbEl.addEventListener("transitionend", this.#onThumbTransitionEnd);
		if (this.#thumbTemplate) {
			this.#thumbEl.appendChild(this.#thumbTemplate.cloneNode(true));
		}

		if (boolAttr(this, ATTR_HIDE_TOOLTIP, false)) {
			this.#tooltipEl = null;
			this.#trackEl.appendChild(this.#thumbEl);
		} else {
			// Tooltip host is `display: contents`, so for layout the thumb
			// remains a direct child of the track. A plain element driven by
			// TooltipController, not a registered <neo-tooltip>.
			this.#tooltipEl = document.createElement("div");
			this.#tooltipEl.setAttribute("data-neo-tooltip-host", "");
			this.#tooltipEl.setAttribute("placement", "top");
			this.#tooltipEl.setAttribute("hover-open-delay", "0");
			this.#tooltipEl.setAttribute("data-neo-slider-thumb-host", "");
			// Seed `text` before the controller binds and reads it.
			this.#tooltipEl.setAttribute("text", formatNumber(this.value, this.step));
			this.#tooltipEl.appendChild(this.#thumbEl);
			this.#trackEl.appendChild(this.#tooltipEl);
			this.#tooltipCtrl = new TooltipController(this.#tooltipEl);
		}

		this.#marksEl = part(document.createElement("div"), "marks");
		this.#marksEl.setAttribute("data-neo-slider-marks", "");

		root.replaceChildren(this.#headerEl, this.#trackEl, this.#marksEl);

		// Bind now that the host is in the shadow tree. Idempotent, so the
		// connectedCallback re-connect on a reconnect is a no-op here.
		this.#tooltipCtrl?.connect();

		this.#valueEl.addEventListener("beforeinput", this.#onValueBeforeInput);
		this.#valueEl.addEventListener("keydown", this.#onValueKeyDown);
		this.#valueEl.addEventListener("blur", this.#onValueBlur);
		this.#valueEl.addEventListener("focus", this.#onValueFocus);

		this.#trackEl.addEventListener("pointerdown", this.#onTrackPointerDown);
		this.#trackEl.addEventListener("pointermove", this.#onTrackMarkPointerMove);
		this.#trackEl.addEventListener("pointerleave", this.#onTrackMarkPointerLeave);
		// Drag listeners are bound once here, not per pointerdown. Each
		// addEventListener/removeEventListener pair allocates a listener object
		// that lives until GC, so attaching on every drag churns the heap. All
		// four short-circuit on `#dragPointerId`, so they are inert until a drag
		// is active. The track lives in the shadow and persists across morphs,
		// so these survive a reconnect without re-binding.
		this.#trackEl.addEventListener("pointermove", this.#onTrackPointerMove);
		this.#trackEl.addEventListener("pointerup", this.#onTrackPointerUp);
		this.#trackEl.addEventListener("pointercancel", this.#onTrackPointerCancel);
		this.#trackEl.addEventListener("lostpointercapture", this.#onTrackLostPointerCapture);
		// Delegate from track/marks rather than per-mark listeners. The
		// browser suppresses `click` after a real drag, so this only runs
		// for genuine taps that should snap to the mark's value.
		this.#trackEl.addEventListener("click", this.#onAnchorClick);
		this.#marksEl.addEventListener("click", this.#onMarkLabelClick);
		this.#marksEl.addEventListener("pointermove", this.#onMarkLabelPointerMove);
		this.#marksEl.addEventListener("pointerleave", this.#onMarkLabelPointerLeave);

		this.#renderMarks();
	}

	#rebuild() {
		this.#stopTooltipTracking();
		this.#rendered = false;
		this.#render();
		this.#syncAll();
	}

	#captureUserContent() {
		const anchorTmpl = this.querySelector<HTMLTemplateElement>(":scope > template[data-neo-slider-anchor]");
		this.#anchorTemplate = anchorTmpl ? anchorTmpl.content : null;

		const thumbTmpl = this.querySelector<HTMLTemplateElement>(":scope > template[data-neo-slider-thumb]");
		this.#thumbTemplate = thumbTmpl ? thumbTmpl.content : null;

		this.#marks = collectMarks(this, MARK_CFG);
	}

	#renderMarks() {
		if (!this.#trackEl || !this.#marksEl) return;
		// Dots are rebuilt; force the next #syncMarkActive to re-tag them.
		this.#lastActiveMarkCount = -1;
		renderMarkRail(this.#marks, this.#trackEl, this.#marksEl, {
			min: this.min,
			max: this.max,
			vertical: this.#isVertical(),
			cfg: MARK_CFG,
			// Insert before the thumb host so the thumb paints on top.
			insertDot: (track, dot) => track.insertBefore(dot, this.#tooltipEl ?? this.#thumbEl),
			anchorTemplate: this.#anchorTemplate,
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
			syncActiveMarkLabelVisibility(this.#marksEl, MARK_CFG, "highest");
		});
	}

	#syncAll() {
		this.#syncLabel();
		this.#syncUnit();
		this.#syncValueVisibility();
		this.#syncHeaderVisibility();
		this.#syncEasing();
		this.#syncDisabled();
		this.#syncAriaMeta();
		this.#syncValue();
		this.#releaseRenderTransitionSuppression();
	}

	#releaseRenderTransitionSuppression() {
		if (!this.hasAttribute(ATTR_RENDERING)) return;
		if (this.#renderTransitionTimer !== null) {
			window.clearTimeout(this.#renderTransitionTimer);
		}
		// Keep transitions disabled until the browser has committed the
		// freshly-rendered geometry. The grace window also covers a morph
		// followed by a same-response signal sync delivered separately.
		this.#renderTransitionTimer = window.setTimeout(() => {
			this.#renderTransitionTimer = null;
			this.removeAttribute(ATTR_RENDERING);
		}, 50);
	}

	// Drive the thumb `transition` via `--neo-slider-thumb-transition`.
	// The shadow `:host [easing]` rules consume it, so unset = instant
	// jumps. The drag flow toggles `data-neo-slider-dragging` to disable
	// the transition while a pointer is captured.
	//
	// Set the var on the shadow track (the common ancestor of fill +
	// thumb, so it inherits to both), NOT the host. A fat morph of the
	// bare light host reconciles its attributes to the source,
	// which has no `style`. Putting it on the host would strip the
	// transition on every morph, so the thumb/fill would snap instead of
	// easing. The shadow tree is untouched by the morph.
	#syncEasing() {
		if (!this.#trackEl) return;
		const raw = this.getAttribute(ATTR_EASING);
		if (raw === null) {
			this.#trackEl.style.removeProperty("--neo-slider-thumb-transition");
			return;
		}
		const trimmed = raw.trim() || "200ms";
		// Scale the duration by --neo-duration-scale so reduced motion (the OS
		// query and the manual `data-pref-reduced-motion` toggle both zero it)
		// makes the thumb jump. Live var, so a runtime toggle needs no re-run.
		// A bare duration gets the kit default timing function; a full pair
		// keeps its own.
		const m = trimmed.match(/^(\d*\.?\d+(?:ms|s))\s*(.*)$/);
		const dur = m ? m[1] : "200ms";
		const fn = m?.[2].trim() ? m[2].trim() : "var(--neo-easing, ease)";
		const value = `calc(${dur} * var(--neo-duration-scale, 1)) ${fn}`;
		this.#trackEl.style.setProperty("--neo-slider-thumb-transition", value);
	}

	#syncValueVisibility() {
		if (!this.#outputEl) return;
		const hidden = boolAttr(this, ATTR_HIDE_VALUE, false);
		this.#outputEl.style.display = hidden ? "none" : "";
		if (this.#valueEl) {
			// Pull the field out of the tab order when invisible.
			if (hidden) {
				this.#valueEl.setAttribute("tabindex", "-1");
				this.#valueEl.setAttribute("aria-hidden", "true");
			} else {
				this.#valueEl.removeAttribute("aria-hidden");
				// syncDisabled writes the canonical tabindex; restore via it.
				this.#syncDisabled();
			}
		}
	}

	#syncHeaderVisibility() {
		if (!this.#headerEl) return;
		const labelHidden = (this.getAttribute(ATTR_LABEL) ?? "") === "";
		const valueHidden = boolAttr(this, ATTR_HIDE_VALUE, false);
		// Collapse the header when both pieces are gone, so the slider's
		// `gap` doesn't leave a blank strip above the rail.
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
		if (this.#valueEl) {
			this.#valueEl.setAttribute("contenteditable", dis ? "false" : "plaintext-only");
			this.#valueEl.setAttribute("tabindex", dis ? "-1" : "0");
		}
		if (this.#thumbEl) {
			this.#thumbEl.setAttribute("aria-disabled", String(dis));
			this.#thumbEl.setAttribute("tabindex", dis ? "-1" : "0");
		}
	}

	#isVertical(): boolean {
		return boolAttr(this, ATTR_VERTICAL, false);
	}

	// Static ARIA that depends on min/max/label/orientation, not the live
	// value. Kept out of #syncValue so a drag doesn't rewrite four unchanging
	// attributes per thumb every frame; the relevant attribute handlers and
	// #syncAll call it instead.
	#syncAriaMeta() {
		const accName = this.getAttribute(ATTR_LABEL) || this.getAttribute("aria-label");
		const min = String(this.min);
		const max = String(this.max);
		this.#thumbEl?.setAttribute("aria-orientation", this.#isVertical() ? "vertical" : "horizontal");
		for (const el of [this.#thumbEl, this.#valueEl]) {
			if (!el) continue;
			el.setAttribute("aria-valuemin", min);
			el.setAttribute("aria-valuemax", max);
			if (accName) el.setAttribute("aria-label", accName);
			else el.removeAttribute("aria-label");
		}
	}

	#syncValue() {
		const v = this.value;
		const formatted = formatNumber(v, this.step);
		// Don't stomp the user's typing; re-render text only when the
		// field isn't focused. The value field lives in the shadow, so
		// `document.activeElement` retargets to the host; read focus from
		// the shadow root. Commit handlers re-sync on blur. In-place text
		// update avoids orphaning a text node every drag frame.
		if (this.#valueEl && this.shadowRoot?.activeElement !== this.#valueEl) {
			setTextInPlace(this.#valueEl, formatted);
		}
		// aria-valuenow is the only value-dependent ARIA; the rest is in
		// #syncAriaMeta.
		const now = String(v);
		this.#thumbEl?.setAttribute("aria-valuenow", now);
		this.#valueEl?.setAttribute("aria-valuenow", now);
		const pct = this.#valuePct(v);
		if (this.#isVertical()) {
			if (this.#fillEl) {
				this.#fillEl.style.width = "";
				this.#fillEl.style.height = `${pct}%`;
			}
			if (this.#thumbEl) {
				this.#thumbEl.style.left = "";
				this.#thumbEl.style.bottom = `${pct}%`;
			}
		} else {
			if (this.#fillEl) {
				this.#fillEl.style.height = "";
				this.#fillEl.style.width = `${pct}%`;
			}
			if (this.#thumbEl) {
				this.#thumbEl.style.bottom = "";
				this.#thumbEl.style.left = `${pct}%`;
			}
		}
		if (this.#tooltipCtrl) {
			this.#tooltipCtrl.setText(formatted);
			if (this.#dragStarted && this.#dragTrackRect) {
				// Follow the thumb by shifting the bubble along the drag axis
				// from the drag-start baseline; no getBoundingClientRect, so no
				// forced reflow per frame on a heavy page.
				const move = (pct - this.#followBasePct) / 100;
				if (this.#isVertical()) this.#tooltipCtrl.nudge(0, -move * this.#dragTrackRect.height);
				else this.#tooltipCtrl.nudge(move * this.#dragTrackRect.width, 0);
			} else {
				// Trigger position moved; reposition any open tooltip.
				this.#tooltipCtrl.reposition();
				this.#trackTooltipWhileThumbMoves();
			}
		}
		this.#syncMarkActive(v);
	}

	#valuePct(v: number): number {
		const span = this.max - this.min;
		return span > 0 ? ((v - this.min) / span) * 100 : 0;
	}

	#trackTooltipWhileThumbMoves() {
		if (!this.#tooltipEl?.hasAttribute("open")) return;
		if (!this.hasAttribute(ATTR_EASING)) return;
		if (this.hasAttribute("data-neo-slider-dragging") || this.hasAttribute(ATTR_RENDERING)) {
			return;
		}
		if (this.#tooltipTrackFrame !== null) return;
		this.#tooltipTrackStartedAt = performance.now();
		const tick = () => {
			this.#tooltipTrackFrame = null;
			if (!this.#tooltipEl?.hasAttribute("open")) return;
			this.#tooltipCtrl?.reposition();
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
		this.#tooltipCtrl?.reposition();
		this.#stopTooltipTracking();
	};

	#syncMarkActive(v: number) {
		// A mark is active iff its value <= v, so the active set changes only
		// when v crosses a mark. Skip the querySelectorAll sweep otherwise, so
		// a drag between marks does no mark work. -1 forces the first sync and
		// a re-render (see #renderMarks) to run.
		let active = 0;
		for (const m of this.#marks) if (m.value <= v) active++;
		if (active === this.#lastActiveMarkCount) return;
		this.#lastActiveMarkCount = active;
		syncMarkRailActive(this.#trackEl, this.#marksEl, v, MARK_CFG);
		syncActiveMarkLabelVisibility(this.#marksEl, MARK_CFG, "highest");
	}

	// Clamp without step-snapping; used for mark-click commits where
	// the explicit anchor must not be re-rounded onto the step grid.
	#clamp(v: number): number {
		if (!Number.isFinite(v)) return this.min;
		return Math.min(this.max, Math.max(this.min, v));
	}

	// marks-only active iff at least one mark is declared, so an author
	// who toggles the attr without marks falls back to the step grid
	// rather than a frozen slider.
	#marksOnlyActive(): boolean {
		return boolAttr(this, ATTR_MARKS_ONLY, false) && this.#marks.length > 0;
	}

	// Index of the mark closest to `v`; -1 when none are declared.
	#nearestMarkIndex(v: number): number {
		if (this.#marks.length === 0) return -1;
		let idx = 0;
		let best = Math.abs(v - this.#marks[0].value);
		for (let i = 1; i < this.#marks.length; i++) {
			const d = Math.abs(v - this.#marks[i].value);
			if (d < best) {
				best = d;
				idx = i;
			}
		}
		return idx;
	}

	#snapToMark(v: number): number {
		return this.#clamp(this.#marks[this.#nearestMarkIndex(v)].value);
	}

	// Mark closest to the current value. Navigation primitive for
	// marks-only keyboard nav.
	#currentMarkIndex(): number {
		return this.#nearestMarkIndex(this.value);
	}

	#markValueAt(idx: number): number {
		const i = Math.min(this.#marks.length - 1, Math.max(0, idx));
		return this.#marks[i].value;
	}

	#clampSnap(v: number): number {
		if (!Number.isFinite(v)) return this.min;
		const min = this.min;
		const max = this.max;
		const step = this.step;
		let x = Math.min(max, Math.max(min, v));
		const k = Math.round((x - min) / step);
		x = min + k * step;
		x = Math.min(max, Math.max(min, x));
		// Round away the FP debris (0.1 + 0.2 -> 0.30000000000000004).
		const decimals = decimalDigits(step);
		return Number(x.toFixed(decimals));
	}

	// Commit a value. Defaults to step-snapping (drag/keyboard/typed);
	// pass `snap: false` for mark clicks so the authored anchor value
	// wins even when it sits between steps.
	#commitValue(v: number, kind: "input" | "change", opts: { snap?: boolean } = {}) {
		const before = this.value;
		let next: number;
		if (opts.snap === false) {
			next = this.#clamp(v);
		} else if (this.#marksOnlyActive()) {
			// In marks-only mode the marks ARE the grid; ignore step.
			next = this.#snapToMark(v);
		} else {
			next = this.#clampSnap(v);
		}
		if (next === before) {
			// Value unchanged: revert any diverged typed text (e.g. "9"
			// with min=10 shows "10" again), but emit nothing. Native
			// input/change fire only on an actual value change, so a
			// blur/keydown that doesn't move the value is a no-op. This
			// is what stops a focus→blur of the readout from spuriously
			// committing.
			this.#syncValue();
			return;
		}
		this.#writeValue(next);
		// A committed change settles the attribute even mid-drag, so a
		// `neo-slider-change` listener reading the attribute sees the value.
		// Per-move `input` stays deferred (see #writeValue).
		if (kind === "change") this.#reflectValue(next);
		// `input` is the live mid-drag value; `change` is the committed value
		// (drag end, mark click, keyboard, field edit). See DESIGN.md Events.
		this.dispatchEvent(
			new CustomEvent(kind === "change" ? "neo-slider-change" : "neo-slider-input", {
				bubbles: true,
				detail: { value: next },
			}),
		);
	}

	#allowsNegative(): boolean {
		return this.min < 0;
	}

	#allowsDecimal(): boolean {
		return this.step % 1 !== 0;
	}

	#onValueFocus = () => {
		if (!this.#valueEl) return;
		// Select all on focus so a single keystroke replaces the value,
		// matching native <input type="number"> when tabbed into.
		const r = document.createRange();
		r.selectNodeContents(this.#valueEl);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(r);
	};

	#onValueBeforeInput = (e: InputEvent) => {
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
		// Project the insertion against the current selection and reject
		// anything that wouldn't still parse as a partial number (e.g. a
		// second `.`, or a `-` in the middle of digits).
		if (!this.#valueEl) return;
		const next = projectInsertion(this.#valueEl, data);
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
		// Permit mid-typing states ("", "-", ".", "-.") that don't parse
		// as numbers on their own.
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

	#onValueKeyDown = (e: KeyboardEvent) => {
		if (boolAttr(this, ATTR_DISABLED, false)) return;
		if (e.key === "Enter") {
			e.preventDefault();
			this.#valueEl?.blur();
		} else if (e.key === "Escape") {
			e.preventDefault();
			if (this.#valueEl) {
				this.#valueEl.textContent = formatNumber(this.value, this.step);
			}
			this.#valueEl?.blur();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (this.#marksOnlyActive()) {
				const delta = e.shiftKey ? 5 : 1;
				this.#commitValue(this.#markValueAt(this.#currentMarkIndex() + delta), "change", { snap: false });
			} else {
				this.#commitValue(this.value + this.step * (e.shiftKey ? 10 : 1), "change");
			}
			this.#refreshValueText();
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			if (this.#marksOnlyActive()) {
				const delta = e.shiftKey ? 5 : 1;
				this.#commitValue(this.#markValueAt(this.#currentMarkIndex() - delta), "change", { snap: false });
			} else {
				this.#commitValue(this.value - this.step * (e.shiftKey ? 10 : 1), "change");
			}
			this.#refreshValueText();
		}
	};

	// Force-rewrite the value field's text and place caret at end.
	// syncValue leaves a focused valueEl alone (so it doesn't stomp
	// typing), but arrow-key nudges DO need the displayed text
	// updated; otherwise the next blur reads the stale text and
	// commits it back, reverting the nudge.
	#refreshValueText() {
		if (!this.#valueEl) return;
		this.#valueEl.textContent = formatNumber(this.value, this.step);
		const r = document.createRange();
		r.selectNodeContents(this.#valueEl);
		r.collapse(false);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(r);
	}

	#onValueBlur = () => {
		const raw = (this.#valueEl?.textContent ?? "").trim();
		const parsed = Number(raw);
		if (raw === "" || !Number.isFinite(parsed)) {
			if (this.#valueEl) {
				this.#valueEl.textContent = formatNumber(this.value, this.step);
			}
			return;
		}
		this.#commitValue(parsed, "change");
	};

	#onThumbKeyDown = (e: KeyboardEvent) => {
		if (boolAttr(this, ATTR_DISABLED, false)) return;
		const useMarks = this.#marksOnlyActive();
		let next: number | null = null;
		const big = this.step * 10;
		switch (e.key) {
			case "ArrowLeft":
			case "ArrowDown":
				next = useMarks ? this.#markValueAt(this.#currentMarkIndex() - 1) : this.value - this.step;
				break;
			case "ArrowRight":
			case "ArrowUp":
				next = useMarks ? this.#markValueAt(this.#currentMarkIndex() + 1) : this.value + this.step;
				break;
			case "PageDown":
				next = useMarks ? this.#markValueAt(this.#currentMarkIndex() - 5) : this.value - big;
				break;
			case "PageUp":
				next = useMarks ? this.#markValueAt(this.#currentMarkIndex() + 5) : this.value + big;
				break;
			case "Home":
				next = useMarks ? this.#markValueAt(0) : this.min;
				break;
			case "End":
				next = useMarks ? this.#markValueAt(this.#marks.length - 1) : this.max;
				break;
		}
		if (next !== null) {
			e.preventDefault();
			// marks-only nav lands on a known mark; commit verbatim so an
			// off-step mark survives.
			this.#commitValue(next, "change", useMarks ? { snap: false } : {});
		}
	};

	#onAnchorClick = (e: MouseEvent) => {
		if (boolAttr(this, ATTR_DISABLED, false)) return;
		if (boolAttr(this, ATTR_STATIC_MARKS, false)) return;
		const target = (e.target as Element | null)?.closest("[data-neo-slider-anchor]");
		if (!target || !this.#trackEl?.contains(target)) return;
		const v = readMarkValue(target);
		if (v === null) return;
		// Commit the mark's value verbatim so clicking a mark at 25 with
		// step=10 lands on 25, not on the nearest step (30).
		this.#commitValue(v, "change", { snap: false });
	};

	#onTrackMarkPointerMove = (e: PointerEvent) => {
		// While a pointer is down (drag or click) the mark-hover highlight is
		// irrelevant; skip it so the per-mark getBoundingClientRect scan
		// doesn't force a layout flush on every drag move.
		if (this.#dragPointerId !== null) return;
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
		this.#commitValue(v, "change", { snap: false });
	};

	#onTrackPointerDown = (e: PointerEvent) => {
		if (boolAttr(this, ATTR_DISABLED, false)) return;
		if (e.button !== 0) return;
		if (!this.#trackEl) return;
		e.preventDefault();
		this.#thumbEl?.focus();
		this.#tooltipCtrl?.show();
		try {
			this.#trackEl.setPointerCapture(e.pointerId);
		} catch {
			// Capture isn't critical; some synthetic event sources refuse it.
		}
		this.#dragPointerId = e.pointerId;
		this.#dragStartX = e.clientX;
		this.#dragStartY = e.clientY;
		this.#dragStarted = false;
		this.#dragTrackRect = this.#trackEl.getBoundingClientRect();
		// The drag pointer listeners are bound once in #render; the scroll /
		// resize rect-invalidators are bound for the slider's lifetime (see
		// connectedCallback) and gate on `#dragPointerId`. Setting the id above
		// arms both, so nothing is attached here.
		// dragging flag is set in onTrackPointerMove past the threshold,
		// so a pure click animates via [easing]; only a real drag
		// suppresses the animation.
		this.#applyPointerPosition(e.clientX, e.clientY, "input");
	};

	#onTrackPointerMove = (e: PointerEvent) => {
		if (e.pointerId !== this.#dragPointerId) return;
		if ((e.buttons & 1) === 0) {
			this.#endDrag();
			return;
		}
		if (!this.#dragStarted) {
			// 4px matches the OS-level click-vs-drag threshold: small
			// enough that a deliberate drag clears it on the first sweep,
			// large enough that finger jitter / sub-pixel mouse drift
			// during a click stays out.
			const delta = this.#isVertical()
				? Math.abs(e.clientY - this.#dragStartY)
				: Math.abs(e.clientX - this.#dragStartX);
			if (delta < 4) return;
			this.#dragStarted = true;
			this.setAttribute("data-neo-slider-dragging", "");
			// Snapshot the thumb position and let the tooltip place itself
			// once; #syncValue then shifts it per frame without a reflow.
			this.#followBasePct = this.#valuePct(this.value);
			this.#tooltipCtrl?.beginFollow();
		}
		// Defensive re-show in case capture was refused earlier. Without
		// capture, dragging far from the thumb fires pointerleave and
		// would blink the tooltip off mid-drag.
		this.#tooltipCtrl?.show();
		this.#applyPointerPosition(e.clientX, e.clientY, "input");
	};

	#onTrackPointerUp = (e: PointerEvent) => {
		if (e.pointerId !== this.#dragPointerId) return;
		this.#applyPointerPosition(e.clientX, e.clientY, "change");
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
		const wasDragging = this.#dragStarted;
		try {
			if (this.#trackEl?.hasPointerCapture(this.#dragPointerId)) {
				this.#trackEl.releasePointerCapture(this.#dragPointerId);
			}
		} catch {
			// May already be released by the platform.
		}
		// Listeners stay bound (see #render / connectedCallback); clearing the
		// pointer id disarms them.
		this.#dragPointerId = null;
		this.#dragStarted = false;
		this.#dragTrackRect = null;
		// Reflect the value deferred during the drag now the flag is clear.
		this.#reflectValue(this.value);
		this.removeAttribute("data-neo-slider-dragging");
		// endFollow settles the exact placement after a follow drag; a plain
		// click (never crossed the threshold) just repositions.
		if (wasDragging) {
			this.#tooltipCtrl?.endFollow();
			this.#stopTooltipTracking();
		} else {
			this.#tooltipCtrl?.reposition();
		}
	}

	#invalidateDragRect = () => {
		// Bound for the slider's lifetime; only a live drag caches a rect to
		// refresh. Skip the getBoundingClientRect (a forced layout) otherwise.
		if (this.#dragPointerId === null || !this.#trackEl) return;
		this.#dragTrackRect = this.#trackEl.getBoundingClientRect();
	};

	#applyPointerPosition(clientX: number, clientY: number, kind: "input" | "change") {
		if (!this.#trackEl) return;
		// Reuse the drag-start rect (refreshed on scroll/resize) so a moving
		// pointer doesn't force a layout flush every frame.
		const rect = this.#dragTrackRect ?? this.#trackEl.getBoundingClientRect();
		const vertical = this.#isVertical();
		const spanPx = vertical ? rect.height : rect.width;
		if (spanPx <= 0) return;
		const t = vertical ? (rect.bottom - clientY) / spanPx : (clientX - rect.left) / spanPx;
		const clamped = Math.min(1, Math.max(0, t));
		const raw = this.min + clamped * (this.max - this.min);
		this.#commitValue(raw, kind);
	}
}

function readMarkValue(el: Element): number | null {
	const raw = el.getAttribute("data-neo-mark-value");
	if (raw === null) return null;
	const v = Number(raw);
	return Number.isFinite(v) ? v : null;
}

// Tag a shadow element with a `part` name so page CSS can style it through
// the shadow boundary via neo-slider::part(<name>).
function part<E extends Element>(el: E, name: string): E {
	el.setAttribute("part", name);
	return el;
}

function decimalDigits(step: number): number {
	if (!Number.isFinite(step) || step <= 0) return 0;
	const s = String(step);
	const dot = s.indexOf(".");
	if (dot < 0) {
		// Handle scientific notation: "1e-3" -> 3 decimals.
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
		// Selection anchored on the element itself (typical after
		// selectNodeContents): translate child-index offset to text
		// offset by summing lengths of preceding children.
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

if (!customElements.get("neo-slider")) {
	customElements.define("neo-slider", NeoSlider);
}
