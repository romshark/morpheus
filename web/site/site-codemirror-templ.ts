// CodeMirror 6 syntax highlighter for templ (https://templ.guide)
// templates. Implemented as a StreamLanguage so it runs at runtime
// without a Lezer build step. Import it and register under
// `language="templ"` in site-codemirror.ts, done.
//
// Coverage is pragmatic, not exhaustive. The state machine recognizes:
//
//   * templ block declarations: `templ Name(args) { body }`,
//     `css Name() { … }`, `script Name() { … }`. The body is parsed
//     in templ mode.
//   * HTML elements inside templ bodies: tag names, attribute names,
//     attribute values (quoted strings, single-quoted strings, and
//     `{ expr }` Go expression holes), self-closing `/>`, closing
//     `</tag>`, HTML comments `<!-- … -->`.
//   * Templ expression holes: `{ expr }` in element content and
//     attribute values, with shallow Go highlighting inside (matches
//     keyword/atom/type/string/number/identifier; nested `{ }` track
//     correctly so braces inside the Go expression don't end the
//     hole prematurely).
//   * Component calls: `@Pkg.Component(args) { children }`. The
//     `@` + dotted identifier emits as a meta token; the `(args)`
//     opens a paren-balanced Go context; the `{ children }` opens a
//     fresh templ body.
//   * Control flow: `if`, `for`, `switch`, `else`. Each pushes a
//     "control-cond" Go-tokenizing mode that runs until the next
//     top-level `{`, which then opens a templ body. `case`,
//     `default`, `range`, etc. are highlighted as keywords without
//     mode changes.
//   * Comments: `// line`, `/* block */`, `<!-- HTML -->`.
//
// Punted: full Go top-level constructs (the source is treated as a
// templ body fragment, common shape for the snippets we ship in
// docs); generics in component-call args; conditional attributes
// (`if cond { name="value" }`) are tokenized as control flow + an
// embedded templ body, which gives reasonable colours but isn't
// strictly correct.
//
// Token names match the legacy CodeMirror v5 mode vocabulary that
// @codemirror/language's StreamLanguage maps onto @lezer/highlight
// tags (so the existing default highlight style picks them up).

import { LanguageSupport, StreamLanguage, type StringStream } from "@codemirror/language";

// Go top-level keywords. All of these highlight as `keyword`; the
// flow-control subset (`if`/`for`/`switch`/`else`) additionally
// triggers a mode switch when seen inside a templ body.
const goKeywords = new Set([
	"break",
	"case",
	"chan",
	"const",
	"continue",
	"default",
	"defer",
	"else",
	"fallthrough",
	"for",
	"func",
	"go",
	"goto",
	"if",
	"import",
	"interface",
	"map",
	"package",
	"range",
	"return",
	"select",
	"struct",
	"switch",
	"type",
	"var",
]);

// Templ block-opening keywords. When seen at the start of a templ
// declaration (or nested in another templ body), they pull in a
// `Name(args)` signature followed by `{` that opens a fresh templ
// body. They highlight as `keyword`; the identifier following them
// emits as `def`.
const templBlockKeywords = new Set(["templ", "css", "script"]);

// Subset of keywords that introduce a templ body. After the keyword
// the parser switches to a Go-ish "control-cond" mode that runs
// until a top-level `{`, which opens the body.
const templControlKeywords = new Set(["if", "for", "switch", "else"]);

const goAtoms = new Set(["true", "false", "nil", "iota"]);

const goTypes = new Set([
	"int",
	"int8",
	"int16",
	"int32",
	"int64",
	"uint",
	"uint8",
	"uint16",
	"uint32",
	"uint64",
	"uintptr",
	"byte",
	"rune",
	"string",
	"float32",
	"float64",
	"complex64",
	"complex128",
	"bool",
	"any",
	"error",
]);

interface ModeEntry {
	mode: string;
	depth: number;
	isSignature?: boolean;
}

