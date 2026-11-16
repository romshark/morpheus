package site

import "testing"

// TestDocItemID tests that item names reduce to lowercase [a-z0-9-] runs
// after the section id, and that the unnamed slot becomes "default".
func TestDocItemID(t *testing.T) {
	for _, tt := range []struct{ section, name, want string }{
		{"css-variables", "--neo-sortable-drag-shadow", "css-variables-neo-sortable-drag-shadow"},
		{"menuitem-events", "neo-menuitem-select", "menuitem-events-neo-menuitem-select"},
		{"attributes", "aria-Label", "attributes-aria-label"},
		{"slots", "", "slots-default"},
		{"parts", "::part(x)", "parts-part-x"},
	} {
		if got := docItemID(tt.section, tt.name); got != tt.want {
			t.Errorf("docItemID(%q, %q) = %q, want %q", tt.section, tt.name, got, tt.want)
		}
	}
}
