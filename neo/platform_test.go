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
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)": PlatformApple,
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)":        PlatformApple,
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64)":       PlatformWindows,
		"Mozilla/5.0 (X11; Linux x86_64)":                 PlatformLinux,
		"Mozilla/5.0 (Linux; Android 14)":                 PlatformLinux,
		"":                                                PlatformOther,
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
		{"mod", PlatformApple, "⌘"},
		{"mod", PlatformWindows, "Ctrl"},
		{"mod", PlatformLinux, "Ctrl"},
		{"shift", PlatformApple, "⇧"},
		{"shift", PlatformWindows, "Shift"},
		{"alt", PlatformApple, "⌥"},
		{"enter", PlatformApple, "↵"},
		{"enter", PlatformWindows, "Enter"},
		{"escape", PlatformWindows, "Esc"},
		{"k", PlatformApple, "K"},
		{"k", PlatformWindows, "K"},
	}
	for _, c := range cases {
		if got := formatKey(c.key, c.p); got != c.want {
			t.Errorf("formatKey(%q, %q) = %q, want %q", c.key, c.p, got, c.want)
		}
	}
}

func TestPlatformMatches(t *testing.T) {
	if !platformMatches("windows linux", PlatformLinux) {
		t.Error(`"windows linux" should match linux`)
	}
	if !platformMatches("windows linux", PlatformWindows) {
		t.Error(`"windows linux" should match windows`)
	}
	if platformMatches("apple", PlatformWindows) {
		t.Error(`"apple" should not match windows`)
	}
	if !platformMatches("not apple", PlatformWindows) {
		t.Error(`"not apple" should match windows`)
	}
	if platformMatches("not apple", PlatformApple) {
		t.Error(`"not apple" should not match apple`)
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

func TestConditionServerPrerender(t *testing.T) {
	match := renderComponent(t, Condition(ConditionOpts{Platform: Set("apple"), UserAgent: Set("Mozilla/5.0 (Macintosh)")}))
	if !strings.Contains(match, "display:contents") {
		t.Errorf("matching branch should be pre-shown, got %q", match)
	}
	miss := renderComponent(t, Condition(ConditionOpts{Platform: Set("apple"), UserAgent: Set("Mozilla/5.0 (Windows NT 10.0)")}))
	if strings.Contains(miss, "display:contents") {
		t.Errorf("non-matching branch should stay hidden, got %q", miss)
	}
}