// State is a stack of mode entries; the top entry drives tokenization.
// Each entry carries its own bracket-depth counter so a closing token
// only pops the entry when its own brackets are balanced. Three
// scalar flags on the state object track the small look-ahead needed
// to distinguish a body-opening `{` from an expression hole `{`:
//
//   afterBlockKeyword   the previous token was `templ`/`css`/`script`,
//                       so the next identifier is the block name and
//                       should highlight as `def`.
//   signatureExpected   the previous token was a block name (after
//                       afterBlockKeyword cleared) or a component-
//                       call target (`@Pkg.Comp`); the next `(` opens
//                       a Go-args signature go-paren.
//   bodyExpected        we just popped a signature go-paren, so the
//                       next `{` opens a templ body (push a fresh
//                       templ scope) rather than an expression hole.
interface TemplState {
	stack: ModeEntry[];
	afterBlockKeyword: boolean;
	signatureExpected: boolean;
	bodyExpected: boolean;
}

function startState(): TemplState {
	return {
		stack: [{ mode: "templ", depth: 0 }],
		afterBlockKeyword: false,
		signatureExpected: false,
		bodyExpected: false,
	};
}

function copyState(s: TemplState): TemplState {
	return {
		stack: s.stack.map((e) => ({ ...e })),
		afterBlockKeyword: s.afterBlockKeyword,
		signatureExpected: s.signatureExpected,
		bodyExpected: s.bodyExpected,
	};
}

function top(state: TemplState): ModeEntry {
	return state.stack[state.stack.length - 1];
}

function pushMode(state: TemplState, mode: string): void {
	state.stack.push({ mode, depth: 0 });
}

function popMode(state: TemplState): void {
	if (state.stack.length > 1) state.stack.pop();
}

function matchText(stream: StringStream, pattern: RegExp): string {
	const match = stream.match(pattern, true);
	return match && match !== true ? match[0] : "";
}

function token(stream: StringStream, state: TemplState): string | null {
	switch (top(state).mode) {
		case "templ":
			return tokenTempl(stream, state);
		case "tag":
			return tokenTag(stream, state);
		case "attr-string":
			return tokenAttrString(stream, state, '"');
		case "attr-string-single":
			return tokenAttrString(stream, state, "'");
		case "expr":
			return tokenGoBraced(stream, state);
		case "go-paren":
			return tokenGoParen(stream, state);
		case "control-cond":
			return tokenControlCond(stream, state);
		case "string":
			return tokenString(stream, state);
		case "raw-string":
			return tokenRawString(stream, state);
		case "block-comment":
			return tokenBlockComment(stream, state);
		case "html-comment":
			return tokenHtmlComment(stream, state);
	}
	stream.next();
	return null;
}

