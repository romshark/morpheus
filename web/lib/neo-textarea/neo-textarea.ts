// The native <textarea> lives in the component's shadow root so the author's
// light DOM stays empty and a fat morph can re-render the host without
// disturbing the field's focus, caret, or value. The host owns the box
// (border, background, resize handle); the field fills it.

import { boolAttr } from "../command";

// Standard <textarea> attributes mirrored verbatim to the inner field.
// `name` is intentionally absent: the host is the form-associated element
// and submits via internals.setFormValue; a name on the inner field too
// would submit the value twice under the same key.
// Native boolean attributes use the command contract; copying
// disabled="false" verbatim would still disable the field.
const BOOL_PASSTHROUGH_ATTRS = ["disabled", "readonly", "required", "autofocus"];

const PASSTHROUGH_ATTRS = [
	"placeholder",
	"rows",
	"cols",
	"wrap",
	"maxlength",
	"minlength",
	"readonly",
	"disabled",
	"required",
	"autocomplete",
	"autofocus",
	"spellcheck",
	"autocapitalize",
	"inputmode",
	// The field is in the shadow root, so a host-level accessible name must
	// be forwarded; the host itself isn't the focusable control.
	"aria-label",
	"aria-labelledby",
	"aria-describedby",
];

const TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - :host overflow:hidden: clip the field to the rounded corner and make the
//   host resizable.
// - :host([rows]): author rows wins over the min-height floor, so rows="1" is
//   one row.
// - :host(:focus-within): focus ring on the host; :focus-within matches when
//   the shadow field is focused, so no JS focus mirroring is needed.
// - :host([auto-resize-width]) textarea: auto-resize-width implies no wrapping
//   so scrollWidth is the longest line.
TEMPLATE.innerHTML = `
<style>
  :host {
    display: inline-flex;
    box-sizing: border-box;
    min-width: var(--neo-textarea-min-width, 16rem);
    min-height: var(--neo-textarea-min-height, 4rem);
    background: var(--neo-textarea-bg);
    color: var(--neo-textarea-color);
    border: 1px solid var(--neo-textarea-border-color);
    border-radius: var(--neo-textarea-radius);
    overflow: hidden;
    transition: border-color var(--neo-duration-hover, calc(120ms * var(--neo-duration-scale, 1))) var(--neo-easing, ease);
  }
  :host([hidden]) { display: none; }
  :host([rows]) { min-height: 0; }
  :host(:focus-within) {
    outline: 2px solid var(--neo-textarea-focus-ring);
    outline-offset: 2px;
  }
  :host([disabled]:not([disabled="false"])) {
    cursor: not-allowed;
    opacity: 0.55;
    background-image: var(--neo-disabled-overlay);
  }
  textarea {
    font: inherit;
    flex: 1 1 auto;
    width: 100%;
    box-sizing: border-box;
    background: transparent;
    color: inherit;
    border: 0;
    padding: var(--neo-textarea-padding);
    resize: none;
    outline: none;
  }
  textarea::placeholder {
    color: var(--muted);
    opacity: 1;
  }
  textarea:disabled {
    cursor: not-allowed;
  }
  :host([auto-resize-width]:not([auto-resize-width="false"])) textarea {
    white-space: pre;
  }
</style>
<textarea></textarea>
`;

export class NeoTextarea extends HTMLElement {
	static readonly formAssociated = true;

	static readonly observedAttributes = [
		"value",
		"auto-resize-width",
		"auto-resize-height",
		"scale-horizontal",
		"scale-vertical",
		...PASSTHROUGH_ATTRS,
	];

	#internals: ElementInternals;
	#textarea!: HTMLTextAreaElement;
	#resizeObserver: ResizeObserver | null = null;
	#ready = false;

	constructor() {
		super();
		this.#internals = this.attachInternals();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(TEMPLATE.content.cloneNode(true));
		this.#textarea = root.querySelector("textarea")!;
	}

	get value(): string {
		return this.#textarea.value;
	}

	set value(v: string) {
		this.#textarea.value = v;
		this.#internals.setFormValue(v);
		this.#autoResize();
	}

	get validity(): ValidityState {
		return this.#textarea.validity;
	}

	checkValidity(): boolean {
		return this.#textarea.checkValidity();
	}

	reportValidity(): boolean {
		return this.#textarea.reportValidity();
	}

	override focus(opts?: FocusOptions) {
		this.#textarea.focus(opts);
	}

	override blur() {
		this.#textarea.blur();
	}

