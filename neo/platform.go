package neo

import "strings"

// Platform is the OS used for server-side platform gating
// (<neo-if-platform>) and shortcut-hint pre-rendering (<neo-kbd>). Detect it
// from the request User-Agent with [DetectPlatform]; the client then refines
// via navigator.userAgentData.platform. Mirrors web/lib/platform.ts so the
// server pre-render matches what the browser would render, eliminating the
// flash where content changes after the bundle upgrades the elements.
type Platform string

const (
	PlatformMacOS    Platform = "macos"
	PlatformIOS      Platform = "ios"
	PlatformWindows  Platform = "windows"
	PlatformLinux    Platform = "linux"
	PlatformAndroid  Platform = "android"
	PlatformChromeOS Platform = "chromeos"
	PlatformOther    Platform = "" // zero value: unknown
)

// apple reports whether p uses the Apple modifier keys (⌘ for mod).
func (p Platform) apple() bool { return p == PlatformMacOS || p == PlatformIOS }

// DetectPlatform classifies a User-Agent header into an OS. The server
// only has the UA string (no client hints), which makes this a best guess
// the client may refine. iPadOS Safari sends a Mac UA and detects as
// [PlatformMacOS]. An empty UA returns [PlatformOther].
func DetectPlatform(userAgent string) Platform {
	s := strings.ToLower(userAgent)
	switch {
	case s == "":
		return PlatformOther
	case strings.Contains(s, "iphone") ||
		strings.Contains(s, "ipad") ||
		strings.Contains(s, "ipod"):
		return PlatformIOS
	case strings.Contains(s, "mac"):
		return PlatformMacOS
	// Not "win", which "Darwin" in Apple app UAs contains.
	case strings.Contains(s, "windows"):
		return PlatformWindows
	// Before Linux, which Android and ChromeOS UAs also contain.
	case strings.Contains(s, "android"):
		return PlatformAndroid
	case strings.Contains(s, "cros"):
		return PlatformChromeOS
	case strings.Contains(s, "linux") ||
		strings.Contains(s, "x11"):
		return PlatformLinux
	default:
		return PlatformOther
	}
}

// platformShown reports whether a <neo-if-platform> with the platform commands cmds
// shows on p. p's own command decides if set, else it shows only when no platform
// is set true. Mirrors NeoIfPlatform.holds in web/lib/neo-if-platform.
func platformShown(cmds map[Platform]bool, p Platform) bool {
	if v, ok := cmds[p]; ok {
		return v
	}
	for _, v := range cmds {
		if v {
			return false
		}
	}
	return true
}

// Single-key glyph formatting mirrors web/lib/platform.ts.

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
	"enter":      "↩",
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
	"delete":     "Delete",
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

// formatKey renders a single key token as a platform label, either a
// modifier glyph (⌘, ⇧, ...) or, via keyLabel, a named key (↩, Esc) or
// letter. Empty
// for an empty token. Mirrors formatKey in web/lib/platform.ts.
func formatKey(token string, p Platform) string {
	t := strings.ToLower(strings.TrimSpace(token))
	if t == "" {
		return ""
	}
	mods := modifierLabelsOther
	if p.apple() {
		mods = modifierGlyphsApple
	}
	if v, ok := mods[t]; ok {
		return v
	}
	if a, ok := keyAliases[t]; ok {
		t = a
	}
	return keyLabel(t, p.apple())
}
