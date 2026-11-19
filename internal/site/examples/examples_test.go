package examples

import (
	"io/fs"
	"slices"
	"strings"
	"testing"
)

// TestTemplates tests that Templates lists exactly the .templ files.
func TestTemplates(t *testing.T) {
	files, err := fs.Glob(Sources, "*.templ")
	if err != nil {
		t.Fatal(err)
	}
	for i, f := range files {
		files[i] = strings.TrimSuffix(f, ".templ")
		if Templates[files[i]] == nil {
			t.Errorf("%s has no entry in Templates", f)
		}
	}
	for name := range Templates {
		if !slices.Contains(files, name) {
			t.Errorf("Templates has %s, but there is no %s.templ", name, name)
		}
	}
}
