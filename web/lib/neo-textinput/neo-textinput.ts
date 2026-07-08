// The native <input> lives in the host's shadow root so the author's light
// DOM stays clean and immune to fat morphs: a server can re-render the host
// without disturbing the field's focus, caret, or value. Use a plain
// <input> when no formatting is needed (and for type=date/color/file, where
// native UI would clash); the kit's CSS styles bare <input>s identically.

import { boolAttr, openCommand } from "../command";
import { cloneDatalistOptionsInto, externalDatalistFor } from "../neo-datalist";
import { OPTION_OBSERVE_ATTRS, readOptionData, wireOptionEl } from "../neo-listbox";
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
// Shared open command/reflection. Explicit open="true"/"false"
// commands open/close; absence preserves client state across fat morphs.
const ATTR_OPEN = "open";
const TEXTINPUT_TAG = "<neo-textinput>";

// Standard <input> attributes mirrored verbatim to the inner field.
// `name` is intentionally absent: the host is the form-associated
// element and submits its value via internals.setFormValue. Putting
// name on the inner input as well would make it a second named
// submittable in the same form (the spec collects both), so the
// value would land in the form payload twice under the same key.
// Passthrough attrs that are booleans on the native input; mirrored via the
// command contract (bare/="true" set, ="false"/absent clear) rather than
// copied verbatim.
const BOOL_PASSTHROUGH_ATTRS = ["disabled", "readonly", "required", "autofocus"];

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
	// The field lives in the shadow root, so a host-level accessible name
	// must be forwarded to it; the host itself isn't the focusable control.
	"aria-label",
	"aria-labelledby",
	"aria-describedby",
	// type="number" / type="range" companions; browsers ignore them
	// on text-typed fields so unconditional mirroring is harmless.
	"min",
	"max",
	"step",
];

// `literal` slots emit a fixed char; `class` slots consume one
// raw char satisfying `test` and optionally apply `transform` (case
// coercion for U/l/A/a: accept either case, store the canonical
// case so rawValue and display agree).
type MaskSlot =
	| { kind: "literal"; ch: string }
	| { kind: "class"; test: (c: string) => boolean; transform?: (c: string) => string };

interface FormatResult {
	formatted: string;
	raw: string;
}

// format + extractRaw together drive cursor preservation: count raw
// chars up to the cursor, then walk the new formatted value until we
// have that many.
interface Formatter {
	format(raw: string): FormatResult;
	extractRaw(formatted: string): string;
	// Pre-flight keystroke filter; undefined = let it land, reformat after.
	acceptsChar?(ch: string): boolean;
}

// Composable transforms only; applies even without mask/preset.
class PlainFormatter implements Formatter {
	#prefix: string;
	#caseMode: "upper" | "lower" | null;
	#numericOnly: boolean;

	constructor(prefix: string, caseMode: "upper" | "lower" | null, numericOnly: boolean) {
		this.#prefix = prefix;
		this.#caseMode = caseMode;
		this.#numericOnly = numericOnly;
	}

