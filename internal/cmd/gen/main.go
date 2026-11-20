// Command gen renders the UI Kit example as a static, CDN-hostable site under {dst}/.
// Walks every page in package site, copies static assets, minifies JS outputs,
// and emits datasim.js so the site works without a server.
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
	"regexp"
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
	if err := run(dst, normalizeBase(base)); err != nil {
		fatalf("%v", err)
	}
}

// run writes the site to dst.
func run(dst, base string) error {
	// Inline the built default theme into every page head so first paint
	// needs no theme-default.css request. Read from the tracked /min/
	// artifact build.ts produced; gen runs from the repo root.
	defaultThemeCSS, err := os.ReadFile("min/theme-default.css")
	if err != nil {
		return fmt.Errorf("reading min/theme-default.css: %w", err)
	}
	site.SetInlineThemeDefaultCSS(string(defaultThemeCSS))

	// Release version, single-sourced from the repo-root VERSION file that
	// web/build.ts also reads for the bundle banner. gen runs from the repo root.
	version, err := os.ReadFile("VERSION")
	if err != nil {
		return fmt.Errorf("reading VERSION: %w", err)
	}

	release := strings.TrimSpace(string(version))

	// Runs before buildPages because the bundle builder page lists the
	// versions and what each lacks.
	bundleVersions, err := prepareBundleVersions(release)
	if err != nil {
		return fmt.Errorf("preparing bundle builder versions: %w", err)
	}
	siteVersions := make([]site.BundleVersion, len(bundleVersions))
	for i, v := range bundleVersions {
		siteVersions[i] = site.BundleVersion{
			Name: v.name, Absent: v.Absent, Themes: v.Manifest.Themes,
		}
	}

	docs, err := site.LoadDocs(release)
	if err != nil {
		return fmt.Errorf("loading Markdown doc pages: %w", err)
	}

	pages, err := buildPages(release, siteVersions, docs)
	if err != nil {
		return fmt.Errorf("collecting pages: %w", err)
	}

	if err := os.MkdirAll(dst, 0o755); err != nil {
		return fmt.Errorf("creating %s: %w", dst, err)
	}

	pagePaths := make([]string, len(pages))
	for i := range pages {
		pagePaths[i] = pages[i].URLPath
	}
	for _, p := range pages {
		p.Body = rewriteHTMLBase(p.Body, base, pagePaths)
		if err := writePage(dst, p); err != nil {
			return fmt.Errorf("rendering %s: %w", p.URLPath, err)
		}
	}
	for _, p := range docs.Paths() {
		out := filepath.Join(filepath.Dir(pageOutPath(dst, p)), "index.md")
		if err := os.WriteFile(out, docs.Markdown(p), 0o644); err != nil {
			return fmt.Errorf("writing the Markdown copy of %s: %w", p, err)
		}
	}

	if err := copyStatic(dst); err != nil {
		return fmt.Errorf("copying static assets: %w", err)
	}

	staticDir := filepath.Join(dst, "static")
	if err := writeSearchIndex(
		filepath.Join(staticDir, "search-index.json"), pages, base,
	); err != nil {
		return fmt.Errorf("writing search index: %w", err)
	}

	minDatasimJS, err := minifyJS([]byte(datasimJS), "datasim.js")
	if err != nil {
		return fmt.Errorf("minifying datasim.js: %w", err)
	}
	if err := os.WriteFile(
		filepath.Join(staticDir, "datasim.js"),
		minDatasimJS, 0o644,
	); err != nil {
		return fmt.Errorf("writing datasim.js: %w", err)
	}

	for _, v := range bundleVersions {
		if err := writeBundleVersion(
			filepath.Join(staticDir, "bundle", v.name), v,
		); err != nil {
			return fmt.Errorf("writing bundle builder version %s: %w", v.name, err)
		}
	}

	if err := rewriteStaticAssetsBase(staticDir, base); err != nil {
		return fmt.Errorf("applying base prefix to assets: %w", err)
	}

	_, _ = fmt.Fprintf(
		os.Stdout, "Wrote %d pages to %s\n", len(pages), dst,
	)
	return nil
}

