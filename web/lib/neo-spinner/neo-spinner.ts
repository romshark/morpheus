// Two modes share the same SVG ring markup, so stroke thickness, outer
// diameter, and anti-aliasing match exactly across them. Mode is implicit:
// a `value` without `indeterminate` is determinate, and the shadow
// stylesheet derives the mode from those public attributes.

import { boolAttr } from "../command";
import { clamp, num } from "../num";
import { scopeCssToHost } from "../shadow-utils";
import spinnerCss from "./neo-spinner.css";

const ATTR_MIN = "min";
const ATTR_MAX = "max";
const ATTR_VALUE = "value";
const ATTR_INDETERMINATE = "indeterminate";
const ATTR_LABEL = "label";
const ATTR_EASING = "easing";

const RING = "data-neo-spinner-ring";
const TRACK = "data-neo-spinner-track";
const ARC = "data-neo-spinner-arc";
const SUN = "data-neo-spinner-sun";

// Lucide-static "loader" glyph rays: the reduced-motion fallback for
// indeterminate mode.
const SUN_LINES: ReadonlyArray<readonly [number, number, number, number]> = [
	[12, 2, 12, 6],
	[12, 18, 12, 22],
	[4.93, 4.93, 7.76, 7.76],
	[16.24, 16.24, 19.07, 19.07],
	[2, 12, 6, 12],
	[18, 12, 22, 12],
	[4.93, 19.07, 7.76, 16.24],
	[16.24, 7.76, 19.07, 4.93],
];

const SVG_NS = "http://www.w3.org/2000/svg";

// Ring geometry. The visible radius defaults to R=10.5 (so a 3-unit stroke fits the
// 24-unit viewBox exactly), but CSS (`r: calc(12px − ringWidth/2)`)
// shrinks it whenever a theme bumps --neo-spinner-ring-width. Dash
// values use a normalised 0–100 scale via pathLength so they survive
// that shrink without redoing the maths.
const R = 10.5;
const PATH_LENGTH = 100;
// Indeterminate visual: 3/4 of the path drawn, 1/4 gap.
const INDETERMINATE_DASH = `${PATH_LENGTH * 0.75} ${PATH_LENGTH * 0.25}`;

const SHEET = new CSSStyleSheet();
SHEET.replaceSync(scopeCssToHost(spinnerCss, "neo-spinner"));

export class NeoSpinner extends HTMLElement {
	static readonly observedAttributes = [ATTR_MIN, ATTR_MAX, ATTR_VALUE, ATTR_INDETERMINATE, ATTR_LABEL, ATTR_EASING];

	#ringEl: SVGSVGElement | null = null;
	#arcEl: SVGCircleElement | null = null;
	// Current value; `value` reflects it (see command). Survives a morph that
	// strips the attribute so a fat morph omitting `value` can't reset the arc
	// to min. `#hasValue` tracks whether a value was ever given: a bare
	// indeterminate spinner that never had one stays decorative.
	#valueIntent = 0;
	#hasValue = false;
	// set value()/reflect write `value` via setAttribute, which would otherwise
	// re-enter #reconcile() through attributeChangedCallback.
	#reflectingValue = false;