// ---------------------------------------------------------------- //
// Templ body: recognizes HTML, component calls, interpolations,
// control flow, and templ block declarations (which work whether
// nested inside another templ block or sitting at top level, since
// we treat the input as a fragment, top-level looks the same as the
// nested case to the parser).
// ---------------------------------------------------------------- //
function tokenTempl(stream: StringStream, state: TemplState): string | null {
	if (stream.eatSpace()) return null;

	// Comments don't disturb the body-opener look-ahead; templ
	// permits whitespace and comments between `(args)` and `{`.
	if (stream.match("<!--")) {
		pushMode(state, "html-comment");
		return "comment";
	}
	if (stream.match("//")) {
		stream.skipToEnd();
		return "comment";
	}
	if (stream.match("/*")) {
		pushMode(state, "block-comment");
		return "comment";
	}

	// `{`: the meaning depends on what we just consumed. After a
	// block/component signature (bodyExpected) it opens a fresh
	// templ scope; otherwise it's a Go expression hole inside the
	// current templ body.
	if (stream.eat("{")) {
		if (state.bodyExpected) {
			state.bodyExpected = false;
			pushMode(state, "templ");
			return null;
		}
		pushMode(state, "expr");
		return null;
	}

	// `}` ends this templ body.
	if (stream.eat("}")) {
		popMode(state);
		return null;
	}

	// Closing tag </name>.
	if (stream.match(/^<\/[A-Za-z][A-Za-z0-9-]*\s*>?/)) {
		state.bodyExpected = false;
		state.signatureExpected = false;
		return "tag";
	}

	// Opening tag <tag: only when the `<` is followed by a letter,
	// otherwise it's text content (e.g. comparison ops inside prose).
	if (stream.peek() === "<" && /[A-Za-z]/.test(stream.string.charAt(stream.pos + 1))) {
		stream.next();
		stream.match(/^[A-Za-z][A-Za-z0-9-]*/);
		pushMode(state, "tag");
		state.bodyExpected = false;
		state.signatureExpected = false;
		return "tag";
	}

	// Component call: @Pkg.Comp[.Sub]. The next `(` (whitespace /
	// comments allowed in between) opens a signature go-paren.
	if (stream.eat("@")) {
		stream.match(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/);
		state.signatureExpected = true;
		state.bodyExpected = false;
		return "meta";
	}

	// Strings at templ-body level, rare but legal (conditional
	// attributes, raw-string args after a control flow keyword).
	if (stream.peek() === '"') {
		stream.next();
		pushMode(state, "string");
		state.bodyExpected = false;
		state.signatureExpected = false;
		return "string";
	}
	if (stream.peek() === "`") {
		stream.next();
		pushMode(state, "raw-string");
		state.bodyExpected = false;
		state.signatureExpected = false;
		return "string";
	}

	// `(`: signature opener if we just saw a block name or
	// component-call target; otherwise a stray paren (unhighlighted).
	if (stream.eat("(")) {
		if (state.signatureExpected) {
			state.signatureExpected = false;
			pushMode(state, "go-paren");
			top(state).isSignature = true;
		} else {
			state.bodyExpected = false;
		}
		return null;
	}
	if (stream.eat(")")) {
		state.bodyExpected = false;
		state.signatureExpected = false;
		return null;
	}

	// Numbers in body text.
	if (stream.match(/^\d[\d_]*(\.\d[\d_]*)?/)) {
		state.bodyExpected = false;
		state.signatureExpected = false;
		return "number";
	}

	// Identifier: block-opening keyword, control-flow keyword,
	// other Go keyword, type, atom, or plain text identifier.
	const next = stream.peek();
	if (next && /[A-Za-z_]/.test(next)) {
		const word = matchText(stream, /^[A-Za-z_][A-Za-z0-9_]*/);
		if (state.afterBlockKeyword) {
			state.afterBlockKeyword = false;
			state.signatureExpected = true;
			state.bodyExpected = false;
			return "def";
		}
		if (templBlockKeywords.has(word)) {
			state.afterBlockKeyword = true;
			state.bodyExpected = false;
			state.signatureExpected = false;
			return "keyword";
		}
		if (templControlKeywords.has(word)) {
			pushMode(state, "control-cond");
			state.bodyExpected = false;
			state.signatureExpected = false;
			return "keyword";
		}
		state.bodyExpected = false;
		state.signatureExpected = false;
		if (goKeywords.has(word)) return "keyword";
		if (goAtoms.has(word)) return "atom";
		if (goTypes.has(word)) return "type";
		return "variable";
	}

	// Default: consume one char of plain content. Body-opener look-
	// ahead is invalidated by any non-whitespace, non-comment token
	// so a `{` arriving much later doesn't accidentally trigger.
	state.bodyExpected = false;
	state.signatureExpected = false;
	stream.next();
	return null;
}

// ---------------------------------------------------------------- //
// Inside an HTML opening tag: read attribute names + values until
// `>` or `/>` ends the tag.
// ---------------------------------------------------------------- //
function tokenTag(stream: StringStream, state: TemplState): string | null {
	if (stream.eatSpace()) return null;

	if (stream.match("/>") || stream.eat(">")) {
		popMode(state);
		return "tag";
	}

	if (stream.peek() === '"') {
		stream.next();
		pushMode(state, "attr-string");
		return "string-2";
	}
	if (stream.peek() === "'") {
		stream.next();
		pushMode(state, "attr-string-single");
		return "string-2";
	}

	if (stream.eat("{")) {
		pushMode(state, "expr");
		return null;
	}

	if (stream.eat("=")) return "operator";

	// Attribute name. Templ attribute names commonly carry colons
	// (`data-on:click`, `data-attr:variant`), dashes, dots, and `@`
	// prefixes for kit-specific bindings.
	const next = stream.peek();
	if (next && /[@:A-Za-z_]/.test(next)) {
		stream.match(/^[@:A-Za-z_][A-Za-z0-9_:.-]*/);
		return "attribute";
	}

	stream.next();
	return null;
}

