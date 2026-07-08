// Shared platform + keyboard-chord core. The single source for "what
// modifier / glyph on this OS", consumed by <neo-keys> (behavior),
// <neo-kbd> (display), and <neo-condition> (platform gating). Framework-
// agnostic: no Datastar, no DOM beyond `navigator`.

export type Platform = "apple" | "windows" | "linux" | "other";

// Resolve the real OS once. Prefer the structured User-Agent Client Hint
// (Chromium), the modern replacement for the deprecated navigator.platform,
// then navigator.platform, then the UA string. All three reflect the actual
// device; a "User Agent Switcher" extension only rewrites navigator.userAgent
// (the last fallback), so it won't flip detection. To simulate a platform use
// DevTools → Network conditions → User agent client hints → Platform, which
// overrides userAgentData.platform.
function detectPlatform(): Platform {
	if (typeof navigator === "undefined") return "other";
	const hint = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
	if (hint) {
		const h = hint.toLowerCase();
		if (h.includes("mac") || h === "ios") return "apple";
		if (h.includes("win")) return "windows";
		if (h.includes("linux") || h.includes("android") || h.includes("chrome")) return "linux";
		return "other";
	}
	const s = (navigator.platform || navigator.userAgent || "").toLowerCase();
	if (/mac|iphone|ipad|ipod/.test(s)) return "apple";
	if (/win/.test(s)) return "windows";
	if (/linux|android|cros|x11/.test(s)) return "linux";
	return "other";
}

const PLATFORM = detectPlatform();

// `mod` is ⌘ on Apple platforms, Ctrl elsewhere. Shared by behavior
// (<neo-keys>) and display (<neo-kbd>, <neo-condition>) so the shown hint always
// matches the shortcut that actually fires.
export const IS_APPLE = PLATFORM === "apple";

export function currentPlatform(): Platform {
	return PLATFORM;
}

// Aliases for keys awkward to write as raw KeyboardEvent.key values.
// Targets are lowercase; matching lowercases event.key too.
export const KEY_ALIASES: Record<string, string> = {
	esc: "escape",
	enter: "enter",
	return: "enter",
	space: " ",
	spacebar: " ",
	up: "arrowup",
	down: "arrowdown",
	left: "arrowleft",
	right: "arrowright",
	plus: "+",
	comma: ",",
	del: "delete",
};

export interface Chord {
	key: string; // normalized, lowercase
	mod: boolean; // platform command modifier
	ctrl: boolean;
	meta: boolean;
	alt: boolean;
	shift: boolean;
}

// One alternative is a sequence of one or more chords; `keys` is a set
// of alternatives. raw is the source text used for the event detail.
export interface Alternative {
	raw: string;
	steps: Chord[];
}

export function parseChord(text: string): Chord | null {
	const parts = text
		.split("+")
		.map((p) => p.trim().toLowerCase())
		.filter(Boolean);
	if (parts.length === 0) return null;

	const chord: Chord = { key: "", mod: false, ctrl: false, meta: false, alt: false, shift: false };
	for (const p of parts) {
		switch (p) {
			case "mod":
				chord.mod = true;
				continue;
			case "ctrl":
			case "control":
				chord.ctrl = true;
				continue;
			case "meta":
			case "cmd":
			case "command":
			case "super":
			case "win":
				chord.meta = true;
				continue;
			case "alt":
			case "option":
			case "opt":
				chord.alt = true;
				continue;
			case "shift":
				chord.shift = true;
				continue;
		}
		// First non-modifier token is the key; a later one overwrites it.
		chord.key = KEY_ALIASES[p] ?? p;
	}
	return chord.key ? chord : null;
}

// `|` separates alternatives, `,` separates sequence steps, `+` joins a
// chord. None overlap, so the grammar is unambiguous (a literal comma
// key is the `comma` alias).
export function parseKeys(raw: string): Alternative[] {
	return raw
		.split("|")
		.map((altText): Alternative => {
			const steps = altText
				.split(",")
				.map((s) => parseChord(s))
				.filter((c): c is Chord => c !== null);
			return { raw: altText.trim().replace(/\s+/g, " "), steps };
		})
		.filter((alt) => alt.steps.length > 0);
}

// Named-key labels: Apple glyphs (↩ ⎋ ⇥ …) vs. spelled words elsewhere.
// Modifiers live in MODIFIER_GLYPHS_APPLE / MODIFIER_LABELS_OTHER below.
const KEY_GLYPHS_APPLE: Record<string, string> = {
	" ": "Space",
	// Web "Enter" is the Return key; its macOS menu glyph is ↩ (U+21A9),
	// not the generic newline arrow ↵ or the numpad-Enter glyph ⌤.
	enter: "↩",
	escape: "⎋",
	tab: "⇥",
	delete: "⌦",
	backspace: "⌫",
	arrowup: "↑",
	arrowdown: "↓",
	arrowleft: "←",
	arrowright: "→",
};

const KEY_LABELS_OTHER: Record<string, string> = {
	" ": "Space",
	enter: "Enter",
	escape: "Esc",
	tab: "Tab",
	// "Del" names the Mac forward-delete key; the Windows/Linux key is "Delete".
	delete: "Delete",
	backspace: "Backspace",
	arrowup: "↑",
	arrowdown: "↓",
	arrowleft: "←",
	arrowright: "→",
};

function keyLabel(key: string, apple: boolean): string {
	const map = apple ? KEY_GLYPHS_APPLE : KEY_LABELS_OTHER;
	if (key in map) return map[key];
	return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
}

// A <neo-kbd> shows ONE key. Modifier tokens render as their platform
// glyph; everything else goes through keyLabel. Multi-key shortcuts are
// composed from several <neo-kbd> in a <neo-kbd-group>, never a
// "+"-joined string, so there is no chord formatter here.
const MODIFIER_GLYPHS_APPLE: Record<string, string> = {
	mod: "⌘",
	meta: "⌘",
	cmd: "⌘",
	command: "⌘",
	super: "⌘",
	win: "⌘",
	ctrl: "⌃",
	control: "⌃",
	alt: "⌥",
	option: "⌥",
	opt: "⌥",
	shift: "⇧",
};

const MODIFIER_LABELS_OTHER: Record<string, string> = {
	mod: "Ctrl",
	ctrl: "Ctrl",
	control: "Ctrl",
	alt: "Alt",
	option: "Alt",
	opt: "Alt",
	shift: "Shift",
	meta: "Win",
	cmd: "Win",
	command: "Win",
	super: "Win",
	win: "Win",
};

// Render a single key token as a platform-appropriate label: a modifier
// glyph (⌘, ⇧, …) or, via keyLabel, a named key (↵, Esc) or letter.
export function formatKey(token: string, apple = IS_APPLE): string {
	const t = token.trim().toLowerCase();
	if (!t) return "";
	const mods = apple ? MODIFIER_GLYPHS_APPLE : MODIFIER_LABELS_OTHER;
	if (t in mods) return mods[t];
	return keyLabel(KEY_ALIASES[t] ?? t, apple);
}
