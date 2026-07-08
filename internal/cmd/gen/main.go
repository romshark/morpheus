// Command gen renders the UI Kit example as a static, CDN-hostable
// site under {dst}/. Walks every page in package site, copies static
// assets, minifies JS outputs, and emits datasim.js so the site works
// without a server.
//
// datasim.js comes from https://github.com/romshark/datastar-simulator.
package main

import (
	"bytes"
	"context"
	_ "embed"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/a-h/templ"

	"github.com/romshark/morpheus/internal/href"
	"github.com/romshark/morpheus/internal/site"
)

//go:embed datasim.js
var datasimJS string

type pageEntry struct {
	URLPath string
	Body    []byte
}

func main() {
	var dst, base string
	flag.StringVar(&dst, "dst", "dst", "output directory for the static site")
	flag.StringVar(&base, "base", "",
		`URL path prefix for hosting under a subdirectory (e.g. "/morpheus"); `+
			`empty serves at the document root`)
	flag.Parse()
	base = normalizeBase(base)

	// Inline the built default theme into every page head so first paint
	// needs no theme-default.css request. Read from the tracked /min/
	// artifact build.ts produced; gen runs from the repo root.
	defaultThemeCSS, err := os.ReadFile("min/theme-default.css")
	if err != nil {
		fatalf("reading min/theme-default.css: %v", err)
	}
	site.SetInlineThemeDefaultCSS(string(defaultThemeCSS))

	// Release version, single-sourced from the repo-root VERSION file that
	// web/build.ts also reads for the bundle banner. gen runs from the repo
	// root.
	version, err := os.ReadFile("VERSION")
	if err != nil {
		fatalf("reading VERSION: %v", err)
	}

	pages, err := buildPages(strings.TrimSpace(string(version)))
	if err != nil {
		fatalf("collecting pages: %v", err)
	}

	if err := os.MkdirAll(dst, 0o755); err != nil {
		fatalf("creating %s: %v", dst, err)
	}

	pagePaths := make([]string, len(pages))
	for i := range pages {
		pagePaths[i] = pages[i].URLPath
	}
	for _, p := range pages {
		p.Body = rewriteHTMLBase(p.Body, base, pagePaths)
		if err := writePage(dst, p); err != nil {
			fatalf("rendering %s: %v", p.URLPath, err)
		}
	}

	if err := copyStatic(dst); err != nil {
		fatalf("copying static assets: %v", err)
	}

	staticDir := filepath.Join(dst, "static")
	minDatasimJS, err := minifyJS([]byte(datasimJS), "datasim.js")
	if err != nil {
		fatalf("minifying datasim.js: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(staticDir, "datasim.js"),
		minDatasimJS, 0o644,
	); err != nil {
		fatalf("writing datasim.js: %v", err)
	}

	if err := writeBundleAssets(staticDir); err != nil {
		fatalf("writing bundle assets: %v", err)
	}

	if err := rewriteStaticAssetsBase(staticDir, base); err != nil {
		fatalf("applying base prefix to assets: %v", err)
	}

	_, _ = fmt.Fprintf(
		os.Stdout, "Wrote %d pages to %s\n", len(pages), dst,
	)
}

// buildPages renders every site.Page<X> templ to final HTML bytes.
// morpheusVersion is the release string stamped into each page frame.
func buildPages(morpheusVersion string) ([]pageEntry, error) {
	ctx := context.Background()
	specs := []struct {
		path string
		comp templ.Component
	}{
		{href.PageIndex(), site.PageIndex(morpheusVersion)},
		{href.PageComponents(), site.PageComponents(morpheusVersion)},
		{href.PageGettingStarted(), site.PageGettingStarted(morpheusVersion)},
		{href.PageFrameworks(), site.PageFrameworks(morpheusVersion)},
		{href.PageTheming(), site.PageTheming(morpheusVersion)},
		{href.PageServerDriven(), site.PageServerDriven(morpheusVersion)},
		{href.PageLayout(), site.PageLayout(morpheusVersion)},
		{href.PageProjectStatus(), site.PageProjectStatus(morpheusVersion)},
		{href.PageBundleBuilder(), site.PageBundleBuilder(morpheusVersion)},
		{href.PageAlert(), site.PageAlert(morpheusVersion)},
		{href.PageAvatar(), site.PageAvatar(morpheusVersion)},
		{href.PageAvatars(), site.PageAvatars(morpheusVersion)},
		{href.PageBadge(), site.PageBadge(morpheusVersion)},
		{href.PageBoundary(), site.PageBoundary(morpheusVersion)},
		{href.PageBreadcrumb(), site.PageBreadcrumb(morpheusVersion)},
		{href.PageButton(), site.PageButton(morpheusVersion)},
		{href.PageButtonGroup(), site.PageButtonGroup(morpheusVersion)},
		{href.PageCard(), site.PageCard(morpheusVersion)},
		{href.PageCarousel(), site.PageCarousel(morpheusVersion)},
		{href.PageCheckbox(), site.PageCheckbox(morpheusVersion)},
		{href.PageClipcopy(), site.PageClipcopy(morpheusVersion)},
		{href.PageCombobox(), site.PageCombobox(morpheusVersion)},
		{href.PageContextMenu(), site.PageContextMenu(morpheusVersion)},
		{href.PageColorField(), site.PageColorField(morpheusVersion)},
		{href.PageDatalist(), site.PageDatalist(morpheusVersion)},
		{href.PageDialog(), site.PageDialog(morpheusVersion)},
		{href.PageDrawer(), site.PageDrawer(morpheusVersion)},
		{href.PageElastic(), site.PageElastic(morpheusVersion)},
		{href.PageIcon(), site.PageIcon(morpheusVersion)},
		{href.PageCondition(), site.PageCondition(morpheusVersion)},
		{href.PageTextInput(), site.PageTextInput(morpheusVersion)},
		{href.PageInputGroup(), site.PageInputGroup(morpheusVersion)},
		{href.PageKbd(), site.PageKbd(morpheusVersion)},
		{href.PageKeys(), site.PageKeys(morpheusVersion)},
		{href.PageLightbox(), site.PageLightbox(morpheusVersion)},
		{href.PageLink(), site.PageLink(morpheusVersion)},
		{href.PageMenu(), site.PageMenu(morpheusVersion)},
		{href.PageNavgroup(), site.PageNavgroup(morpheusVersion)},
		{href.PageOption(), site.PageOption(morpheusVersion)},
		{href.PageOptgroup(), site.PageOptgroup(morpheusVersion)},
		{href.PagePagination(), site.PagePagination(morpheusVersion)},
		{href.PagePersist(), site.PagePersist(morpheusVersion)},
		{href.PagePopover(), site.PagePopover(morpheusVersion)},
		{href.PageProgress(), site.PageProgress(morpheusVersion)},
		{href.PageRadioGroup(), site.PageRadioGroup(morpheusVersion)},
		{href.PageRating(), site.PageRating(morpheusVersion)},
		{href.PageResizable(), site.PageResizable(morpheusVersion)},
		{href.PageRevealable(), site.PageRevealable(morpheusVersion)},
		{href.PageSelect(), site.PageSelect(morpheusVersion)},
		{href.PageSidebar(), site.PageSidebar(morpheusVersion)},
		{href.PageSkeleton(), site.PageSkeleton(morpheusVersion)},
		{href.PageSlider(), site.PageSlider(morpheusVersion)},
		{href.PageSliderRange(), site.PageSliderRange(morpheusVersion)},
		{href.PageSortable(), site.PageSortable(morpheusVersion)},
		{href.PageSpinner(), site.PageSpinner(morpheusVersion)},
		{href.PageSwitch(), site.PageSwitch(morpheusVersion)},
		{href.PageTabs(), site.PageTabs(morpheusVersion)},
		{href.PageTextarea(), site.PageTextarea(morpheusVersion)},
		{href.PageToaster(), site.PageToaster(morpheusVersion)},
		{href.PageToggle(), site.PageToggle(morpheusVersion)},
		{href.PageToggleGroup(), site.PageToggleGroup(morpheusVersion)},
		{href.PageTooltip(), site.PageTooltip(morpheusVersion)},
		{href.PageTree(), site.PageTree(morpheusVersion)},
		{href.PageDebug(), site.PageDebug(morpheusVersion)},
		{href.PageDebugBorders(), site.PageDebugBorders(morpheusVersion)},
	}
	pages := make([]pageEntry, 0, len(specs))
	for _, s := range specs {
		var b bytes.Buffer
		if err := s.comp.Render(ctx, &b); err != nil {
			return nil, fmt.Errorf("page %s: %w", s.path, err)
		}
		pages = append(pages, pageEntry{URLPath: s.path, Body: b.Bytes()})
	}
	return pages, nil
}

// normalizeBase canonicalises the -base prefix. "" stays "" (document
// root); anything else gets a single leading slash and no trailing one,
// so "morpheus", "/morpheus" and "/morpheus/" all yield "/morpheus".
func normalizeBase(base string) string {
	base = strings.Trim(base, "/")
	if base == "" {
		return ""
	}
	return "/" + base
}

// rewriteHTMLBase prefixes base onto every root-absolute URL in one
// rendered page. Two kinds occur, and they never overlap so order is
// irrelevant:
//
//   - Asset URLs "/static/...". They are always the value of a quoted
//     token in the output ("href=", "src=", an import specifier), so
//     anchoring on the leading quote leaves any /static/ shown as
//     literal text in a doc example untouched.
//   - The site's own page links, whose exact paths are pagePaths.
//
// Datastar demo action paths (e.g. /tree/loadnode/) are intercepted by
// the client-side simulator on their literal value and are not in
// pagePaths, so they stay unprefixed by design. base=="" is a no-op.
func rewriteHTMLBase(b []byte, base string, pagePaths []string) []byte {
	if base == "" {
		return b
	}
	s := string(b)
	// Assets first: this also turns page-named asset dirs (e.g.
	// /static/avatar/) into /base/static/... before the page loop runs,
	// so the page anchors below cannot match inside an asset path.
	s = strings.ReplaceAll(s, `"/static/`, `"`+base+`/static/`)
	for _, p := range pagePaths {
		if p == "/" {
			// Index path is a prefix of every URL; match it exactly.
			s = strings.ReplaceAll(s, `"/"`, `"`+base+`/"`)
			continue
		}
		// Anchor on the opening `="` and the full path (kept trailing
		// slash rules out cross-page prefix hits); catches the plain
		// link plus its #fragment, ?query and sub-path forms.
		s = strings.ReplaceAll(s, `="`+p, `="`+base+p)
	}
	return []byte(s)
}

// rewriteStaticAssetsBase prefixes base onto the "/static/" root-absolute
// URLs baked into copied JS and CSS assets (bundle.js icon/manifest/
// datasim paths, minified theme @font-face url()s, sim import specifiers).
// bundle-src/ and bundle-css/ are skipped: those are the in-browser
// builder's downloadable payloads, hosted by users elsewhere, so their
// root-absolute defaults must stay unprefixed. base=="" is a no-op.
func rewriteStaticAssetsBase(staticDir, base string) error {
	if base == "" {
		return nil
	}
	old, replacement := []byte("/static/"), []byte(base+"/static/")
	sep := string(filepath.Separator)
	return filepath.WalkDir(staticDir, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		if strings.Contains(p, sep+"bundle-src"+sep) ||
			strings.Contains(p, sep+"bundle-css"+sep) {
			return nil
		}
		if ext := filepath.Ext(p); ext != ".js" && ext != ".css" {
			return nil
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		if !bytes.Contains(b, old) {
			return nil
		}
		return os.WriteFile(p, bytes.ReplaceAll(b, old, replacement), 0o644)
	})
}

// writePage writes one already-rendered page to disk. site.Page emits
// root-absolute /static/* and page URLs; dst/ is hosted at the document
// root unless gen ran with -base, which rewrites those to a subpath.
func writePage(dst string, p pageEntry) error {
	out := pageOutPath(dst, p.URLPath)
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		return err
	}
	return os.WriteFile(out, p.Body, 0o644)
}