// Quoted attribute value; pops on the matching close quote.
function tokenAttrString(stream: StringStream, state: TemplState, quote: string): string {
	while (!stream.eol()) {
		const c = stream.next();
		if (c === "\\" && !stream.eol()) {
			stream.next();
			continue;
		}
		if (c === quote) {
			popMode(state);
			return "string-2";
		}
	}
	return "string-2";
}

// ---------------------------------------------------------------- //
// Go expression hole `{ … }`. Tokenizes as Go; tracks inner `{ }`
// depth so a Go composite literal inside the hole doesn't terminate
// the mode early.
// ---------------------------------------------------------------- //
function tokenGoBraced(stream: StringStream, state: TemplState): string | null {
	if (stream.eatSpace()) return null;

	if (stream.match("//")) {
		stream.skipToEnd();
		return "comment";
	}
	if (stream.match("/*")) {
		pushMode(state, "block-comment");
		return "comment";
	}

	if (stream.peek() === '"') {
		stream.next();
		pushMode(state, "string");
		return "string";
	}
	if (stream.peek() === "`") {
		stream.next();
		pushMode(state, "raw-string");
		return "string";
	}
	if (stream.peek() === "'") {
		return tokenRune(stream);
	}

	if (stream.eat("{")) {
		top(state).depth++;
		return null;
	}
	if (stream.eat("}")) {
		const cur = top(state);
		if (cur.depth > 0) {
			cur.depth--;
			return null;
		}
		popMode(state);
		return null;
	}

	return tokenGoCommon(stream, state);
}

// ---------------------------------------------------------------- //
// Go args inside `( )`. Same as the brace variant but pivots on
// matching parens rather than matching braces.
// ---------------------------------------------------------------- //
function tokenGoParen(stream: StringStream, state: TemplState): string | null {
	if (stream.eatSpace()) return null;

	if (stream.match("//")) {
		stream.skipToEnd();
		return "comment";
	}
	if (stream.match("/*")) {
		pushMode(state, "block-comment");
		return "comment";
	}

	if (stream.peek() === '"') {
		stream.next();
		pushMode(state, "string");
		return "string";
	}
	if (stream.peek() === "`") {
		stream.next();
		pushMode(state, "raw-string");
		return "string";
	}
	if (stream.peek() === "'") {
		return tokenRune(stream);
	}

	if (stream.eat("(")) {
		top(state).depth++;
		return null;
	}
	if (stream.eat(")")) {
		const cur = top(state);
		if (cur.depth > 0) {
			cur.depth--;
			return null;
		}
		// Pop and, if this paren-group was a templ block / component
		// call signature, raise bodyExpected so the next `{` opens a
		// fresh templ body.
		const wasSignature = cur.isSignature === true;
		popMode(state);
		if (wasSignature) state.bodyExpected = true;
		return null;
	}

	// Composite literals show up frequently in component args
	// (`neo.BadgeOpts{Variant: "primary"}`). Track `{ }` depth as
	// well so a stray `}` inside doesn't fall through to the outer
	// templ mode.
	if (stream.eat("{")) {
		pushMode(state, "expr");
		return null;
	}

	return tokenGoCommon(stream, state);
}

