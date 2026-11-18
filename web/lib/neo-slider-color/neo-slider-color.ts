// The shadow root holds 1 inner <neo-slider>, which owns the drag, keyboard,
// value field and ARIA. This element maps its number to 1 HSV channel of a
// #rrggbb value and paints its track and thumb.

import { type HSV, hexToHsv, hsvToHex, parseHex } from "../color";
import { boolAttr } from "../command";
import { isRTL } from "../direction";
import "../neo-slider";
import css from "./neo-slider-color.css";

type Channel = "hue" | "saturation" | "brightness";

// name is the accessible name when the host has no label or aria-label.
const CHANNELS: Record<Channel, { max: number; unit: string; name: string }> = {
	hue: { max: 360, unit: "°", name: "Hue" },
	saturation: { max: 100, unit: "%", name: "Saturation" },
	brightness: { max: 100, unit: "%", name: "Brightness" },
};

const DEFAULT_VALUE = "#2563eb";

// Copied verbatim to the inner slider.
const FORWARDED = ["label", "hide-value", "vertical", "easing", "disabled"];

const HUE_TRACK = "#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000";

const SHEET = new CSSStyleSheet();
SHEET.replaceSync(css);

export class NeoSliderColor extends HTMLElement {
	static readonly observedAttributes = ["value", "hue", "channel", "aria-label", ...FORWARDED];

	#slider: HTMLElement;
	// Source of truth. Kept apart from `value` because a #rrggbb value drops
	// the hue of a gray and the saturation of black.
	#hsv: HSV = hexToHsv(DEFAULT_VALUE) as HSV;
	#reflecting = false;
	// Set from the first neo-slider-input until the pointer is released.
	// A binding can echo a value from a few frames back; applying it would
	// pull the thumb away from the pointer.
	#dragging = false;
	#dragStartValue = "";
	#warnedValue: string | null = null;
	#warnedChannel: string | null = null;

	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.adoptedStyleSheets = [SHEET];
		this.#slider = document.createElement("neo-slider");
		this.#slider.setAttribute("hide-tooltip", "");
		this.#slider.setAttribute("step", "1");
		this.#slider.setAttribute("min", "0");
		this.#slider.setAttribute("exportparts", "header, label, output, value, unit, track, thumb");
		this.#slider.addEventListener("neo-slider-input", this.#onInput);
		this.#slider.addEventListener("neo-slider-change", this.#onChange);
		this.#slider.addEventListener("lostpointercapture", this.#onDragEnd);
		root.append(this.#slider);
		this.#syncChannel();
	}

	connectedCallback() {
		this.#paint();
	}

