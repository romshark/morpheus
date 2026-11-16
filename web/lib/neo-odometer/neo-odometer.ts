// The light-DOM text is the number, formatted by the server, which keeps
// locale rules out of the kit. The digits render in the shadow root, where a
// morph can't reach them. A morph changes only the text, and the strips roll
// on from the digits they show.
//
// Assistive tech reads the light-DOM text through a visually hidden slot.
// The rendered cells are aria-hidden, because each strip holds 30 digits.

// A strip holds 3 runs of 0-9 and rests in the middle one,
// which leaves room for a full turn either way.
const RUNS = 3;
const REST = 10;
const STRIP_TEXT_CACHE = new Map<number, string>();
const DIGIT_CACHE = new Map<string, Digit | null>();
const ND = /\p{Nd}/u;
const SIGN = /[-+−]/;

interface Digit {
	// Code point of 0 in the digit's script.
	zero: number;
	value: number;
}

interface Cell {
	el: HTMLElement;
	char: string;
	digit: Digit | null;
	// Last position set on the strip, at rest or as a roll target.
	pos: number;
	rolling: boolean;
}

interface Parts {
	prefix: string;
	body: string;
	suffix: string;
}

interface Roll {
	cell: Cell;
	from: number;
}

const TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops them.
// Anchored by selector:
// - :host white-space: stops the spaces in "5 min" and "1 234" from collapsing.
// - [part~="number"]: digits read left to right in every script, also in
//   a right-to-left page. The prefix and suffix follow the host direction.
// - [data-cell]: animating grid-template-columns between 0fr and 1fr sizes
//   a cell to its content width without measuring it.
// - [data-clip]: overflow clip, unlike hidden, keeps the content baseline.
// - [data-sizer]: shows the digit at rest and gives the cell its width
//   and baseline. Selection and copy then get the digit, not the strip.
// - [data-strip]: 1 glyph per line; translateY(-100% / 30) moves 1 glyph.
// - durations: scaled by --neo-duration-scale, which reduced motion sets to 0.
TEMPLATE.innerHTML = `
<style>
  :host {
    display: inline-flex;
    align-items: baseline;
    position: relative;
    white-space: pre;
    font-variant-numeric: tabular-nums;
    unicode-bidi: isolate;
  }
  [data-sr] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  [part~="number"] {
    display: inline-flex;
    align-items: baseline;
    direction: ltr;
    unicode-bidi: isolate;
    transition-property: none;
    transition-duration: calc(var(--neo-odometer-duration, 600ms) * var(--neo-duration-scale, 1));
  }
  [data-cell] {
    display: inline-grid;
    grid-template-columns: 1fr;
    transition:
      grid-template-columns calc(var(--neo-odometer-duration, 600ms) * var(--neo-duration-scale, 1)) var(--neo-odometer-easing, var(--neo-easing, cubic-bezier(0.16, 1, 0.3, 1))),
      opacity calc(var(--neo-odometer-duration, 600ms) * var(--neo-duration-scale, 1)) var(--neo-odometer-easing, var(--neo-easing, cubic-bezier(0.16, 1, 0.3, 1)));
  }
  [data-cell][data-hidden] {
    grid-template-columns: 0fr;
    opacity: 0;
  }
  [data-clip] {
    position: relative;
    min-width: 0;
    overflow: clip;
  }
  [data-rolling] [data-sizer] {
    visibility: hidden;
  }
  [data-strip] {
    position: absolute;
    inset-inline: 0;
    top: 0;
    visibility: hidden;
    user-select: none;
    transition: transform calc(var(--neo-odometer-duration, 600ms) * var(--neo-duration-scale, 1)) var(--neo-odometer-easing, var(--neo-easing, cubic-bezier(0.16, 1, 0.3, 1)));
  }
  [data-rolling] [data-strip] {
    visibility: visible;
  }
</style>
<span data-sr><slot></slot></span>
<span part="prefix" aria-hidden="true"></span>
<span part="number" aria-hidden="true"></span>
<span part="suffix" aria-hidden="true"></span>
`;