// ---------------------------------------------------------------- //
// `if`/`for`/`switch`/`else` condition body: Go tokens until the
// next top-level `{`, which closes this mode and opens a templ body.
// We track `(` and `[` depth so a brace inside (e.g. inside a
// composite-literal in the cond expression) doesn't confuse us.
// ---------------------------------------------------------------- //
function tokenControlCond(stream: StringStream, state: TemplState): string | null {
	if (stream.eatSpace()) return null;

	if (stream.match("//")) {
		stream.skipToEnd();
		return "comment";
	}
	if (stream.match("/*")) {
		pushMode(state, "block-comment");
		return "comment";
	}

	if (stream.peek() === '"') {
		stream.next();
		pushMode(state, "string");
		return "string";
	}
	if (stream.peek() === "`") {
		stream.next();
		pushMode(state, "raw-string");
		return "string";
	}
	if (stream.peek() === "'") {
		return tokenRune(stream);
	}

	const cur = top(state);
	if (stream.eat("(") || stream.eat("[")) {
		cur.depth++;
		return null;
	}
	if (stream.eat(")") || stream.eat("]")) {
		if (cur.depth > 0) cur.depth--;
		return null;
	}

	if (stream.eat("{")) {
		// Composite literals can show up inside the cond
		// (`if x == (Foo{}) { … }`), but those are wrapped in
		// `(`/`[` and won't reach here at depth 0. Only a depth-0
		// `{` closes the cond and opens the templ body.
		if (cur.depth > 0) {
			pushMode(state, "expr");
			return null;
		}
		popMode(state);
		pushMode(state, "templ");
		return null;
	}

	return tokenGoCommon(stream, state);
}

// ---------------------------------------------------------------- //
// Shared Go-token helpers: identifiers, keywords, numbers, operators.
// Returns a token name (or null) and advances the stream by one
// token's worth of characters. Callers handle bracket / quote /
// comment cases before delegating here.
// ---------------------------------------------------------------- //
function tokenGoCommon(stream: StringStream, _state: TemplState): string | null {
	if (stream.match(/^0[xX][0-9a-fA-F_]+/)) return "number";
	if (stream.match(/^0[oO][0-7_]+/)) return "number";
	if (stream.match(/^0[bB][01_]+/)) return "number";
	if (stream.match(/^\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?i?/)) return "number";

	const next = stream.peek();
	if (next && /[A-Za-z_]/.test(next)) {
		const word = matchText(stream, /^[A-Za-z_][A-Za-z0-9_]*/);
		if (goKeywords.has(word)) return "keyword";
		if (goAtoms.has(word)) return "atom";
		if (goTypes.has(word)) return "type";
		return "variable";
	}

	if (stream.match(/^[+\-*/%=<>!&|^~?]+/)) return "operator";
	if (stream.eat(/[;,.:]/)) return null;

	stream.next();
	return null;
}

function tokenRune(stream: StringStream): string {
	stream.next(); // opening '
	while (!stream.eol()) {
		const c = stream.next();
		if (c === "\\" && !stream.eol()) {
			stream.next();
			continue;
		}
		if (c === "'") break;
	}
	return "string";
}

// ---------------------------------------------------------------- //
// Multi-char delimited tokens.
// ---------------------------------------------------------------- //
function tokenString(stream: StringStream, state: TemplState): string {
	while (!stream.eol()) {
		const c = stream.next();
		if (c === "\\" && !stream.eol()) {
			stream.next();
			continue;
		}
		if (c === '"') {
			popMode(state);
			return "string";
		}
	}
	return "string";
}

function tokenRawString(stream: StringStream, state: TemplState): string {
	while (!stream.eol()) {
		if (stream.next() === "`") {
			popMode(state);
			return "string";
		}
	}
	return "string";
}

function tokenBlockComment(stream: StringStream, state: TemplState): string {
	while (!stream.eol()) {
		if (stream.match("*/")) {
			popMode(state);
			return "comment";
		}
		stream.next();
	}
	return "comment";
}

function tokenHtmlComment(stream: StringStream, state: TemplState): string {
	while (!stream.eol()) {
		if (stream.match("-->")) {
			popMode(state);
			return "comment";
		}
		stream.next();
	}
	return "comment";
}

const templStream = StreamLanguage.define({
	name: "templ",
	startState,
	copyState,
	token,
	languageData: {
		commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
		closeBrackets: { brackets: ["(", "[", "{", '"', "`"] },
	},
});

export function templ() {
	return new LanguageSupport(templStream);
}
