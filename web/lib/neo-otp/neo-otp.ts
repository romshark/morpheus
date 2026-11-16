// 1 native <input> holds the whole value and draws nothing; the boxes are a
// rendering of its value and selection. Paste, autofill, password managers
// and screen readers then see a single text field.
//
// The value has no gaps. A filled box under the caret holds a 1-char
// selection, which makes typing replace it as in an overtype field.

import { boolAttr } from "../command";
import { retryWhileParsing } from "../document-parsing";
import { setState } from "../internal-state";
import { type ClassSlot, parseMask } from "../mask";
import { setAttrIfChanged } from "../neo-morph-resilient";

interface Edit {
	value: string;
	caret: number;
}

const OTP_TAG = "<neo-otp>";
// 6 digits, the most common one-time code. RFC 4226 section 5.3 requires
// at least 6 for HOTP and TOTP, and most SMS codes use 6.
const DEFAULT_MASK = "######";
const DESCRIPTION_ID = "description";
// The first char of a box key names the part of its span. A "v" key holds
// plain text and has none.
const KEY_PARTS: Record<string, string> = { c: "caret", m: "conceal", p: "placeholder" };
const BOOL_ATTRS = ["disabled", "readonly", "required", "conceal"];
const PASSTHROUGH_ATTRS = ["autocomplete", "inputmode", "autocapitalize", "aria-invalid"];
// The inner field sits in the shadow root, where light-DOM IDREFs and
// labels do not resolve. Their text is copied in instead.
const NAME_ATTRS = ["aria-label", "aria-labelledby", "aria-describedby"];

const TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops
// them. Anchored by selector:
// - :host direction: a code reads left to right also in a right-to-left
//   page, as digits do in Arabic and Hebrew text. The UA [dir] rule loses
//   to :host, which makes the explicit :host([dir="rtl"]) necessary.
// - input: covers the row, which makes the whole row 1 pointer target, and
//   paints nothing. Its value and selection are drawn by the boxes.
// - input:autofill: Chrome paints the autofill background with an
//   !important UA rule. The delayed transition keeps it off the boxes.
// - input + [data-row]: the input precedes the row so its focus, disabled
//   and readonly states reach the boxes through the sibling combinator.
// - [data-slot]: the neo-textinput field box, on the same --neo-textarea-*
//   tokens and --neo-control-height.
// - [part~="caret"]: a border, not a background, which forced colors keep.
// - [part~="conceal"]::before: a content value from a token, which lets a
//   theme swap the glyph.
TEMPLATE.innerHTML = `
<style>
  :host {
    display: inline-flex;
    position: relative;
    vertical-align: middle;
    direction: ltr;
  }
  :host([dir="rtl" i]) {
    direction: rtl;
  }
  input {
    position: absolute;
    inset: 0;
    z-index: 1;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: transparent;
    caret-color: transparent;
    font: inherit;
    cursor: text;
  }
  input::selection {
    background: transparent;
    color: transparent;
  }
  input:autofill {
    -webkit-text-fill-color: transparent;
    transition: background-color 600000s 0s, color 600000s 0s;
  }
  input:disabled {
    cursor: not-allowed;
  }
  [data-row] {
    display: flex;
    align-items: center;
    gap: var(--neo-otp-gap, calc(var(--page-spacing, 0.25rem) * 2));
  }
  [data-slot] {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--neo-otp-slot-width, var(--neo-control-height));
    height: var(--neo-control-height);
    background: var(--neo-textarea-bg);
    color: var(--neo-textarea-color);
    border: var(--neo-textarea-border-width, 1px) solid var(--neo-textarea-border-color);
    border-radius: var(--neo-textarea-radius);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition: border-color var(--neo-duration-hover, calc(120ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease);
  }
  :host([aria-invalid="true"]) [data-slot] {
    border-color: var(--neo-otp-invalid-color);
  }
  input:focus + [data-row] [part~="active"] {
    outline: var(--neo-textarea-focus-outline, 2px solid var(--neo-textarea-focus-ring));
    outline-offset: 2px;
  }
  input[readonly] + [data-row] {
    opacity: 0.75;
  }
  input:disabled + [data-row] {
    opacity: 0.55;
  }
  input:disabled + [data-row] [data-slot] {
    background-image: var(--neo-disabled-overlay);
  }
  [part~="placeholder"],
  [part~="separator"] {
    color: var(--muted);
  }
  [part~="conceal"]::before {
    content: var(--neo-otp-conceal-glyph, "\\2022");
  }
  [part~="caret"] {
    height: 1em;
    border-left: 1px solid currentColor;
    animation: neo-otp-blink 1s step-end infinite;
  }
  @keyframes neo-otp-blink {
    50% {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part~="caret"] {
      animation: none;
    }
  }
  @media (forced-colors: active) {
    [part~="placeholder"] {
      color: GrayText;
    }
  }
</style>
<input type="text" autocomplete="one-time-code" spellcheck="false" autocorrect="off" />
<div data-row aria-hidden="true"></div>
<span id="${DESCRIPTION_ID}" hidden></span>
`;