export class NeoOdometer extends HTMLElement {
	#root: ShadowRoot;
	// The prefix renders as the text before its sign, the sign cell and the text after.
	#before = document.createTextNode("");
	#sign: HTMLElement | null = null;
	#after = document.createTextNode("");
	#numberEl: HTMLElement;
	#suffixEl: HTMLElement;
	#cells: Cell[] = [];
	// The applied text; null until a value is shown.
	#text: string | null = null;
	#parts: Parts | null = null;
	#observer = new MutationObserver(() => this.#sync(true));

	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(TEMPLATE.content.cloneNode(true));
		this.#root = root;
		(root.querySelector('[part="prefix"]') as HTMLElement).append(this.#before, this.#after);
		this.#numberEl = root.querySelector<HTMLElement>('[part="number"]') as HTMLElement;
		this.#suffixEl = root.querySelector<HTMLElement>('[part="suffix"]') as HTMLElement;
	}

	connectedCallback() {
		// Text may arrive after connect, from the parser or a framework binding.
		this.#observer.observe(this, {
			childList: true,
			characterData: true,
			subtree: true,
		});
		this.#sync(false);
	}

	disconnectedCallback() {
		this.#observer.disconnect();
	}

	#sync(animate: boolean) {
		const text = (this.textContent ?? "").trim();
		// Empty text is no command, like an absent attribute. A morph that renders
		// the element empty for a client binding to fill keeps the number.
		if (text === "" || text === this.#text) return;
		const parts = splitNumber(text);
		animate &&= this.#parts !== null;
		const dir = animate ? trend(this.#parts as Parts, parts) : 0;
		const rolls = this.#apply(parts, animate);
		this.#text = text;
		this.#parts = parts;
		if (rolls.length > 0) this.#roll(rolls, dir);
	}

	// #apply aligns the new body with the old one from the end, where the
	// ones digit is, and returns the digit cells that need a roll.
	#apply(parts: Parts, animate: boolean): Roll[] {
		setText(this.#suffixEl, parts.suffix);
		// Drop cells still leaving from the last change.
		// With no transitionend, as under display: none, they would pile up.
		for (const el of this.#root.querySelectorAll("[data-leaving]")) el.remove();
		const instant = !animate || this.#instant();
		const entering: HTMLElement[] = [];
		this.#applyPrefix(parts.prefix, instant, entering);
		const chars = Array.from(parts.body);
		const old = this.#cells;
		const next: Cell[] = [];
		const rolls: Roll[] = [];
		const count = Math.max(chars.length, old.length);
		for (let i = 1; i <= count; i++) {
			const ch = chars[chars.length - i];
			const cell = old[old.length - i];
			if (ch !== undefined && cell) {
				next.unshift(this.#update(cell, ch, instant, rolls));
			} else if (ch !== undefined) {
				const created = createCell(ch);
				this.#numberEl.insertBefore(created.el, next[0]?.el ?? null);
				if (!instant) {
					created.el.setAttribute("data-hidden", "");
					entering.push(created.el);
				}
				next.unshift(created);
			} else if (cell) {
				leave(cell.el, instant);
			}
		}
		this.#cells = next;
		if (entering.length === 0) return rolls;
		// 1 style flush starts every entering cell from 0fr.
		void this.#numberEl.offsetWidth;
		for (const el of entering) {
			el.removeAttribute("data-hidden");
		}
		return rolls;
	}

	// #applyPrefix puts the sign in a cell, which slides in and out like a digit.
	// The rest of the prefix stays plain text: a cell per character would break
	// letter joining in scripts like Arabic.
	#applyPrefix(prefix: string, instant: boolean, entering: HTMLElement[]) {
		let [before, sign, after] = splitSign(prefix);
		const old = this.#sign;
		// A leaving sign keeps its place, as in "-$5" to "$5", where "$" stays after it.
		if (old && !sign && prefix.endsWith(this.#after.data)) {
			after = this.#after.data;
			before = prefix.slice(0, prefix.length - after.length);
		}
		if (this.#before.data !== before) {
			this.#before.data = before;
		}
		if (this.#after.data !== after) {
			this.#after.data = after;
		}
		if ((old?.textContent ?? "") === sign) {
			return;
		}
		if (old && sign) {
			// A sign that turns, as from + to -, changes in place.
			setText(old.firstElementChild as HTMLElement, sign);
		} else if (old) {
			leave(old, instant);
			this.#sign = null;
		} else {
			const el = createBox(sign);
			this.#after.before(el);
			this.#sign = el;
			if (!instant) {
				el.setAttribute("data-hidden", "");
				entering.push(el);
			}
		}
	}

	// #update returns the cell that shows ch in place of cell.
	#update(cell: Cell, ch: string, instant: boolean, rolls: Roll[]): Cell {
		if (cell.char === ch) {
			return cell;
		}
		const digit = digitOf(ch);
		const prev = cell.digit;
		if (digit && prev && digit.zero === prev.zero) {
			cell.char = ch;
			cell.digit = digit;
			setText(sizerOf(cell), ch);
			if (instant) rest(cell);
			else rolls.push({ cell, from: prev.value });
			return cell;
		}
		// A symbol or a digit of another script replaces the cell without a roll.
		const fresh = createCell(ch);
		cell.el.replaceWith(fresh.el);
		return fresh;
	}

	// #roll rolls each cell up when the absolute value grows and down when it shrinks.
	// Without a trend, a digit rolls up to a higher value and down to a lower one.
	#roll(rolls: Roll[], dir: number) {
		for (const { cell, from } of rolls) {
			const strip = stripOf(cell);
			const at = cell.rolling ? readPos(strip) : cell.pos;
			// The same glyph in the middle run, which keeps the roll on the strip.
			const base = (((at % 10) + 10) % 10) + REST;
			const to = (cell.digit as Digit).value;
			const up = dir === 0 ? to > from : dir > 0;
			let target = to + REST;
			if (up) {
				while (target <= base) target += 10;
			} else {
				while (target >= base) target -= 10;
			}
			strip.style.transition = "none";
			strip.style.transform = translate(base);
			cell.el.setAttribute("data-rolling", "");
			cell.rolling = true;
			cell.pos = target;
		}
		// 1 style flush commits every base position before the transitions.
		void this.#numberEl.offsetWidth;
		for (const { cell } of rolls) {
			const strip = stripOf(cell);
			strip.style.transition = "";
			strip.style.transform = translate(cell.pos);
		}
	}

	// Reduced motion zeroes the duration, and a 0s transition fires no transitionend.
	// [part~="number"] carries the duration as a probe, with no transition property.
	#instant(): boolean {
		return Number.parseFloat(getComputedStyle(this.#numberEl).transitionDuration) === 0;
	}
}

// splitNumber splits text at its first and last digit. The prefix and suffix
// hold the sign, currency and unit; the body holds the digits and the
// separators between them.
function splitNumber(text: string): Parts {
	const chars = Array.from(text);
	const first = chars.findIndex((c) => ND.test(c));
	if (first < 0) {
		return { prefix: text, body: "", suffix: "" };
	}
	let last = chars.length - 1;
	while (!ND.test(chars[last] as string)) last--;
	return {
		prefix: chars.slice(0, first).join(""),
		body: chars.slice(first, last + 1).join(""),
		suffix: chars.slice(last + 1).join(""),
	};
}

// splitSign splits the prefix around its last sign, the one next to the digits.
// Signs are single UTF-16 code units, which makes a code unit scan safe.
function splitSign(prefix: string): [string, string, string] {
	for (let i = prefix.length - 1; i >= 0; i--) {
		if (SIGN.test(prefix[i] as string)) {
			return [prefix.slice(0, i), prefix[i] as string, prefix.slice(i + 1)];
		}
	}
	return [prefix, "", ""];
}

// trend reports whether the absolute value of b is above (1), below (-1) or
// equal to (0) that of a. The digits show the absolute value, which makes them
// roll up as a negative number falls. It compares the digits as written, which
// holds while both use the same number of fraction digits.
function trend(a: Parts, b: Parts): number {
	const da = significantDigits(a.body);
	const db = significantDigits(b.body);
	let cmp = db.length - da.length;
	for (let i = 0; cmp === 0 && i < da.length; i++) {
		cmp = (db[i] as number) - (da[i] as number);
	}
	return Math.sign(cmp);
}

function significantDigits(body: string): number[] {
	const out: number[] = [];
	for (const ch of body) {
		const d = digitOf(ch);
		if (d && (out.length > 0 || d.value > 0)) out.push(d.value);
	}
	return out;
}

// digitOf returns the value of a decimal digit in any script, or null.
// Unicode puts each script's 0-9 in 1 run of code points, and some blocks put
// several runs back to back.
function digitOf(ch: string): Digit | null {
	const cached = DIGIT_CACHE.get(ch);
	if (cached !== undefined) {
		return cached;
	}
	let digit: Digit | null = null;
	if (ND.test(ch)) {
		const cp = ch.codePointAt(0) as number;
		let start = cp;
		while (ND.test(String.fromCodePoint(start - 1))) start--;
		const value = (cp - start) % 10;
		digit = { zero: cp - value, value };
	}
	DIGIT_CACHE.set(ch, digit);
	return digit;
}

function stripText(zero: number): string {
	let text = STRIP_TEXT_CACHE.get(zero);
	if (text === undefined) {
		const glyphs: string[] = [];
		for (let i = 0; i < RUNS * 10; i++) {
			glyphs.push(String.fromCodePoint(zero + (i % 10)));
		}
		text = glyphs.join("\n");
		STRIP_TEXT_CACHE.set(zero, text);
	}
	return text;
}

function createCell(ch: string): Cell {
	const digit = digitOf(ch);
	const el = createBox(digit ? "" : ch);
	const cell: Cell = { el, char: ch, digit, pos: 0, rolling: false };
	if (!digit) {
		el.setAttribute("part", "symbol");
		return cell;
	}
	el.setAttribute("part", "digit");
	const sizer = document.createElement("span");
	sizer.setAttribute("data-sizer", "");
	sizer.textContent = ch;
	const strip = document.createElement("span");
	strip.setAttribute("data-strip", "");
	strip.textContent = stripText(digit.zero);
	strip.addEventListener("transitionend", (e) => {
		if (e.target === strip && e.propertyName === "transform" && cell.rolling) {
			rest(cell);
		}
	});
	(el.firstElementChild as HTMLElement).append(sizer, strip);
	rest(cell);
	return cell;
}

// createBox returns a [data-cell] that holds text in its clip.
function createBox(text: string): HTMLElement {
	const el = document.createElement("span");
	el.setAttribute("data-cell", "");
	const clip = document.createElement("span");
	clip.setAttribute("data-clip", "");
	clip.textContent = text;
	el.appendChild(clip);
	return el;
}

function rest(cell: Cell) {
	const strip = stripOf(cell);
	cell.pos = REST + (cell.digit as Digit).value;
	cell.rolling = false;
	cell.el.removeAttribute("data-rolling");
	strip.style.transition = "none";
	strip.style.transform = translate(cell.pos);
}

function leave(el: HTMLElement, instant: boolean) {
	if (instant) {
		el.remove();
		return;
	}
	el.setAttribute("data-leaving", "");
	el.setAttribute("data-hidden", "");
	el.addEventListener("transitionend", (e) => {
		if (e.target === el && e.propertyName === "grid-template-columns") el.remove();
	});
}

// readPos reads the strip position mid-roll from the computed transform.
function readPos(strip: HTMLElement): number {
	const ty = new DOMMatrixReadOnly(getComputedStyle(strip).transform).m42;
	const glyph = strip.offsetHeight / (RUNS * 10);
	return glyph > 0 ? -ty / glyph : 0;
}

function translate(pos: number): string {
	return `translateY(${(-pos * 100) / (RUNS * 10)}%)`;
}

function sizerOf(cell: Cell): HTMLElement {
	return cell.el.querySelector<HTMLElement>("[data-sizer]") as HTMLElement;
}

function stripOf(cell: Cell): HTMLElement {
	return cell.el.querySelector<HTMLElement>("[data-strip]") as HTMLElement;
}

function setText(el: HTMLElement, text: string) {
	if (el.textContent !== text) el.textContent = text;
}

if (!customElements.get("neo-odometer")) {
	customElements.define("neo-odometer", NeoOdometer);
}
