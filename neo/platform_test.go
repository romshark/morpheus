package neo

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/a-h/templ"
)

func TestDetectPlatform(t *testing.T) {
	cases := map[string]Platform{
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)": PlatformMacOS,
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)":        PlatformIOS,
		"Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)":   PlatformIOS,
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64)":       PlatformWindows,
		"Mozilla/5.0 (X11; Linux x86_64)":                 PlatformLinux,
		"Mozilla/5.0 (Linux; Android 14)":                 PlatformAndroid,
		"Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)":        PlatformChromeOS,
		"Notes/1.0 CFNetwork/1410.0.3 Darwin/22.6.0":      PlatformOther,
		"": PlatformOther,
	}
	for ua, want := range cases {
		if got := DetectPlatform(ua); got != want {
			t.Errorf("DetectPlatform(%q) = %q, want %q", ua, got, want)
		}
	}
}

// formatKey must match web/lib/platform.ts so the SSR pre-render equals
// what the browser renders (no flash on reconcile).
func TestFormatKeyMatchesClient(t *testing.T) {
	cases := []struct {
		key  string
		p    Platform
		want string
	}{
		{"mod", PlatformMacOS, "⌘"},
		{"mod", PlatformWindows, "Ctrl"},
		{"mod", PlatformLinux, "Ctrl"},
		{"shift", PlatformMacOS, "⇧"},
		{"shift", PlatformWindows, "Shift"},
		{"alt", PlatformMacOS, "⌥"},
		{"enter", PlatformMacOS, "↵"},
		{"enter", PlatformWindows, "Enter"},
		{"escape", PlatformWindows, "Esc"},
		{"k", PlatformMacOS, "K"},
		{"k", PlatformWindows, "K"},
	}
	for _, c := range cases {
		if got := formatKey(c.key, c.p); got != c.want {
			t.Errorf("formatKey(%q, %q) = %q, want %q", c.key, c.p, got, c.want)
		}
	}
}

// TestPlatformShown tests that platforms set true are an OR, false
// excludes one, and with none set true every platform not excluded shows.
func TestPlatformShown(t *testing.T) {
	cases := []struct {
		cmds map[Platform]bool
		p    Platform
		want bool
	}{
		{nil, PlatformWindows, true},
		{nil, PlatformOther, true},
		{map[Platform]bool{PlatformMacOS: true, PlatformLinux: true}, PlatformLinux, true},
		{map[Platform]bool{PlatformMacOS: true, PlatformLinux: true}, PlatformWindows, false},
		{map[Platform]bool{PlatformMacOS: true}, PlatformOther, false},
		{map[Platform]bool{PlatformWindows: false}, PlatformWindows, false},
		{map[Platform]bool{PlatformWindows: false}, PlatformAndroid, true},
		{map[Platform]bool{PlatformWindows: false}, PlatformOther, true},
		{map[Platform]bool{PlatformMacOS: true, PlatformWindows: false}, PlatformWindows, false},
	}
	for _, c := range cases {
		if got := platformShown(c.cmds, c.p); got != c.want {
			t.Errorf("platformShown(%v, %q) = %v, want %v", c.cmds, c.p, got, c.want)
		}
	}
}

func renderComponent(t *testing.T, c templ.Component) string {
	t.Helper()
	var b bytes.Buffer
	if err := c.Render(context.Background(), &b); err != nil {
		t.Fatalf("render: %v", err)
	}
	return b.String()
}

func TestKbdServerPrerender(t *testing.T) {
	out := renderComponent(t, Kbd(KbdOpts{Key: Set("mod"), UserAgent: Set("Mozilla/5.0 (Windows NT 10.0)")}))
	if !strings.Contains(out, "Ctrl") {
		t.Errorf("kbd SSR want Ctrl glyph pre-rendered, got %q", out)
	}
}

func TestIfPlatformServerPrerender(t *testing.T) {
	opts := IfPlatformOpts{MacOS: Set(true), IOS: Set(true), Windows: Set(false)}
	opts.UserAgent = Set("Mozilla/5.0 (Macintosh)")
	match := renderComponent(t, IfPlatform(opts))
	if !strings.Contains(match, "display:contents") {
		t.Errorf("matching branch should be pre-shown, got %q", match)
	}
	for _, want := range []string{" macos", " ios", `windows="false"`} {
		if !strings.Contains(match, want) {
			t.Errorf("want %s, got %q", want, match)
		}
	}
	opts.UserAgent = Set("Mozilla/5.0 (Windows NT 10.0)")
	if miss := renderComponent(t, IfPlatform(opts)); strings.Contains(miss, "display:contents") {
		t.Errorf("non-matching branch should stay hidden, got %q", miss)
	}
}
