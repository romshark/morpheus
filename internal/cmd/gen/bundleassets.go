package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/romshark/morpheus/internal/site"
)

// writeBundleAssets emits everything static/min/bundlebuilder.min.js needs
// to assemble the selected bundle in the browser:
//
//   - bundle-src/*.ts       : the kit's TypeScript sources, fetched
//     and bundled by esbuild-wasm on the fly.
//   - bundle-css/*.css      : the kit's source CSS modules copied from
//     web/lib/.
//   - bundle-manifest.json  : node -> {js, css, owners} wiring.
//
// Both target directories are flat: each component lives at
// web/lib/neo-X/neo-X.{ts,css} (per-component subfolder), but the in-
// browser builder addresses sources by bare filename. copyTSSources
// rewrites cross-subfolder relative imports (../neo-foo) back to
// flat-sibling (./neo-foo) during the copy.
func writeBundleAssets(staticDir string) error {
	const libRoot = "web/lib"

	libSrcDir := filepath.Join(staticDir, "bundle-src")
	if err := copyTSSources(libRoot, libSrcDir); err != nil {
		return err
	}

	cssDir := filepath.Join(staticDir, "bundle-css")
	if err := os.MkdirAll(cssDir, 0o755); err != nil {
		return err
	}
	// _base.css and _placeholders.css live at the top of web/lib/.
	if err := copyCSSModule(libRoot, cssDir, "_base.css"); err != nil {
		return err
	}
	if err := copyCSSModule(libRoot, cssDir, "_placeholders.css"); err != nil {
		return err
	}

	entries := site.BundleManifestEntries()
	for i := range entries {
		e := &entries[i]
		if e.JS != "" {
			if _, err := os.Stat(filepath.Join(libSrcDir, e.JS)); err != nil {
				e.JS = "" // no module shipped for this node
			}
		}
		if e.CSS == "" {
			continue
		}
		// Component CSS normally lives at web/lib/<slug>/<slug>.css.
		// Top-level shared slices such as _layout.css stay in web/lib/.
		srcDir := libRoot
		if !strings.HasPrefix(e.CSS, "_") {
			srcDir = filepath.Join(libRoot, e.Name)
		}
		if _, err := os.Stat(filepath.Join(srcDir, e.CSS)); err != nil {
			e.CSS = ""
			continue
		}
		if err := copyCSSModule(srcDir, cssDir, e.CSS); err != nil {
			return err
		}
	}

	manifest := struct {
		Base    []string                   `json:"base"`
		Entries []site.BundleManifestEntry `json:"entries"`
	}{Base: []string{"_base.css", "_placeholders.css"}, Entries: entries}
	data, err := json.Marshal(manifest)
	if err != nil {
		return err
	}
	return os.WriteFile(
		filepath.Join(staticDir, "bundle-manifest.json"), data, 0o644,
	)
}

func copyCSSModule(srcDir, dstDir, name string) error {
	b, err := os.ReadFile(filepath.Join(srcDir, name))
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dstDir, name), b, 0o644)
}

// `import "..."` / `from "..."` with a parent-relative path; we rewrite
// "../X" to "./X" so the flattened bundle-src/ still resolves sibling
// modules.
var reParentImport = regexp.MustCompile(`(["'\x60])\.\./`)

// copyTSSources mirrors *.ts from src into dst (flat). Top-level files
// at web/lib/*.ts copy as-is; per-component files at web/lib/neo-X/neo-X.ts
// flatten to dst/neo-X.ts and their "../foo" imports get rewritten to
// "./foo". esbuild-wasm fetches the result over HTTP and bundles it on
// the fly.
func copyTSSources(src, dst string) error {
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	ents, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, ent := range ents {
		name := ent.Name()
		if ent.IsDir() {
			// Per-component subfolder: copy only neo-X.ts (drop
			// index.ts re-exports and component CSS).
			componentFile := name + ".ts"
			b, err := os.ReadFile(filepath.Join(src, name, componentFile))
			if err != nil {
				if os.IsNotExist(err) {
					continue
				}
				return err
			}
			out := reParentImport.ReplaceAll(b, []byte("$1./"))
			if err := os.WriteFile(
				filepath.Join(dst, componentFile), out, 0o644,
			); err != nil {
				return err
			}
			continue
		}
		if !strings.HasSuffix(name, ".ts") || name == "index.ts" {
			continue
		}
		b, err := os.ReadFile(filepath.Join(src, name))
		if err != nil {
			return err
		}
		if err := os.WriteFile(
			filepath.Join(dst, name), b, 0o644,
		); err != nil {
			return err
		}
	}
	return nil
}
