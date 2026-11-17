package site

import (
	"os"
	"path/filepath"
	"slices"
	"testing"
)

// TestNavIconsExist tests that every page icon has a file in both icon sets.
// The matrix theme reads static/icons-matrix, and a missing file there
// renders as an empty icon instead of failing.
func TestNavIconsExist(t *testing.T) {
	icons := map[string]string{}
	for _, l := range slices.Concat(DocLinks, ToolLinks) {
		icons[l.Icon] = l.Label
	}
	for _, g := range ComponentGroups {
		for _, l := range g.Links {
			icons[l.Icon] = l.Label
		}
	}
	for name, owner := range icons {
		if name == "" {
			t.Errorf("%s: no icon", owner)
			continue
		}
		for _, dir := range []string{"static/icons", "static/icons-matrix"} {
			p := filepath.Join(dir, name+".svg")
			if _, err := os.Stat(p); err != nil {
				t.Errorf("%s: icon %q: %v", owner, name, err)
			}
		}
	}
}
