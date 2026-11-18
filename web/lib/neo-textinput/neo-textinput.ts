// The native <input> lives in the shadow root, out of a fat morph's reach,
// which keeps its focus, caret and value when a server re-renders the host.

import "../neo-icon";
import { boolAttr, openCommand } from "../command";
import { isRTL } from "../direction";
import { setState } from "../internal-state";
import { labelAttr } from "../label-name";
import { type ClassSlot, isDigit, type MaskSlot, parseMask } from "../mask";
import { cloneDatalistOptionsInto, externalDatalistFor } from "../neo-datalist";
import { OPTION_OBSERVE_ATTRS, readOptionData, wireOptionEl } from "../neo-listbox";
import { setAttrIfChanged } from "../neo-morph-resilient";
import {
	anchorPopoverResult,
	applyOpenSizeDuringScroll,
	POPOVER_ATTRS,
	scrollAnchorIntoOpenView,
} from "../neo-position";
import { eventEnters, isIndependentBoundaryScroll, scopingBoundary } from "../shadow-utils";

const ATTR_VALUE = "value";
const ATTR_MASK = "mask";
const ATTR_FORMAT = "format";
const ATTR_PREFIX = "prefix";
const ATTR_NUMERIC_ONLY = "numeric-only";
const ATTR_CASE = "case";
const ATTR_DECIMAL_PLACES = "decimal-places";
const ATTR_DECIMAL_MARK = "decimal-mark";
const ATTR_THOUSANDS_SEPARATOR = "thousands-separator";
const ATTR_SUBMIT_RAW = "submit-raw";
const ATTR_STEPPER = "stepper";
const ATTR_INCREMENT_ICON = "increment-icon";
const ATTR_DECREMENT_ICON = "decrement-icon";
const ATTR_INCREMENT_LABEL = "increment-label";
const ATTR_DECREMENT_LABEL = "decrement-label";
const ATTR_SCRUB = "scrub";
const ATTR_SCRUB_ICON = "scrub-icon";
const ATTR_SCRUB_SIDE = "scrub-side";
const ATTR_SCRUB_SENSITIVITY = "scrub-sensitivity";
// Steps per CSS pixel of scrub drag, 1 step per 2px.
// Shift takes 10 times as many, like PageUp.
const SCRUB_SENSITIVITY = 0.5;
// Press-and-hold on a stepper button repeats after a delay, like the
// native spin buttons.
const STEP_REPEAT_DELAY_MS = 400;
const STEP_REPEAT_INTERVAL_MS = 60;
const ATTR_OPEN = "open";
const TEXTINPUT_TAG = "<neo-textinput>";

// Native booleans. They follow the command contract, which means x="false"
// removes the field's attribute instead of being copied to it.
const BOOL_PASSTHROUGH_ATTRS = ["disabled", "readonly", "required", "autofocus"];

// Mirrored to the field. `name` stays on the host, the form-associated element.
// On the field too, the form would submit the value 2 times.
const PASSTHROUGH_ATTRS = [
	"type",
	"placeholder",
	"disabled",
	"readonly",
	"required",
	"autocomplete",
	"inputmode",
	"maxlength",
	"minlength",
	"pattern",
	"autofocus",
	// The host's accessible name goes to the field, the focusable control.
	"aria-label",
	"aria-labelledby",
	"aria-describedby",
	// A text field ignores these natively.
	"min",
	"max",
	"step",
];

interface FormatResult {
	formatted: string;
	raw: string;
}

// #onInput keeps the caret by counting the raw chars before it,
// then finding the spot in the reformatted text with as many.
interface Formatter {
	// format() puts the prefix first.
	readonly prefixLength: number;
	format(raw: string): FormatResult;
	extractRaw(formatted: string): string;
	// Rejects a keystroke before it lands.
	acceptsChar(ch: string): boolean;
}

