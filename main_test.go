package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"testing"

	"github.com/romshark/morpheus/internal/bundle"
)

// TestTree tests that tree prepares the same [bundle.Version] as the repository.
// A failure means a //go:embed pattern misses a file that [bundle.Prepare] reads.
func TestTree(t *testing.T) {
	want, err := bundle.Prepare(os.DirFS("."))
	if err != nil {
		t.Fatal(err)
	}
	got, err := bundle.Prepare(tree)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Error("the embedded tree differs from the repository; check the //go:embed patterns")
	}
}

func TestBundle(t *testing.T) {
	dir := t.TempDir()
	var stdout, stderr bytes.Buffer
	args := []string{
		"bundle", "-components", "neo-Select", "-components", "dialog",
		"-unminified", "-json", "-o", dir,
	}
	if status := run(args, &stdout, &stderr); status != 0 {
		t.Fatalf("status %d: %s", status, &stderr)
	}
	var res bundleResult
	if err := json.Unmarshal(stdout.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if want := []string{"datalist", "dialog", "icon", "select", "spinner"}; !slices.Equal(res.Components, want) {
		t.Errorf("components %v, want %v", res.Components, want)
	}
	if want := []string{"datalist", "icon", "spinner"}; !slices.Equal(res.Added, want) {
		t.Errorf("added %v, want %v", res.Added, want)
	}
	var names []string
	for _, f := range res.Files {
		names = append(names, filepath.Base(f.Path))
		b, err := os.ReadFile(f.Path)
		if err != nil {
			t.Fatal(err)
		}
		if f.Size != len(b) || f.Gzip <= 0 || f.Gzip >= f.Size || f.Brotli <= 0 || f.Brotli >= f.Size {
			t.Errorf("%s: sizes %+v for %d bytes", f.Path, f, len(b))
		}
	}
	want := []string{"morpheus.min.js", "morpheus.min.css", "morpheus.js", "morpheus.css"}
	if !slices.Equal(names, want) {
		t.Errorf("files %v, want %v", names, want)
	}
}

func TestComponents(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if status := run([]string{"components", "-json"}, &stdout, &stderr); status != 0 {
		t.Fatalf("status %d: %s", status, &stderr)
	}
	var res componentsResult
	if err := json.Unmarshal(stdout.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	i := slices.IndexFunc(res.Components, func(c componentInfo) bool { return c.Name == "select" })
	if i < 0 {
		t.Fatal("no select")
	}
	want := componentInfo{
		Name:     "select",
		Requires: []string{"datalist", "icon", "spinner"},
		Includes: []string{"optgroup", "option"},
	}
	if !reflect.DeepEqual(res.Components[i], want) {
		t.Errorf("select: %+v, want %+v", res.Components[i], want)
	}
}

func TestUsageErrors(t *testing.T) {
	for _, args := range [][]string{
		nil,
		{"build"},
		{"bundle"},
		{"bundle", "select"},
		{"bundle", "-components", "selct"},
		{"bundle", "-components", "select", "-bogus"},
		{"components", "select"},
	} {
		var stderr bytes.Buffer
		if status := run(args, io.Discard, &stderr); status != exitUsage {
			t.Errorf("run(%q) = %d, want %d", args, status, exitUsage)
		}
		if stderr.Len() == 0 {
			t.Errorf("run(%q) printed no error", args)
		}
	}
}