	connectedCallback() {
		if (!this.shadowRoot) {
			const root = this.attachShadow({ mode: "open" });
			root.adoptedStyleSheets = [SHEET];
		}
		// Explicit value commands the intent; absent keeps the prior value.
		const raw = this.getAttribute(ATTR_VALUE);
		if (raw !== null) {
			const n = Number(raw);
			if (Number.isFinite(n)) {
				this.#valueIntent = n;
				this.#hasValue = true;
			}
		}
		// Mirror state to the attribute (clamped) so it stays the state mirror.
		if (this.#hasValue) this.#reflectValue();
		this.#reconcile();
	}

	attributeChangedCallback(name: string, _old: string | null, newValue: string | null) {
		if (!this.isConnected) return;
		if (this.#reflectingValue && name === ATTR_VALUE) return;
		if (name === ATTR_VALUE) {
			// Absent: no command, keep the current value; re-reflect so the arc
			// survives a morph that stripped `value`.
			if (newValue === null) {
				if (this.#hasValue) this.#reflectValue();
			} else {
				const n = Number(newValue);
				if (Number.isFinite(n)) {
					this.#valueIntent = n;
					this.#hasValue = true;
				}
			}
		}
		this.#reconcile();
	}

	get #determinate(): boolean {
		return this.#hasValue && !boolAttr(this, ATTR_INDETERMINATE, false);
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
		this.#hasValue = true;
		this.#reflectValue();
		this.#reconcile();
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

	// Single entry point: ensure the persistent shadow ring exists, then
	// sync the arc per mode.
	#reconcile() {
		this.#ensureRing();
		const determinate = this.#determinate;
		if (determinate) this.#syncDeterminate();
		else this.#syncIndeterminate();
		this.#syncEasing();
		this.#applyAria(determinate ? this.value : null);
	}

	#ensureRing() {
		if (this.#ringEl) return;
		const root = this.shadowRoot;
		if (!root) return;

		const ring = document.createElementNS(SVG_NS, "svg");
		ring.setAttribute(RING, "");
		ring.setAttribute("part", "ring");
		ring.setAttribute("viewBox", "0 0 24 24");
		ring.setAttribute("fill", "none");
		ring.setAttribute("aria-hidden", "true");

		const track = document.createElementNS(SVG_NS, "circle");
		track.setAttribute(TRACK, "");
		track.setAttribute("part", "track");
		circleGeom(track);

		const arc = document.createElementNS(SVG_NS, "circle");
		arc.setAttribute(ARC, "");
		arc.setAttribute("part", "arc");
		circleGeom(arc);

		const sun = document.createElementNS(SVG_NS, "g");
		sun.setAttribute(SUN, "");
		sun.setAttribute("part", "sun");
		sun.setAttribute("aria-hidden", "true");
		for (const [x1, y1, x2, y2] of SUN_LINES) {
			const line = document.createElementNS(SVG_NS, "line");
			line.setAttribute("x1", String(x1));
			line.setAttribute("y1", String(y1));
			line.setAttribute("x2", String(x2));
			line.setAttribute("y2", String(y2));
			sun.appendChild(line);
		}

		ring.appendChild(track);
		ring.appendChild(arc);
		ring.appendChild(sun);
		root.replaceChildren(ring);
		this.#ringEl = ring;
		this.#arcEl = arc;
	}

	#syncDeterminate() {
		if (!this.#arcEl) return;
		const frac = (this.value - this.min) / (this.max - this.min);
		this.#arcEl.setAttribute("stroke-dasharray", String(PATH_LENGTH));
		this.#arcEl.setAttribute("stroke-dashoffset", String(PATH_LENGTH * (1 - clamp(frac, 0, 1))));
	}

	#syncIndeterminate() {
		if (!this.#arcEl) return;
		this.#arcEl.setAttribute("stroke-dasharray", INDETERMINATE_DASH);
		this.#arcEl.setAttribute("stroke-dashoffset", "0");
	}

	#syncEasing() {
		if (!this.#ringEl) return;
		const raw = this.getAttribute(ATTR_EASING);
		if (raw === null) {
			this.#ringEl.style.removeProperty("--neo-spinner-arc-transition");
			return;
		}
		const trimmed = raw.trim() || "200ms";
		const value = /\s/.test(trimmed) ? trimmed : `${trimmed} var(--neo-easing, ease)`;
		this.#ringEl.style.setProperty("--neo-spinner-arc-transition", value);
	}

	// role="progressbar" + value text when determinate, or when an
	// indeterminate spinner was given a label. A bare, unlabelled
	// indeterminate spinner stays decorative (no role): preserves the
	// original behaviour so existing call sites aren't altered.
	#applyAria(valuenow: number | null) {
		const label = this.getAttribute(ATTR_LABEL) || this.getAttribute("aria-label");
		const determinate = valuenow !== null;
		if (!determinate && !this.getAttribute(ATTR_LABEL)) {
			this.removeAttribute("role");
			this.removeAttribute("aria-valuemin");
			this.removeAttribute("aria-valuemax");
			this.removeAttribute("aria-valuenow");
			return;
		}
		this.setAttribute("role", "progressbar");
		this.setAttribute("aria-valuemin", String(this.min));
		this.setAttribute("aria-valuemax", String(this.max));
		if (determinate) this.setAttribute("aria-valuenow", String(valuenow));
		else this.removeAttribute("aria-valuenow");
		if (label && !this.hasAttribute("aria-labelledby")) {
			this.setAttribute("aria-label", label);
		}
	}
}

function circleGeom(c: SVGCircleElement) {
	c.setAttribute("cx", "12");
	c.setAttribute("cy", "12");
	c.setAttribute("r", String(R));
	c.setAttribute("pathLength", String(PATH_LENGTH));
}

if (!customElements.get("neo-spinner")) {
	customElements.define("neo-spinner", NeoSpinner);
}
