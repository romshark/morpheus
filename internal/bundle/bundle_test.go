package bundle

import (
	"bytes"
	"io/fs"
	"os"
	"regexp"
	"slices"
	"testing"
)

// repo is the repository root, which holds [TreePaths].
var repo = os.DirFS("../..")

func prepare(t *testing.T) Version {
	t.Helper()
	v, err := Prepare(repo)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

// TestBuildAll tests that [Build] of every component reproduces
// web/build.ts's min/bundle.js and min/morpheus.css.
func TestBuildAll(t *testing.T) {
	v := prepare(t)
	var all []string
	for _, nd := range Nodes() {
		if nd.Selectable() {
			all = append(all, nd.ID)
		}
	}
	js, css, err := Build(v, all, true)
	if err != nil {
		t.Fatal(err)
	}
	for name, got := range map[string][]byte{"min/bundle.js": js, "min/morpheus.css": css} {
		want, err := fs.ReadFile(repo, name)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(got, want) {
			t.Errorf("Build output is not %s: %d bytes, want %d", name, len(got), len(want))
		}
	}
}

// TestBuildSelection tests that a build holds only the selected modules.
func TestBuildSelection(t *testing.T) {
	v := prepare(t)
	js, css, err := Build(v, Select([]string{"dialog"}, v.Absent).IDs, false)
	if err != nil {
		t.Fatal(err)
	}
	// Unminified output names each module by its path.
	for module, want := range map[string]bool{"neo-dialog.ts": true, "neo-select.ts": false} {
		if got := bytes.Contains(js, []byte("\n// morpheus:"+module+"\n")); got != want {
			t.Errorf("bundle has %s: %v, want %v", module, got, want)
		}
	}
	if len(css) == 0 {
		t.Error("no CSS")
	}
}

// TestThemes tests that [Prepare] ships the min/theme-*.css files that load
// no other file, unchanged.
func TestThemes(t *testing.T) {
	v := prepare(t)
	want := []string{"theme-default.css", "theme-rose.css", "theme-sunshine.css"}
	if !slices.Equal(v.Manifest.Themes, want) {
		t.Errorf("Themes = %v, want %v", v.Manifest.Themes, want)
	}
	for _, name := range v.Manifest.Themes {
		b, err := fs.ReadFile(repo, "min/"+name)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(v.Files["bundle-themes/"+name], b) {
			t.Errorf("bundle-themes/%s is not min/%s", name, name)
		}
	}
}

// TestEsbuildPin tests that go.mod requires the esbuild version web/package.json pins.
// web/build.ts builds min/ with it, and the bundle builder page loads it as esbuild-wasm.
func TestEsbuildPin(t *testing.T) {
	mod, err := fs.ReadFile(repo, "go.mod")
	if err != nil {
		t.Fatal(err)
	}
	m := regexp.MustCompile(`(?m)^(?:require)?\s+github\.com/evanw/esbuild v(\S+)`).FindSubmatch(mod)
	if m == nil {
		t.Fatal("go.mod does not require github.com/evanw/esbuild")
	}
	got := string(m[1])
	if want := prepare(t).Manifest.Esbuild; got != want {
		t.Errorf("go.mod requires esbuild %s, web/package.json pins %s", got, want)
	}
}

func TestSelect(t *testing.T) {
	s := Select([]string{" NEO-Select, dialog", "nope,option", ""}, nil)
	if want := []string{"graph-neo-dialog", "graph-neo-select"}; !slices.Equal(s.Named, want) {
		t.Errorf("Named = %v, want %v", s.Named, want)
	}
	want := []string{
		"graph-neo-datalist", "graph-neo-dialog", "graph-neo-icon",
		"graph-neo-select", "graph-neo-spinner",
	}
	if !slices.Equal(s.IDs, want) {
		t.Errorf("IDs = %v, want %v", s.IDs, want)
	}
	// option is bound. It ships with select, but a selection cannot name it.
	if want := []string{"nope", "option"}; !slices.Equal(s.Unknown, want) {
		t.Errorf("Unknown = %v, want %v", s.Unknown, want)
	}

	s = Select([]string{"select,dialog"}, []string{"graph-neo-dialog", "graph-neo-icon"})
	if want := []string{"dialog"}; !slices.Equal(s.Missing, want) {
		t.Errorf("Missing = %v, want %v", s.Missing, want)
	}
	if want := []string{"graph-neo-datalist", "graph-neo-select", "graph-neo-spinner"}; !slices.Equal(s.IDs, want) {
		t.Errorf("IDs = %v, want %v", s.IDs, want)
	}
}
