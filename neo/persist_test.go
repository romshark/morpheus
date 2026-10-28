package neo

import (
	"strings"
	"testing"
)

// TestPersistOn tests that On renders as the HTML-escaped on attribute
// <neo-persist> reads.
func TestPersistOn(t *testing.T) {
	out := renderComponent(t, PersistFor(PersistOpts{
		On:  []string{"scroll", `x"y`},
		For: Set("t"),
	}))
	want := `on="scroll x&#34;y"`
	if !strings.Contains(out, want) {
		t.Errorf("want %s, got %q", want, out)
	}
}