	connectedCallback() {
		if (this.#ready) return;
		this.#ready = true;
		this.#textarea.addEventListener("input", this.#onInput);
		// Container resize can change percentage-based caps.
		this.#resizeObserver = new ResizeObserver(this.#autoResize);
		this.#resizeObserver.observe(this);
		this.#syncPassthrough();
		this.#textarea.value = this.getAttribute("value") ?? "";
		this.#internals.setFormValue(this.#textarea.value);
		this.#syncAll();
	}

	disconnectedCallback() {
		this.#ready = false;
		this.#textarea.removeEventListener("input", this.#onInput);
		this.#resizeObserver?.disconnect();
		this.#resizeObserver = null;
	}

	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (!this.#ready) return;
		if (name === "value") {
			// An absent attribute is no command: a fat morph that omits
			// `value` leaves the current value untouched, like the `open`
			// command contract. An explicit value="" still clears. Skip while
			// the field is focused so a write never stomps live typing.
			if (value !== null && this.shadowRoot!.activeElement !== this.#textarea) {
				this.#textarea.value = value;
				this.#internals.setFormValue(this.#textarea.value);
				this.#autoResize();
			}
			return;
		}
		if (PASSTHROUGH_ATTRS.includes(name)) {
			this.#syncOnePassthrough(name);
			// rows / cols / wrap change the field's intrinsic size.
			this.#syncAll();
			return;
		}
		this.#syncAll();
	}

	formDisabledCallback(disabled: boolean) {
		this.#textarea.disabled = disabled;
	}

	formResetCallback() {
		this.value = this.getAttribute("value") ?? "";
	}

	#onInput = () => {
		this.#internals.setFormValue(this.#textarea.value);
		this.#autoResize();
	};

	#syncPassthrough() {
		for (const a of PASSTHROUGH_ATTRS) this.#syncOnePassthrough(a);
	}

	#syncOnePassthrough(attr: string) {
		if (BOOL_PASSTHROUGH_ATTRS.includes(attr)) {
			if (boolAttr(this, attr, false)) this.#textarea.setAttribute(attr, "");
			else this.#textarea.removeAttribute(attr);
			return;
		}
		const v = this.getAttribute(attr);
		if (v === null) this.#textarea.removeAttribute(attr);
		else this.#textarea.setAttribute(attr, v);
	}

	#syncAll() {
		this.#applyCaps();
		this.#applyWrap();
		this.#applyOverflow();
		this.#applyResize();
		this.#autoResize();
	}

	#applyCaps() {
		// Caps live on the host (the resizable box); the field fills it.
		const maxH = this.getAttribute("auto-resize-height");
		this.style.maxHeight = maxH ? maxH : "";
		const maxW = this.getAttribute("auto-resize-width");
		this.style.maxWidth = maxW ? maxW : "";
	}

	#applyWrap() {
		if (boolAttr(this, "auto-resize-width", false)) this.#textarea.setAttribute("wrap", "off");
	}

	#applyOverflow() {
		// Unlimited auto-grow -> hide the field's scrollbar (always fits).
		// Capped -> let it scroll once the cap is hit.
		const hAuto = boolAttr(this, "auto-resize-height", false);
		const hCap = !!this.getAttribute("auto-resize-height");
		this.#textarea.style.overflowY = hAuto && !hCap ? "hidden" : "";
		const wAuto = boolAttr(this, "auto-resize-width", false);
		const wCap = !!this.getAttribute("auto-resize-width");
		this.#textarea.style.overflowX = wAuto && !wCap ? "hidden" : "";
	}

	#applyResize() {
		// Resize handle on the host so the dragged size lands in the host's
		// light-DOM inline style (observable, persistable). auto-resize wins.
		const canH = boolAttr(this, "scale-horizontal", false) && !boolAttr(this, "auto-resize-width", false);
		const canV = boolAttr(this, "scale-vertical", false) && !boolAttr(this, "auto-resize-height", false);
		this.style.resize = canH && canV ? "both" : canH ? "horizontal" : canV ? "vertical" : "none";
	}

	#autoResize = () => {
		const ta = this.#textarea;
		if (boolAttr(this, "auto-resize-width", false)) {
			// Reset to auto so scrollWidth reflects natural content width, not
			// the previously-grown value. Gate on value: with wrap="off" a long
			// placeholder also drives scrollWidth, so an empty field stays put.
			this.style.width = "auto";
			if (ta.value.length > 0) this.style.width = `${ta.scrollWidth + this.#borderX()}px`;
		}
		if (boolAttr(this, "auto-resize-height", false)) {
			// scrollHeight is the field's content box (incl. its padding) but
			// excludes the host border; add it back so the box doesn't shrink.
			this.style.height = "auto";
			this.style.height = `${ta.scrollHeight + this.#borderY()}px`;
		}
	};

	#borderX(): number {
		const cs = getComputedStyle(this);
		return parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
	}

	#borderY(): number {
		const cs = getComputedStyle(this);
		return parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
	}
}

if (!customElements.get("neo-textarea")) {
	customElements.define("neo-textarea", NeoTextarea);
}