	get value(): string {
		return hsvToHex(this.#hsv.h, this.#hsv.s, this.#hsv.v);
	}

	set value(v: string | null) {
		if (v == null) this.removeAttribute("value");
		else this.setAttribute("value", v);
	}

	attributeChangedCallback(name: string, _old: string | null, next: string | null) {
		if (this.#reflecting) return;
		if (name === "value") this.#applyValue(next);
		else if (name === "hue") this.#applyHue(next);
		else if (name === "channel") this.#syncChannel();
		else {
			if (name !== "aria-label") {
				if (next === null) this.#slider.removeAttribute(name);
				else this.#slider.setAttribute(name, next);
			}
			if (name === "label" || name === "aria-label") this.#syncName();
			else if (name === "vertical") this.#paint();
		}
	}

	// <neo-slider> names its thumb from `label`, else from `aria-label`.
	#syncName() {
		const name =
			this.getAttribute("aria-label") || (this.getAttribute("label") ? null : CHANNELS[this.#channel()].name);
		if (name === null) this.#slider.removeAttribute("aria-label");
		else this.#slider.setAttribute("aria-label", name);
	}

	#channel(): Channel {
		const raw = this.getAttribute("channel");
		if (raw === null || raw === "") return "hue";
		if (raw in CHANNELS) return raw as Channel;
		if (raw !== this.#warnedChannel) {
			this.#warnedChannel = raw;
			console.warn(`<neo-slider-color>: unsupported channel "${raw}"; use hue, saturation or brightness.`);
		}
		return "hue";
	}

	#applyValue(raw: string | null) {
		// Absent: keep the color and mirror it back, as <neo-slider> does.
		if (raw === null) {
			this.#reflect();
			return;
		}
		const hex = parseHex(raw);
		if (!hex) {
			if (raw !== this.#warnedValue) {
				this.#warnedValue = raw;
				console.warn(`<neo-slider-color>: unsupported value "${raw}"; use #rrggbb.`);
			}
			return;
		}
		if (this.#dragging || hex === this.value) return;
		const next = hexToHsv(hex) as HSV;
		const { h, s } = this.#hsv;
		this.#hsv = {
			h: this.hasAttribute("hue") || next.s === 0 || next.v === 0 ? h : next.h,
			s: next.v === 0 ? s : next.s,
			v: next.v,
		};
		this.#syncSliderValue();
		this.#paint();
	}

	#applyHue(raw: string | null) {
		if (raw === null || this.#dragging) return;
		const n = Number(raw);
		if (!Number.isFinite(n)) return;
		// 360 stays 360, which keeps the thumb at the end of the track.
		const h = n >= 0 && n <= 360 ? n : ((n % 360) + 360) % 360;
		if (h === this.#hsv.h) return;
		this.#hsv = { ...this.#hsv, h };
		this.#syncSliderValue();
		this.#paint();
	}

	#syncChannel() {
		const cfg = CHANNELS[this.#channel()];
		this.#slider.setAttribute("max", String(cfg.max));
		this.#slider.setAttribute("unit", cfg.unit);
		this.#syncName();
		this.#syncSliderValue();
		this.#paint();
	}

	#channelValue(): number {
		const ch = this.#channel();
		const n = ch === "hue" ? this.#hsv.h : ch === "saturation" ? this.#hsv.s : this.#hsv.v;
		return Math.round(n * 100) / 100;
	}

	#syncSliderValue() {
		const v = String(this.#channelValue());
		if (this.#slider.getAttribute("value") !== v) this.#slider.setAttribute("value", v);
	}

	#paint() {
		const { h, s, v } = this.#hsv;
		const ch = this.#channel();
		const dir = boolAttr(this, "vertical", false) ? "to top" : isRTL(this) ? "to left" : "to right";
		let stops = HUE_TRACK;
		if (ch === "saturation") stops = `${hsvToHex(h, 0, v)}, ${hsvToHex(h, 100, v)}`;
		else if (ch === "brightness") stops = `#000000, ${hsvToHex(h, s, 100)}`;
		const style = this.#slider.style;
		style.setProperty("--neo-slider-track-image", `linear-gradient(${dir}, ${stops})`);
		style.setProperty("--neo-slider-thumb-bg", ch === "hue" ? hsvToHex(h, 100, 100) : this.value);
	}

	#setChannel(n: number) {
		const ch = this.#channel();
		if (ch === "hue") this.#hsv = { ...this.#hsv, h: n };
		else if (ch === "saturation") this.#hsv = { ...this.#hsv, s: n };
		else this.#hsv = { ...this.#hsv, v: n };
		this.#paint();
	}

	// Mid-drag the attributes stay put, as on <neo-slider>, because a page
	// rule keyed on `value` would restyle the document every frame.
	#reflect() {
		this.#reflecting = true;
		try {
			const value = this.value;
			if (this.getAttribute("value") !== value) this.setAttribute("value", value);
			const hue = String(this.#hsv.h);
			if (this.hasAttribute("hue") && this.getAttribute("hue") !== hue) this.setAttribute("hue", hue);
		} finally {
			this.#reflecting = false;
		}
	}

	#emit(kind: "input" | "change") {
		this.dispatchEvent(
			new CustomEvent(`neo-slider-color-${kind}`, {
				bubbles: true,
				detail: { value: this.value, hue: this.#hsv.h },
			}),
		);
	}

	#onInput = (e: Event) => {
		if (!this.#dragging) this.#dragStartValue = this.value;
		this.#dragging = true;
		this.#setChannel((e as CustomEvent<{ value: number }>).detail.value);
		this.#emit("input");
	};

	#onChange = (e: Event) => {
		this.#dragging = false;
		this.#setChannel((e as CustomEvent<{ value: number }>).detail.value);
		this.#reflect();
		this.#emit("change");
	};

	// <neo-slider> fires no change when the release lands on the last input
	// position, which a drag or a click on the track always does.
	#onDragEnd = () => {
		if (!this.#dragging) return;
		this.#dragging = false;
		this.#reflect();
		if (this.value !== this.#dragStartValue) this.#emit("change");
	};
}

if (!customElements.get("neo-slider-color")) {
	customElements.define("neo-slider-color", NeoSliderColor);
}
