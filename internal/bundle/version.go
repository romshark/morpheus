// Package bundle builds a Morpheus bundle of chosen components.
// It holds the component graph, the source tree preparation and the build,
// which the morpheus command, internal/cmd/gen and the bundle builder page share.
package bundle

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"path"
	"regexp"
	"slices"
	"strings"
)

// TreePaths are the parts of a source tree a [Version] is prepared from,
// as git pathspecs.
var TreePaths = []string{
	"web/lib", "web/package.json", "min/bundle.js", "min/theme-*.css",
	"internal/site/static/morpheus.css",
}

// Version is a source tree prepared for building with the current graph
// ([Nodes]). internal/cmd/gen writes it to static/bundle/<version>/,
// which the bundle builder page builds from:
//
//   - bundle-src/: the kit's TypeScript, flattened ([flatten]),
//     with the stylesheets it imports as text and index.ts.
//   - bundle-css/: the stylesheets morpheus.css imports.
//   - bundle-themes/: the min/theme-*.css files that load no other file.
//   - bundle-manifest.json: the [Manifest].
type Version struct {
	Manifest Manifest
	// Absent are the selectable ids the tree lacks.
	Absent []string
	// Files are bundle-src/, bundle-css/ and bundle-themes/
	// by slash-separated path.
	Files map[string][]byte
}

// Manifest is a version's bundle-manifest.json. CSS is in morpheus.css import order.
type Manifest struct {
	Banner  string  `json:"banner"`
	Esbuild string  `json:"esbuild"`
	CSS     []Sheet `json:"css"`
	Entries []Entry `json:"entries"`
	// Themes are the file names in bundle-themes/, such as theme-default.css.
	Themes []string `json:"themes"`
}

// Entry is a graph node in a [Manifest].
type Entry struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Bound bool   `json:"bound"`
	// JS is the module's file name in bundle-src/, or "" for none.
	JS string `json:"js"`
	// Owners, for a bound node, are the ids whose selection ships it.
	Owners []string `json:"owners,omitempty"`
}

// Prepare prepares the tree in fsys, which holds [TreePaths].
func Prepare(fsys fs.FS) (Version, error) {
	lib, err := fs.Sub(fsys, "web/lib")
	if err != nil {
		return Version{}, err
	}
	entries := manifestEntries()
	var absent []string
	for i := range entries {
		e := &entries[i]
		if e.JS != "" && !exists(lib, path.Join(e.Name, e.JS)) {
			e.JS = "" // no module in this tree
		}
		// A bound node can live in its owner's module.
		if !e.Bound && !ships(lib, e.Name) {
			absent = append(absent, e.ID)
		}
	}
	if err := checkIndexImports(lib, entries); err != nil {
		return Version{}, err
	}
	sheets, err := stylesheets(fsys, lib, entries)
	if err != nil {
		return Version{}, err
	}
	banner, err := readBanner(fsys)
	if err != nil {
		return Version{}, err
	}
	esbuild, err := esbuildVersion(fsys)
	if err != nil {
		return Version{}, err
	}
	files, err := flatten(lib)
	if err != nil {
		return Version{}, err
	}
	for _, s := range sheets {
		b, err := fs.ReadFile(lib, s.path)
		if err != nil {
			return Version{}, err
		}
		files[path.Join("bundle-css", s.File)] = b
	}
	themeNames, err := themes(fsys, files)
	if err != nil {
		return Version{}, err
	}
	return Version{
		Manifest: Manifest{
			Banner: banner, Esbuild: esbuild, CSS: sheets, Entries: entries,
			Themes: themeNames,
		},
		Absent: absent,
		Files:  files,
	}, nil
}

// manifestEntries returns an entry per node, in [Nodes] order.
func manifestEntries() []Entry {
	nodes := Nodes()
	out := make([]Entry, 0, len(nodes))
	for _, nd := range nodes {
		e := Entry{
			ID:    nd.ID,
			Name:  nd.Name,
			Bound: nd.Bound,
			JS:    nd.Name + ".ts",
		}
		if nd.Bound {
			e.Owners = nd.RequiredBy
		}
		out = append(out, e)
	}
	return out
}

// A url() and its data: scheme, if any.
var reURL = regexp.MustCompile(`url\(\s*["']?(data:)?`)

// themes adds the tree's min/theme-*.css files to files as bundle-themes/
// and returns their names. It skips a theme with a url() other than a
// data: URL, such as a @font-face font, because the url() is a doc-site
// path and fails anywhere else.
func themes(fsys fs.FS, files map[string][]byte) ([]string, error) {
	paths, err := fs.Glob(fsys, "min/theme-*.css")
	if err != nil {
		return nil, err
	}
	names := []string{}
	for _, p := range paths {
		b, err := fs.ReadFile(fsys, p)
		if err != nil {
			return nil, err
		}
		if slices.ContainsFunc(reURL.FindAllSubmatchIndex(b, -1), func(m []int) bool {
			return m[2] < 0
		}) {
			continue
		}
		name := path.Base(p)
		files[path.Join("bundle-themes", name)] = b
		names = append(names, name)
	}
	return names, nil
}