// pageOutPath maps a URL path to its on-disk index.html.
//
//	"/"             -> "{dst}/index.html"
//	"/breadcrumb/"  -> "{dst}/breadcrumb/index.html"
func pageOutPath(dst, urlPath string) string {
	trimmed := strings.Trim(urlPath, "/")
	if trimmed == "" {
		return filepath.Join(dst, "index.html")
	}
	return filepath.Join(dst, filepath.FromSlash(trimmed), "index.html")
}

// copyStatic mirrors internal/site/static to {dst}/static and overlays
// the tracked /min/ artifacts onto {dst}/static/min/. Bulk copy + prune
// delegates to rsync (mtime+size incremental, --delete handles removed
// sources). *.js sources under internal/site/static are excluded from
// the first rsync and handled by minifyJSFiles below (sim/ demo
// snippets); top-level *.css sources and the component CSS source
// modules aren't shipped (pages reference the minified outputs in
// /min/, and bundle assets are emitted explicitly).
// Assumes internal/cmd/gen runs from the repo root, as Make and
// templier invoke it.
func copyStatic(dst string) error {
	const src = "internal/site/static"
	dstStatic := filepath.Join(dst, "static")
	if err := os.MkdirAll(dstStatic, 0o755); err != nil {
		return err
	}
	cmd := exec.Command("rsync",
		"-a", "--delete",
		"--exclude=/*.css",
		"--exclude=/morpheus/",
		"--exclude=*.js",
		src+"/", dstStatic+"/",
	)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("rsync: %s", msg)
	}
	if err := copyMin(dstStatic); err != nil {
		return err
	}
	return minifyJSFiles(src, dstStatic)
}