function stripPrefix(value: string, prefix: string): string {
	return prefix && value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

// The formatter of a field without a mask or format="number".
class PlainFormatter implements Formatter {
	#prefix: string;
	#caseMode: "upper" | "lower" | null;
	#numericOnly: boolean;

	constructor(prefix: string, caseMode: "upper" | "lower" | null, numericOnly: boolean) {
		this.#prefix = prefix;
		this.#caseMode = caseMode;
		this.#numericOnly = numericOnly;
	}

	get prefixLength(): number {
		return this.#prefix.length;
	}

	format(raw: string): FormatResult {
		let r = raw;
		if (this.#numericOnly) r = r.replace(/\D/g, "");
		if (this.#caseMode === "upper") r = r.toUpperCase();
		else if (this.#caseMode === "lower") r = r.toLowerCase();
		return { formatted: this.#prefix + r, raw: r };
	}

	extractRaw(formatted: string): string {
		return stripPrefix(formatted, this.#prefix);
	}

	acceptsChar(ch: string): boolean {
		return !this.#numericOnly || isDigit(ch);
	}
}

// A run of digit slots, the unit a masked field steps. slotEnd indexes the
// mask slots, which match formatted positions less the prefix in a filled field.
// raw* index the raw string, which holds only class-slot chars.
interface MaskGroup {
	slotEnd: number;
	rawStart: number;
	rawEnd: number;
}

class MaskFormatter implements Formatter {
	#slots: MaskSlot[];
	#prefix: string;
	readonly digitGroups: MaskGroup[] = [];
	readonly classSlotCount: number;

	constructor(mask: string, prefix: string) {
		this.#prefix = prefix;
		this.#slots = parseMask(mask);
		let raw = 0;
		let group: MaskGroup | null = null;
		for (let i = 0; i < this.#slots.length; i++) {
			const slot = this.#slots[i];
			if (slot.kind === "class" && slot.token === "#") {
				if (group) {
					group.slotEnd = i + 1;
					group.rawEnd = raw + 1;
				} else {
					group = { slotEnd: i + 1, rawStart: raw, rawEnd: raw + 1 };
					this.digitGroups.push(group);
				}
			} else group = null;
			if (slot.kind === "class") raw++;
		}
		this.classSlotCount = raw;
	}

	get prefixLength(): number {
		return this.#prefix.length;
	}

	format(raw: string): FormatResult {
		let out = this.#prefix;
		let rawOut = "";
		let ri = 0;
		for (const slot of this.#slots) {
			if (slot.kind === "literal") {
				// Literals show once any raw char exists, which puts a delimiter right
				// after a filled slot ("123" in "###-###" shows "123-"). A blank field
				// shows none, and the next unfilled class slot ends the run.
				if (raw.length === 0) break;
				out += slot.ch;
				continue;
			}
			// Skip raw chars the slot rejects,
			// such as punctuation pasted into an `A` slot.
			while (ri < raw.length && !slot.test(raw[ri])) ri++;
			if (ri >= raw.length) break;
			let c = raw[ri++];
			if (slot.transform) c = slot.transform(c);
			out += c;
			rawOut += c;
		}
		return { formatted: out, raw: rawOut };
	}

	// Aligns f, a value less its prefix, to the slots. Anchoring to literals keeps
	// a char inserted out of shape ("1293-12" after typing "9" into "123-12")
	// from shifting the dash onto a class slot and dropping a trailing char.
	// visit(s, i, hit) runs before each step, hit when f[i] fills slot s, and a
	// true return stops the walk. Returns the slot and position it stopped at.
	#walk(f: string, visit: (s: number, i: number, hit: boolean) => unknown): [number, number] {
		const slots = this.#slots;
		let i = 0;
		let s = 0;
		while (s < slots.length && i < f.length) {
			const slot = slots[s];
			const hit = slot.kind === "literal" ? f[i] === slot.ch : slot.test(f[i]);
			if (visit(s, i, hit)) break;
			if (hit) i++;
			if (hit || slot.kind === "literal") {
				s++;
				continue;
			}
			// A char that matches a later literal leaves slot s empty.
			// Else the char is noise and is skipped.
			if (this.#literalAhead(s, f[i])) s++;
			else i++;
		}
		return [s, i];
	}

	#literalAhead(s: number, ch: string): boolean {
		for (let k = s + 1; k < this.#slots.length; k++) {
			const slot = this.#slots[k];
			if (slot.kind === "literal" && slot.ch === ch) return true;
		}
		return false;
	}

	extractRaw(formatted: string): string {
		const f = stripPrefix(formatted, this.#prefix);
		let r = "";
		this.#walk(f, (s, i, hit) => {
			if (hit && this.#slots[s].kind === "class") r += f[i];
		});
		return r;
	}

	// Takes any char a class slot takes, or a mask literal.
	// format() drops a literal already in place, which makes typing a delimiter
	// ("-" in "###-###") a no-op rather than a blocked key.
	acceptsChar(ch: string): boolean {
		for (const slot of this.#slots) {
			if (slot.kind === "class" ? slot.test(ch) : slot.ch === ch) return true;
		}
		return false;
	}

	// The class slot at pos in value. Null on a literal, in the prefix or past the mask.
	#classSlotAt(value: string, pos: number): ClassSlot | null {
		const f = stripPrefix(value, this.#prefix);
		const p = pos - (value.length - f.length);
		const [s, i] = this.#walk(f, (_, at) => at === p);
		const slot = i === p ? this.#slots[s] : undefined;
		return slot?.kind === "class" ? slot : null;
	}

	// The test of the class slot at pos.
	// A cased slot tests either case and applies its case through transform.
	classTestAt(value: string, pos: number): ((c: string) => boolean) | null {
		return this.#classSlotAt(value, pos)?.test ?? null;
	}

	// ch as the class slot at pos stores it, or null when the slot rejects it.
	classAcceptAt(value: string, pos: number, ch: string): string | null {
		const slot = this.#classSlotAt(value, pos);
		if (!slot?.test(ch)) return null;
		return slot.transform ? slot.transform(ch) : ch;
	}

	// Positions of the prefix and the mask literals in value.
	literalPositions(value: string): Set<number> {
		const f = stripPrefix(value, this.#prefix);
		const off = value.length - f.length;
		const set = new Set<number>();
		for (let p = 0; p < off; p++) set.add(p);
		this.#walk(f, (s, i, hit) => {
			if (hit && this.#slots[s].kind === "literal") set.add(off + i);
		});
		return set;
	}
}

// A number field's canonical value, such as "-1234.56".
const CANONICAL_NUMBER = /^-?\d*\.?\d*$/;

class NumberFormatter implements Formatter {
	#decimalPlaces: number;
	#decimalMark: string;
	#thousandsSep: string;
	#prefix: string;

	constructor(decimalPlaces: number, decimalMark: string, thousandsSep: string, prefix: string) {
		this.#decimalPlaces = decimalPlaces;
		this.#decimalMark = decimalMark;
		this.#thousandsSep = thousandsSep;
		this.#prefix = prefix;
	}

	get prefixLength(): number {
		return this.#prefix.length;
	}

	format(raw: string): FormatResult {
		// Raw uses "." whatever the decimal-mark.
		// Other chars come from a paste or a separator extractRaw missed.
		const s = raw.replace(/[^\d.-]/g, "");
		const sign = s.startsWith("-") ? "-" : "";
		// The first "." splits the parts, and later ones drop. decimal-places="0"
		// drops the mark too, which makes "1.5" "1" rather than "1.".
		const [intPart, ...rest] = s.replace(/-/g, "").split(".");
		const dp = this.#decimalPlaces;
		const decPart = rest.length > 0 && dp !== 0 ? rest.join("").slice(0, dp > 0 ? dp : undefined) : null;
		// ".5" gets no "0" seeded, which would surprise mid-typing. The replacer
		// is a function, because replace() reads "$" in a string as a pattern.
		const sep = this.#thousandsSep;
		const grouped = sep ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, () => sep) : intPart;
		return {
			formatted: this.#prefix + sign + grouped + (decPart === null ? "" : this.#decimalMark + decPart),
			raw: sign + grouped.replace(/\D/g, "") + (decPart === null ? "" : `.${decPart}`),
		};
	}

	// The last replace drops paste debris, such as the "$" of "$1,234.50".
	extractRaw(formatted: string): string {
		return stripPrefix(formatted, this.#prefix)
			.replaceAll(this.#thousandsSep, "")
			.replaceAll(this.#decimalMark, ".")
			.replace(/[^\d.-]/g, "");
	}

	acceptsChar(ch: string): boolean {
		if (isDigit(ch)) return true;
		if (ch === "-") return true;
		if (ch === "." || ch === this.#decimalMark) {
			return this.#decimalPlaces !== 0;
		}
		return false;
	}
}

// The shadow shell. The "suggestions" slot projects light-DOM <neo-option>s
// into a fixed listbox the field owns. The options stay light, which keeps
// their lifecycle and lets a server patch them. Without options the slot is inert.
const SHADOW_TEMPLATE = document.createElement("template");
// Notes on the shadow CSS, by selector:
// - input: mirrors the bare-<input> rules in neo-textinput.css through the same
//   inherited --neo-textarea-* tokens, which makes a wrapped field and a bare
//   <input> look the same.
// - input width: --neo-input-min-width is the preferred width an auto-width host
//   sizes to. min-width and max-width 100% pin the field to any definite host
//   width, such as its own, a grid or flex track, or display: block. A min-width
//   floor would beat an explicit width and push the stepper and scrub handle,
//   positioned against the host, into the text.
// - input border: the width token lets neo-input-group zero it and draw 1 border.
// - input height: an <input> floors its content box at the font's normal line
//   height, ~2px over a button. The shared control height lines up single-line
//   controls. neo-input-group sets --neo-input-height to 100% to fill the group.
// - input line-height: matches <neo-button>'s 1, not the body's ~1.5.
// - input:focus-visible outline: the token lets neo-input-group draw 1 ring.
// - :host([popover-fit-content]...) [data-neo-suggest-list]: the positioner
//   leaves the width unset, which sizes the list to its options.
// - input[type="number"] appearance and ::-webkit-*-spin-button: hide the native
//   spin buttons. Firefox reads only appearance, WebKit and Blink only the
//   pseudo-elements.
// - [data-neo-textinput-stepper]: inside the field's border, which keeps the
//   focus ring and the input group's merged border. Its end corners follow the
//   field radius less the border width.
// - --neo-textinput-stepper-inset: end padding on the buttons, which centers
//   the icons clear of a rounded end. The radius caps at half the control
//   height, where a pill clamps it. 0.3 is tuned by eye on a pill.
// - [data-neo-textinput-scrub]: aria-hidden, because the arrow keys and the
//   stepper do its job. A rounded start barely curves at its centered icon,
//   which needs no inset. touch-action: none keeps a drag from scrolling.
//   At scrub-side="end" it sits before the stepper, and the end padding covers both.
// - input:disabled ~ ...: not-allowed, as on the field. A button at a bound or in
//   a readonly field keeps the default cursor, because the control still works.
// - [data-neo-textinput-scrub-cover]: transparent top-layer cover over the viewport
//   during a mouse scrub. Safari takes the cursor from the element under the pointer
//   and ignores pointer capture; the cover inherits the handle's cursor.
// - [data-neo-textinput-stepper] button color: dims the icon through color,
//   which a ::part(increment) color overrides, not through opacity on the icon.
SHADOW_TEMPLATE.innerHTML = `
<style>
  input {
    font: inherit;
    display: block;
    box-sizing: border-box;
    width: var(--neo-input-min-width, 12rem);
    min-width: 100%;
    max-width: 100%;
    background: var(--neo-textarea-bg);
    color: var(--neo-textarea-color);
    border: var(--neo-textarea-border-width, 1px) solid var(--neo-textarea-border-color);
    border-radius: var(--neo-textarea-radius);
    padding: var(--neo-textarea-padding);
    height: var(--neo-input-height, var(--neo-control-height));
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition: border-color var(--neo-duration-hover, calc(120ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease);
  }
  input::placeholder {
    color: var(--muted);
    opacity: 1;
  }
  input:focus-visible {
    outline: var(--neo-textarea-focus-outline, 2px solid var(--neo-textarea-focus-ring));
    outline-offset: 2px;
  }
  input[readonly] {
    opacity: 0.75;
  }
  input:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    background-image: var(--neo-disabled-overlay);
  }
  input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
  input::-webkit-inner-spin-button,
  input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  :host(:state(stepper)) {
    position: relative;
    --neo-textinput-stepper-inset: calc(min(var(--neo-textinput-stepper-radius, max(0px, calc(var(--neo-textarea-radius) - var(--neo-textarea-border-width, 1px)))), var(--neo-control-height) / 2) * 0.3);
  }
  :host(:state(stepper)) input {
    padding-inline-end: calc(var(--neo-textinput-stepper-width, calc(1.5em + var(--neo-textinput-stepper-inset))) + var(--page-spacing, 0.25rem) * 2);
  }
  [data-neo-textinput-stepper] {
    position: absolute;
    inset-block: var(--neo-textarea-border-width, 1px);
    inset-inline-end: var(--neo-textarea-border-width, 1px);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: var(--neo-textinput-stepper-width, calc(1.5em + var(--neo-textinput-stepper-inset)));
    border-inline-start: var(--neo-textarea-border-width, 1px) solid var(--neo-textarea-border-color);
    border-start-end-radius: var(--neo-textinput-stepper-radius, max(0px, calc(var(--neo-textarea-radius) - var(--neo-textarea-border-width, 1px))));
    border-end-end-radius: var(--neo-textinput-stepper-radius, max(0px, calc(var(--neo-textarea-radius) - var(--neo-textarea-border-width, 1px))));
    overflow: hidden;
  }
  [data-neo-textinput-stepper][hidden] {
    display: none;
  }
  [data-neo-textinput-stepper] button {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    padding-inline-end: var(--neo-textinput-stepper-inset);
    border: 0;
    background: transparent;
    color: color-mix(in srgb, currentColor 60%, transparent);
    font: inherit;
    cursor: pointer;
    touch-action: manipulation;
  }
  [data-neo-textinput-stepper] button:hover:enabled {
    background: var(--neo-button-hover-bg);
    color: inherit;
  }
  [data-neo-textinput-stepper] button:active:enabled {
    background: var(--neo-button-active-bg);
  }
  [data-neo-textinput-stepper] button:disabled {
    cursor: default;
    opacity: 0.35;
  }
  input:disabled ~ [data-neo-textinput-stepper] button {
    cursor: not-allowed;
  }
  neo-icon {
    display: block;
    width: 0.75em;
    height: 0.75em;
  }
  [data-neo-textinput-flip] {
    rotate: 180deg;
  }
  :host(:state(scrub)) {
    position: relative;
  }
  :host(:state(scrub):not(:state(scrub-end))) input {
    padding-inline-start: var(--neo-textinput-scrub-width, 1.75em);
  }
  :host(:state(scrub-end)) input {
    padding-inline-end: var(--neo-textinput-scrub-width, 1.75em);
  }
  :host(:state(scrub-end):state(stepper)) input {
    padding-inline-end: calc(var(--neo-textinput-stepper-width, calc(1.5em + var(--neo-textinput-stepper-inset))) + var(--neo-textinput-scrub-width, 1.75em));
  }
  [data-neo-textinput-scrub] {
    position: absolute;
    inset-block: var(--neo-textarea-border-width, 1px);
    inset-inline-start: var(--neo-textarea-border-width, 1px);
    box-sizing: border-box;
    width: var(--neo-textinput-scrub-width, 1.75em);
    display: flex;
    align-items: center;
    justify-content: center;
    color: color-mix(in srgb, currentColor 60%, transparent);
    cursor: ew-resize;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }
  :host(:state(scrub-end)) [data-neo-textinput-scrub] {
    inset-inline-start: auto;
    inset-inline-end: var(--neo-textarea-border-width, 1px);
  }
  :host(:state(scrub-end):state(stepper)) [data-neo-textinput-scrub] {
    inset-inline-end: calc(var(--neo-textarea-border-width, 1px) + var(--neo-textinput-stepper-width, calc(1.5em + var(--neo-textinput-stepper-inset))));
  }
  [data-neo-textinput-scrub][data-neo-textinput-vertical] {
    cursor: ns-resize;
  }
  [data-neo-textinput-scrub][hidden] {
    display: none;
  }
  input:not(:disabled, [readonly]) ~ [data-neo-textinput-scrub]:hover,
  :host(:state(scrubbing)) [data-neo-textinput-scrub] {
    color: inherit;
  }
  input:is(:disabled, [readonly]) ~ [data-neo-textinput-scrub] {
    cursor: default;
    opacity: 0.35;
  }
  input:disabled ~ [data-neo-textinput-scrub] {
    cursor: not-allowed;
  }
  [data-neo-textinput-scrub-cover] {
    inset: 0;
    width: auto;
    height: auto;
    margin: 0;
    border: 0;
    padding: 0;
    background: none;
    cursor: inherit;
  }
  [data-neo-textinput-turn] {
    rotate: 90deg;
  }
  [data-neo-suggest-list] {
    position: fixed;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    gap: var(--neo-select-list-gap, calc(var(--page-spacing, 0.25rem) * 1));
    min-width: var(--neo-input-min-width, 12rem);
    max-width: min(var(--neo-popover-max-width, 22rem), calc(100vw - 1rem));
    max-height: calc(100dvh - 1rem);
    overflow: auto;
    overscroll-behavior: contain;
    padding: var(--neo-select-list-padding, calc(var(--page-spacing, 0.25rem) * 1));
    box-sizing: border-box;
    background: var(--neo-popover-bg, #ffffff);
    color: var(--neo-popover-color, var(--page-fg, #111827));
    border: var(--neo-popover-border-width, 1px) solid var(--neo-popover-border-color, rgba(0, 0, 0, 0.08));
    border-radius: var(--neo-popover-radius, var(--page-radius, 0.25rem));
    box-shadow: var(--neo-popover-shadow, 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05));
    z-index: var(--neo-popover-z-index, 1000);
    transition:
      opacity var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease-out),
      transform var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease-out),
      display var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) allow-discrete;
  }
  :host([popover-fit-content]:not([popover-fit-content="false"])) [data-neo-suggest-list] {
    width: max-content;
  }
  [data-neo-suggest-list][hidden] {
    display: none;
    opacity: 0;
    transform: translateY(-4px);
  }
  @starting-style {
    [data-neo-suggest-list]:not([hidden]) {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-neo-suggest-list] { transition: none; }
  }
</style>
<input />
<div data-neo-suggest-list role="listbox" hidden>
  <slot name="suggestions"></slot>
</div>
`;

// Built on first use, which keeps the icon fetch off fields without a stepper.
// tabindex="-1" keeps the buttons out of the tab order like native spin buttons;
// the field's arrow keys are the keyboard path.
const STEPPER_TEMPLATE = document.createElement("template");
STEPPER_TEMPLATE.innerHTML = `<div data-neo-textinput-stepper part="stepper">
<button type="button" tabindex="-1" data-neo-textinput-increment part="increment"><neo-icon name="chevron-down" data-neo-textinput-flip aria-hidden="true"></neo-icon></button>
<button type="button" tabindex="-1" data-neo-textinput-decrement part="decrement"><neo-icon name="chevron-down" aria-hidden="true"></neo-icon></button>
</div>`;

// Built on first use like STEPPER_TEMPLATE.
// The default horizontal icon is chevrons-up-down turned 90deg.
const SCRUB_TEMPLATE = document.createElement("template");
SCRUB_TEMPLATE.innerHTML = `<div data-neo-textinput-scrub part="scrub" aria-hidden="true"><neo-icon name="chevrons-up-down"></neo-icon><div data-neo-textinput-scrub-cover popover="manual"></div></div>`;

let suggestInstanceCounter = 0;

export class NeoTextInput extends HTMLElement {
	static readonly formAssociated = true;
	static readonly observedAttributes = [
		ATTR_VALUE,
		ATTR_MASK,
		ATTR_FORMAT,
		ATTR_PREFIX,
		ATTR_NUMERIC_ONLY,
		ATTR_CASE,
		ATTR_DECIMAL_PLACES,
		ATTR_DECIMAL_MARK,
		ATTR_THOUSANDS_SEPARATOR,
		ATTR_SUBMIT_RAW,
		ATTR_STEPPER,
		ATTR_INCREMENT_ICON,
		ATTR_DECREMENT_ICON,
		ATTR_INCREMENT_LABEL,
		ATTR_DECREMENT_LABEL,
		ATTR_SCRUB,
		ATTR_SCRUB_ICON,
		ATTR_SCRUB_SIDE,
		ATTR_SCRUB_SENSITIVITY,
		ATTR_OPEN,
		"list",
		...POPOVER_ATTRS,
		...PASSTHROUGH_ATTRS,
	];

	#internals: ElementInternals;
	#innerInput: HTMLInputElement | null = null;
	#formatter: Formatter = new PlainFormatter("", null, false);
	// Reformatting waits for compositionend, which keeps an IME's glyph whole.
	#composing = false;
	#beforeInputState: { value: string; selectionStart: number; raw: string } | null = null;
	// Reconciles suggestion options a server patch adds, removes or changes in place.
	#childObserver = new MutationObserver(() => {
		this.#adoptSuggestions();
		this.#scheduleSuggestionsChanged();
	});

	// The suggestions popover. Focus stays in the field, and the arrow keys
	// move aria-activedescendant over the options.
	#suggestList!: HTMLElement;
	#suggestSlot!: HTMLSlotElement;
	#suggestPrefix = `neo-ti-sug-${suggestInstanceCounter++}`;
	#suggestOpen = false;
	// Escape or a commit keeps a populated slot from reopening the list until
	// the next keystroke or focus.
	#suggestDismissed = false;
	// An open command that came before any option, as when a morph sets `open`
	// ahead of the options. The next reconcile opens the list, focused or not.
	#suggestOpenCommanded = false;
	// Held by reference, which keeps the idle options id-less and morph-stable.
	#suggestActiveEl: HTMLElement | null = null;
	// The option carrying the aria-activedescendant id.
	#activeIdEl: HTMLElement | null = null;
	#observerPauseDepth = 0;
	#suggestAnchorRect: DOMRect | null = null;
	// Set while the component writes `open`,
	// which keeps the write from reading as a command.
	#reflectingSuggestOpen = false;
	// A fat morph can detach the options before inserting their replacements.
	// Reconciling a frame later keeps that empty slot from closing an open list.
	#suggestReconcileFrame: number | null = null;
	#suggestRepositionFrame: number | null = null;
	#suggestOpenScrollHoldUntil = 0;
	#suggestOpenScrollPositionFrame: number | null = null;
	#suggestOpenScrollPositionUntil = 0;
	#stepper: HTMLElement | null = null;
	#stepRepeatTimer = 0;
	#scrub: HTMLElement | null = null;
	#scrubCover: HTMLElement | null = null;
	#scrubAxis: "horizontal" | "vertical" | null = null;
	#scrubEnd = false;
	#scrubSensitivity = SCRUB_SENSITIVITY;
	// The digit group a masked field steps while unfocused,
	// which is the group the caret left on blur or the last one stepped.
	#stepGroup: number | null = null;
	// sign maps pointer travel to the step direction.
	// Up, or toward the inline end, increases.
	#scrubDrag: {
		id: number;
		last: number;
		acc: number;
		start: string;
		vertical: boolean;
		sign: number;
	} | null = null;

	constructor() {
		super();
		this.#internals = this.attachInternals();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(SHADOW_TEMPLATE.content.cloneNode(true));
		this.#suggestList = root.querySelector("[data-neo-suggest-list]")!;
		this.#suggestSlot = root.querySelector('slot[name="suggestions"]')!;
		this.#suggestList.id = `${this.#suggestPrefix}-list`;
		// mousedown's default would blur the field, and the blur would close the
		// list before `click` commits the option.
		this.#suggestList.addEventListener("mousedown", preventDefault);
	}

	connectedCallback() {
		this.#render();
		this.#rebuildFormatter();
		this.#applyValue(this.getAttribute(ATTR_VALUE) ?? "");
		this.#syncPassthrough();
		this.#syncFormValue();
		this.#connectChildObserver();
		this.addEventListener("focusin", this.#onHostFocusIn);
		this.addEventListener("focusout", this.#onHostFocusOut);
		this.addEventListener("click", this.#onSuggestClick);
		this.#suggestSlot.addEventListener("slotchange", this.#onSuggestionsChanged);
		document.addEventListener("pointerdown", this.#onDocPointerDown, true);
		document.addEventListener("focusin", this.#onDocFocusIn, true);
		window.addEventListener("resize", this.#repositionSuggest);
		window.addEventListener("scroll", this.#onSuggestWindowScroll, true);
		window.visualViewport?.addEventListener("resize", this.#repositionSuggest);
		window.visualViewport?.addEventListener("scroll", this.#repositionSuggest);
		this.#adoptSuggestions();
		// The <neo-datalist> named by `list` may have upgraded first.
		this.syncDatalist();
		this.#readScrubAttrs();
		this.#updateRole();
		if (!this.#applyOpenCommand()) this.#maybeOpenSuggest();
	}

	disconnectedCallback() {
		if (this.#suggestReconcileFrame !== null) {
			cancelAnimationFrame(this.#suggestReconcileFrame);
			this.#suggestReconcileFrame = null;
		}
		if (this.#suggestRepositionFrame !== null) {
			cancelAnimationFrame(this.#suggestRepositionFrame);
			this.#suggestRepositionFrame = null;
		}
		this.#cancelSuggestOpenScrollPositioning();
		this.#stopStepRepeat();
		this.#scrubDrag = null;
		setState(this.#internals, "scrubbing", false);
		this.#childObserver.disconnect();
		this.removeEventListener("focusin", this.#onHostFocusIn);
		this.removeEventListener("focusout", this.#onHostFocusOut);
		this.removeEventListener("click", this.#onSuggestClick);
		this.#suggestSlot.removeEventListener("slotchange", this.#onSuggestionsChanged);
		document.removeEventListener("pointerdown", this.#onDocPointerDown, true);
		document.removeEventListener("focusin", this.#onDocFocusIn, true);
		window.removeEventListener("resize", this.#repositionSuggest);
		window.removeEventListener("scroll", this.#onSuggestWindowScroll, true);
		window.visualViewport?.removeEventListener("resize", this.#repositionSuggest);
		window.visualViewport?.removeEventListener("scroll", this.#repositionSuggest);
	}

	#onHostFocusIn = () => {
		// A fresh focus clears an Escape dismiss.
		this.#suggestDismissed = false;
		this.#maybeOpenSuggest();
	};

	// relatedTarget is the host while focus stays in the shadow field,
	// and null or outside once focus leaves.
	#onHostFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		this.#closeSuggest();
	};

	// document.activeElement reports the host, not the shadow field.
	#isInputFocused(): boolean {
		return this.shadowRoot?.activeElement === this.#innerInput;
	}

	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (!this.#innerInput) return;
		switch (name) {
			case ATTR_OPEN:
				if (!this.#reflectingSuggestOpen) this.#applyOpenCommand();
				return;
			case ATTR_SCRUB:
			case ATTR_SCRUB_SIDE:
			case ATTR_SCRUB_SENSITIVITY:
				this.#readScrubAttrs();
				this.#syncStepper();
				return;
			case ATTR_STEPPER:
			case ATTR_INCREMENT_ICON:
			case ATTR_DECREMENT_ICON:
			case ATTR_INCREMENT_LABEL:
			case ATTR_DECREMENT_LABEL:
			case ATTR_SCRUB_ICON:
				this.#syncStepper();
				return;
			case ATTR_VALUE:
				// Absence is no command, which keeps the value across a fat morph that
				// omits it. value="" still clears. A focused field keeps the live text.
				if (value !== null && !this.#isInputFocused()) this.#applyValue(value);
				return;
			case ATTR_SUBMIT_RAW:
				this.#syncFormValue();
				return;
			case "list":
				this.syncDatalist();
				return;
		}
		if (PASSTHROUGH_ATTRS.includes(name)) {
			this.#syncOnePassthrough(name);
			// type, min, max, step, disabled and
			// readonly shape the spinbutton and the stepper.
			this.#updateRole();
			return;
		}
		if ((POPOVER_ATTRS as readonly string[]).includes(name)) {
			this.#positionSuggest();
			return;
		}
		// The rest shape the formatter, which reparses the shown text.
		this.#rebuildFormatter();
		this.#applyRaw(this.#formatter.extractRaw(this.#innerInput.value));
		this.#updateRole();
	}

	// A number field's value is the canonical number, without the separators
	// and the decimal mark of the shown text.
	get value(): string {
		if (!this.#innerInput) return "";
		if (this.#formatter instanceof NumberFormatter) {
			return this.#formatter.extractRaw(this.#innerInput.value);
		}
		return this.#innerInput.value;
	}

	set value(v: string) {
		this.#applyValue(v);
	}

	// Shadows the read-only Element.prefix, which makes a framework property
	// binding (React 19 assigns el.prefix) set the attribute instead of throwing.
	override get prefix(): string {
		return this.getAttribute(ATTR_PREFIX) ?? "";
	}

	override set prefix(v: string) {
		if (v === "") this.removeAttribute(ATTR_PREFIX);
		else this.setAttribute(ATTR_PREFIX, v);
	}

	get rawValue(): string {
		if (!this.#innerInput) return "";
		return this.#formatter.extractRaw(this.#innerInput.value);
	}

	get validity(): ValidityState | null {
		return this.#innerInput?.validity ?? null;
	}

	checkValidity(): boolean {
		return this.#innerInput?.checkValidity() ?? true;
	}

	reportValidity(): boolean {
		return this.#innerInput?.reportValidity() ?? true;
	}

	override focus(opts?: FocusOptions) {
		this.#innerInput?.focus(opts);
	}

	override blur() {
		this.#innerInput?.blur();
	}

	formDisabledCallback(disabled: boolean) {
		if (this.#innerInput) this.#innerInput.disabled = disabled;
		this.#syncStepper();
	}

	formResetCallback() {
		this.#applyValue(this.getAttribute(ATTR_VALUE) ?? "");
	}

	#render() {
		if (this.#innerInput) return;
		const inp = this.shadowRoot!.querySelector<HTMLInputElement>("input")!;
		inp.type = this.getAttribute("type") ?? "text";
		inp.addEventListener("beforeinput", this.#onBeforeInput);
		inp.addEventListener("input", this.#onInput);
		inp.addEventListener("change", this.#onChange);
		inp.addEventListener("compositionstart", this.#onCompositionStart);
		inp.addEventListener("compositionend", this.#onCompositionEnd);
		inp.addEventListener("keydown", this.#onKeyDown);
		inp.addEventListener("blur", this.#onInputBlur);
		this.#innerInput = inp;
	}

	// Watches option attributes too, which reconciles a morph that patches
	// an option in place. The component's own option writes run paused,
	// which keeps them from looping back.
	#connectChildObserver() {
		this.#childObserver.observe(this, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: OPTION_OBSERVE_ATTRS,
		});
	}

	// Disconnects while the component writes option attributes, which drops
	// their records. A flag can't, because the records arrive later.
	// Mirrors NeoListbox.withLightDomObserverPaused.
	#withObserverPaused(fn: () => void) {
		this.#observerPauseDepth += 1;
		if (this.#observerPauseDepth === 1) {
			this.#childObserver.disconnect();
		}
		try {
			fn();
		} finally {
			this.#observerPauseDepth -= 1;
			if (this.#observerPauseDepth === 0 && this.isConnected) {
				this.#connectChildObserver();
			}
		}
	}

	#adoptSuggestions() {
		this.#withObserverPaused(() => {
			this.#syncSuggestSlot();
			this.#wireSuggestions();
		});
	}

	#rebuildFormatter() {
		const prefix = this.getAttribute(ATTR_PREFIX) ?? "";
		if (this.getAttribute(ATTR_FORMAT) === "number") {
			// Datastar's data-attr:mask sets mask="" while its signal is empty,
			// which is no misconfiguration.
			if (this.getAttribute(ATTR_MASK)) {
				console.warn(`${TEXTINPUT_TAG} ignores mask when format="number" is set.`, this);
			}
			let dp = numAttr(this.getAttribute(ATTR_DECIMAL_PLACES), -1);
			if (dp < -1) {
				// -1 is the only unbounded value, which keeps a typo like "-3" from
				// dropping the cap without notice.
				console.warn(`${TEXTINPUT_TAG} decimal-places=${dp} clamped to -1 (unbounded).`, this);
				dp = -1;
			}
			const dm = this.#normalizedDecimalMark();
			const ts = this.getAttribute(ATTR_THOUSANDS_SEPARATOR) ?? ",";
			this.#formatter = new NumberFormatter(dp, dm, ts, prefix);
			return;
		}
		const mask = this.getAttribute(ATTR_MASK);
		if (mask) {
			this.#formatter = new MaskFormatter(mask, prefix);
			return;
		}
		// A mask sets case through its cased letters (U, A, l, a) instead of `case`.
		this.#formatter = new PlainFormatter(prefix, this.#normalizedCase(), boolAttr(this, ATTR_NUMERIC_ONLY, false));
	}

	// 1 enumerated attribute, which makes both cases at once unrepresentable.
	#normalizedCase(): "upper" | "lower" | null {
		const raw = this.getAttribute(ATTR_CASE);
		if (raw !== "upper" && raw !== "lower") return null;
		return raw;
	}

	#normalizedDecimalMark(): string {
		const raw = this.getAttribute(ATTR_DECIMAL_MARK);
		if (raw === null) return ".";
		if (raw !== "." && raw !== ",") {
			console.warn(`${TEXTINPUT_TAG} decimal-mark must be "." or ","; falling back to ".".`, this);
			return ".";
		}
		return raw;
	}

	// Takes the canonical value or the shown text. A number field reads a
	// canonical-looking string as canonical, which keeps thousands-separator="."
	// from taking the decimal point of "1234.56" for a separator.
	#applyValue(value: string) {
		const fmt = this.#formatter;
		this.#applyRaw(fmt instanceof NumberFormatter && CANONICAL_NUMBER.test(value) ? value : fmt.extractRaw(value));
	}

	#applyRaw(raw: string) {
		if (!this.#innerInput) return;
		this.#innerInput.value = this.#formatter.format(raw).formatted;
		this.#syncFormValue();
		this.#syncStepper();
	}

	#syncPassthrough() {
		for (const a of PASSTHROUGH_ATTRS) this.#syncOnePassthrough(a);
	}

	#syncOnePassthrough(attr: string) {
		const inp = this.#innerInput;
		if (!inp) return;
		if (BOOL_PASSTHROUGH_ATTRS.includes(attr)) {
			if (boolAttr(this, attr, false)) inp.setAttribute(attr, "");
			else inp.removeAttribute(attr);
			return;
		}
		const v = this.getAttribute(attr);
		if (v === null) inp.removeAttribute(attr);
		else inp.setAttribute(attr, v);
	}

	// A number field's value is already the canonical number.
	#syncFormValue() {
		if (!this.#innerInput) return;
		this.#internals.setFormValue(boolAttr(this, ATTR_SUBMIT_RAW, false) ? this.rawValue : this.value);
	}

	#onCompositionStart = () => {
		this.#composing = true;
	};

	#onCompositionEnd = (e: Event) => {
		this.#composing = false;
		// Not every browser fires an input event after compositionend.
		this.#onInput(e as InputEvent);
	};

	#onBeforeInput = (e: InputEvent) => {
		const inp = this.#innerInput!;
		if (inp.disabled || inp.readOnly || this.#composing) return;
		const fmt = this.#formatter;
		const { value, selectionStart: start, selectionEnd: end } = inp;
		const raw = fmt.extractRaw(value);
		this.#beforeInputState = { value, selectionStart: start ?? value.length, raw };
		const data = e.data;
		if (fmt instanceof MaskFormatter && e.inputType === "insertText" && data && start !== null && end !== null) {
			// Typing over a longer selection fills its class slots 1 char at a time.
			// The browser's replace-and-reformat would repack raw and drop a trailing
			// char ("123-456" with "123" selected, typing "777" gives "777-45").
			if (end - start > data.length) {
				e.preventDefault();
				this.#writeMask(inp, fmt, data, start, end);
				return;
			}
			// At a caret, the char goes to the next class slot past any literal.
			// - The slot rejects it: drop it. acceptsChar lets 'a' through on a digit
			//   slot when another slot takes letters, and the reformat would then drop
			//   a trailing raw char.
			// - Every class slot is filled: overstrike. Insert-and-reformat would push
			//   a char past the mask's end ("99|9-111" + "8" gives "998-91").
			// - Room is left: the browser inserts, and the literal-anchored extractRaw
			//   shifts the rest right ("12|3-12" + "9" gives "129-312").
			if (start === end) {
				const literals = fmt.literalPositions(value);
				let cur = start;
				while (cur < value.length && literals.has(cur)) cur++;
				const test = fmt.classTestAt(value, cur);
				if (test) {
					if (!test(data[0])) {
						e.preventDefault();
						this.#beforeInputState = null;
						return;
					}
					if (cur < value.length && raw.length >= fmt.classSlotCount) {
						e.preventDefault();
						this.#writeMask(inp, fmt, data, cur, null);
						return;
					}
				}
			}
		}
		// A delete or a paste lands, and #onInput reformats it,
		// which takes "$1,234.50" into a number field.
		if (
			!data ||
			e.inputType.startsWith("delete") ||
			e.inputType === "insertReplacementText" ||
			e.inputType === "insertFromPaste"
		) {
			return;
		}
		// 1 accepted char keeps the run, and format() strips the rest.
		// This stops 'a' on a digit mask without breaking a mixed paste.
		if (![...data].some((ch) => fmt.acceptsChar(ch))) e.preventDefault();
	};

	// Re-emits input from the host, where frameworks listen.
	#emitInput(value = this.value, rawValue = this.rawValue): void {
		this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
		this.dispatchEvent(
			new CustomEvent("neo-textinput-input", {
				bubbles: true,
				composed: true,
				detail: { value, rawValue },
			}),
		);
	}

	// Writes data 1 char per class slot from start, skipping mask literals,
	// which keeps the raw chars after it in place. Over a selection it stops at end,
	// skips a char a slot rejects and leaves the rest selected for the next keys.
	// At a caret (end null) it overstrikes to the value's end, which a `*` slot
	// taking a 2-unit char grows. It stops at a rejected char and parks the caret
	// past any literals, on the next class slot.
	#writeMask(inp: HTMLInputElement, fmt: MaskFormatter, data: string, start: number, end: number | null) {
		const literals = fmt.literalPositions(inp.value);
		let v = inp.value;
		let p = start;
		const skipLiterals = () => {
			while (p < (end ?? v.length) && literals.has(p)) p++;
		};
		for (const ch of data) {
			skipLiterals();
			if (p >= (end ?? v.length)) break;
			const out = fmt.classAcceptAt(v, p, ch);
			if (out === null) {
				if (end === null) break;
				continue;
			}
			v = v.slice(0, p) + out + v.slice(p + 1);
			p++;
		}
		skipLiterals();
		inp.value = v;
		inp.setSelectionRange(p, end ?? p);
		this.#beforeInputState = null;
		this.#syncFormValue();
		// v, not this.value, which the browser's sanitizing can have changed.
		this.#emitInput(v, fmt.extractRaw(v));
	}

	#onInput = (e: InputEvent | Event) => {
		if (this.#composing) return;
		const inp = this.#innerInput!;
		const beforeInputState = this.#beforeInputState;
		this.#beforeInputState = null;
		const raw = this.#formatter.extractRaw(inp.value);
		let { formatted, raw: canonRaw } = this.#formatter.format(raw);

		// A backward delete that left raw as it was removed a literal, which the
		// reformat would put back. Drop the raw char before it too, or backspace
		// looks stuck. Raw is the signal, not the text, because the mask re-emits
		// trailing literals and the reformatted text can come out longer.
		const ie = e as InputEvent;
		if (ie.inputType === "deleteContentBackward" && beforeInputState?.raw === canonRaw && canonRaw.length > 0) {
			const rawCursor = this.#formatter.extractRaw(
				beforeInputState.value.slice(0, beforeInputState.selectionStart),
			).length;
			if (rawCursor === canonRaw.length) {
				canonRaw = canonRaw.slice(0, -1);
			} else if (rawCursor > 0) {
				canonRaw = canonRaw.slice(0, rawCursor - 1) + canonRaw.slice(rawCursor);
			}
			const reformatted = this.#formatter.format(canonRaw);
			formatted = reformatted.formatted;
			canonRaw = reformatted.raw;
		}

		// An unchanged text keeps the browser's caret. Writing it back would fire
		// a stray selectionchange and can disturb IME and autofill state.
		if (formatted !== inp.value) {
			const oldCursor = inp.selectionStart;
			const beforeCaret = inp.value.slice(0, oldCursor ?? 0);
			inp.value = formatted;
			// type="email", "number" and others have no caret,
			// and setSelectionRange throws on them.
			if (oldCursor !== null) {
				// The caret goes to the largest p whose formatted[0..p] holds
				// oldRawCursor raw chars, which is past the literals that follow them.
				// Stopping at the first such p would put it at 1 for oldRawCursor 0,
				// which bounces the caret after a backspace at 1 in plain text.
				const oldRawCursor = this.#formatter.extractRaw(beforeCaret).length;
				let newCursor = formatted.length;
				if (oldRawCursor < canonRaw.length) {
					// The walk starts past the prefix. extractRaw doesn't strip
					// a partial prefix ("I" of "ID-") and counts it as raw. O(N^2)
					// extractRaw calls, fine under ~100 chars.
					let p = this.#formatter.prefixLength;
					while (p < formatted.length) {
						p++;
						const c = this.#formatter.extractRaw(formatted.slice(0, p)).length;
						if (c > oldRawCursor) {
							newCursor = p - 1;
							break;
						}
					}
				}
				inp.setSelectionRange(newCursor, newCursor);
			}
		}

		this.#syncFormValue();
		this.#syncStepper();
		this.#emitInput();
		// Typing re-arms the suggestions. A server answering the input event
		// patches in fresh options, and the observer opens the list then.
		this.#suggestDismissed = false;
		this.#maybeOpenSuggest();
	};

	// The native change isn't composed and stops at the shadow root.
	#onChange = () => {
		this.dispatchEvent(new Event("change", { bubbles: true }));
		this.dispatchEvent(
			new CustomEvent("neo-textinput-change", {
				bubbles: true,
				detail: { value: this.value, rawValue: this.rawValue },
			}),
		);
	};

	// Clones the options of the <neo-datalist> named by `list` into a managed
	// container in the suggestions slot, unless the field has inline options.
	// Public, which lets a patched datalist re-run it.
	syncDatalist(): void {
		if (!this.#innerInput) return;
		const datalist = externalDatalistFor(this);
		const managed = this.querySelector<HTMLElement>(':scope > [data-neo-datalist-managed][slot="suggestions"]');
		if (!datalist) {
			if (managed) {
				managed.remove();
				this.#scheduleSuggestionsChanged();
			}
			return;
		}
		let container = managed;
		if (!container) {
			container = document.createElement("div");
			container.setAttribute("data-neo-datalist-managed", "");
			container.setAttribute("slot", "suggestions");
			this.appendChild(container);
		}
		cloneDatalistOptionsInto(container, datalist);
		this.#scheduleSuggestionsChanged();
	}

	// A server patch inserts options without `slot`, and the shadow root has no
	// default slot to render them.
	#syncSuggestSlot() {
		for (const child of Array.from(this.children)) {
			if (
				child instanceof HTMLElement &&
				child.matches("neo-option, neo-optgroup, neo-datalist, [data-neo-empty-results]") &&
				child.getAttribute("slot") !== "suggestions"
			) {
				child.setAttribute("slot", "suggestions");
			}
		}
	}

	#suggestOptionEls(): HTMLElement[] {
		const out: HTMLElement[] = [];
		for (const el of this.#suggestSlot.assignedElements()) {
			if (el.matches("neo-option")) out.push(el as HTMLElement);
			else out.push(...Array.from(el.querySelectorAll<HTMLElement>("neo-option")));
		}
		return out;
	}

	#suggestEnabledEls(): HTMLElement[] {
		return this.#suggestOptionEls().filter((el) => !el.hidden && el.getAttribute("aria-disabled") !== "true");
	}

	// A "No results" row, as in <neo-combobox>. It keeps the list open without options.
	#suggestEmptyEl(): HTMLElement | null {
		for (const el of this.#suggestSlot.assignedElements()) {
			if (el.matches("[data-neo-empty-results]")) return el as HTMLElement;
			const found = el.querySelector<HTMLElement>("[data-neo-empty-results]");
			if (found) return found;
		}
		return null;
	}

	// Selectable options or a "No results" row.
	#hasSuggestContent(): boolean {
		return this.#suggestEnabledEls().length > 0 || this.#suggestEmptyEl() !== null;
	}

	// The option wiring of <neo-select> and <neo-combobox>, without a roving
	// tabindex, because focus stays in the field.
	#wireSuggestions() {
		for (const el of this.#suggestOptionEls()) {
			wireOptionEl(el, readOptionData(el), false);
		}
	}

	#hasSuggestions(): boolean {
		return (
			this.#suggestOpen ||
			this.#suggestSlot
				.assignedElements()
				.some((el) => el.matches("neo-option") || el.querySelector("neo-option") !== null)
		);
	}

	// A combobox while suggestions exist, else a spinbutton on a number field.
	// aria-controls can't point from the shadow field to the light-DOM options,
	// which leaves #pointActiveDescendant to link the active one.
	#updateRole() {
		const inp = this.#innerInput;
		if (!inp) return;
		if (this.#hasSuggestions()) {
			setAttrIfChanged(inp, "role", "combobox");
			setAttrIfChanged(inp, "aria-autocomplete", "list");
			setAttrIfChanged(inp, "aria-expanded", String(this.#suggestOpen));
		} else {
			// A native type="number" field is a spinbutton already.
			if (this.#isNumber() && inp.type !== "number") setAttrIfChanged(inp, "role", "spinbutton");
			else inp.removeAttribute("role");
			inp.removeAttribute("aria-autocomplete");
			inp.removeAttribute("aria-expanded");
			this.#pointActiveDescendant(null);
		}
		this.#syncStepper();
	}

	// A masked field steps its digit groups only with a stepper or a scrub handle.
	// A card or phone mask has digit groups but no use for stepping.
	#isMaskStep(): boolean {
		return (
			this.#formatter instanceof MaskFormatter &&
			this.#formatter.digitGroups.length > 0 &&
			(boolAttr(this, ATTR_STEPPER, false) || this.#scrubAxis !== null)
		);
	}

	#isNumber(): boolean {
		return this.#formatter instanceof NumberFormatter || this.#innerInput?.type === "number";
	}

	// Syncs the spinbutton values and the stepper buttons to the field.
	#syncStepper() {
		const inp = this.#innerInput;
		if (!inp) return;
		const isNumber = this.#isNumber();
		const raw = isNumber ? this.value : "";
		const cur = raw === "" ? Number.NaN : Number(raw);
		const min = numAttr(this.getAttribute("min"), Number.NaN);
		const max = numAttr(this.getAttribute("max"), Number.NaN);
		const spin = inp.getAttribute("role") === "spinbutton";
		setOrRemoveAttr(inp, "aria-valuenow", spin && Number.isFinite(cur) ? String(cur) : null);
		// The display text carries the prefix and separators, which aria-valuenow drops.
		setOrRemoveAttr(inp, "aria-valuetext", spin && inp.value !== "" ? inp.value : null);
		setOrRemoveAttr(inp, "aria-valuemin", spin && Number.isFinite(min) ? String(min) : null);
		setOrRemoveAttr(inp, "aria-valuemax", spin && Number.isFinite(max) ? String(max) : null);

		const maskStep = this.#isMaskStep();
		this.#syncScrub(isNumber || maskStep);
		const show = (isNumber || maskStep) && boolAttr(this, ATTR_STEPPER, false);
		setState(this.#internals, "stepper", show);
		if (!show) {
			if (this.#stepper) this.#stepper.hidden = true;
			return;
		}
		const stepper = this.#ensureStepper();
		stepper.hidden = false;
		const locked = inp.disabled || inp.readOnly;
		const [inc, dec] = stepper.querySelectorAll("button");
		// A masked field's bound depends on the group at the caret, which moves
		// without a value change. Its buttons disable only when locked.
		inc.disabled = locked || (!maskStep && this.#stepTarget(1) === null);
		dec.disabled = locked || (!maskStep && this.#stepTarget(-1) === null);
		// The up chevron is the down one flipped,
		// which keeps the stepper at 1 icon in the set.
		syncIcon(inc, this.getAttribute(ATTR_INCREMENT_ICON), "chevron-down", "data-neo-textinput-flip", true);
		syncIcon(dec, this.getAttribute(ATTR_DECREMENT_ICON), "chevron-down", "data-neo-textinput-flip", false);
		setAttrIfChanged(inc, "aria-label", labelAttr(this, ATTR_INCREMENT_LABEL, "Increase"));
		setAttrIfChanged(dec, "aria-label", labelAttr(this, ATTR_DECREMENT_LABEL, "Decrease"));
	}

	// Inserts a clone of tpl's root right after the field,
	// which puts the newest part first.
	#mount(tpl: HTMLTemplateElement): HTMLElement {
		const el = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
		this.#innerInput!.after(el);
		return el;
	}

	#ensureStepper(): HTMLElement {
		if (this.#stepper) return this.#stepper;
		const stepper = this.#mount(STEPPER_TEMPLATE);
		// mousedown's default would focus the button and blur the field.
		stepper.addEventListener("mousedown", preventDefault);
		stepper.addEventListener("pointerdown", this.#onStepperPointerDown);
		for (const btn of stepper.querySelectorAll("button")) {
			btn.addEventListener("pointerup", this.#stopStepRepeat);
			btn.addEventListener("pointerleave", this.#stopStepRepeat);
			btn.addEventListener("pointercancel", this.#stopStepRepeat);
		}
		this.#stepper = stepper;
		return stepper;
	}

	#onStepperPointerDown = (e: PointerEvent) => {
		if (e.button !== 0) return;
		const btn = (e.target as Element).closest("button");
		if (!btn || btn.disabled) return;
		const n = btn.hasAttribute("data-neo-textinput-increment") ? 1 : -1;
		// A native spin button focuses its field. Skip on touch,
		// where focus opens the virtual keyboard.
		if (e.pointerType !== "touch") this.#innerInput?.focus({ preventScroll: true });
		this.#stopStepRepeat();
		this.#stepBy(n);
		const repeat = () => {
			// A button disabled at min or max gets no pointerup.
			if (btn.disabled || !this.isConnected) {
				this.#stopStepRepeat();
				return;
			}
			this.#stepBy(n);
			this.#stepRepeatTimer = window.setTimeout(repeat, STEP_REPEAT_INTERVAL_MS);
		};
		this.#stepRepeatTimer = window.setTimeout(repeat, STEP_REPEAT_DELAY_MS);
	};

	#stopStepRepeat = () => {
		clearTimeout(this.#stepRepeatTimer);
		this.#stepRepeatTimer = 0;
	};

	// Returns the field text n steps away, or null when the step can't move the value.
	// Follows HTML stepUp/stepDown. An off-grid value first snaps to the step grid
	// (based at min, else 0) in the step direction, and the result clamps to min/max
	// on the grid. step="any" steps by 1 without the grid. An empty field steps from 0.
	#stepTarget(n: number): string | null {
		const inp = this.#innerInput;
		if (!inp) return null;
		const stepAttr = this.getAttribute("step") ?? "";
		const minAttr = this.getAttribute("min") ?? "";
		const anyStep = stepAttr.trim().toLowerCase() === "any";
		const s = numAttr(stepAttr, 1);
		const step = s > 0 ? s : 1;
		const min = numAttr(minAttr, Number.NaN);
		const max = numAttr(this.getAttribute("max"), Number.NaN);
		const base = Number.isFinite(min) ? min : 0;

		const curStr = this.value;
		const cur = curStr === "" ? Number.NaN : Number(curStr);
		const empty = !Number.isFinite(cur);
		const before = empty ? 0 : cur;

		// Fixed decimals avoid float noise (0.1 + 0.2) and keep the
		// typed precision ("1.50" steps to "2.50").
		let dp = Math.max(fractionDigits(stepAttr), fractionDigits(minAttr), fractionDigits(curStr));
		if (this.#formatter instanceof NumberFormatter) {
			const cap = numAttr(this.getAttribute(ATTR_DECIMAL_PLACES), -1);
			if (cap >= 0) dp = Math.min(dp, cap);
		}
		dp = Math.min(dp, 100);
		const shown = (x: number) => x.toFixed(dp);

		let v: number;
		if (anyStep) {
			v = before + n * step;
			if (v < min) v = min;
			if (v > max) v = max;
		} else {
			const at = (k: number) => base + k * step;
			const q = (before - base) / step;
			const near = Math.round(q);
			// Grid tests run at the shown precision. With fewer decimal places
			// than step has, a grid value shows rounded off the grid
			// (step 1.255 at 2 places shows 66.555 as 66.55).
			let k = shown(at(near)) === shown(before) ? near + n : n > 0 ? Math.ceil(q) : Math.floor(q);
			if (shown(at(k)) === shown(before)) {
				// The target rounds back onto the shown value, as every step of
				// 0.025 does at 1 place from most values. Jump to the first grid
				// value past the rounding edge.
				const edge = Number(shown(before)) + (Math.sign(n) * 10 ** -dp) / 2;
				k = n > 0 ? Math.ceil((edge - base) / step) : Math.floor((edge - base) / step);
				// A value exactly on the edge can round either way.
				// The bound guards magnitudes where at(k + 1) === at(k).
				for (let i = 0; i < 4 && shown(at(k)) === shown(before); i++) k += Math.sign(n);
			}
			// base is min.
			if (at(k) < min) k = 0;
			if (at(k) > max) k = Math.floor((max - base) / step + 1e-9);
			v = at(k);
		}
		// A value already past a bound must not move the other way.
		if (!empty && (n > 0 ? v < before : v > before)) return null;

		let raw = shown(v);
		if (Number(raw) === 0) raw = raw.replace("-", "");
		const { formatted } = this.#formatter.format(raw);
		return formatted === inp.value ? null : formatted;
	}

	// commit fires change per step, as a native number field does for keys
	// and spin buttons. A scrub drag passes false and commits on release.
	#stepBy(n: number, commit = true) {
		const inp = this.#innerInput;
		if (!inp || inp.disabled || inp.readOnly) return;
		const fmt = this.#formatter;
		const mask = fmt instanceof MaskFormatter && this.#isMaskStep() ? this.#maskStepTarget(fmt, n) : null;
		const formatted = fmt instanceof MaskFormatter ? (mask?.formatted ?? null) : this.#stepTarget(n);
		if (formatted === null) return;
		inp.value = formatted;
		// The caret stays at the end of the stepped group, which makes the next
		// step move the same group. A field without a caret, as type="email", skips it.
		if (mask && this.#isInputFocused() && inp.selectionStart !== null) inp.setSelectionRange(mask.caret, mask.caret);
		this.#syncFormValue();
		this.#syncStepper();
		this.#emitInput();
		if (commit) this.#onChange();
	}

	#caretGroup(fmt: MaskFormatter): number {
		const inp = this.#innerInput!;
		const pos = (inp.selectionStart ?? inp.value.length) - fmt.prefixLength;
		// The caret right after a group, before the literal that follows,
		// belongs to that group.
		const i = fmt.digitGroups.findIndex((g) => pos <= g.slotEnd);
		return i < 0 ? fmt.digitGroups.length - 1 : i;
	}

	#onInputBlur = () => {
		const fmt = this.#formatter;
		if (fmt instanceof MaskFormatter && this.#isMaskStep()) this.#stepGroup = this.#caretGroup(fmt);
	};

	// Steps 1 digit group of a masked field n steps, like a native time field.
	// The group is the one at the caret, else #stepGroup, else the last.
	// Each group clamps to its part of min and max, written in mask form
	// ("00:00", "23:59"), else 0 and all 9s. step applies to the last group,
	// the others step by 1. A step fills empty groups with their minimum.
	// Returns the field text and caret, or null when the group can't move.
	#maskStepTarget(fmt: MaskFormatter, n: number): { formatted: string; caret: number } | null {
		const inp = this.#innerInput!;
		const groups = fmt.digitGroups;
		let g = this.#isInputFocused() ? this.#caretGroup(fmt) : (this.#stepGroup ?? groups.length - 1);
		if (g >= groups.length) g = groups.length - 1;
		const raw = fmt.extractRaw(inp.value);
		const minRaw = fmt.extractRaw(this.getAttribute("min") ?? "");
		const maxRaw = fmt.extractRaw(this.getAttribute("max") ?? "");
		const width = (grp: MaskGroup) => grp.rawEnd - grp.rawStart;
		const bound = (src: string, grp: MaskGroup, dflt: number) => {
			const part = src.slice(grp.rawStart, grp.rawEnd);
			return part.length === width(grp) ? Number(part) : dflt;
		};
		const lowOf = (grp: MaskGroup) => bound(minRaw, grp, 0);
		const parts = groups.map((grp) => raw.slice(grp.rawStart, grp.rawEnd));

		const target = groups[g];
		const lo = lowOf(target);
		const hi = bound(maxRaw, target, 10 ** width(target) - 1);
		const step = g === groups.length - 1 ? Math.max(1, Math.round(numAttr(this.getAttribute("step"), 1))) : 1;
		let v: number;
		if (parts[g] === "") {
			v = n > 0 ? lo : hi;
		} else {
			const cur = Number(parts[g]);
			const q = (cur - lo) / step;
			v = Number.isInteger(q) ? cur + n * step : lo + (n > 0 ? Math.ceil(q) : Math.floor(q)) * step;
			if (v < lo) v = lo;
			if (v > hi) v = lo + Math.floor((hi - lo) / step) * step;
			// A value already past a bound must not move the other way.
			if (n > 0 ? v < cur : v > cur) return null;
		}
		parts[g] = String(v);
		let next = "";
		for (let r = 0, i = 0; r < fmt.classSlotCount; r++) {
			const grp = groups[i];
			if (grp && r === grp.rawStart) {
				const part = parts[i] === "" ? String(lowOf(grp)) : parts[i];
				next += part.padStart(width(grp), "0");
				r = grp.rawEnd - 1;
				i++;
			} else if (r < raw.length) {
				next += raw[r];
			} else {
				// An empty letter slot, which a step can't fill.
				return null;
			}
		}
		const { formatted } = fmt.format(next);
		this.#stepGroup = g;
		if (formatted === inp.value) return null;
		return { formatted, caret: fmt.prefixLength + target.slotEnd };
	}

	// Warns once per attribute change rather than on every value sync.
	#readScrubAttrs() {
		const v = this.getAttribute(ATTR_SCRUB);
		if (v === null || v === "false") this.#scrubAxis = null;
		else if (v === "" || v === "horizontal") this.#scrubAxis = "horizontal";
		else if (v === "vertical") this.#scrubAxis = "vertical";
		else {
			console.warn(`${TEXTINPUT_TAG} scrub must be "horizontal" or "vertical", got "${v}".`, this);
			this.#scrubAxis = null;
		}
		const side = this.getAttribute(ATTR_SCRUB_SIDE);
		if (side !== null && side !== "start" && side !== "end") {
			console.warn(`${TEXTINPUT_TAG} scrub-side must be "start" or "end", got "${side}".`, this);
		}
		this.#scrubEnd = side === "end";
		const sens = this.getAttribute(ATTR_SCRUB_SENSITIVITY);
		const n = numAttr(sens, Number.NaN);
		if (sens !== null && sens !== "" && !(n > 0)) {
			console.warn(`${TEXTINPUT_TAG} scrub-sensitivity must be a positive number, got "${sens}".`, this);
		}
		this.#scrubSensitivity = n > 0 ? n : SCRUB_SENSITIVITY;
	}

	#syncScrub(steppable: boolean) {
		const show = steppable && this.#scrubAxis !== null;
		setState(this.#internals, "scrub", show);
		setState(this.#internals, "scrub-end", show && this.#scrubEnd);
		if (!show) {
			if (this.#scrub) this.#scrub.hidden = true;
			return;
		}
		const scrub = this.#ensureScrub();
		scrub.hidden = false;
		const vertical = this.#scrubAxis === "vertical";
		scrub.toggleAttribute("data-neo-textinput-vertical", vertical);
		syncIcon(scrub, this.getAttribute(ATTR_SCRUB_ICON), "chevrons-up-down", "data-neo-textinput-turn", !vertical);
	}

	#ensureScrub(): HTMLElement {
		if (this.#scrub) return this.#scrub;
		const scrub = this.#mount(SCRUB_TEMPLATE);
		scrub.addEventListener("pointerdown", this.#onScrubPointerDown);
		scrub.addEventListener("pointermove", this.#onScrubPointerMove);
		scrub.addEventListener("pointerup", this.#onScrubPointerEnd);
		scrub.addEventListener("pointercancel", this.#onScrubPointerEnd);
		scrub.addEventListener("lostpointercapture", this.#onScrubPointerEnd);
		this.#scrub = scrub;
		this.#scrubCover = scrub.querySelector("[data-neo-textinput-scrub-cover]");
		return scrub;
	}

	#onScrubPointerDown = (e: PointerEvent) => {
		const inp = this.#innerInput;
		if (e.button !== 0 || !inp || inp.disabled || inp.readOnly) return;
		// Suppresses the compatibility mousedown, whose default would start a
		// text selection and move focus.
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		if (e.pointerType === "mouse") this.#scrubCover?.showPopover();
		if (e.pointerType !== "touch") inp.focus({ preventScroll: true });
		const vertical = this.#scrubAxis === "vertical";
		this.#scrubDrag = {
			id: e.pointerId,
			last: vertical ? e.clientY : e.clientX,
			acc: 0,
			start: inp.value,
			vertical,
			sign: vertical || isRTL(this) ? -1 : 1,
		};
		setState(this.#internals, "scrubbing", true);
	};

	#onScrubPointerMove = (e: PointerEvent) => {
		const drag = this.#scrubDrag;
		if (!drag || e.pointerId !== drag.id) return;
		const pos = drag.vertical ? e.clientY : e.clientX;
		// acc counts steps, fractions included, which a low sensitivity carries
		// across moves. The tolerance absorbs float sums, as 10 moves at 0.1 add
		// up to 0.9999999999999999.
		drag.acc += (pos - drag.last) * drag.sign * this.#scrubSensitivity;
		drag.last = pos;
		const n = Math.trunc(drag.acc + Math.sign(drag.acc) * 1e-9);
		if (n === 0) return;
		// Travel past min or max is dropped, which makes a reversed drag
		// move the value at once.
		drag.acc -= n;
		this.#stepBy(e.shiftKey ? n * 10 : n, false);
	};

	#onScrubPointerEnd = (e: PointerEvent) => {
		const drag = this.#scrubDrag;
		if (!drag || e.pointerId !== drag.id) return;
		this.#scrubDrag = null;
		setState(this.#internals, "scrubbing", false);
		this.#scrubCover?.hidePopover();
		if (this.#innerInput && this.#innerInput.value !== drag.start) this.#onChange();
	};

	// An IDREF from the shadow field can't reach a light-DOM option, which makes
	// ariaActiveDescendantElement the link. Firefox lacks it and reads the IDREF.
	// Only the active option carries an id, which keeps the idle ones id-less
	// and lets a morph patch them in place.
	#pointActiveDescendant(el: HTMLElement | null) {
		const inp = this.#innerInput;
		if (!inp) return;
		const activeId = `${this.#suggestPrefix}-active`;
		if (this.#activeIdEl && this.#activeIdEl !== el && this.#activeIdEl.id === activeId) {
			this.#activeIdEl.removeAttribute("id");
		}
		this.#activeIdEl = el;
		if ("ariaActiveDescendantElement" in inp) {
			(inp as unknown as { ariaActiveDescendantElement: Element | null }).ariaActiveDescendantElement = el;
		}
		if (el) {
			if (!el.id) el.id = activeId;
			inp.setAttribute("aria-activedescendant", el.id);
		} else {
			inp.removeAttribute("aria-activedescendant");
		}
	}

	// Reconciles after the options changed, through a server patch or a morph.
	#afterSuggestionsChanged() {
		if (this.#suggestActiveEl && !this.#activeEl()) this.#clearActive();
		if (this.#suggestOpen) {
			// A "No results" row counts as content and keeps the list open.
			if (!this.#hasSuggestContent()) this.#closeSuggest();
			else {
				this.#reflectSuggest(true);
				this.#positionSuggest();
				this.#scheduleSuggestReposition();
			}
		} else if (this.#suggestOpenCommanded && this.#hasSuggestContent()) {
			// The options of a deferred open command arrived,
			// which opens the list without focus.
			this.#openSuggest();
		} else {
			this.#maybeOpenSuggest();
		}
		this.#updateRole();
	}

	#onSuggestionsChanged = () => {
		this.#withObserverPaused(() => this.#wireSuggestions());
		this.#scheduleSuggestionsChanged();
	};

	#scheduleSuggestionsChanged() {
		if (this.#suggestReconcileFrame !== null) return;
		this.#suggestReconcileFrame = requestAnimationFrame(() => {
			this.#suggestReconcileFrame = null;
			if (!this.isConnected) return;
			this.#adoptSuggestions();
			this.#afterSuggestionsChanged();
		});
	}

	#maybeOpenSuggest() {
		if (this.#suggestOpen) {
			this.#reflectSuggest(true);
			if (this.#hasSuggestContent()) this.#positionSuggest();
			return;
		}
		if (this.#suggestDismissed) return;
		if (!this.#isInputFocused()) return;
		if (this.#hasSuggestContent()) this.#openSuggest();
	}

	// Applies the `open` command. Absence is no command, and an open list
	// re-asserts the attribute a fat morph stripped.
	// Returns false when there is no command and the list is closed.
	#applyOpenCommand(): boolean {
		const cmd = openCommand(this);
		if (cmd === "open") {
			this.#suggestDismissed = false;
			this.#openSuggest();
		} else if (cmd === "close") this.#closeSuggest();
		else if (this.#suggestOpen) {
			this.#reflectSuggest(true);
			this.#scheduleSuggestionsChanged();
		} else return false;
		return true;
	}

	#openSuggest() {
		if (!this.#hasSuggestContent()) {
			// The command came before the options, as when a morph sets `open` first.
			// #afterSuggestionsChanged opens the list once they land.
			this.#suggestOpenCommanded = true;
			return;
		}
		this.#suggestOpenCommanded = false;
		if (this.#suggestOpen) {
			this.#reflectSuggest(true);
			this.#positionSuggest(true);
			this.#scheduleSuggestReposition();
			return;
		}
		this.#suggestOpen = true;
		this.#reflectSuggest(true);
		this.#suggestList.hidden = false;
		this.#updateRole();
		this.#positionSuggest(true);
	}

	#closeSuggest() {
		this.#suggestOpenCommanded = false;
		if (!this.#suggestOpen) {
			this.#reflectSuggest(false);
			return;
		}
		this.#suggestOpen = false;
		this.#suggestAnchorRect = null;
		this.#cancelSuggestOpenScrollPositioning();
		this.#reflectSuggest(false);
		this.#suggestList.hidden = true;
		this.#clearActive();
		this.#updateRole();
	}

	#reflectSuggest(open: boolean) {
		if (this.hasAttribute(ATTR_OPEN) === open) return;
		this.#reflectingSuggestOpen = true;
		try {
			this.toggleAttribute(ATTR_OPEN, open);
		} finally {
			this.#reflectingSuggestOpen = false;
		}
	}

	// The anchoring of <neo-select> and <neo-combobox>, which follows placement,
	// screen-offset, clamp-placement, min-fit-*, min-open-* and the field width.
	// When the list doesn't fit, scrollIntoView scrolls the field to the middle
	// and holds the list at its open size while it moves.
	#positionSuggest(scrollIntoView = false) {
		const inp = this.#innerInput;
		if (!inp || !this.#suggestOpen) return;
		if (!scrollIntoView && performance.now() < this.#suggestOpenScrollHoldUntil) {
			if (!this.#placeSuggest(inp, true)) this.#scheduleSuggestOpenScrollPositioning();
			return;
		}
		if (this.#placeSuggest(inp, false)) return;
		if (scrollIntoView) {
			this.#suggestOpenScrollHoldUntil = performance.now() + 1000;
			scrollAnchorIntoOpenView(inp);
			if (!this.#placeSuggest(inp, true)) this.#scheduleSuggestOpenScrollPositioning();
			return;
		}
		if (this.#suggestOpenScrollPositionFrame !== null && performance.now() < this.#suggestOpenScrollPositionUntil) {
			return;
		}
		this.#closeSuggest();
	}

	// Anchors the list and returns whether it fits. duringScroll ignores a
	// positioning boundary and holds an unfit list at its open size.
	// Otherwise an unfit pass records nothing.
	// anchorPopoverResult clears the inline max-height to measure, which lets a
	// list it capped fit its options and drops the scroll to 0. Like
	// NeoListbox, keep the scroll across the pass.
	#placeSuggest(inp: HTMLInputElement, duringScroll: boolean): boolean {
		const list = this.#suggestList;
		const scrollTop = list.scrollTop;
		const result = anchorPopoverResult(this, inp, list, { ignorePositioningBoundary: duringScroll });
		if (list.scrollTop !== scrollTop) list.scrollTop = scrollTop;
		if (result.fitsOpenSize) this.#cancelSuggestOpenScrollPositioning();
		else if (duringScroll) applyOpenSizeDuringScroll(this.#suggestList, result);
		else return false;
		this.#suggestAnchorRect = inp.getBoundingClientRect();
		this.dispatchEvent(
			new CustomEvent("neo-popover-position", { bubbles: true, detail: { placement: result.placement } }),
		);
		return result.fitsOpenSize;
	}

	#cancelSuggestOpenScrollPositioning() {
		if (this.#suggestOpenScrollPositionFrame !== null) {
			cancelAnimationFrame(this.#suggestOpenScrollPositionFrame);
			this.#suggestOpenScrollPositionFrame = null;
		}
	}

	#scheduleSuggestOpenScrollPositioning() {
		this.#suggestOpenScrollPositionUntil = performance.now() + 1000;
		if (this.#suggestOpenScrollPositionFrame !== null) return;
		const tick = () => {
			this.#suggestOpenScrollPositionFrame = null;
			const inp = this.#innerInput;
			if (!inp || !this.#suggestOpen || !this.isConnected) return;
			if (this.#placeSuggest(inp, true)) return;
			if (performance.now() < this.#suggestOpenScrollPositionUntil) {
				this.#suggestOpenScrollPositionFrame = requestAnimationFrame(tick);
				return;
			}
			this.#closeSuggest();
		};
		this.#suggestOpenScrollPositionFrame = requestAnimationFrame(tick);
	}

	// A wrapper, which keeps the listener's event from reaching scrollIntoView.
	#repositionSuggest = () => this.#positionSuggest();

	#scheduleSuggestReposition() {
		if (this.#suggestRepositionFrame !== null) return;
		this.#suggestRepositionFrame = requestAnimationFrame(() => {
			this.#suggestRepositionFrame = null;
			this.#positionSuggest();
		});
	}

	// A captured scroll comes from any scroller on the page, such as an
	// autoplaying carousel. Only one that moved the field counts.
	#onSuggestWindowScroll = (e: Event) => {
		// The options are the host's light-DOM children, which puts the host on
		// the path of their scrolls.
		if (!this.#suggestOpen || eventEnters(e, this)) return;
		// In a scroll-scoped boundary, an independent outside scroller moves the
		// list with the field. A scroller carrying the boundary closes it.
		const sb = scopingBoundary(this, "scroll");
		if (sb && isIndependentBoundaryScroll(sb, e.target)) {
			this.#positionSuggest();
			return;
		}
		const inp = this.#innerInput!;
		const now = inp.getBoundingClientRect();
		const prev = this.#suggestAnchorRect;
		if (prev && prev.x === now.x && prev.y === now.y && prev.width === now.width && prev.height === now.height) {
			return;
		}
		if (performance.now() < this.#suggestOpenScrollHoldUntil) {
			this.#placeSuggest(inp, true);
			return;
		}
		const mode = this.getAttribute("follow-scroll");
		if (mode === "always" || mode === "until-trigger-invisible") this.#positionSuggest();
		else this.#closeSuggest();
	};

	#activeEl(): HTMLElement | null {
		const el = this.#suggestActiveEl;
		if (!el?.isConnected) return null;
		return this.#suggestEnabledEls().includes(el) ? el : null;
	}

	// The active option carries aria-selected, per the APG listbox-popup combobox,
	// and neo-option.css paints it from that.
	#setActive(el: HTMLElement | null) {
		this.#clearActive();
		if (!el) return;
		el.setAttribute("aria-selected", "true");
		this.#suggestActiveEl = el;
		this.#pointActiveDescendant(el);
		el.scrollIntoView({ block: "nearest" });
	}

	#clearActive() {
		for (const el of this.#suggestOptionEls()) {
			if (el.getAttribute("aria-selected") === "true") el.setAttribute("aria-selected", "false");
		}
		this.#suggestActiveEl = null;
		this.#pointActiveDescendant(null);
	}

	#moveActive(delta: number) {
		const enabled = this.#suggestEnabledEls();
		if (enabled.length === 0) return;
		const cur = this.#activeEl();
		const idx = cur ? enabled.indexOf(cur) : -1;
		this.#setActive(enabled[(idx + delta + enabled.length) % enabled.length]);
	}

	// The field is free text, which makes the label its value.
	// neo-textinput-select carries the option's value.
	#selectOption(el: HTMLElement) {
		if (el.getAttribute("aria-disabled") === "true") return;
		const label = el.getAttribute("label") ?? el.textContent?.trim() ?? "";
		const value = el.getAttribute("value") ?? el.getAttribute("data-neo-value") ?? label;
		this.value = label;
		const inp = this.#innerInput;
		if (inp) {
			inp.focus();
			const len = inp.value.length;
			try {
				inp.setSelectionRange(len, len);
			} catch {
				// type="email", "number" and others have no selection.
			}
		}
		// The populated slot stays shut until the next keystroke.
		this.#suggestDismissed = true;
		this.#closeSuggest();
		this.#emitInput();
		this.#onChange();
		this.dispatchEvent(new CustomEvent("neo-textinput-select", { bubbles: true, detail: { value, label } }));
	}

	#onKeyDown = (e: KeyboardEvent) => {
		if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
		// Suggestions keep the arrow keys. Shift+arrow keeps selecting text.
		if (!e.shiftKey && (this.#isNumber() || this.#isMaskStep()) && !this.#hasSuggestions()) {
			const n = stepKeyCount(e.key);
			if (n !== 0) {
				e.preventDefault();
				this.#stepBy(n);
				return;
			}
		}
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			// With nothing to suggest, the browser moves the caret to the start or end.
			if (!this.#suggestOpen && !this.#hasSuggestContent()) return;
			e.preventDefault();
			this.#suggestDismissed = false;
			const down = e.key === "ArrowDown";
			if (this.#suggestOpen) {
				this.#moveActive(down ? 1 : -1);
				return;
			}
			this.#openSuggest();
			const enabled = this.#suggestEnabledEls();
			if (enabled.length) this.#setActive(down ? enabled[0] : enabled[enabled.length - 1]);
			return;
		}
		if (e.key === "Enter") {
			const el = this.#suggestOpen ? this.#activeEl() : null;
			if (el) {
				e.preventDefault();
				this.#selectOption(el);
			}
			return;
		}
		if (e.key === "Escape" && this.#suggestOpen) {
			e.preventDefault();
			e.stopPropagation();
			this.#closeSuggest();
			this.#suggestDismissed = true;
		}
	};

	#onSuggestClick = (e: MouseEvent) => {
		const el = (e.target as Element | null)?.closest<HTMLElement>("neo-option");
		if (!el || !this.contains(el) || el.getAttribute("role") !== "option") return;
		this.#selectOption(el);
	};

	// An event outside the field, and inside the dismiss-scoped boundary if there
	// is one, closes the open list. The list sits in the host's shadow root,
	// which puts the host on the path of every event in it.
	#dismissesFrom(e: Event): boolean {
		if (!this.#suggestOpen || eventEnters(e, this)) return false;
		const boundary = scopingBoundary(this, "dismiss");
		return !boundary || eventEnters(e, boundary);
	}

	#onDocPointerDown = (e: PointerEvent) => {
		if (!this.#dismissesFrom(e)) return;
		this.#closeSuggest();
		this.#suggestDismissed = true;
	};

	#onDocFocusIn = (e: FocusEvent) => {
		if (this.#dismissesFrom(e)) this.#closeSuggest();
	};
}

const preventDefault = (e: Event) => e.preventDefault();

function numAttr(s: string | null, fallback: number): number {
	// "" is unset, not the 0 Number("") gives, which keeps decimal-places=""
	// from meaning 0 decimals.
	if (s === null || s === "") return fallback;
	const n = Number(s);
	return Number.isFinite(n) ? n : fallback;
}

// PageUp and PageDown take the larger step the APG spinbutton pattern allows.
function stepKeyCount(key: string): number {
	switch (key) {
		case "ArrowUp":
			return 1;
		case "ArrowDown":
			return -1;
		case "PageUp":
			return 10;
		case "PageDown":
			return -10;
		default:
			return 0;
	}
}

// fractionDigits counts the decimals a number string carries, including
// those an exponent adds ("1e-3" has 3).
function fractionDigits(s: string): number {
	const m = /^[^.eE]*(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s.trim());
	if (!m) return 0;
	return Math.max(0, (m[1]?.length ?? 0) - Number(m[2] ?? 0));
}

// Names part's icon, or gives it dflt and, when markDefault, the mark attribute.
function syncIcon(part: Element, name: string | null, dflt: string, mark: string, markDefault: boolean) {
	const icon = part.querySelector("neo-icon")!;
	const custom = name !== null && name !== "";
	setAttrIfChanged(icon, "name", custom ? name : dflt);
	icon.toggleAttribute(mark, markDefault && !custom);
}

function setOrRemoveAttr(el: Element, name: string, value: string | null) {
	if (value === null) el.removeAttribute(name);
	else setAttrIfChanged(el, name, value);
}

if (!customElements.get("neo-textinput")) {
	customElements.define("neo-textinput", NeoTextInput);
}
