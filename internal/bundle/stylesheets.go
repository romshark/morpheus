package bundle

import (
	"fmt"
	"io/fs"
	"path"
	"regexp"
	"slices"
	"strings"
)

// Sheet is one stylesheet morpheus.css imports.
type Sheet struct {
	// File is the name in bundle-css/.
	File string `json:"file"`
	// Nodes are the ids that need the sheet; empty for a base sheet,
	// which always ships.
	Nodes []string `json:"nodes,omitempty"`

	path    string              // relative to web/lib
	owner   string              // component the sheet belongs to, "" for base
	defines map[string][]string // custom property -> values set in :root rules
	reads   map[varRead]bool    // custom properties read with var()
}

// varRead is one var() read of a custom property;
// fallback is "" for a read without one.
type varRead struct{ prop, fallback string }

// baseSheets ship in every bundle, like the top-level sheets
// without a component (_base.css). neo-spinner.global.css holds the
// kit-wide motion and contrast preferences.
var baseSheets = map[string]bool{
	"neo-spinner/neo-spinner.global.css": true,
}

// sheetUsers lists the nodes a sheet styles besides its owner.
// neo-button.css holds the <a data-neo-link> rules.
var sheetUsers = map[string][]string{
	"neo-button/neo-button.css": {"neo-link"},
}

var (
	reMorpheusImport = regexp.MustCompile(`@import\s+"(?:\.\./)*web/lib/([^"]+)"`)
	reBlockComment   = regexp.MustCompile(`(?s)/\*.*?\*/`)
	reLineComment    = regexp.MustCompile(`(?m)^\s*//.*$`)
	reTypeImport     = regexp.MustCompile(`(?m)^import type [^;]*;`)
	// An innermost rule, which is a selector and a block without nested braces.
	reCSSRule = regexp.MustCompile(`([^{}]*)\{([^{}]*)\}`)
	// :root, optionally qualified, as in `:root[data-pref-contrast-more]`.
	reRootSelector = regexp.MustCompile(`^:root(?:\[[^\]]*\]|:[a-z-]+(?:\([^)]*\))?)*$`)
	reCustomProp   = regexp.MustCompile(`(--neo-[a-z0-9-]+)\s*:([^;]*)`)
	// A var() read up to the comma before its fallback or its closing
	// parenthesis.
	reVarRead   = regexp.MustCompile(`var\(\s*(--neo-[a-z0-9-]+)\s*([,)])`)
	reRelImport = regexp.MustCompile(`(?:from|import)\s+["'](\.\.?/[^"']+)["']`)
)

// stylesheets lists morpheus.css's imports in order, each with the nodes
// that need it. A node needs its own sheets and, transitively, each sheet
// that sets a :root custom property its JS or a needed sheet reads
// (neo-toggle reads neo-button.css's --neo-button-* tokens). A read whose
// fallback equals every value a sheet sets does not need that sheet.
func stylesheets(fsys, lib fs.FS, entries []Entry) ([]Sheet, error) {
	src, err := fs.ReadFile(fsys, "internal/site/static/morpheus.css")
	if err != nil {
		return nil, err
	}
	nodeIDs := make(map[string]string, len(entries))
	for _, e := range entries {
		nodeIDs[e.Name] = e.ID
	}

	var sheets []Sheet
	for _, m := range reMorpheusImport.FindAllStringSubmatch(string(src), -1) {
		p := m[1]
		dir, file := path.Split(p)
		owner := strings.TrimSuffix(dir, "/")
		if owner == "" {
			// A top-level _x.css belongs to neo-x if that node exists, else is base.
			if name := "neo-" + strings.TrimSuffix(
				strings.TrimPrefix(file, "_"), ".css",
			); nodeIDs[name] != "" {
				owner = name
			}
		}
		if baseSheets[p] {
			owner = ""
		}
		if owner != "" && nodeIDs[owner] == "" {
			return nil, fmt.Errorf(
				"morpheus.css imports %s, which has no bundle graph node", p,
			)
		}
		b, err := fs.ReadFile(lib, p)
		if err != nil {
			return nil, err
		}
		css := reBlockComment.ReplaceAllString(string(b), "")
		sheets = append(sheets, Sheet{
			File:    file,
			path:    p,
			owner:   owner,
			defines: rootProps(css),
			reads:   varReads(css),
		})
	}
	for p, users := range sheetUsers {
		if !slices.ContainsFunc(sheets,
			func(s Sheet) bool { return s.path == p }) {
			return nil, fmt.Errorf("sheetUsers: morpheus.css imports no %s", p)
		}
		for _, u := range users {
			if nodeIDs[u] == "" {
				return nil, fmt.Errorf("sheetUsers: %s has no bundle graph node", u)
			}
		}
	}

	// providers[p] are the non-base sheets that set p on :root.
	providers := make(map[string][]int)
	for i, s := range sheets {
		if s.owner == "" {
			continue
		}
		for p := range s.defines {
			providers[p] = append(providers[p], i)
		}
	}
	// needs returns the providers the reads depend on.
	needs := func(reads map[varRead]bool) []int {
		var out []int
		for r := range reads {
			for _, j := range providers[r.prop] {
				if r.fallback == "" ||
					slices.ContainsFunc(sheets[j].defines[r.prop], func(v string) bool {
						return v != r.fallback
					}) {
					out = append(out, j)
				}
			}
		}
		return out
	}

	// A sheet a base sheet needs ships in every bundle too.
	var always func(i int)
	always = func(i int) {
		for _, j := range needs(sheets[i].reads) {
			if sheets[j].owner != "" {
				sheets[j].owner = ""
				always(j)
			}
		}
	}
	for i := range sheets {
		if sheets[i].owner == "" {
			always(i)
		}
	}

	for _, e := range entries {
		need := make(map[int]bool)
		var add func(i int)
		add = func(i int) {
			if need[i] {
				return
			}
			need[i] = true
			for _, j := range needs(sheets[i].reads) {
				add(j)
			}
		}
		for i, s := range sheets {
			if s.owner == e.Name || slices.Contains(sheetUsers[s.path], e.Name) {
				add(i)
			}
		}
		if e.JS != "" {
			reads, err := moduleReads(lib, path.Join(e.Name, e.JS))
			if err != nil {
				return nil, err
			}
			for _, j := range needs(reads) {
				add(j)
			}
		}
		for i := range need {
			if sheets[i].owner != "" {
				sheets[i].Nodes = append(sheets[i].Nodes, e.ID)
			}
		}
	}
	for i := range sheets {
		slices.Sort(sheets[i].Nodes)
	}
	return sheets, nil
}

