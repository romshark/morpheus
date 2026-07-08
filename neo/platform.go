package neo

import "strings"

// Platform is a coarse OS family used for server-side platform gating
// (<neo-condition>) and shortcut-hint pre-rendering (<neo-kbd>). Detect it
// from the request User-Agent with DetectPlatform; the client then refines
// via navigator.userAgentData.platform. Mirrors web/lib/platform.ts so the
// server pre-render matches what the browser would render, eliminating the
// flash where content changes after the bundle upgrades the elements.
type Platform string

const (
	PlatformApple   Platform = "apple"
	PlatformWindows Platform = "windows"
	PlatformLinux   Platform = "linux"
	PlatformOther   Platform = "" // zero value: unknown / non-mobile-desktop
)

// DetectPlatform classifies a User-Agent header into an OS family. The
// server only has the UA string (no client hints), so this is a best guess
// the client may refine. Empty UA → PlatformOther.
func DetectPlatform(userAgent string) Platform {
	s := strings.ToLower(userAgent)
	switch {
	case s == "":
		return PlatformOther
	case strings.Contains(s, "mac") ||
		strings.Contains(s, "iphone") ||
		strings.Contains(s, "ipad") ||
		strings.Contains(s, "ipod"):
		return PlatformApple
	case strings.Contains(s, "win"):
		return PlatformWindows
	case strings.Contains(s, "linux") ||
		strings.Contains(s, "android") ||
		strings.Contains(s, "cros") ||
		strings.Contains(s, "x11"):
		return PlatformLinux
	default:
		return PlatformOther
	}
}

// platformMatches reports whether p satisfies a <neo-condition> platform
// expression: a space-separated OR of tokens, optionally prefixed "not ".
// Mirrors matchPlatform in web/lib/neo-condition.
func platformMatches(expr string, p Platform) bool {
	e := strings.ToLower(strings.TrimSpace(expr))
	if e == "" {
		return true
	}
	negate := strings.HasPrefix(e, "not ")
	if negate {
		e = strings.TrimSpace(e[len("not "):])
	}
	matched := false
	for _, tok := range strings.Fields(e) {
		if platformToken(tok, p) {
			matched = true
			break
		}
	}
	if negate {
		return !matched
	}
	return matched
}

func platformToken(token string, p Platform) bool {
	switch token {
	case "apple",
		"mac",
		"macos",
		"ios":
		return p == PlatformApple
	case "windows",
		"win":
		return p == PlatformWindows
	case "linux":
		return p == PlatformLinux
	}
	return false
}

// --- single-key glyph formatting (mirror of web/lib/platform.ts) ---

var keyAliases = map[string]string{
	"esc":      "escape",
	"enter":    "enter",
	"return":   "enter",
	"space":    " ",
	"spacebar": " ",
	"up":       "arrowup",
	"down":     "arrowdown",
	"left":     "arrowleft",
	"right":    "arrowright",
	"plus":     "+",
	"comma":    ",",
	"del":      "delete",
}

var keyGlyphsApple = map[string]string{
	" ":          "Space",
	"enter":      "↵",
	"escape":     "⎋",
	"tab":        "⇥",
	"delete":     "⌦",
	"backspace":  "⌫",
	"arrowup":    "↑",
	"arrowdown":  "↓",
	"arrowleft":  "←",
	"arrowright": "→",
}

var keyLabelsOther = map[string]string{
	" ":          "Space",
	"enter":      "Enter",
	"escape":     "Esc",
	"tab":        "Tab",
	"delete":     "Del",
	"backspace":  "Backspace",
	"arrowup":    "↑",
	"arrowdown":  "↓",
	"arrowleft":  "←",
	"arrowright": "→",
}

func keyLabel(key string, apple bool) string {
	m := keyLabelsOther
	if apple {
		m = keyGlyphsApple
	}
	if v, ok := m[key]; ok {
		return v
	}
	r := []rune(key)
	if len(r) == 1 {
		return strings.ToUpper(key)
	}
	return strings.ToUpper(string(r[0])) + string(r[1:])
}

var modifierGlyphsApple = map[string]string{
	"mod":     "⌘",
	"meta":    "⌘",
	"cmd":     "⌘",
	"command": "⌘",
	"super":   "⌘",
	"win":     "⌘",
	"ctrl":    "⌃",
	"control": "⌃",
	"alt":     "⌥",
	"option":  "⌥",
	"opt":     "⌥",
	"shift":   "⇧",
}

var modifierLabelsOther = map[string]string{
	"mod":     "Ctrl",
	"ctrl":    "Ctrl",
	"control": "Ctrl",
	"alt":     "Alt",
	"option":  "Alt",
	"opt":     "Alt",
	"shift":   "Shift",
	"meta":    "Win",
	"cmd":     "Win",
	"command": "Win",
	"super":   "Win",
	"win":     "Win",
}

// formatKey renders a single key token as a platform label: a modifier
// glyph (⌘, ⇧, …) or, via keyLabel, a named key (↵, Esc) or letter. Empty
// for an empty token. Mirrors formatKey in web/lib/platform.ts.
func formatKey(token string, p Platform) string {
	t := strings.ToLower(strings.TrimSpace(token))
	if t == "" {
		return ""
	}
	mods := modifierLabelsOther
	if p == PlatformApple {
		mods = modifierGlyphsApple
	}
	if v, ok := mods[t]; ok {
		return v
	}
	if a, ok := keyAliases[t]; ok {
		t = a
	}
	return keyLabel(t, p == PlatformApple)
}