	format(raw: string): FormatResult {
		let r = raw;
		if (this.#numericOnly) r = r.replace(/\D/g, "");
		if (this.#caseMode === "upper") r = r.toUpperCase();
		else if (this.#caseMode === "lower") r = r.toLowerCase();
		return { formatted: this.#prefix + r, raw: r };
	}

	extractRaw(formatted: string): string {
		return this.#prefix && formatted.startsWith(this.#prefix) ? formatted.slice(this.#prefix.length) : formatted;
	}

	acceptsChar(ch: string): boolean {
		if (this.#numericOnly) return /\d/.test(ch);
		return true;
	}
}

class MaskFormatter implements Formatter {
	#slots: MaskSlot[];
	#prefix: string;

	constructor(mask: string, prefix: string) {
		this.#prefix = prefix;
		this.#slots = parseMask(mask);
	}

	format(raw: string): FormatResult {
		let out = this.#prefix;
		let rawOut = "";
		let ri = 0;
		for (const slot of this.#slots) {
			if (slot.kind === "literal") {
				// Emit literals as soon as any raw has landed so internal
				// and trailing delimiters appear right after the preceding
				// class slot is filled (typing "123" into "###-###" lands
				// as "123-", cursor past the dash, and the user can keep typing
				// digits or "type through" the dash as a no-op). Still
				// suppress on a wholly empty raw so the mask doesn't leak
				// into a blank field. The next class slot's own break
				// stops further trailing-literal runaway.
				if (raw.length === 0) break;
				out += slot.ch;
				continue;
			}
			// Skip raw chars that fail the predicate (e.g. punctuation
			// pasted into an `A` slot).
			while (ri < raw.length && !slot.test(raw[ri])) ri++;
			if (ri >= raw.length) break;
			let c = raw[ri++];
			if (slot.transform) c = slot.transform(c);
			out += c;
			rawOut += c;
		}
		return { formatted: out, raw: rawOut };
	}

	// Anchor to literals so an inserted char that pushes the layout
	// out of canonical shape (e.g. "1293-12" after inserting "9" at
	// position 2 in "123-12") doesn't lose trailing raw chars to the
	// misaligned dash. Without anchoring, the slot 5 alnum "consumes"
	// the dash position, skips a real char, and the formatter then
	// emits a short value.
	extractRaw(formatted: string): string {
		let f = formatted;
		if (this.#prefix && f.startsWith(this.#prefix)) f = f.slice(this.#prefix.length);
		let r = "";
		let i = 0;
		let s = 0;
		while (s < this.#slots.length && i < f.length) {
			const slot = this.#slots[s];
			if (slot.kind === "literal") {
				if (f[i] === slot.ch) i++;
				s++;
				continue;
			}
			if (slot.test(f[i])) {
				r += f[i];
				i++;
				s++;
				continue;
			}
			// Class slot doesn't match the char. If the char matches an
			// upcoming literal, the slot is empty; advance the slot,
			// leave the position for the literal slot to consume. Else
			// the char is noise (e.g. a misplaced literal that's already
			// behind us); skip it and retry the same slot.
			let upcoming = false;
			for (let s2 = s + 1; s2 < this.#slots.length; s2++) {
				const ahead = this.#slots[s2];
				if (ahead.kind === "literal" && ahead.ch === f[i]) {
					upcoming = true;
					break;
				}
			}
			if (upcoming) s++;
			else i++;
		}
		return r;
	}

	classSlotCount(): number {
		let n = 0;
		for (const slot of this.#slots) if (slot.kind === "class") n++;
		return n;
	}

	acceptsChar(ch: string): boolean {
		// Accept any char that some class slot would accept, OR any
		// char that matches a literal in the mask. Format strips the
		// duplicate when the literal is already in place, so "type
		// through" a delimiter is a harmless no-op rather than a
		// blocked keystroke (e.g. pressing "-" in "###-###").
		for (const slot of this.#slots) {
			if (slot.kind === "class" ? slot.test(ch) : slot.ch === ch) return true;
		}
		return false;
	}

	// Returns the class slot at position `pos` in `value`, or null
	// when pos sits on a literal, the prefix, or past the mask's end.
	#classSlotAt(value: string, pos: number): MaskSlot | null {
		let f = value;
		let p = pos;
		if (this.#prefix && f.startsWith(this.#prefix)) {
			if (p < this.#prefix.length) return null;
			p -= this.#prefix.length;
			f = f.slice(this.#prefix.length);
		}
		let i = 0;
		let s = 0;
		while (s < this.#slots.length && i <= f.length) {
			if (i === p) {
				const slot = this.#slots[s];
				return slot.kind === "literal" ? null : slot;
			}
			if (i >= f.length) break;
			const slot = this.#slots[s];
			if (slot.kind === "literal") {
				if (f[i] === slot.ch) i++;
				s++;
				continue;
			}
			if (slot.test(f[i])) {
				i++;
				s++;
				continue;
			}
			let upcoming = false;
			for (let s2 = s + 1; s2 < this.#slots.length; s2++) {
				const ahead = this.#slots[s2];
				if (ahead.kind === "literal" && ahead.ch === f[i]) {
					upcoming = true;
					break;
				}
			}
			if (upcoming) s++;
			else i++;
		}
		return null;
	}

	// Loose predicate at position `pos`. Used by the overstrike
	// intercept's slot-mismatch reject (e.g. 'a' on a digit slot is
	// rejected; 'a' on `A` slot is accepted because cased slots use
	// any-case predicates and apply case via transform).
	classTestAt(value: string, pos: number): ((c: string) => boolean) | null {
		const slot = this.#classSlotAt(value, pos);
		return slot && slot.kind === "class" ? slot.test : null;
	}

	// Test `ch` against the class slot at `pos` and apply the slot's
	// case transform (if any). Returns the canonical char to place,
	// or null when the slot rejects `ch`. Used by both overstrike
	// and type-through intercepts.
	classAcceptAt(value: string, pos: number, ch: string): string | null {
		const slot = this.#classSlotAt(value, pos);
		if (slot?.kind !== "class") return null;
		if (!slot.test(ch)) return null;
		return slot.transform ? slot.transform(ch) : ch;
	}

	// Positions in `value` that correspond to mask literals (and the
	// prefix). Used by the selection-replace intercept so a single
	// keystroke walking through a multi-slot selection skips past the
	// dash in "###-AAA" instead of overwriting it.
	literalPositions(value: string): Set<number> {
		const set = new Set<number>();
		let f = value;
		let pfxOff = 0;
		if (this.#prefix && f.startsWith(this.#prefix)) {
			for (let p = 0; p < this.#prefix.length; p++) set.add(p);
			pfxOff = this.#prefix.length;
			f = f.slice(this.#prefix.length);
		}
		let i = 0;
		let s = 0;
		while (s < this.#slots.length && i < f.length) {
			const slot = this.#slots[s];
			if (slot.kind === "literal") {
				if (f[i] === slot.ch) {
					set.add(pfxOff + i);
					i++;
				}
				s++;
				continue;
			}
			if (slot.test(f[i])) {
				i++;
				s++;
				continue;
			}
			// Class slot doesn't match. If the char matches an upcoming
			// literal, treat the current slot as empty so alignment
			// catches up; otherwise it's noise, so skip it.
			let upcoming = false;
			for (let s2 = s + 1; s2 < this.#slots.length; s2++) {
				const ahead = this.#slots[s2];
				if (ahead.kind === "literal" && ahead.ch === f[i]) {
					upcoming = true;
					break;
				}
			}
			if (upcoming) s++;
			else i++;
		}
		return set;
	}
}

function parseMask(mask: string): MaskSlot[] {
	const slots: MaskSlot[] = [];
	for (const c of mask) {
		if (c === "#") slots.push({ kind: "class", test: isDigit });
		else if (c === "U") slots.push({ kind: "class", test: isAlpha, transform: toUpper });
		else if (c === "l") slots.push({ kind: "class", test: isAlpha, transform: toLower });
		else if (c === "A") slots.push({ kind: "class", test: isAlnum, transform: toUpper });
		else if (c === "a") slots.push({ kind: "class", test: isAlnum, transform: toLower });
		else if (c === "X") slots.push({ kind: "class", test: isAlnum });
		else if (c === "*") slots.push({ kind: "class", test: () => true });
		else slots.push({ kind: "literal", ch: c });
	}
	return slots;
}

function isDigit(c: string) {
	return c >= "0" && c <= "9";
}
function isAlpha(c: string) {
	return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z");
}
function isAlnum(c: string) {
	return isDigit(c) || isAlpha(c);
}
function toUpper(c: string) {
	return c.toUpperCase();
}
function toLower(c: string) {
	return c.toLowerCase();
}

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

	format(raw: string): FormatResult {
		// Strip everything except sign, digits, and the dot (raw uses
		// `.` regardless of decimal-mark). Other chars either snuck in
		// via paste or are leftover separators extractRaw missed.
		let s = raw.replace(/[^\d.-]/g, "");
		const neg = s.startsWith("-");
		s = s.replace(/-/g, "");

		// Only the first dot survives.
		const dot = s.indexOf(".");
		let intPart: string;
		let decPart: string | undefined;
		if (dot >= 0) {
			intPart = s.slice(0, dot);
			if (this.#decimalPlaces === 0) {
				// No decimals allowed: drop the mark too, not just the
				// trailing digits, so "1.5" → "1" instead of "1.".
				decPart = undefined;
			} else {
				decPart = s.slice(dot + 1).replace(/\./g, "");
				if (this.#decimalPlaces > 0 && decPart.length > this.#decimalPlaces) {
					decPart = decPart.slice(0, this.#decimalPlaces);
				}
			}
		} else {
			intPart = s;
		}

		// Don't seed "0" for ".5"; it would surprise mid-typing users.
		if (this.#thousandsSep && intPart.length > 0) {
			// Function form to bypass replacement-string specials:
			// a separator containing "$" would otherwise be parsed as
			// a backreference ("$1" → captured digits, "$$" → "$"),
			// corrupting the output.
			const sep = this.#thousandsSep;
			intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, () => sep);
		}

		const sign = neg ? "-" : "";
		const formatted = this.#prefix + sign + intPart + (decPart !== undefined ? this.#decimalMark + decPart : "");
		const rawIntDigits = intPart.replace(/\D/g, "");
		const rawOut = sign + rawIntDigits + (decPart !== undefined ? `.${decPart}` : "");
		return { formatted, raw: rawOut };
	}

	extractRaw(formatted: string): string {
		let f = formatted;
		if (this.#prefix && f.startsWith(this.#prefix)) f = f.slice(this.#prefix.length);
		if (this.#thousandsSep) {
			// split+join handles separators with regex metacharacters.
			f = f.split(this.#thousandsSep).join("");
		}
		if (this.#decimalMark !== ".") {
			f = f.split(this.#decimalMark).join(".");
		}
		// Drop remaining non-numeric debris (e.g. pasted "$1,234.50").
		return f.replace(/[^\d.-]/g, "");
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

// Shadow shell. The native <input> lives in the shadow root (styled
// here via the inherited --neo-textarea-* tokens, which pierce the
// shadow boundary). The named "suggestions" slot still projects light-DOM
// <neo-option> children into a fixed-position listbox: an autocomplete
// popover the field owns. Those stay light so they keep their lifecycle
// and a server can patch them. The slot is inert until an option is
// slotted, so a plain text field pays nothing at runtime.
const SUGGEST_SHADOW_TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - input: the field. Mirrors the bare-<input> rules in neo-textinput.css so
//   a wrapped field and a standalone <input> look identical; both read the
//   same --neo-textarea-* tokens.
// - input border: width tokenized so neo-input-group can zero it (the field
//   merges into the group's shared border instead of drawing its own).
// - input height: an <input> floors its content box at the font's normal line
//   height, ignoring line-height:1, so it lands ~2px taller than a
//   button/select trigger. Pin the height to the shared control height so
//   single-line controls line up; --neo-input-height lets neo-input-group set
//   100% so the field fills the group instead.
// - input line-height: <neo-button> pins line-height: 1; match it so an
//   adjacent field doesn't inherit the body's ~1.5 and land ~0.5em taller.
// - input:focus-visible outline: tokenized so neo-input-group can drop the
//   per-field ring (the group owns the focus outline for the whole control).
// - :host([popover-fit-content]:not([popover-fit-content="false"])) [data-neo-suggest-list]: size to the
//   suggestions instead of forcing the field width, capped like max-width.
SUGGEST_SHADOW_TEMPLATE.innerHTML = `
<style>
  input {
    font: inherit;
    display: block;
    box-sizing: border-box;
    width: 100%;
    background: var(--neo-textarea-bg);
    color: var(--neo-textarea-color);
    border: var(--neo-textarea-border-width, 1px) solid var(--neo-textarea-border-color);
    border-radius: var(--neo-textarea-radius);
    padding: var(--neo-textarea-padding);
    min-width: var(--neo-input-min-width);
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
  input:disabled,
  input[readonly] {
    opacity: 0.75;
  }
  input:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    background-image: var(--neo-disabled-overlay);
  }
  [data-neo-suggest-list] {
    position: fixed;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    gap: var(--neo-navgroup-gap, 0.5rem);
    min-width: var(--neo-input-min-width, 12rem);
    max-width: min(var(--neo-popover-max-width, 22rem), calc(100vw - 1rem));
    max-height: calc(100dvh - 1rem);
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0.25rem;
    box-sizing: border-box;
    background: var(--neo-popover-bg, #ffffff);
    color: var(--neo-popover-color, var(--page-fg, #111827));
    border: var(--neo-popover-border-width, 1px) solid var(--neo-popover-border-color, rgba(0, 0, 0, 0.08));
    border-radius: var(--neo-popover-radius, var(--page-radius, 0.25rem));
    box-shadow: var(--neo-popover-shadow, 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05));
    z-index: var(--neo-popover-z-index, 1000);
    opacity: 1;
    transform: none;
    transition:
      opacity var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease-out),
      transform var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease-out),
      display var(--neo-popover-enter-duration, calc(140ms * var(--neo-duration-scale, 1))) allow-discrete;
  }
  :host([popover-fit-content]:not([popover-fit-content="false"])) [data-neo-suggest-list] {
    /* The positioner leaves width unset in this mode, so size to the
       suggestions, floored by min-width and capped by max-width. */
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
		ATTR_OPEN,
		"list",
		...POPOVER_ATTRS,
		...PASSTHROUGH_ATTRS,
	];

	#internals: ElementInternals;
	#innerInput: HTMLInputElement | null = null;
	#formatter: Formatter = new PlainFormatter("", null, false);
	#rendered = false;
	// Don't reformat mid-glyph during IME composition (CJK soft IMEs
	// etc.); reformat once on compositionend.
	#composing = false;
	#beforeInputState: { value: string; selectionStart: number; raw: string } | null = null;
	// Watches light-DOM children so a server-patched suggestion option set
	// (added / removed <neo-option>) reconciles into the popover. The field
	// itself lives in the shadow root, so a morph can't disturb it.
	#childObserver: MutationObserver | null = null;

	// Suggestions popover (autocomplete). Dormant until an option is
	// slotted; focus never leaves the field. Arrow keys move
	// aria-activedescendant, the field's text stays the value.
	#suggestList!: HTMLElement;
	#suggestSlot!: HTMLSlotElement;
	#suggestPrefix = `neo-ti-sug-${suggestInstanceCounter++}`;
	#suggestOpen = false;
	// Escape (or a commit) suppresses auto-reopen until the next keystroke
	// or a fresh focus, so a still-populated slot can't immediately reopen.
	#suggestDismissed = false;
	// An explicit open command (open / open="true") received while the slot
	// has no content yet, e.g. a morph applies `open` before slotting the
	// options. Recorded so the next reconcile honors the intent once content
	// lands, instead of falling through to the focus-gated auto-open path.
	#suggestOpenCommanded = false;
	// Active option tracked by element reference (not id), so it survives an
	// in-place morph and the idle rows stay id-less / morph-stable.
	#suggestActiveEl: HTMLElement | null = null;
	// The one row currently carrying the transient aria-activedescendant IDREF
	// id, so #pointActiveDescendant can strip it when the active row moves.
	#activeIdEl: HTMLElement | null = null;
	#observerPauseDepth = 0;
	#suggestAnchorRect: DOMRect | null = null;
	// Rendered open state; `open` is its command/reflection.
	// Client-open intent survives a fat morph stripping the attribute.
	#reflectingSuggestOpen = false;
	// A fat morph can briefly detach the suggestions wrapper/options before
	// inserting their replacements. Reconcile once the DOM operation has
	// settled so that transient empty slot does not dismiss an open list.
	#suggestReconcileFrame: number | null = null;
	#suggestRepositionFrame: number | null = null;
	#suggestOpenScrollHoldUntil = 0;
	#suggestOpenScrollPositionFrame: number | null = null;
	#suggestOpenScrollPositionUntil = 0;

	constructor() {
		super();
		this.#internals = this.attachInternals();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(SUGGEST_SHADOW_TEMPLATE.content.cloneNode(true));
		this.#suggestList = root.querySelector("[data-neo-suggest-list]")!;
		this.#suggestSlot = root.querySelector('slot[name="suggestions"]')!;
		this.#suggestList.id = `${this.#suggestPrefix}-list`;
		// Keep focus in the field when an option is clicked: mousedown's
		// default would blur the input, and the blur handler would close the
		// popover before `click` could commit the selection.
		this.#suggestList.addEventListener("mousedown", (e) => e.preventDefault());
	}

	connectedCallback() {
		this.#render();
		this.#rebuildFormatter();
		this.#applyValue(this.getAttribute(ATTR_VALUE) ?? "");
		this.#syncPassthrough();
		this.#syncFormValue();
		this.#observeChildren();
		this.addEventListener("focusin", this.#onHostFocusIn);
		this.addEventListener("focusout", this.#onHostFocusOut);
		this.addEventListener("click", this.#onSuggestClick);
		// Server can patch options in/out of the slot at any time.
		this.#suggestSlot.addEventListener("slotchange", this.#onSuggestionsChanged);
		document.addEventListener("pointerdown", this.#onDocPointerDown, true);
		document.addEventListener("focusin", this.#onDocFocusIn, true);
		window.addEventListener("resize", this.#repositionSuggest);
		window.addEventListener("scroll", this.#onSuggestWindowScroll, true);
		window.visualViewport?.addEventListener("resize", this.#repositionSuggest);
		window.visualViewport?.addEventListener("scroll", this.#repositionSuggest);
		this.#withObserverPaused(() => {
			this.#syncSuggestSlot();
			this.#wireSuggestions();
		});
		// Read suggestions from the external <neo-datalist> this field's
		// list="<id>" points at (it may have upgraded first).
		this.syncDatalist();
		this.#updateComboboxRole();
		// Command `open`: explicit true/false commands obey; absent keeps
		// prior client intent across reconnect/morph.
		const cmd = openCommand(this);
		if (cmd === "open") {
			this.#suggestDismissed = false;
			this.#openSuggest();
		} else if (cmd === "close") {
			this.#closeSuggest();
		} else if (this.#suggestOpen) {
			this.#reflectSuggestOpen();
			this.#scheduleSuggestionsChanged();
		} else {
			this.#maybeOpenSuggest();
		}
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
		this.#childObserver?.disconnect();
		this.#childObserver = null;
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
		// Fresh focus clears a prior Escape dismiss and reopens if the
		// slot already holds suggestions.
		this.#suggestDismissed = false;
		this.#maybeOpenSuggest();
	};

	#onHostFocusOut = (e: FocusEvent) => {
		// relatedTarget is retargeted to the host while focus stays inside the
		// shadow field, so a focusout with no related target (or one outside)
		// means focus genuinely left. The shadow field can't be morphed away,
		// so there's no transient blur to debounce.
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		this.#closeSuggest();
	};

	// Focus check that works across the shadow boundary: document.activeElement
	// reports the host, so compare against the shadow root's active element.
	#isInputFocused(): boolean {
		return this.shadowRoot?.activeElement === this.#innerInput;
	}

	attributeChangedCallback(name: string, _old: string | null, _new: string | null) {
		if (!this.#rendered) return;
		if (name === ATTR_OPEN) {
			if (this.#reflectingSuggestOpen) return;
			const cmd = openCommand(this);
			if (cmd === null) {
				// A fat morph omitted the reflected attribute. Absence is no
				// command, so preserve and re-assert client-open state.
				if (this.#suggestOpen) {
					this.#reflectSuggestOpen();
					this.#scheduleSuggestionsChanged();
				}
			} else if (cmd === "open") {
				this.#suggestDismissed = false;
				this.#openSuggest();
			} else {
				this.#closeSuggest();
			}
			return;
		}
		if (PASSTHROUGH_ATTRS.includes(name)) {
			this.#syncOnePassthrough(name);
			return;
		}
		if (name === ATTR_VALUE) {
			// An absent attribute is no command: a fat morph that omits
			// `value` leaves the current value untouched, like the `open`
			// command contract. An explicit value="" still clears. Skip while
			// the inner field is focused so a write never stomps live typing.
			if (_new !== null && !this.#isInputFocused()) {
				this.#applyValue(_new);
			}
			return;
		}
		if (name === ATTR_SUBMIT_RAW) {
			this.#syncFormValue();
			return;
		}
		if ((POPOVER_ATTRS as readonly string[]).includes(name)) {
			if (this.#suggestOpen) this.#positionSuggest();
			return;
		}
		if (name === "list") {
			this.syncDatalist();
			return;
		}
		// Any other watched attribute changes the formatter shape, so
		// rebuild and re-apply against the current displayed value.
		this.#rebuildFormatter();
		if (this.#innerInput) {
			this.#applyValue(this.#innerInput.value);
		}
	}

	get value(): string {
		if (!this.#innerInput) return "";
		// For format="number", the displayed text carries the thousands
		// separator + localized decimal mark, which are presentation,
		// not part of the number. `value` returns the canonical
		// numeric string (sign + digits + "."); use the raw `<input>`'s
		// `value` directly if you need the formatted display.
		if (this.#formatter instanceof NumberFormatter) {
			return this.#formatter.extractRaw(this.#innerInput.value);
		}
		return this.#innerInput.value;
	}

	set value(v: string) {
		this.#applyValue(v);
	}

	// Reflect `prefix` as a settable property. It shadows the read-only
	// inherited `Element.prefix`, so framework property bindings (React 19
	// assigns `el.prefix`) write the attribute instead of throwing on the
	// getter-only DOM builtin. Parity with `value`.
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
	}

	formResetCallback() {
		this.#applyValue(this.getAttribute(ATTR_VALUE) ?? "");
	}

	#render() {
		if (this.#rendered) return;
		this.#rendered = true;

		const inp = this.shadowRoot!.querySelector<HTMLInputElement>("input")!;
		inp.type = this.getAttribute("type") ?? "text";
		inp.addEventListener("beforeinput", this.#onBeforeInput);
		inp.addEventListener("input", this.#onInput);
		inp.addEventListener("change", this.#onChange);
		inp.addEventListener("compositionstart", this.#onCompositionStart);
		inp.addEventListener("compositionend", this.#onCompositionEnd);
		inp.addEventListener("keydown", this.#onSuggestKeyDown);
		this.#innerInput = inp;
	}

	// A server patch can add or remove suggestion <neo-option> children; the
	// field is in the shadow root, so a morph never touches it.
	#observeChildren() {
		if (!this.#childObserver) {
			this.#childObserver = new MutationObserver(() => {
				if (!this.#rendered || this.#observerPauseDepth > 0) return;
				this.#withObserverPaused(() => {
					this.#syncSuggestSlot();
					this.#wireSuggestions();
				});
				this.#scheduleSuggestionsChanged();
			});
		}
		this.#connectChildObserver();
	}

	// Watch option attributes (disabled/value/…) too, not just childList, so an
	// in-place morph patch reconciles, not only a node swap. The component's
	// own slot/role/aria/data-neo-value writes happen inside #withObserverPaused
	// (observer disconnected), so wiring can't feed back and loop.
	#connectChildObserver() {
		this.#childObserver?.observe(this, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: OPTION_OBSERVE_ATTRS,
		});
	}

	// Disconnect while the component writes its own option attributes, so those
	// writes are dropped rather than observed (the flag-based pause couldn't
	// suppress async attribute records). Mirrors NeoListbox.withLightDomObserverPaused.
	#withObserverPaused(fn: () => void) {
		this.#observerPauseDepth += 1;
		if (this.#observerPauseDepth === 1) this.#childObserver?.disconnect();
		try {
			fn();
		} finally {
			this.#observerPauseDepth -= 1;
			if (this.#observerPauseDepth === 0 && this.isConnected) this.#connectChildObserver();
		}
	}

	#rebuildFormatter() {
		const prefix = this.getAttribute(ATTR_PREFIX) ?? "";
		const numericOnly = this.hasAttribute(ATTR_NUMERIC_ONLY);

		const fmt = this.getAttribute(ATTR_FORMAT);
		if (fmt === "number") {
			// Datastar `data-attr:mask` can land an empty `mask=""` while
			// the bound signal is still empty; that's a no-op, not a
			// misconfiguration. Only warn for a real mask string.
			if (this.getAttribute(ATTR_MASK)) {
				console.warn(`${TEXTINPUT_TAG} ignores mask when format="number" is set.`, this);
			}
			let dp = numAttr(this.getAttribute(ATTR_DECIMAL_PLACES), -1);
			if (dp < -1) {
				// -1 is the only "unbounded" sentinel; clamp other negatives so
				// a typo like "-3" doesn't silently disable the decimal cap.
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
		// `case` is free-form only; masks express case via cased letters (U/A/l/a).
		this.#formatter = new PlainFormatter(prefix, this.#normalizedCase(), numericOnly);
	}

	// Single enumerated attribute so "both cases at once" is unrepresentable.
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

	// Accepts raw or formatted (extractRaw+format round-trips both).
	#applyValue(value: string) {
		if (!this.#innerInput) return;
		const raw = this.#formatter.extractRaw(value);
		const { formatted } = this.#formatter.format(raw);
		this.#innerInput.value = formatted;
		this.#syncFormValue();
	}

	#syncPassthrough() {
		for (const a of PASSTHROUGH_ATTRS) this.#syncOnePassthrough(a);
	}

	#syncOnePassthrough(attr: string) {
		if (!this.#innerInput) return;
		// Boolean passthroughs follow the command contract: a native input
		// reads bare presence, so copying x="false" verbatim would leave it
		// set. Resolve to bare / removed via boolAttr instead.
		if (BOOL_PASSTHROUGH_ATTRS.includes(attr)) {
			if (boolAttr(this, attr, false)) this.#innerInput.setAttribute(attr, "");
			else this.#innerInput.removeAttribute(attr);
			return;
		}
		const v = this.getAttribute(attr);
		if (v === null) this.#innerInput.removeAttribute(attr);
		else this.#innerInput.setAttribute(attr, v);
	}

	#syncFormValue() {
		if (!this.#innerInput) return;
		// Number format always submits the canonical numeric string;
		// thousands separators are presentation, never part of the
		// number a form should receive. For other formats, submit-raw
		// is opt-in.
		const submitRaw = this.hasAttribute(ATTR_SUBMIT_RAW) || this.#formatter instanceof NumberFormatter;
		const v = submitRaw ? this.rawValue : this.#innerInput.value;
		this.#internals.setFormValue(v);
	}

	#onCompositionStart = () => {
		this.#composing = true;
	};

	#onCompositionEnd = (e: Event) => {
		this.#composing = false;
		// The trailing input event isn't fired in every browser, so run
		// the format pass synchronously so the IME's final string
		// lands formatted.
		this.#onInput(e as InputEvent);
	};

	#onBeforeInput = (e: InputEvent) => {
		if (this.#innerInput?.disabled || this.#innerInput?.readOnly) return;
		if (this.#composing) return;
		this.#beforeInputState = this.#innerInput
			? {
					value: this.#innerInput.value,
					selectionStart: this.#innerInput.selectionStart ?? this.#innerInput.value.length,
					raw: this.#formatter.extractRaw(this.#innerInput.value),
				}
			: null;
		// Mask + selection-replace with fewer chars than slots: type-
		// through the selection one class slot per char, skipping mask
		// literals. The default path lets the browser collapse the
		// selection to the inserted run; reformat then reflows raw
		// left-to-right and trailing raw chars shift left, dropping the
		// last one ("123-456" with "123" selected + typing "777" →
		// "777-45" because each intermediate keystroke re-packs raw).
		if (
			this.#innerInput &&
			this.#formatter instanceof MaskFormatter &&
			e.inputType === "insertText" &&
			e.data &&
			e.data.length > 0 &&
			this.#innerInput.selectionStart !== null &&
			this.#innerInput.selectionEnd !== null &&
			this.#innerInput.selectionEnd - this.#innerInput.selectionStart > e.data.length
		) {
			e.preventDefault();
			this.#applyMaskTypeThrough(this.#innerInput, this.#formatter, e.data);
			return;
		}
		// Mask + collapsed cursor: route the keystroke to the next class
		// slot from the cursor, skipping any literal in between. Three
		// outcomes:
		//   - char doesn't fit the slot: reject silently. The
		//     pre-flight is loose (acceptsChar returns true if any slot
		//     would accept) and lets through 'a' on a digit slot; the
		//     reflow drop on reformat then strips a trailing raw char.
		//   - char fits + every class slot already filled: overstrike,
		//     since insert-and-reformat would push a char past the mask
		//     end and format() would drop the last raw char (e.g.
		//     "99|9-111" + "8" without this lands "998-91").
		//   - char fits + room remains in the mask: fall through so the
		//     browser inserts and the literal-anchored extractRaw lets
		//     format() shift trailing chars right correctly (e.g.
		//     "12|3-12" + "9" lands "129-312" instead of overstriking).
		if (
			this.#innerInput &&
			this.#formatter instanceof MaskFormatter &&
			e.inputType === "insertText" &&
			e.data &&
			e.data.length > 0 &&
			this.#innerInput.selectionStart !== null &&
			this.#innerInput.selectionStart === this.#innerInput.selectionEnd
		) {
			const fmt = this.#formatter;
			const value = this.#innerInput.value;
			const literals = fmt.literalPositions(value);
			let cur = this.#innerInput.selectionStart;
			while (cur < value.length && literals.has(cur)) cur++;
			const test = fmt.classTestAt(value, cur);
			if (test) {
				if (!test(e.data[0])) {
					e.preventDefault();
					this.#beforeInputState = null;
					return;
				}
				if (cur < value.length && fmt.extractRaw(value).length >= fmt.classSlotCount()) {
					e.preventDefault();
					this.#applyMaskOverstrike(this.#innerInput, fmt, e.data, cur);
					return;
				}
			}
		}
		// Deletes pass through; the input handler reformats and may
		// collapse a delimiter delete into dropping a raw char too.
		if (e.inputType.startsWith("delete")) return;
		if (e.inputType === "insertReplacementText") return;
		if (e.inputType === "insertFromPaste") {
			// Let paste through and reformat after: better UX for
			// "$1,234.50" into a number input than wholesale rejection.
			return;
		}
		const data = e.data;
		if (!data) return;
		const fmt = this.#formatter;
		if (!fmt.acceptsChar) return;
		// Reject only when EVERY char in the run is rejected; one valid
		// char keeps the run (format() strips the rest); stops 'a' on a
		// digit mask without breaking mixed pastes. Call as a method so
		// acceptsChar keeps its `this` (the formatter).
		let accepted = false;
		for (const ch of data) {
			if (fmt.acceptsChar(ch)) {
				accepted = true;
				break;
			}
		}
		if (!accepted) e.preventDefault();
	};

	// Re-emit input from the host so frameworks listening on the
	// custom element (not the inner field) wake up.
	#emitInput(value: string, rawValue: string): void {
		this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
		this.dispatchEvent(
			new CustomEvent("neo-textinput-input", {
				bubbles: true,
				composed: true,
				detail: { value, rawValue },
			}),
		);
	}

	// Replace one class slot per data char, walking selection from
	// start to end and skipping mask literals so trailing raw stays
	// aligned. The remaining selection is left behind for subsequent
	// keystrokes to chew through. See onBeforeInput for the why.
	#applyMaskTypeThrough(inp: HTMLInputElement, fmt: MaskFormatter, data: string) {
		const selStart = inp.selectionStart!;
		const selEnd = inp.selectionEnd!;
		const literals = fmt.literalPositions(inp.value);
		let cur = selStart;
		let v = inp.value;
		for (const ch of data) {
			while (cur < selEnd && literals.has(cur)) cur++;
			if (cur >= selEnd) break;
			const out = fmt.classAcceptAt(v, cur, ch);
			if (out === null) continue;
			v = v.slice(0, cur) + out + v.slice(cur + 1);
			cur++;
		}
		while (cur < selEnd && literals.has(cur)) cur++;
		inp.value = v;
		inp.setSelectionRange(cur, selEnd);
		this.#beforeInputState = null;
		this.#syncFormValue();
		this.#emitInput(v, fmt.extractRaw(v));
	}

	// Overstrike: replace the class slot under the cursor with each
	// typed char, walking forward and skipping mask literals. After
	// the last placed char, park the cursor past any trailing literal
	// run so the next keystroke lands on the next class slot.
	#applyMaskOverstrike(inp: HTMLInputElement, fmt: MaskFormatter, data: string, startPos: number) {
		const literals = fmt.literalPositions(inp.value);
		let pos = startPos;
		let v = inp.value;
		for (const ch of data) {
			while (pos < v.length && literals.has(pos)) pos++;
			if (pos >= v.length) break;
			const out = fmt.classAcceptAt(v, pos, ch);
			if (out === null) break;
			v = v.slice(0, pos) + out + v.slice(pos + 1);
			pos++;
		}
		while (pos < v.length && literals.has(pos)) pos++;
		inp.value = v;
		inp.setSelectionRange(pos, pos);
		this.#beforeInputState = null;
		this.#syncFormValue();
		this.#emitInput(v, fmt.extractRaw(v));
	}

	#onInput = (e: InputEvent | Event) => {
		if (!this.#innerInput) return;
		if (this.#composing) return;
		const inp = this.#innerInput;
		const beforeInputState = this.#beforeInputState;
		this.#beforeInputState = null;
		const raw = this.#formatter.extractRaw(inp.value);
		let { formatted, raw: canonRaw } = this.#formatter.format(raw);

		// Backspace-at-literal: if a backward delete didn't change raw,
		// the deleted char was a literal, so drop the preceding raw char
		// too. Otherwise the literal gets re-inserted on reformat and
		// backspace looks like a no-op. (Don't gate on `formatted ===
		// inp.value`: the mask formatter re-emits trailing literals,
		// so after deleting one the new formatted is *longer* than
		// inp.value; raw-equality is the load-bearing signal.)
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

		// Skip the rewrite + cursor reset when format produced an
		// identical string. The browser's post-edit cursor is already
		// correct, and writing the same value back fires spurious
		// selectionchange events and can nudge IME / autofill state.
		if (formatted !== inp.value) {
			// Cursor preservation: largest p where formatted[0..p] still
			// has oldRawCursor raw chars, i.e. just past any leading
			// literals after the oldRawCursor-th raw char. Walk forward
			// until c exceeds oldRawCursor, then back up one. Stopping at
			// the first c >= oldRawCursor lands at p=1 whenever
			// oldRawCursor=0, e.g. backspace from position 1 in plain
			// text would bounce the cursor back to position 1.
			const oldCursor = inp.selectionStart ?? inp.value.length;
			const oldRawCursor = this.#formatter.extractRaw(inp.value.slice(0, oldCursor)).length;

			inp.value = formatted;

			let newCursor = formatted.length;
			if (oldRawCursor < canonRaw.length) {
				// Linear walk. O(N²) extractRaw is fine for typical input
				// lengths (<100 chars); a per-formatter index map isn't
				// worth the extra code.
				let p = 0;
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

		this.#syncFormValue();
		this.#emitInput(this.value, this.rawValue);
		// Typing re-arms suggestions; the server patches fresh options in
		// response to the input event, and the slot observer opens then.
		this.#suggestDismissed = false;
		this.#maybeOpenSuggest();
	};

	#onChange = () => {
		this.dispatchEvent(new Event("change", { bubbles: true }));
		this.dispatchEvent(
			new CustomEvent("neo-textinput-change", {
				bubbles: true,
				detail: { value: this.value, rawValue: this.rawValue },
			}),
		);
	};

	// ---- Suggestions (autocomplete) -------------------------------------
	// Inert until a <neo-option> is slotted. The server patches options
	// into the "suggestions" slot; the field stays the value, focus never
	// leaves it, arrow keys move aria-activedescendant.

	// Read suggestions from the external <neo-datalist> this field's list="<id>"
	// points at, when it has no inline source. Public so a patched datalist can re-trigger it;
	// clones land in a managed, slot-assigned container the suggestion wiring
	// reads through. Inline datalists need none of this; they project via the
	// suggestions slot directly.
	syncDatalist(): void {
		if (!this.#rendered) return;
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

	// Project bare <neo-option>/<neo-optgroup> children into the suggestions
	// slot (the default slot is the input's). Server-patched children arrive
	// unslotted; assign here so the popover, not the field row, holds them.
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

	// A non-selectable "No results" status row in the slot (same contract
	// as <neo-combobox>). Its presence keeps the popover open with zero
	// options instead of closing.
	#suggestEmptyEl(): HTMLElement | null {
		for (const el of this.#suggestSlot.assignedElements()) {
			if (el.matches("[data-neo-empty-results]")) return el as HTMLElement;
			const found = el.querySelector<HTMLElement>("[data-neo-empty-results]");
			if (found) return found;
		}
		return null;
	}

	// Something worth showing: selectable options, or a "No results" row.
	#hasSuggestContent(): boolean {
		return this.#suggestEnabledEls().length > 0 || this.#suggestEmptyEl() !== null;
	}

	// Shared role/value/disabled parity with <neo-select>/<neo-combobox>
	// options (wireOptionEl). No id is stamped: options are keyed by
	// data-neo-value, so a fat morph patches them in place instead of replacing
	// id-mismatched nodes, which would tear down and re-animate the open
	// popover. The active row's transient IDREF id lives in
	// #pointActiveDescendant; `false` omits the navgroup roving-focus attrs
	// (focus stays in the field, the active row is tracked by aria-activedescendant).
	#wireSuggestions() {
		for (const el of this.#suggestOptionEls()) {
			wireOptionEl(el, readOptionData(el), false);
		}
	}

	// Combobox semantics only while suggestions exist (or the popover is
	// open); a plain field stays a plain textbox. aria-controls is omitted:
	// it can't resolve from the shadow field to the light-DOM options across
	// roots. The active-option link is carried by #pointActiveDescendant.
	#updateComboboxRole() {
		const inp = this.#innerInput;
		if (!inp) return;
		const active = this.#suggestOptionEls().length > 0 || this.#suggestOpen;
		if (active) {
			if (inp.getAttribute("role") !== "combobox") inp.setAttribute("role", "combobox");
			if (inp.getAttribute("aria-autocomplete") !== "list") inp.setAttribute("aria-autocomplete", "list");
			const expanded = String(this.#suggestOpen);
			if (inp.getAttribute("aria-expanded") !== expanded) inp.setAttribute("aria-expanded", expanded);
		} else {
			inp.removeAttribute("role");
			inp.removeAttribute("aria-autocomplete");
			inp.removeAttribute("aria-expanded");
			this.#pointActiveDescendant(null);
		}
	}

	// The field lives in the shadow root and the options in light DOM, so the
	// aria-activedescendant IDREF can't resolve across roots. Use the element-
	// reference IDL (ariaActiveDescendantElement) as the primary link where
	// supported; keep the IDREF as a same-root fallback / extra signal.
	#pointActiveDescendant(el: HTMLElement | null) {
		const inp = this.#innerInput;
		if (!inp) return;
		// Only the active row carries an id, so the idle option set stays
		// id-less and a morph patches it in place. Strip our id off the row that
		// was active before, then stamp the new one. Firefox lacks the
		// ariaActiveDescendantElement IDL, so the IDREF is its only link.
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

	// Reconcile after the slot's option set changed (server patch or morph).
	#afterSuggestionsChanged() {
		if (this.#suggestActiveEl && !this.#activeEl()) this.#clearActive();
		if (this.#suggestOpen) {
			// Close only when nothing's left to show. A "No results" row
			// counts as content, so the slot going option-less keeps the
			// popover open with the message.
			if (!this.#hasSuggestContent()) this.#closeSuggest();
			else {
				this.#reflectSuggestOpen();
				this.#suggestList.hidden = false;
				this.#positionSuggest();
				this.#scheduleSuggestReposition();
			}
		} else if (this.#suggestOpenCommanded && this.#hasSuggestContent()) {
			// A deferred open command (see #openSuggest): the options have now
			// arrived, so honor it without requiring focus.
			this.#openSuggest();
		} else {
			this.#maybeOpenSuggest();
		}
		this.#updateComboboxRole();
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
			this.#withObserverPaused(() => {
				this.#syncSuggestSlot();
				this.#wireSuggestions();
			});
			this.#afterSuggestionsChanged();
		});
	}

	#maybeOpenSuggest() {
		if (this.#suggestOpen) {
			this.#reflectSuggestOpen();
			if (this.#hasSuggestContent()) {
				this.#suggestList.hidden = false;
				this.#positionSuggest();
			}
			return;
		}
		if (this.#suggestDismissed) return;
		if (!this.#isInputFocused()) return;
		if (this.#hasSuggestContent()) this.#openSuggest();
	}

	#openSuggest() {
		if (!this.#hasSuggestContent()) {
			// Commanded open before any option is slotted (a morph applies
			// `open` ahead of the suggestions). Defer to the next reconcile,
			// which honors the intent once content lands. See
			// #afterSuggestionsChanged.
			this.#suggestOpenCommanded = true;
			return;
		}
		this.#suggestOpenCommanded = false;
		if (this.#suggestOpen) {
			this.#reflectSuggestOpen();
			this.#suggestList.hidden = false;
			this.#positionSuggest({ scrollIntoView: true });
			this.#scheduleSuggestReposition();
			return;
		}
		this.#suggestOpen = true;
		this.#reflectSuggestOpen();
		this.#suggestList.hidden = false;
		this.#updateComboboxRole();
		this.#positionSuggest({ scrollIntoView: true });
	}

	#closeSuggest() {
		this.#suggestOpenCommanded = false;
		if (!this.#suggestOpen) {
			this.#reflectSuggestClosed();
			return;
		}
		this.#suggestOpen = false;
		this.#suggestAnchorRect = null;
		this.#cancelSuggestOpenScrollPositioning();
		this.#reflectSuggestClosed();
		this.#suggestList.hidden = true;
		this.#clearActive();
		this.#updateComboboxRole();
	}

	#reflectSuggestOpen() {
		if (this.hasAttribute(ATTR_OPEN)) return;
		this.#reflectingSuggestOpen = true;
		try {
			this.setAttribute(ATTR_OPEN, "");
		} finally {
			this.#reflectingSuggestOpen = false;
		}
	}

	#reflectSuggestClosed() {
		if (!this.hasAttribute(ATTR_OPEN)) return;
		this.#reflectingSuggestOpen = true;
		try {
			this.removeAttribute(ATTR_OPEN);
		} finally {
			this.#reflectingSuggestOpen = false;
		}
	}

	// Same anchoring as <neo-select>/<neo-combobox>: honors placement,
	// screen-offset, clamp-placement, min-fit-*/min-open-*, and tracks the field width.
	#positionSuggest(opts: { scrollIntoView?: boolean; keepWhenUnfit?: boolean } = {}): boolean {
		const inp = this.#innerInput;
		if (!inp || !this.#suggestOpen) return false;
		if (!opts.scrollIntoView && performance.now() < this.#suggestOpenScrollHoldUntil) {
			const fits = this.#applySuggestOpenScrollPosition(inp);
			if (!fits) this.#scheduleSuggestOpenScrollPositioning();
			return true;
		}
		if (this.#applySuggestPosition(inp)) return true;
		if (opts.scrollIntoView) {
			this.#suggestOpenScrollHoldUntil = performance.now() + 1000;
			scrollAnchorIntoOpenView(inp);
			if (!this.#applySuggestOpenScrollPosition(inp)) this.#scheduleSuggestOpenScrollPositioning();
			return true;
		}
		if (
			opts.keepWhenUnfit ||
			(this.#suggestOpenScrollPositionFrame !== null && performance.now() < this.#suggestOpenScrollPositionUntil)
		) {
			return false;
		}
		this.#closeSuggest();
		return false;
	}

	#applySuggestPosition(inp: HTMLInputElement): boolean {
		const result = anchorPopoverResult(this, inp, this.#suggestList);
		if (!result.fitsOpenSize) {
			return false;
		}
		this.#applySuggestPositionResult(inp, result);
		return true;
	}

	#applySuggestOpenScrollPosition(inp: HTMLInputElement): boolean {
		const result = anchorPopoverResult(this, inp, this.#suggestList, { ignorePositioningBoundary: true });
		if (result.fitsOpenSize) {
			this.#applySuggestPositionResult(inp, result);
			return true;
		}
		applyOpenSizeDuringScroll(this.#suggestList, result);
		this.#suggestList.style.visibility = "";
		this.#suggestAnchorRect = inp.getBoundingClientRect();
		this.dispatchEvent(
			new CustomEvent("neo-popover-position", { bubbles: true, detail: { placement: result.placement } }),
		);
		return false;
	}

	#applySuggestPositionResult(inp: HTMLInputElement, result: ReturnType<typeof anchorPopoverResult>) {
		this.#cancelSuggestOpenScrollPositioning();
		this.#suggestList.style.visibility = "";
		this.#suggestAnchorRect = inp.getBoundingClientRect();
		this.dispatchEvent(
			new CustomEvent("neo-popover-position", { bubbles: true, detail: { placement: result.placement } }),
		);
	}

	#cancelSuggestOpenScrollPositioning() {
		if (this.#suggestOpenScrollPositionFrame !== null) {
			cancelAnimationFrame(this.#suggestOpenScrollPositionFrame);
			this.#suggestOpenScrollPositionFrame = null;
		}
		this.#suggestList.style.visibility = "";
	}

	#scheduleSuggestOpenScrollPositioning() {
		this.#suggestOpenScrollPositionUntil = performance.now() + 1000;
		if (this.#suggestOpenScrollPositionFrame !== null) return;
		const tick = () => {
			this.#suggestOpenScrollPositionFrame = null;
			const inp = this.#innerInput;
			if (!inp || !this.#suggestOpen || !this.isConnected) {
				this.#suggestList.style.visibility = "";
				return;
			}
			if (this.#applySuggestOpenScrollPosition(inp)) return;
			if (performance.now() < this.#suggestOpenScrollPositionUntil) {
				this.#suggestOpenScrollPositionFrame = requestAnimationFrame(tick);
				return;
			}
			this.#closeSuggest();
		};
		this.#suggestOpenScrollPositionFrame = requestAnimationFrame(tick);
	}

	#repositionSuggest = () => {
		if (this.#suggestOpen) this.#positionSuggest();
	};

	#scheduleSuggestReposition() {
		if (this.#suggestRepositionFrame !== null) return;
		this.#suggestRepositionFrame = requestAnimationFrame(() => {
			this.#suggestRepositionFrame = null;
			if (this.#suggestOpen) this.#positionSuggest();
		});
	}

	// Captured scroll events include every unrelated scroller on the page
	// (for example an autoplaying carousel). Only react when scrolling
	// actually moved the input anchor.
	#onSuggestWindowScroll = (e: Event) => {
		if (!this.#suggestOpen) return;
		// Slotted options remain light-DOM children of <neo-textinput>.
		// Native scroll events are not composed through the shadow slot, so
		// listbox-only checks miss option scrolls caused by morph animation.
		// Both host-originated and shadow-list-originated scrolls are internal.
		if (eventEnters(e, this) || eventEnters(e, this.#suggestList)) return;
		// Scoped scroll: only independent outside scrollers follow the field;
		// scrollers that carry the boundary keep the default close behavior.
		const sb = scopingBoundary(this, "scroll");
		if (sb && isIndependentBoundaryScroll(sb, e.target)) {
			this.#positionSuggest();
			return;
		}
		const inp = this.#innerInput;
		if (!inp) return;
		const now = inp.getBoundingClientRect();
		const prev = this.#suggestAnchorRect;
		const moved =
			!prev || prev.x !== now.x || prev.y !== now.y || prev.width !== now.width || prev.height !== now.height;
		if (!moved) return;
		if (performance.now() < this.#suggestOpenScrollHoldUntil) {
			this.#applySuggestOpenScrollPosition(inp);
			return;
		}
		const mode = this.getAttribute("follow-scroll");
		if (mode === "always" || mode === "until-trigger-invisible") {
			this.#positionSuggest();
			return;
		}
		this.#closeSuggest();
	};

	#activeEl(): HTMLElement | null {
		const el = this.#suggestActiveEl;
		if (!el?.isConnected) return null;
		return this.#suggestEnabledEls().includes(el) ? el : null;
	}

	// One option is active at a time. Per APG's listbox-popup combobox the
	// active row carries aria-selected; neo-option.css paints it from that.
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

	// Commit a suggestion: the field is free text, so the visible label
	// becomes the value. Callers needing a canonical id read it off
	// neo-textinput-select.detail.value.
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
				// setSelectionRange is unsupported on type=number/email/etc.
			}
		}
		// Don't let the still-populated slot reopen before the next keystroke.
		this.#suggestDismissed = true;
		this.#closeSuggest();
		this.#emitInput(this.value, this.rawValue);
		this.dispatchEvent(new Event("change", { bubbles: true }));
		this.dispatchEvent(
			new CustomEvent("neo-textinput-change", {
				bubbles: true,
				detail: { value: this.value, rawValue: this.rawValue },
			}),
		);
		this.dispatchEvent(new CustomEvent("neo-textinput-select", { bubbles: true, detail: { value, label } }));
	}

	#onSuggestKeyDown = (e: KeyboardEvent) => {
		if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
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

	#onDocPointerDown = (e: PointerEvent) => {
		if (!this.#suggestOpen) return;
		if (eventEnters(e, this) || eventEnters(e, this.#suggestList)) return;
		const boundary = scopingBoundary(this, "dismiss");
		if (boundary && !eventEnters(e, boundary)) return;
		this.#closeSuggest();
		this.#suggestDismissed = true;
	};

	#onDocFocusIn = (e: FocusEvent) => {
		if (!this.#suggestOpen) return;
		if (eventEnters(e, this) || eventEnters(e, this.#suggestList)) return;
		const boundary = scopingBoundary(this, "dismiss");
		if (boundary && !eventEnters(e, boundary)) return;
		this.#closeSuggest();
	};
}

function numAttr(s: string | null, fallback: number): number {
	// Empty string is "unset", not zero: `Number("")` coerces to 0
	// and would silently flip decimal-places="" into 0 decimals.
	if (s === null || s === "") return fallback;
	const n = Number(s);
	return Number.isFinite(n) ? n : fallback;
}

if (!customElements.get("neo-textinput")) {
	customElements.define("neo-textinput", NeoTextInput);
}