// esbuildVersion returns the tree's esbuild devDependency. The bundle builder page
// loads that esbuild-wasm to reproduce the tree's min/bundle.js.
func esbuildVersion(fsys fs.FS) (string, error) {
	const name = "web/package.json"
	b, err := fs.ReadFile(fsys, name)
	if err != nil {
		return "", err
	}
	var pkg struct {
		DevDependencies map[string]string `json:"devDependencies"`
	}
	if err := json.Unmarshal(b, &pkg); err != nil {
		return "", fmt.Errorf("%s: %w", name, err)
	}
	v := pkg.DevDependencies["esbuild"]
	if v == "" {
		return "", fmt.Errorf("%s: no esbuild devDependency", name)
	}
	return v, nil
}

// ships reports whether lib has component name as a folder,
// a top-level _x.css or a [sheetUsers] sheet.
func ships(lib fs.FS, name string) bool {
	if exists(lib, name) ||
		exists(lib, "_"+strings.TrimPrefix(name, "neo-")+".css") {
		return true
	}
	for p, users := range sheetUsers {
		if slices.Contains(users, name) && exists(lib, p) {
			return true
		}
	}
	return false
}

func exists(fsys fs.FS, name string) bool {
	_, err := fs.Stat(fsys, name)
	return err == nil
}

// A parent-relative import path, made a sibling one in the flat bundle-src/.
var reParentImport = regexp.MustCompile(`(["'\x60])\.\./`)

// A stylesheet a module imports as text, such as `from "./neo-x.css"`.
var reCSSImport = regexp.MustCompile(`from\s+["'](\.\.?/[^"']+\.css)["']`)

// flatten returns lib's modules as a flat bundle-src/. neo-X/neo-X.ts
// becomes bundle-src/neo-X.ts with "../" imports rewritten to "./".
// Each stylesheet it imports as text lands where the rewritten import resolves.
// Top-level *.ts files copy as is.
func flatten(lib fs.FS) (map[string][]byte, error) {
	ents, err := fs.ReadDir(lib, ".")
	if err != nil {
		return nil, err
	}
	files := make(map[string][]byte)
	for _, ent := range ents {
		name := ent.Name()
		if ent.IsDir() {
			// The folder's index.ts only re-exports neo-X.ts.
			componentFile := name + ".ts"
			b, err := fs.ReadFile(lib, path.Join(name, componentFile))
			if errors.Is(err, fs.ErrNotExist) {
				continue
			}
			if err != nil {
				return nil, err
			}
			for _, m := range reCSSImport.FindAllSubmatch(b, -1) {
				spec := string(m[1])
				css, err := fs.ReadFile(lib, path.Join(name, spec))
				if err != nil {
					return nil, err
				}
				dst := path.Join("bundle-src", strings.Replace(spec, "../", "./", 1))
				files[dst] = css
			}
			files[path.Join("bundle-src", componentFile)] =
				reParentImport.ReplaceAll(b, []byte("$1./"))
			continue
		}
		// [Build] filters index.ts's imports to the selection.
		if !strings.HasSuffix(name, ".ts") {
			continue
		}
		b, err := fs.ReadFile(lib, name)
		if err != nil {
			return nil, err
		}
		files[path.Join("bundle-src", name)] = b
	}
	return files, nil
}

// A component import in index.ts, kept by [Build] when selected.
var reIndexImport = regexp.MustCompile(`(?m)^import "\./(neo-[a-z0-9-]+)";$`)

// checkIndexImports fails when index.ts imports a module no graph node
// has, because [Build] could never include it.
func checkIndexImports(lib fs.FS, entries []Entry) error {
	b, err := fs.ReadFile(lib, "index.ts")
	if err != nil {
		return err
	}
	have := modules(entries)
	for _, m := range reIndexImport.FindAllSubmatch(b, -1) {
		if !have[string(m[1])] {
			return fmt.Errorf(
				"web/lib/index.ts imports %s, which has no bundle graph node", m[1],
			)
		}
	}
	return nil
}

// modules returns the entries' module names as index.ts imports them,
// such as neo-x.
func modules(entries []Entry) map[string]bool {
	m := make(map[string]bool, len(entries))
	for _, e := range entries {
		if e.JS != "" {
			m[strings.TrimSuffix(e.JS, ".ts")] = true
		}
	}
	return m
}

// readBanner returns min/bundle.js's license comment, which [Build]
// stamps on its bundles.
func readBanner(fsys fs.FS) (string, error) {
	const name = "min/bundle.js"
	b, err := fs.ReadFile(fsys, name)
	if err != nil {
		return "", err
	}
	line, _, _ := bytes.Cut(b, []byte("\n"))
	if !bytes.HasPrefix(line, []byte("/*!")) {
		return "", fmt.Errorf("%s: first line is not a license banner", name)
	}
	return string(line), nil
}
