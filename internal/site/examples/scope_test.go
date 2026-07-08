package examples

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// TestExampleStylesScoped enforces that every <style> block in a doc
// example is fully wrapped in `@scope { … }`. Example CSS lives in light
// DOM (Datastar needs it there), so an unscoped rule leaks page-wide and
// silently styles other demos. @scope confines each block to its own demo
// subtree; this guard fails the build if a block isn't scoped, instead of
// letting the leak through with no error.
func TestExampleStylesScoped(t *testing.T) {
	files, err := filepath.Glob("*.templ")
	if err != nil {
		t.Fatal(err)
	}
	styleRE := regexp.MustCompile(`(?s)<style>(.*?)</style>`)
	commentRE := regexp.MustCompile(`(?s)/\*.*?\*/`)
	for _, f := range files {
		src, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range styleRE.FindAllStringSubmatch(string(src), -1) {
			if bad := unscopedRule(commentRE.ReplaceAllString(m[1], "")); bad != "" {
				t.Errorf("%s: <style> rule outside @scope: %q\n"+
					"wrap the block's rules in `@scope { … }` so they don't leak page-wide", f, bad)
			}
		}
	}
}

// unscopedRule walks CSS at brace depth 0 and returns the first selector /
// at-rule preceding a `{` that isn't `@scope`, or "" if everything at the
// top level is an @scope block.
func unscopedRule(css string) string {
	depth := 0
	var head strings.Builder
	for _, r := range css {
		switch r {
		case '{':
			if depth == 0 {
				if h := strings.TrimSpace(head.String()); !strings.HasPrefix(h, "@scope") {
					return h
				}
				head.Reset()
			}
			depth++
		case '}':
			if depth > 0 {
				depth--
			}
		default:
			if depth == 0 {
				head.WriteRune(r)
			}
		}
	}
	return ""
}
