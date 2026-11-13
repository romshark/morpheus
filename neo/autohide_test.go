package neo

import (
	"strings"
	"testing"
)

// TestAutohideAttrs tests that the options render as the attributes
// <neo-autohide> reads.
func TestAutohideAttrs(t *testing.T) {
	out := renderComponent(t, Autohide(AutohideOpts{
		Side:      Set(AutohideSideBottom),
		Tolerance: Set(24),
		Disabled:  Set(false),
		ShowAtEnd: Set(false),
	}))
	for _, want := range []string{
		`side="bottom"`, `tolerance="24"`, `disabled="false"`, `show-at-end="false"`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("want %s, got %q", want, out)
		}
	}
}
