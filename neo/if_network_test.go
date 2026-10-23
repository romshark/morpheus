package neo

import (
	"strings"
	"testing"
)

// TestIfNetworkAttrs tests that Online and Delay render as the online and
// delay attributes <neo-if-network> reads.
func TestIfNetworkAttrs(t *testing.T) {
	out := renderComponent(t, IfNetwork(IfNetworkOpts{
		Online: Set(false),
		Delay:  Set(3000),
	}))
	for _, want := range []string{`online="false"`, `delay="3000"`} {
		if !strings.Contains(out, want) {
			t.Errorf("want %s, got %q", want, out)
		}
	}
}
