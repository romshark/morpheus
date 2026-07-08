// Internals render into a shadow root on connect with no <slot>, so a fat
// morph of the light host keeps the same fill node and the `easing`
// transition runs instead of rebuilding and snapping. Marks are authored
// as light children, read on connect and on light-DOM mutation.

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
import { clamp, num } from "../num";
import { scopeCssToHost } from "../shadow-utils";
import progressCss from "./neo-progress.css";

const ATTR_MIN = "min";
const ATTR_MAX = "max";
const ATTR_VALUE = "value";
const ATTR_LABEL = "label";
const ATTR_UNIT = "unit";
const ATTR_HIDE_VALUE = "hide-value";
const ATTR_VERTICAL = "vertical";
const ATTR_EASING = "easing";
const ATTR_INDETERMINATE = "indeterminate";

const MARK_CFG: MarkRailConfig = {
	markAttr: "data-neo-progress-mark",
	anchorAttr: "data-neo-progress-anchor",
	markLabelAttr: "data-neo-progress-mark-label",
};

// The whole module stylesheet, tag selectors rewritten to `:host`, adopted
// into every instance's shadow root. Built once and shared. The internals
// live in the shadow so a Datastar fat-morph of the light host can't wipe
// them: the fill node persists, so an `easing` transition runs on a plain
// `value` change instead of snapping after a rebuild.
const SHEET = new CSSStyleSheet();
SHEET.replaceSync(scopeCssToHost(progressCss, "neo-progress"));

export class NeoProgress extends HTMLElement {
	static readonly observedAttributes = [
		ATTR_MIN,
		ATTR_MAX,
		ATTR_VALUE,
		ATTR_LABEL,
		ATTR_UNIT,
		ATTR_HIDE_VALUE,
		ATTR_VERTICAL,
		ATTR_EASING,
		ATTR_INDETERMINATE,
	];

	#rendered = false;
	// Current value; `value` reflects it (see command). Survives a morph that
	// strips the attribute so a fat morph omitting `value` can't reset to min.
	#valueIntent = 0;
	// setValue()/reflect write `value` via setAttribute, which would otherwise
	// re-enter syncValue() through attributeChangedCallback.
	#reflectingValue = false;
	#headerEl: HTMLElement | null = null;
	#labelEl: HTMLElement | null = null;
	#outputEl: HTMLElement | null = null;
	#valueEl: HTMLElement | null = null;
	#unitEl: HTMLElement | null = null;
	#trackEl: HTMLElement | null = null;
	#fillEl: HTMLElement | null = null;
	#marksEl: HTMLElement | null = null;
	#marks: MarkSpec[] = [];
	#childObserver: MutationObserver | null = null;
	#markResizeObserver: ResizeObserver | null = null;
	#markLayoutFrame: number | null = null;

	connectedCallback() {
		if (!this.shadowRoot) {
			const root = this.attachShadow({ mode: "open" });
			root.adoptedStyleSheets = [SHEET];
		}
		// Explicit value commands the intent; absent keeps the prior value.
		const raw = this.getAttribute(ATTR_VALUE);
		if (raw !== null) {
			const n = Number(raw);
			if (Number.isFinite(n)) this.#valueIntent = n;
		}
		this.#render();
		// Mirror state to the attribute (clamped) so it stays the state mirror.
		this.#reflectValue();
		this.#syncAll();
		this.#observeMarkLayout();
		this.#scheduleMarkLayoutSync();
		this.#observeChildren();
	}

	disconnectedCallback() {
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		this.#markResizeObserver?.disconnect();
		this.#markResizeObserver = null;
		if (this.#markLayoutFrame !== null) {
			window.cancelAnimationFrame(this.#markLayoutFrame);
			this.#markLayoutFrame = null;
		}
	}

	// Author marks are [data-neo-progress-mark] light children; the rendered
	// dots/labels live in the shadow. A morph that changes the light marks
	// won't touch the shadow, so re-collect and re-render the rail here.
	// The rendered internals themselves are shadow-only and never wiped.
	#observeChildren() {
		if (this.#childObserver) return;
		this.#childObserver = new MutationObserver(() => {
			if (!this.#rendered) return;
			this.#captureUserContent();
			this.#renderMarks();
		});
		this.#childObserver.observe(this, { childList: true });
	}