// rootProps returns the custom properties css sets on :root,
// also under @media, with every value set.
func rootProps(css string) map[string][]string {
	props := make(map[string][]string)
	for _, m := range reCSSRule.FindAllStringSubmatch(css, -1) {
		selectors := m[1][strings.LastIndex(m[1], ";")+1:]
		if !slices.ContainsFunc(strings.Split(selectors, ","), func(s string) bool {
			return reRootSelector.MatchString(strings.TrimSpace(s))
		}) {
			continue
		}
		for _, d := range reCustomProp.FindAllStringSubmatch(m[2], -1) {
			props[d[1]] = append(props[d[1]], cssValue(d[2]))
		}
	}
	return props
}

func varReads(src string) map[varRead]bool {
	reads := make(map[varRead]bool)
	for _, m := range reVarRead.FindAllStringSubmatchIndex(src, -1) {
		r := varRead{prop: src[m[2]:m[3]]}
		if src[m[4]] == ',' {
			// The fallback runs to the parenthesis that closes var(.
			depth, end := 0, m[5]
			for ; end < len(src) && (src[end] != ')' || depth > 0); end++ {
				switch src[end] {
				case '(':
					depth++
				case ')':
					depth--
				}
			}
			r.fallback = cssValue(src[m[5]:end])
		}
		reads[r] = true
	}
	return reads
}

// cssValue collapses whitespace, which makes values that differ only in
// formatting compare equal.
func cssValue(v string) string { return strings.Join(strings.Fields(v), " ") }

// moduleReads returns the var() reads in a module and the modules it
// imports, which the bundle ships with it.
func moduleReads(lib fs.FS, entry string) (map[varRead]bool, error) {
	reads := make(map[varRead]bool)
	seen := make(map[string]bool)
	var visit func(p string) error
	visit = func(p string) error {
		if seen[p] {
			return nil
		}
		seen[p] = true
		b, err := fs.ReadFile(lib, p)
		if err != nil {
			return err
		}
		src := reBlockComment.ReplaceAllString(string(b), "")
		src = reLineComment.ReplaceAllString(src, "")
		src = reTypeImport.ReplaceAllString(src, "")
		for r := range varReads(src) {
			reads[r] = true
		}
		for _, m := range reRelImport.FindAllStringSubmatch(src, -1) {
			target := path.Join(path.Dir(p), m[1])
			if !strings.HasSuffix(target, ".css") {
				target = resolveModule(lib, target)
				if target == "" {
					return fmt.Errorf("web/lib/%s: cannot resolve %q", p, m[1])
				}
			}
			if err := visit(target); err != nil {
				return err
			}
		}
		return nil
	}
	if err := visit(entry); err != nil {
		return nil, err
	}
	return reads, nil
}

// resolveModule maps an extensionless import to x.ts or the folder's index.ts.
func resolveModule(lib fs.FS, p string) string {
	for _, f := range []string{p + ".ts", path.Join(p, "index.ts")} {
		if exists(lib, f) {
			return f
		}
	}
	return ""
}
