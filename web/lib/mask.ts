// Mask grammar shared by <neo-textinput> and <neo-otp>.
// `literal` slots emit a fixed char; `class` slots consume 1
// raw char satisfying `test` and optionally apply `transform`
// (case coercion for U/l/A/a, which accepts either case and stores the
// canonical case so rawValue and display agree). `token` is the mask
// char the slot came from.
export type MaskSlot =
	| { kind: "literal"; ch: string }
	| { kind: "class"; token: string; test: (c: string) => boolean; transform?: (c: string) => string };

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
		else if (c === "#") slots.push({ kind: "class", token: c, test: isDigit });
		else if (c === "U") slots.push({ kind: "class", token: c, test: isAlpha, transform: toUpper });
		else if (c === "l") slots.push({ kind: "class", token: c, test: isAlpha, transform: toLower });
		else if (c === "A") slots.push({ kind: "class", token: c, test: isAlnum, transform: toUpper });
		else if (c === "a") slots.push({ kind: "class", token: c, test: isAlnum, transform: toLower });
		else if (c === "X") slots.push({ kind: "class", token: c, test: isAlnum });
		else if (c === "*") slots.push({ kind: "class", token: c, test: () => true });
		else slots.push({ kind: "literal", ch: c });
	}
	if (escaped) slots.push({ kind: "literal", ch: "\\" });
	return slots;
}

export function isDigit(c: string) {
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