	attributeChangedCallback(name: string, _old: string | null, newValue: string | null) {
		if (!this.#rendered) return;
		if (this.#reflectingValue && name === ATTR_VALUE) return;
		if (name === ATTR_VALUE) {
			// Absent: no command, keep the current value; re-reflect so the
			// bar/marks survive a morph that stripped `value`.
			if (newValue === null) this.#reflectValue();
			else {
				const n = Number(newValue);
				if (Number.isFinite(n)) this.#valueIntent = n;
			}
			this.#syncValue();
			return;
		}
		if (name === ATTR_LABEL) {
			this.#syncLabel();
			this.#syncHeaderVisibility();
		} else if (name === ATTR_UNIT) this.#syncUnit();
		else if (name === ATTR_HIDE_VALUE) {
			this.#syncValueVisibility();
			this.#syncHeaderVisibility();
		} else if (name === ATTR_VERTICAL) {
			this.#renderMarks();
			this.#syncValue();
		} else if (name === ATTR_EASING) this.#syncEasing();
		else if (name === ATTR_INDETERMINATE) this.#syncValue();
		else if (name === ATTR_MIN || name === ATTR_MAX) {
			this.#renderMarks();
			this.#syncValue();
		} else this.#syncValue();
	}

	get min(): number {
		return num(this.getAttribute(ATTR_MIN), 0);
	}

	get max(): number {
		const m = num(this.getAttribute(ATTR_MAX), 100);
		return m > this.min ? m : this.min + 1;
	}

	get value(): number {
		return clamp(this.#valueIntent, this.min, this.max);
	}

	set value(v: number) {
		this.#valueIntent = v;
		this.#reflectValue();
		this.#syncValue();
	}

	// State → attribute, guarded so it isn't read back as a command.
	#reflectValue() {
		this.#reflectingValue = true;
		try {
			this.setAttribute(ATTR_VALUE, String(this.value));
		} finally {
			this.#reflectingValue = false;
		}
	}

	#render() {
		if (this.#rendered) return;
		const root = this.shadowRoot;
		if (!root) return;
		this.#rendered = true;

		// Host is the progressbar; the shadow track is presentational.
		this.setAttribute("role", "progressbar");

		this.#captureUserContent();

		// `part` exposes each internal to page CSS via
		// `neo-progress::part(<name>)`, the only styling hook across the
		// shadow boundary (e.g. a custom fill animation).
		this.#headerEl = part(document.createElement("div"), "header");
		this.#headerEl.setAttribute("data-neo-progress-header", "");

		this.#labelEl = part(document.createElement("span"), "label");
		this.#labelEl.setAttribute("data-neo-progress-label", "");

		this.#outputEl = part(document.createElement("span"), "output");
		this.#outputEl.setAttribute("data-neo-progress-output", "");

		this.#valueEl = part(document.createElement("span"), "value");
		this.#valueEl.setAttribute("data-neo-progress-value", "");

		this.#unitEl = part(document.createElement("span"), "unit");
		this.#unitEl.setAttribute("data-neo-progress-unit", "");

		this.#outputEl.appendChild(this.#valueEl);
		this.#outputEl.appendChild(this.#unitEl);
		this.#headerEl.appendChild(this.#labelEl);
		this.#headerEl.appendChild(this.#outputEl);

		this.#trackEl = part(document.createElement("div"), "track");
		this.#trackEl.setAttribute("data-neo-progress-track", "");

		this.#fillEl = part(document.createElement("div"), "fill");
		this.#fillEl.setAttribute("data-neo-progress-fill", "");
		this.#trackEl.appendChild(this.#fillEl);

		this.#marksEl = part(document.createElement("div"), "marks");
		this.#marksEl.setAttribute("data-neo-progress-marks", "");

		root.replaceChildren(this.#headerEl, this.#trackEl, this.#marksEl);
		this.#trackEl.addEventListener("pointermove", this.#onTrackMarkPointerMove);
		this.#trackEl.addEventListener("pointerleave", this.#onTrackMarkPointerLeave);
		this.#marksEl.addEventListener("pointermove", this.#onMarkLabelPointerMove);
		this.#marksEl.addEventListener("pointerleave", this.#onMarkLabelPointerLeave);
		this.#renderMarks();
	}

	#captureUserContent() {
		this.#marks = collectMarks(this, MARK_CFG);
	}

	#renderMarks() {
		if (!this.#trackEl || !this.#marksEl) return;
		renderMarkRail(this.#marks, this.#trackEl, this.#marksEl, {
			min: this.min,
			max: this.max,
			vertical: this.#isVertical(),
			cfg: MARK_CFG,
			insertDot: (track, dot) => track.appendChild(dot),
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
		for (const label of this.#marksEl.querySelectorAll<HTMLElement>(":scope > [data-neo-progress-mark-label]")) {
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
		this.#syncValue();
	}

	#syncEasing() {
		// Set the transition on the shadow fill, NOT the host. A Datastar
		// fat-morph of the bare light host reconciles its attributes to the
		// source, which has no `style`. Putting it on the host would strip
		// the transition on every morph, so the fill would snap to the new
		// value instead of easing. The shadow tree is untouched by the morph.
		if (!this.#fillEl) return;
		const raw = this.getAttribute(ATTR_EASING);
		if (raw === null) {
			this.#fillEl.style.removeProperty("--neo-progress-fill-transition");
			return;
		}
		const trimmed = raw.trim() || "200ms";
		const value = /\s/.test(trimmed) ? trimmed : `${trimmed} var(--neo-easing, ease)`;
		this.#fillEl.style.setProperty("--neo-progress-fill-transition", value);
	}

	#syncValueVisibility() {
		if (!this.#outputEl) return;
		const hidden = boolAttr(this, ATTR_HIDE_VALUE, false);
		this.#outputEl.style.display = hidden ? "none" : "";
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

	#isVertical(): boolean {
		return boolAttr(this, ATTR_VERTICAL, false);
	}

	#isIndeterminate(): boolean {
		return boolAttr(this, ATTR_INDETERMINATE, false);
	}

	#syncValue() {
		const indeterminate = this.#isIndeterminate();
		const v = this.value;
		if (this.#valueEl) this.#valueEl.textContent = indeterminate ? "" : String(v);
		// Host carries the progressbar semantics (the header/track are in the
		// shadow and presentational). aria-valuenow drives the announced
		// value; indeterminate drops it.
		this.setAttribute("aria-valuemin", String(this.min));
		this.setAttribute("aria-valuemax", String(this.max));
		if (indeterminate) this.removeAttribute("aria-valuenow");
		else this.setAttribute("aria-valuenow", String(v));
		// The visible `label` lives in the shadow, so mirror it to the host's
		// aria-label to name the progressbar. An author-set aria-label is the
		// fallback when there's no visible label.
		const label = this.getAttribute(ATTR_LABEL) || this.getAttribute("aria-label");
		if (label) this.setAttribute("aria-label", label);
		else this.removeAttribute("aria-label");
		const span = this.max - this.min;
		const pct = span > 0 ? ((v - this.min) / span) * 100 : 0;
		if (this.#fillEl && !indeterminate) {
			if (this.#isVertical()) {
				this.#fillEl.style.width = "";
				this.#fillEl.style.height = `${pct}%`;
			} else {
				this.#fillEl.style.height = "";
				this.#fillEl.style.width = `${pct}%`;
			}
		} else if (this.#fillEl) {
			this.#fillEl.style.width = "";
			this.#fillEl.style.height = "";
		}
		this.#syncMarkActive(v);
	}

	#syncMarkActive(v: number) {
		syncMarkRailActive(this.#trackEl, this.#marksEl, v, MARK_CFG);
		syncActiveMarkLabelVisibility(this.#marksEl, MARK_CFG, "highest");
	}

	#onTrackMarkPointerMove = (e: PointerEvent) => {
		const value = markValueNearPointer(this.#trackEl, MARK_CFG, this.#isVertical(), e.clientX, e.clientY);
		syncHoveredMarkLabel(this.#marksEl, MARK_CFG, value);
	};

	#onTrackMarkPointerLeave = () => {
		syncHoveredMarkLabel(this.#marksEl, MARK_CFG, null);
	};

	#onMarkLabelPointerMove = (e: PointerEvent) => {
		const target = (e.target as Element | null)?.closest("[data-neo-progress-mark-label]");
		const value = target && this.#marksEl?.contains(target) ? target.getAttribute("data-neo-mark-value") : null;
		syncHoveredMarkLabel(this.#marksEl, MARK_CFG, value);
	};

	#onMarkLabelPointerLeave = () => {
		syncHoveredMarkLabel(this.#marksEl, MARK_CFG, null);
	};
}

// Tag a shadow element with a `part` name so page CSS can style it through
// the shadow boundary via neo-progress::part(<name>).
function part<E extends Element>(el: E, name: string): E {
	el.setAttribute("part", name);
	return el;
}

if (!customElements.get("neo-progress")) {
	customElements.define("neo-progress", NeoProgress);
}
