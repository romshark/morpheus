// Mask grammar shared by <neo-textinput> and <neo-otp>.
// `literal` slots emit a fixed char; `class` slots consume 1
// raw char satisfying `test` and optionally apply `transform`, which stores
// the canonical form so rawValue and display agree: the case for U/l/A/a,
// and an ASCII digit for a digit typed as Arabic-Indic or Persian.
// `token` is the mask char the slot came from.
export type MaskSlot =
	| { kind: "literal"; ch: string }
	| { kind: "class"; token: string; test: (c: string) => boolean; transform?: (c: string) => string };

export type ClassSlot = Extract<MaskSlot, { kind: "class" }>;

// A backslash makes the next char a literal, as in "##\###" for 2 digits,
// a "#" and 2 digits. A trailing backslash is a literal backslash.
export function parseMask(mask: string): MaskSlot[] {
	const slots: MaskSlot[] = [];
	let escaped = false;
	for (const c of mask) {
		if (escaped) {
			slots.push({ kind: "literal", ch: c });
			escaped = false;
		} else if (c === "\\") escaped = true;
		else if (c === "#") slots.push({ kind: "class", token: c, test: isDigit, transform: toAsciiDigit });
		else if (c === "U") slots.push({ kind: "class", token: c, test: isAlpha, transform: toUpper });
		else if (c === "l") slots.push({ kind: "class", token: c, test: isAlpha, transform: toLower });
		else if (c === "A") slots.push({ kind: "class", token: c, test: isAlnum, transform: toAlnumUpper });
		else if (c === "a") slots.push({ kind: "class", token: c, test: isAlnum, transform: toAlnumLower });
		else if (c === "X") slots.push({ kind: "class", token: c, test: isAlnum, transform: toAsciiDigit });
		else if (c === "*") slots.push({ kind: "class", token: c, test: () => true });
		else slots.push({ kind: "literal", ch: c });
	}
	if (escaped) slots.push({ kind: "literal", ch: "\\" });
	return slots;
}

// Arabic and Persian keyboards type Arabic-Indic (U+0660-0669) and
// extended Arabic-Indic (U+06F0-06F9) digits.
const ARABIC_INDIC_ZERO = 0x0660;
const PERSIAN_ZERO = 0x06f0;
const NON_ASCII_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

// A digit typed as Arabic-Indic or Persian maps to its ASCII digit.
// Any other char returns unchanged.
export function toAsciiDigit(c: string): string {
	if (c.length !== 1) return c;
	const code = c.charCodeAt(0);
	if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9)
		return String.fromCharCode(48 + code - ARABIC_INDIC_ZERO);
	if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) return String.fromCharCode(48 + code - PERSIAN_ZERO);
	return c;
}

// s with its Arabic-Indic and Persian digits in ASCII, for the `\d` regexes.
export function asciiDigits(s: string): string {
	return s.replace(NON_ASCII_DIGITS, toAsciiDigit);
}

export function isDigit(c: string) {
	const d = toAsciiDigit(c);
	return d >= "0" && d <= "9";
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

function toAlnumUpper(c: string) {
	return toAsciiDigit(c).toUpperCase();
}

function toAlnumLower(c: string) {
	return toAsciiDigit(c).toLowerCase();
}