export class NeoOtp extends HTMLElement {
	static readonly formAssociated = true;
	static readonly observedAttributes = [
		"value",
		"mask",
		"placeholder",
		...BOOL_ATTRS,
		...PASSTHROUGH_ATTRS,
		...NAME_ATTRS,
	];

	#internals: ElementInternals;
	#input: HTMLInputElement;
	#row: HTMLElement;
	#description: HTMLElement;
	#boxes: HTMLElement[] = [];
	// The part names of each box that only a mask change alters.
	#boxParts: string[] = [];
	#slots: ClassSlot[] = [];
	// The mask attribute #slots were built from, undefined before the first build.
	#maskSource: string | null | undefined = undefined;
	#value = "";
	// The value neo-otp-change last fired with; null while incomplete, which
	// lets a retyped code fire again after a reset.
	#committed: string | null = null;
	// A value command not applied yet: null for a removed attribute,
	// undefined for none.
	#pendingValue: string | null | undefined = undefined;
	#syncQueued = false;
	#nameQueued = false;
	#reflecting = false;
	#composing = false;
	// Disabled by a containing <fieldset> or the platform's reading of the
	// host's own `disabled`.
	#formDisabled = false;

	constructor() {
		super();
		this.#internals = this.attachInternals();
		const root = this.attachShadow({ mode: "open", delegatesFocus: true });
		root.appendChild(TEMPLATE.content.cloneNode(true));
		this.#input = root.querySelector("input")!;
		this.#row = root.querySelector("[data-row]")!;
		this.#description = root.getElementById(DESCRIPTION_ID)!;
		const inp = this.#input;
		inp.addEventListener("beforeinput", this.#onBeforeInput);
		inp.addEventListener("input", this.#onInput);
		inp.addEventListener("keydown", this.#onKeyDown);
		inp.addEventListener("click", this.#onClick);
		inp.addEventListener("focus", this.#onFocus);
		inp.addEventListener("blur", this.#paint);
		inp.addEventListener("keyup", this.#paint);
		inp.addEventListener("select", this.#paint);
		inp.addEventListener("selectionchange", this.#paint);
		inp.addEventListener("compositionstart", this.#onCompositionStart);
		inp.addEventListener("compositionend", this.#onCompositionEnd);
		this.addEventListener("click", this.#onHostClick);
	}

	connectedCallback() {
		this.#sync();
	}

	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (name === "value") {
			if (this.#reflecting) return;
			this.#pendingValue = value;
		}
		// A morph sets mask and value in either order. 1 sync after the batch
		// fits a new value to the new mask.
		if (!this.#syncQueued) {
			this.#syncQueued = true;
			queueMicrotask(() => {
				if (this.#syncQueued) this.#sync();
			});
		}
	}

	get value(): string {
		if (this.#syncQueued) this.#sync();
		return this.#value;
	}

	set value(v: string) {
		if (this.#syncQueued) this.#sync();
		this.#command(String(v));
	}

	get form(): HTMLFormElement | null {
		return this.#internals.form;
	}

	get validity(): ValidityState {
		return this.#internals.validity;
	}

	get validationMessage(): string {
		return this.#internals.validationMessage;
	}

	get willValidate(): boolean {
		return this.#internals.willValidate;
	}

	checkValidity(): boolean {
		return this.#internals.checkValidity();
	}

	reportValidity(): boolean {
		return this.#internals.reportValidity();
	}

	formDisabledCallback(disabled: boolean) {
		this.#formDisabled = disabled;
		this.#syncInput();
	}

	formResetCallback() {
		this.#command("");
	}

	formStateRestoreCallback(state: unknown) {
		if (typeof state === "string") this.#command(state);
	}

	#sync() {
		this.#syncQueued = false;
		const mask = this.getAttribute("mask");
		if (mask !== this.#maskSource) this.#applyMask(mask);
		const pending = this.#pendingValue;
		this.#pendingValue = undefined;
		// A morph removed the reflected attribute, which is no command.
		if (pending === null) this.#reflectValue();
		else if (pending !== undefined) this.#command(pending);
		this.#syncInput();
		this.#queueName();
		this.#paint();
	}

	#applyMask(source: string | null) {
		this.#maskSource = source;
		// A data-attr:mask binding can land mask="" before its signal is set.
		let layout = parseMask(source === null || source === "" ? DEFAULT_MASK : source);
		if (!layout.some((s) => s.kind === "class")) {
			console.warn(`${OTP_TAG} mask="${source}" has no character slots; using "${DEFAULT_MASK}".`, this);
			layout = parseMask(DEFAULT_MASK);
		}
		this.#slots = [];
		this.#boxes = [];
		this.#boxParts = [];
		const nodes: HTMLElement[] = [];
		for (const [i, slot] of layout.entries()) {
			const el = document.createElement("div");
			if (slot.kind === "class") {
				// A separator or the row's edge bounds a group, which page CSS
				// can't find with :first-child through ::part().
				let part = "slot";
				if (layout[i - 1]?.kind !== "class") part += " group-start";
				if (layout[i + 1]?.kind !== "class") part += " group-end";
				el.setAttribute("data-slot", "");
				el.setAttribute("part", part);
				this.#slots.push(slot);
				this.#boxes.push(el);
				this.#boxParts.push(part);
			} else {
				el.setAttribute("part", "separator");
				if (slot.ch !== " ") el.textContent = slot.ch;
			}
			nodes.push(el);
		}
		this.#row.replaceChildren(...nodes);
		this.#store(this.#fit(this.#value, 0, true));
	}

	// Sets the value without events, as a server command or a property write.
	#command(raw: string) {
		const v = this.#fit(raw, 0, true);
		this.#store(v);
		this.#committed = v.length === this.#slots.length ? v : null;
		if (this.#isFocused()) this.#placeCaret(v.length);
		else this.#paint();
	}

	#store(value: string) {
		this.#value = value;
		if (this.#input.value !== value) this.#input.value = value;
		this.#internals.setFormValue(value);
		setState(this.#internals, "complete", value.length === this.#slots.length);
		this.#syncValidity();
		this.#reflectValue();
	}

	// An empty value reflects as no attribute, which a template without
	// `value` already matches.
	#reflectValue() {
		const current = this.getAttribute("value");
		if (this.#value === "" ? current === null : current === this.#value) return;
		this.#reflecting = true;
		try {
			if (this.#value === "") this.removeAttribute("value");
			else this.setAttribute("value", this.#value);
		} finally {
			this.#reflecting = false;
		}
	}

	#syncValidity() {
		const n = this.#value.length;
		const total = this.#slots.length;
		if (n === 0 && boolAttr(this, "required", false)) {
			this.#internals.setValidity({ valueMissing: true }, "Fill out this field.", this.#input);
		} else if (n > 0 && n < total) {
			this.#internals.setValidity({ tooShort: true }, `Enter all ${total} characters.`, this.#input);
		} else {
			this.#internals.setValidity({});
		}
	}

	#syncInput() {
		const inp = this.#input;
		const type = boolAttr(this, "conceal", false) ? "password" : "text";
		if (inp.type !== type) {
			inp.type = type;
			if (this.#isFocused()) this.#placeCaret(inp.selectionStart ?? this.#value.length);
		}
		inp.disabled = boolAttr(this, "disabled", false) || this.#formDisabled;
		inp.readOnly = boolAttr(this, "readonly", false);
		inp.required = boolAttr(this, "required", false);
		const digits = this.#slots.every((s) => s.token === "#");
		const letters = this.#slots.filter((s) => s.token !== "#");
		const upper = letters.length > 0 && letters.every((s) => s.token === "U" || s.token === "A");
		this.#mirror("autocomplete", "one-time-code");
		this.#mirror("inputmode", digits ? "numeric" : "text");
		this.#mirror("autocapitalize", upper ? "characters" : "off");
		this.#mirror("aria-invalid", null);
		this.#syncValidity();
	}

	#mirror(attr: string, dflt: string | null) {
		const v = this.getAttribute(attr) ?? dflt;
		if (v === null) this.#input.removeAttribute(attr);
		else setAttrIfChanged(this.#input, attr, v);
	}

	// Deferred to a microtask: a morph that changes aria-describedby may
	// patch the referenced error text after the host. While the document
	// parses, the referenced elements may come after the host.
	#queueName() {
		if (this.#nameQueued) return;
		this.#nameQueued = true;
		queueMicrotask(() => {
			this.#nameQueued = false;
			this.#syncName();
			retryWhileParsing(this, () => this.#syncName());
		});
	}

	#syncName() {
		const label =
			this.getAttribute("aria-label") ?? idrefText(this, "aria-labelledby") ?? labelsText(this.#internals.labels);
		if (label) setAttrIfChanged(this.#input, "aria-label", label);
		else this.#input.removeAttribute("aria-label");
		const description = idrefText(this, "aria-describedby") ?? "";
		if (this.#description.textContent !== description) this.#description.textContent = description;
		if (description) setAttrIfChanged(this.#input, "aria-describedby", DESCRIPTION_ID);
		else this.#input.removeAttribute("aria-describedby");
	}

	#isFocused(): boolean {
		return this.shadowRoot?.activeElement === this.#input;
	}

	// Maps text onto the boxes from index `from`, 1 char per box, in each
	// box's case. With skip, a char its box rejects is dropped; without, the
	// result ends there. A char outside the BMP never fits, which keeps 1
	// UTF-16 unit per box and lets selection offsets index boxes.
	#fit(text: string, from: number, skip: boolean): string {
		let out = "";
		let box = from;
		for (const ch of text) {
			if (box >= this.#slots.length) break;
			const slot = this.#slots[box];
			if (ch.length !== 1 || !slot.test(ch)) {
				if (skip) continue;
				break;
			}
			out += slot.transform ? slot.transform(ch) : ch;
			box++;
		}
		return out;
	}

	// Replaces value[start, end) with text. The tail moves into new boxes
	// and keeps its chars while each fits; with a uniform mask nothing is lost.
	// Returns null when text has chars and none of them fit, which keeps a
	// selected char from being replaced by a rejected key.
	#edit(start: number, end: number, text: string): Edit | null {
		const ins = this.#fit(text, start, true);
		if (text !== "" && ins === "") return null;
		const tail = this.#fit(this.#value.slice(end), start + ins.length, false);
		return { value: this.#value.slice(0, start) + ins + tail, caret: start + ins.length };
	}

	// A pasted or autofilled full code replaces the value wherever the caret is.
	#replaceAll(text: string): Edit | null {
		const v = this.#fit(text, 0, true);
		return v.length === this.#slots.length ? { value: v, caret: v.length } : null;
	}

	#commitEdit(edit: Edit) {
		const changed = edit.value !== this.#value;
		if (changed) this.#store(edit.value);
		else if (this.#input.value !== edit.value) this.#input.value = edit.value;
		this.#placeCaret(edit.caret);
		if (!changed) return;
		this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
		this.#emit("input");
		if (edit.value.length < this.#slots.length) {
			this.#committed = null;
			return;
		}
		if (edit.value === this.#committed) return;
		this.#committed = edit.value;
		this.#emit("change");
		if (boolAttr(this, "autosubmit", false)) this.#internals.form?.requestSubmit();
	}

	#emit(verb: "input" | "change") {
		this.dispatchEvent(new CustomEvent(`neo-otp-${verb}`, { bubbles: true, detail: { value: this.#value } }));
	}

	#placeCaret(index: number) {
		const len = this.#value.length;
		const at = Math.max(0, Math.min(index, len, this.#slots.length - 1));
		if (at < len) this.#input.setSelectionRange(at, at + 1);
		else this.#input.setSelectionRange(at, at);
		this.#paint();
	}

	// Box indexes [start, end) under the selection; a caret or a 1-char
	// selection marks 1 box.
	#activeRange(): [number, number] {
		const s = this.#input.selectionStart ?? 0;
		const e = this.#input.selectionEnd ?? s;
		if (e - s > 1) return [s, e];
		const at = Math.min(s, this.#slots.length - 1);
		return [at, at + 1];
	}

	#paint = () => {
		const focused = this.#isFocused();
		const [start, end] = focused ? this.#activeRange() : [-1, -1];
		const caret = focused && this.#input.selectionStart === this.#input.selectionEnd;
		const conceal = boolAttr(this, "conceal", false);
		const hints = Array.from(this.getAttribute("placeholder") ?? "");
		this.#boxes.forEach((box, i) => {
			const filled = i < this.#value.length;
			const active = i >= start && i < end;
			setAttrIfChanged(box, "part", `${this.#boxParts[i]}${filled ? " filled" : ""}${active ? " active" : ""}`);
			let key: string;
			if (filled) key = conceal ? "m" : `v${this.#value[i]}`;
			else if (active && caret) key = "c";
			else key = `p${(hints.length === 1 ? hints[0] : hints[i]) ?? ""}`;
			if (box.dataset.key === key) return;
			box.dataset.key = key;
			if (key[0] === "v") {
				box.textContent = key.slice(1);
				return;
			}
			if (key === "p") {
				box.replaceChildren();
				return;
			}
			const span = document.createElement("span");
			span.setAttribute("part", KEY_PARTS[key[0]]);
			span.textContent = key.slice(1);
			box.replaceChildren(span);
		});
	};

	#boxAt(x: number): number {
		let best = 0;
		let bestDistance = Number.POSITIVE_INFINITY;
		this.#boxes.forEach((box, i) => {
			const r = box.getBoundingClientRect();
			const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
			if (d < bestDistance) {
				best = i;
				bestDistance = d;
			}
		});
		return best;
	}

	#onBeforeInput = (e: InputEvent) => {
		const type = e.inputType;
		const inp = this.#input;
		// Chrome fires beforeinput on a readonly field and drops the edit after.
		if (inp.readOnly) return;
		// Composition is not cancelable; #onInput refits its result.
		if (type === "insertCompositionText" || e.isComposing) return;
		const len = this.#value.length;
		const start = inp.selectionStart ?? len;
		const end = inp.selectionEnd ?? start;
		let edit: Edit | null = null;
		if (type === "insertLineBreak" || type === "insertParagraph") {
			// Enter is handled on keydown.
		} else if (type.startsWith("insert")) {
			const text = e.data ?? e.dataTransfer?.getData("text/plain") ?? "";
			// A keystroke inserts 1 char. More is a paste, a drop or autofill.
			edit = (text.length > 1 ? this.#replaceAll(text) : null) ?? this.#edit(start, end, text);
		} else if (type === "deleteWordBackward" || type.endsWith("LineBackward")) {
			edit = this.#edit(0, end, "");
		} else if (type === "deleteWordForward" || type.endsWith("LineForward")) {
			edit = this.#edit(start, len, "");
		} else if (type.startsWith("delete")) {
			if (end > start) edit = this.#edit(start, end, "");
			else if (type === "deleteContentBackward") edit = start > 0 ? this.#edit(start - 1, start, "") : null;
			else edit = start < len ? this.#edit(start, start + 1, "") : null;
		} else {
			// Undo, redo and formatting land natively; #onInput refits them.
			return;
		}
		e.preventDefault();
		if (edit) this.#commitEdit(edit);
	};

	// Only edits #onBeforeInput let through arrive here: composition,
	// history, and autofill that fires no beforeinput.
	#onInput = (e: Event) => {
		// #commitEdit fires the host's own input event.
		e.stopPropagation();
		if (this.#composing) return;
		this.#refitNative();
	};

	#refitNative() {
		const raw = this.#input.value;
		if (raw === this.#value) return;
		const v = this.#fit(raw, 0, true);
		this.#commitEdit({ value: v, caret: Math.min(this.#input.selectionStart ?? v.length, v.length) });
	}

	#onCompositionStart = () => {
		this.#composing = true;
	};

	#onCompositionEnd = () => {
		this.#composing = false;
		this.#refitNative();
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key === "Enter") {
			this.#internals.form?.requestSubmit();
			return;
		}
		// Shift extends the native selection.
		if (e.shiftKey) return;
		const s = this.#input.selectionStart ?? 0;
		const end = this.#input.selectionEnd ?? s;
		const range = end - s > 1;
		let to: number;
		switch (e.key) {
			case "ArrowLeft":
			case "ArrowRight": {
				// Arrows follow the screen, which runs backward through the
				// value with dir="rtl".
				const rtl = getComputedStyle(this.#row).direction === "rtl";
				const forward = (e.key === "ArrowRight") !== rtl;
				if (range) to = forward ? end - 1 : s;
				else to = forward ? s + 1 : s - 1;
				break;
			}
			case "ArrowUp":
			case "Home":
				to = 0;
				break;
			case "ArrowDown":
			case "End":
				to = this.#value.length;
				break;
			default:
				return;
		}
		e.preventDefault();
		this.#placeCaret(to);
	};

	#onClick = (e: MouseEvent) => {
		// A double or triple click keeps the native selection.
		if (e.detail > 1) return;
		this.#placeCaret(this.#boxAt(e.clientX));
	};

	// A <label> click activates the host itself.
	#onHostClick = (e: MouseEvent) => {
		if (e.composedPath()[0] === this) this.#input.focus();
	};

	#onFocus = () => {
		this.#syncName();
		this.#placeCaret(this.#value.length);
	};
}

function idrefText(host: Element, attr: string): string | null {
	const ids = host.getAttribute(attr)?.trim();
	if (!ids) return null;
	const root = host.getRootNode() as Document | ShadowRoot;
	const text = ids
		.split(/\s+/)
		.map((id) => root.getElementById?.(id)?.textContent ?? "")
		.join(" ");
	return normalizeSpace(text) || null;
}

function labelsText(labels: NodeList): string | null {
	const text = Array.from(labels, (l) => l.textContent ?? "").join(" ");
	return normalizeSpace(text) || null;
}

function normalizeSpace(s: string): string {
	return s.replace(/\s+/g, " ").trim();
}

if (!customElements.get("neo-otp")) {
	customElements.define("neo-otp", NeoOtp);
}
