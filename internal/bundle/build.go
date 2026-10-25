package bundle

import (
	"errors"
	"io/fs"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/evanw/esbuild/pkg/api"
)

// Build returns the JS and CSS bundles of the selected ids.
// web/site/bundle-size.ts builds the same bytes in the browser with the
// same esbuild version.
func Build(v Version, selected []string, minify bool) (js, css []byte, err error) {
	nodes := shipped(v.Manifest, selected)
	if js, err = buildJS(v, nodes, minify); err != nil {
		return nil, nil, err
	}
	if css, err = buildCSS(v, nodes, minify); err != nil {
		return nil, nil, err
	}
	return js, css, nil
}

// shipped returns the entries a selection ships.
// A bound node ships when any of its owners does.
func shipped(m Manifest, selected []string) []Entry {
	sel := make(map[string]bool, len(selected))
	for _, id := range selected {
		sel[id] = true
	}
	var out []Entry
	for _, e := range m.Entries {
		ships := sel[e.ID]
		if e.Bound {
			ships = slices.ContainsFunc(e.Owners, func(id string) bool { return sel[id] })
		}
		if ships {
			out = append(out, e)
		}
	}
	return out
}

// file returns v.Files[name], or an [fs.ErrNotExist] error.
func (v Version) file(name string) ([]byte, error) {
	b, ok := v.Files[name]
	if !ok {
		return nil, &fs.PathError{Op: "open", Path: name, Err: fs.ErrNotExist}
	}
	return b, nil
}

// entryPoint is bundle-src/index.ts without the unselected imports.
// The rest stays, including the missing-component watcher.
func entryPoint(v Version, nodes []Entry) (string, error) {
	selected := modules(nodes)
	index, err := v.file("bundle-src/index.ts")
	if err != nil {
		return "", err
	}
	var kept []string
	for line := range strings.SplitSeq(string(index), "\n") {
		if m := reIndexImport.FindStringSubmatch(line); m == nil || selected[m[1]] {
			kept = append(kept, line)
		}
	}
	return strings.Join(kept, "\n"), nil
}

func buildJS(v Version, nodes []Entry, minify bool) ([]byte, error) {
	contents, err := entryPoint(v, nodes)
	if err != nil {
		return nil, err
	}
	// Unminified output names paths relative to the working directory.
	// The root matches esbuild-wasm's "/" on the page.
	root, err := filepath.Abs(string(filepath.Separator))
	if err != nil {
		return nil, err
	}
	r := api.Build(api.BuildOptions{
		Stdin: &api.StdinOptions{
			Contents:   contents,
			Loader:     api.LoaderTS,
			Sourcefile: "index.ts",
			ResolveDir: root,
		},
		AbsWorkingDir:     root,
		Bundle:            true,
		MinifyWhitespace:  minify,
		MinifyIdentifiers: minify,
		MinifySyntax:      minify,
		Format:            api.FormatESModule,
		Target:            api.ES2022,
		Banner:            map[string]string{"js": v.Manifest.Banner},
		LogLevel:          api.LogLevelSilent,
		Plugins:           []api.Plugin{srcPlugin(v, minify)},
	})
	if len(r.Errors) > 0 {
		return nil, esbuildError(r.Errors)
	}
	return r.OutputFiles[0].Contents, nil
}

// srcNamespace holds bundle-src/'s modules. Unminified output prefixes
// module paths with it, as in bundle-size.ts.
const srcNamespace = "morpheus"

// An extension in an import path; the kit imports modules without one.
var reExt = regexp.MustCompile(`\.[a-z]+$`)

// srcPlugin resolves the kit's imports in bundle-src/, as bundle-size.ts's
// httpPlugin does over HTTP. CSS loads as text, minified as in web/build.ts.
func srcPlugin(v Version, minify bool) api.Plugin {
	load := func(
		name string, minifier func(string) (string, error), loader api.Loader,
	) (api.OnLoadResult, error) {
		b, err := v.file(path.Join("bundle-src", name))
		if err != nil {
			return api.OnLoadResult{}, err
		}
		src := string(b)
		if minify {
			if src, err = minifier(src); err != nil {
				return api.OnLoadResult{}, err
			}
		}
		return api.OnLoadResult{Contents: &src, Loader: loader}, nil
	}
	return api.Plugin{
		Name: "bundle-src",
		Setup: func(build api.PluginBuild) {
			build.OnResolve(api.OnResolveOptions{Filter: `.*`},
				func(args api.OnResolveArgs) (api.OnResolveResult, error) {
					if args.Kind == api.ResolveEntryPoint {
						return api.OnResolveResult{}, nil
					}
					dir := "."
					if args.Namespace == srcNamespace {
						dir = path.Dir(args.Importer)
					}
					p := path.Join(dir, args.Path)
					if !reExt.MatchString(p) {
						p += ".ts"
					}
					return api.OnResolveResult{Path: p, Namespace: srcNamespace}, nil
				})
			build.OnLoad(api.OnLoadOptions{Filter: `\.css$`, Namespace: srcNamespace},
				func(args api.OnLoadArgs) (api.OnLoadResult, error) {
					return load(args.Path, minifyCSS, api.LoaderText)
				})
			build.OnLoad(api.OnLoadOptions{Filter: `.*`, Namespace: srcNamespace},
				func(args api.OnLoadArgs) (api.OnLoadResult, error) {
					return load(args.Path, minifyInlineStyles, api.LoaderTS)
				})
		},
	}
}

func buildCSS(v Version, nodes []Entry, minify bool) ([]byte, error) {
	ids := make(map[string]bool, len(nodes))
	for _, e := range nodes {
		ids[e.ID] = true
	}
	var sheets []string
	for _, s := range v.Manifest.CSS {
		if len(s.Nodes) > 0 && !slices.ContainsFunc(s.Nodes, func(id string) bool { return ids[id] }) {
			continue
		}
		b, err := v.file(path.Join("bundle-css", s.File))
		if err != nil {
			return nil, err
		}
		sheets = append(sheets, string(b))
	}
	css := strings.Join(sheets, "\n")
	if minify {
		var err error
		if css, err = minifyCSS(css); err != nil {
			return nil, err
		}
	}
	return []byte(css), nil
}

func minifyCSS(css string) (string, error) {
	r := api.Transform(css, api.TransformOptions{
		Loader:            api.LoaderCSS,
		MinifyWhitespace:  true,
		MinifyIdentifiers: true,
		MinifySyntax:      true,
	})
	if len(r.Errors) > 0 {
		return "", esbuildError(r.Errors)
	}
	return string(r.Code), nil
}

// A shadow <style> block in a template literal.
var reStyle = regexp.MustCompile(`(?s)<style>(.*?)</style>`)

// An escape or interpolation, which a source-level minify would break.
var reDynamicCSS = regexp.MustCompile("[`\\\\]|\\$\\{")

// minifyInlineStyles minifies src's <style> blocks, as web/build.ts does,
// because esbuild leaves template literals as is.
func minifyInlineStyles(src string) (string, error) {
	var err error
	out := reStyle.ReplaceAllStringFunc(src, func(block string) string {
		css := reStyle.FindStringSubmatch(block)[1]
		if err != nil || reDynamicCSS.MatchString(css) {
			return block
		}
		var minified string
		minified, err = minifyCSS(css)
		return "<style>" + strings.TrimSpace(minified) + "</style>"
	})
	return out, err
}

func esbuildError(msgs []api.Message) error {
	return errors.New(strings.TrimSpace(strings.Join(api.FormatMessages(
		msgs, api.FormatMessagesOptions{Kind: api.ErrorMessage},
	), "")))
}