// buildPages renders every site.Page<X> templ and every Markdown doc page
// to final HTML bytes. morpheusVersion is the release string stamped into
// each page frame; bundleVersions are the versions the bundle builder offers.
func buildPages(
	morpheusVersion string, bundleVersions []site.BundleVersion, docs *site.Docs,
) ([]pageEntry, error) {
	ctx := context.Background()
	specs := []struct {
		path string
		comp templ.Component
	}{
		{href.PageIndex(), site.PageIndex(morpheusVersion)},
		{href.PageComponents(), site.PageComponents(morpheusVersion)},
		{href.PageGettingStarted(), docs.Page(href.PageGettingStarted(), morpheusVersion)},
		{href.PageFrameworks(), docs.Page(href.PageFrameworks(), morpheusVersion)},
		{href.PageTheming(), docs.Page(href.PageTheming(), morpheusVersion)},
		{href.PageServerDriven(), docs.Page(href.PageServerDriven(), morpheusVersion)},
		{href.PageLayout(), docs.Page(href.PageLayout(), morpheusVersion)},
		{href.PageProjectStatus(), docs.Page(href.PageProjectStatus(), morpheusVersion)},
		{
			href.PageBundleBuilder(),
			site.PageBundleBuilder(morpheusVersion, bundleVersions),
		},
		{href.PageAlert(), docs.Page(href.PageAlert(), morpheusVersion)},
		{href.PageAura(), docs.Page(href.PageAura(), morpheusVersion)},
		{href.PageAutohide(), docs.Page(href.PageAutohide(), morpheusVersion)},
		{href.PageAvatar(), docs.Page(href.PageAvatar(), morpheusVersion)},
		{href.PageAvatars(), docs.Page(href.PageAvatars(), morpheusVersion)},
		{href.PageBadge(), docs.Page(href.PageBadge(), morpheusVersion)},
		{href.PageBoundary(), docs.Page(href.PageBoundary(), morpheusVersion)},
		{href.PageBreadcrumb(), docs.Page(href.PageBreadcrumb(), morpheusVersion)},
		{href.PageButton(), docs.Page(href.PageButton(), morpheusVersion)},
		{href.PageButtonGroup(), docs.Page(href.PageButtonGroup(), morpheusVersion)},
		{href.PageCard(), docs.Page(href.PageCard(), morpheusVersion)},
		{href.PageCarousel(), docs.Page(href.PageCarousel(), morpheusVersion)},
		{href.PageCheckbox(), docs.Page(href.PageCheckbox(), morpheusVersion)},
		{href.PageClipcopy(), docs.Page(href.PageClipcopy(), morpheusVersion)},
		{href.PageCollapsible(), docs.Page(href.PageCollapsible(), morpheusVersion)},
		{href.PageCombobox(), docs.Page(href.PageCombobox(), morpheusVersion)},
		{href.PageCompare(), docs.Page(href.PageCompare(), morpheusVersion)},
		{href.PageContextMenu(), docs.Page(href.PageContextMenu(), morpheusVersion)},
		{href.PageColorField(), docs.Page(href.PageColorField(), morpheusVersion)},
		{href.PageDatalist(), docs.Page(href.PageDatalist(), morpheusVersion)},
		{href.PageDialog(), docs.Page(href.PageDialog(), morpheusVersion)},
		{href.PageDrawer(), docs.Page(href.PageDrawer(), morpheusVersion)},
		{href.PageElastic(), docs.Page(href.PageElastic(), morpheusVersion)},
		{href.PageIcon(), docs.Page(href.PageIcon(), morpheusVersion)},
		{href.PageIfNetwork(), docs.Page(href.PageIfNetwork(), morpheusVersion)},
		{href.PageIfPlatform(), docs.Page(href.PageIfPlatform(), morpheusVersion)},
		{href.PageTextInput(), docs.Page(href.PageTextInput(), morpheusVersion)},
		{href.PageInputGroup(), docs.Page(href.PageInputGroup(), morpheusVersion)},
		{href.PageKbd(), docs.Page(href.PageKbd(), morpheusVersion)},
		{href.PageKeys(), docs.Page(href.PageKeys(), morpheusVersion)},
		{href.PageLightbox(), docs.Page(href.PageLightbox(), morpheusVersion)},
		{href.PageLink(), docs.Page(href.PageLink(), morpheusVersion)},
		{href.PageMenu(), docs.Page(href.PageMenu(), morpheusVersion)},
		{href.PageNavgroup(), docs.Page(href.PageNavgroup(), morpheusVersion)},
		{href.PageOdometer(), docs.Page(href.PageOdometer(), morpheusVersion)},
		{href.PageOption(), docs.Page(href.PageOption(), morpheusVersion)},
		{href.PageOptgroup(), docs.Page(href.PageOptgroup(), morpheusVersion)},
		{href.PageOTP(), docs.Page(href.PageOTP(), morpheusVersion)},
		{href.PagePagination(), docs.Page(href.PagePagination(), morpheusVersion)},
		{href.PagePersist(), docs.Page(href.PagePersist(), morpheusVersion)},
		{href.PagePopover(), docs.Page(href.PagePopover(), morpheusVersion)},
		{href.PageProgress(), docs.Page(href.PageProgress(), morpheusVersion)},
		{href.PageRadioGroup(), docs.Page(href.PageRadioGroup(), morpheusVersion)},
		{href.PageRating(), docs.Page(href.PageRating(), morpheusVersion)},
		{href.PageResizable(), docs.Page(href.PageResizable(), morpheusVersion)},
		{href.PageRevealable(), docs.Page(href.PageRevealable(), morpheusVersion)},
		{href.PageSelect(), docs.Page(href.PageSelect(), morpheusVersion)},
		{href.PageSidebar(), docs.Page(href.PageSidebar(), morpheusVersion)},
		{href.PageSkeleton(), docs.Page(href.PageSkeleton(), morpheusVersion)},
		{href.PageSlider(), docs.Page(href.PageSlider(), morpheusVersion)},
		{href.PageSliderRange(), docs.Page(href.PageSliderRange(), morpheusVersion)},
		{href.PageSortable(), docs.Page(href.PageSortable(), morpheusVersion)},
		{href.PageSpinner(), docs.Page(href.PageSpinner(), morpheusVersion)},
		{href.PageSwitch(), docs.Page(href.PageSwitch(), morpheusVersion)},
		{href.PageTabs(), docs.Page(href.PageTabs(), morpheusVersion)},
		{href.PageTextarea(), docs.Page(href.PageTextarea(), morpheusVersion)},
		{href.PageToaster(), docs.Page(href.PageToaster(), morpheusVersion)},
		{href.PageToggle(), docs.Page(href.PageToggle(), morpheusVersion)},
		{href.PageToggleGroup(), docs.Page(href.PageToggleGroup(), morpheusVersion)},
		{href.PageTooltip(), docs.Page(href.PageTooltip(), morpheusVersion)},
		{href.PageTree(), docs.Page(href.PageTree(), morpheusVersion)},
		{href.PageDebug(), site.PageDebug(morpheusVersion)},
		{href.PageDebugBorders(), site.PageDebugBorders(morpheusVersion)},
	}
	if files := docs.Unserved(); len(files) > 0 {
		return nil, fmt.Errorf("no buildPages entry for the Markdown doc pages %s",
			strings.Join(files, ", "))
	}
	paths := make([]string, len(specs))
	for i, s := range specs {
		paths[i] = s.path
	}
	if err := docs.CheckLinks(paths); err != nil {
		return nil, err
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

// normalizeBase canonicalises the -base prefix. "" stays "" (document root);
// anything else gets a single leading slash and no trailing one.
// "morpheus", "/morpheus" and "/morpheus/" all yield "/morpheus".
func normalizeBase(base string) string {
	base = strings.Trim(base, "/")
	if base == "" {
		return ""
	}
	return "/" + base
}

// rewriteHTMLBase prefixes base onto every root-absolute URL in one rendered page.
// 2 kinds occur, and they never overlap, which makes order irrelevant:
//
//   - Asset URLs "/static/...". They are always the value of a quoted
//     token in the output ("href=", "src=", an import specifier).
//     Anchoring on the leading quote leaves any /static/ shown as
//     literal text in a doc example untouched.
//   - The site's own page links, whose exact paths are pagePaths.
//
// A playground state is markup kept as escaped text in a
// <template data-playground-state>, which the client injects into the preview.
// Its quotes are &#34;, so the same rules run inside it with that quote.
// Source tabs stay untouched.
//
// Datastar demo action paths (e.g. /tree/loadnode/) are intercepted by
// the client-side simulator on their literal value and are not in pagePaths.
// They stay unprefixed by design. base=="" is a no-op.
func rewriteHTMLBase(b []byte, base string, pagePaths []string) []byte {
	if base == "" {
		return b
	}
	s := rewriteURLs(string(b), base, pagePaths, `"`)
	s = rePlaygroundState.ReplaceAllStringFunc(s, func(t string) string {
		return rewriteURLs(t, base, pagePaths, "&#34;")
	})
	return []byte(s)
}

var rePlaygroundState = regexp.MustCompile(
	`(?s)<template data-playground-state[^>]*>.*?</template>`,
)

// rewriteURLs applies the rules of [rewriteHTMLBase] to URLs quoted by q.
func rewriteURLs(s, base string, pagePaths []string, q string) string {
	// Assets go first. This turns page-named asset dirs (e.g. /static/avatar/)
	// into /base/static/... before the page loop runs, which keeps the page
	// anchors from matching inside an asset path.
	s = strings.ReplaceAll(s, q+"/static/", q+base+"/static/")
	for _, p := range pagePaths {
		if p == "/" {
			// Index path is a prefix of every URL; match it exactly.
			s = strings.ReplaceAll(s, q+"/"+q, q+base+"/"+q)
			continue
		}
		// Anchor on the opening `="` and the full path
		// (kept trailing slash rules out cross-page prefix hits);
		// catches the plain link plus its #fragment, ?query and sub-path forms.
		s = strings.ReplaceAll(s, "="+q+p, "="+q+base+p)
	}
	return s
}

// rewriteStaticAssetsBase prefixes base onto the "/static/" root-absolute
// URLs baked into copied JS and CSS assets (bundle.js icon/manifest/
// datasim paths, minified theme @font-face url()s, sim import specifiers).
// bundle-src/, bundle-css/ and bundle-themes/ are skipped, because they are
// the in-browser builder's downloadable payloads. Users host them elsewhere,
// and their root-absolute defaults must stay unprefixed. base=="" is a no-op.
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
			strings.Contains(p, sep+"bundle-css"+sep) ||
			strings.Contains(p, sep+"bundle-themes"+sep) {
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
// delegates to rsync (mtime+size incremental, --delete handles removed sources).
// *.js sources under internal/site/static are excluded from the first rsync
// and minified by [minifyJSFiles];
// top-level *.css sources and the component CSS source modules aren't shipped
// (pages reference the minified outputs in /min/,
// and bundle assets are emitted explicitly).
// Assumes internal/cmd/gen runs from the repo root, as Make and templier invoke it.
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

// copyMin mirrors /min/ (the tracked build-output directory at the repo root)
// into {dst}/static/min/. Templates reference these as
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
// rsync excludes *.js from --delete, and removed sources leave stale .js in dst.
// That is acceptable on this incremental dev path.
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