// copyMin mirrors /min/ (the tracked build-output directory at the
// repo root) into {dst}/static/min/. Templates reference these as
// /static/min/*; the source layout in /min/ is flat and maps 1:1.
func copyMin(dstStatic string) error {
	const src = "min"
	if _, err := os.Stat(src); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf(
				"/min/ not found. Run`make bundle` to produce it",
			)
		}
		return err
	}
	dstMin := filepath.Join(dstStatic, "min")
	if err := os.MkdirAll(dstMin, 0o755); err != nil {
		return err
	}
	cmd := exec.Command("rsync", "-a", "--delete", src+"/", dstMin+"/")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("rsync /min/: %s", msg)
	}
	return nil
}

// minifyJSFiles walks src for *.js sources, invoking esbuild only on
// files whose dst counterpart is missing or older than the source.
// rsync excludes *.js from --delete, so removed sources leave stale
// .js in dst, acceptable since this is an incremental dev path.
func minifyJSFiles(src, dstStatic string) error {
	return filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(p, ".js") {
			return err
		}
		rel, err := filepath.Rel(src, p)
		if err != nil {
			return err
		}
		target := filepath.Join(dstStatic, rel)
		if upToDate(p, target) {
			return nil
		}
		data, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		data, err = minifyJS(data, rel)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	})
}

// upToDate reports whether dst exists with a mtime >= src, i.e. dst
// was last written after src was last modified.
func upToDate(src, dst string) bool {
	si, err := os.Stat(src)
	if err != nil {
		return false
	}
	di, err := os.Stat(dst)
	if err != nil {
		return false
	}
	return !si.ModTime().After(di.ModTime())
}

func minifyJS(src []byte, name string) ([]byte, error) {
	cmd := exec.Command("web/node_modules/.bin/esbuild", "--minify", "--loader=js")
	cmd.Stdin = bytes.NewReader(src)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf("%s: %s", name, msg)
	}
	return out, nil
}

func fatalf(format string, args ...any) {
	_, _ = fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
