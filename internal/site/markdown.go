package site

import (
	"bytes"
	"context"
	"embed"
	"fmt"
	"html"
	"io"
	"io/fs"
	"net/url"
	"path"
	"slices"
	"strings"

	"github.com/a-h/templ"
	"github.com/yuin/goldmark/v2/ast"
	"github.com/yuin/goldmark/v2/extension"
	extast "github.com/yuin/goldmark/v2/extension/ast"
	"github.com/yuin/goldmark/v2/parser"
	"github.com/yuin/goldmark/v2/renderer"
	goldhtml "github.com/yuin/goldmark/v2/renderer/html"
	"github.com/yuin/goldmark/v2/text"
)

// docsFS holds the Markdown sources of the doc pages.
// docs/<name>.md is the page /<name>/.
//
//go:embed docs/*.md
var docsFS embed.FS

// Docs are the doc pages written in Markdown.
type Docs struct {
	byPath map[string]*doc
	served map[string]bool
}

// doc is 1 doc page parsed from Markdown.
//
// A page in [ComponentGroups] is a component page. Its title is #overview
// with the page icon, its intro is .intro, and its other paragraphs and
// lists are .demo-note. Other pages, such as Frameworks, are guide pages.
// Their title takes its heading ID and their prose is plain.
type doc struct {
	file      string // Repository-relative source, for errors.
	path      string // URL path, such as "/button/".
	title     string // Text of the level 1 heading.
	component bool
	src       []byte
	root      ast.Node
	intro     *ast.Paragraph // The paragraph right after the level 1 heading.
	// ids are the element IDs that link fragments can name:
	// the headings and the API table rows.
	ids     map[string]bool
	links   []docLink
	blocks  map[ast.Node]any // *exampleBlock, *playgroundBlock, *apiKind, *apiTable
	scripts map[string]bool  // The script attributes of the example blocks.
	version string           // The release, see [LoadDocs].
	copy    []byte           // The Markdown copy, see [Docs.Markdown].
}

// docLink is a link from a doc page to a page of the site.
type docLink struct {
	line     int
	path     string // Target page; the linking page for a bare "#fragment".
	fragment string
	// dest is the destination in the source, which the Markdown copy
	// rewrites. Empty for a bare "#fragment".
	dest text.Index
}

// LoadDocs parses the Markdown doc pages and checks their blocks,
// API tables and in-page links. Links to other pages are checked by
// [Docs.CheckLinks]. version replaces {VERSION} in the files that source
// blocks show, such as the install snippet of Getting started.
func LoadDocs(version string) (*Docs, error) {
	files, err := fs.Glob(docsFS, "docs/*.md")
	if err != nil {
		return nil, err
	}
	ds := &Docs{byPath: make(map[string]*doc), served: make(map[string]bool)}
	for _, f := range files {
		src, err := fs.ReadFile(docsFS, f)
		if err != nil {
			return nil, err
		}
		d, err := parseDoc(f, src)
		if err != nil {
			return nil, err
		}
		d.version = version
		ds.byPath[d.path] = d
	}
	for _, p := range ds.Paths() {
		d := ds.byPath[p]
		for _, l := range d.links {
			t, ok := ds.byPath[l.path]
			if l.fragment != "" && ok && !t.ids[l.fragment] {
				return nil, fmt.Errorf("%s:%d: no #%s on %s",
					d.file, l.line, l.fragment, l.path)
			}
		}
		d.copy = ds.markdownCopy(d)
	}
	return ds, nil
}

// Page returns the doc page at URL path, framed by [PageDoc].
// Rendering it fails when no Markdown file is the page at path.
func (ds *Docs) Page(path, morpheusVersion string) templ.Component {
	d, ok := ds.byPath[path]
	if !ok {
		return templ.ComponentFunc(func(context.Context, io.Writer) error {
			return fmt.Errorf("no Markdown doc page %s", path)
		})
	}
	ds.served[path] = true
	body := templ.ComponentFunc(d.render)
	return templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		return PageDoc(d.path, d.title, morpheusVersion).
			Render(templ.WithChildren(ctx, body), w)
	})
}

// Paths returns the URL paths of the doc pages, sorted.
func (ds *Docs) Paths() []string {
	paths := make([]string, 0, len(ds.byPath))
	for p := range ds.byPath {
		paths = append(paths, p)
	}
	slices.Sort(paths)
	return paths
}

// Unserved returns the source files of the doc pages that no [Docs.Page]
// call returned, sorted.
func (ds *Docs) Unserved() []string {
	var files []string
	for p, d := range ds.byPath {
		if !ds.served[p] {
			files = append(files, d.file)
		}
	}
	slices.Sort(files)
	return files
}

// CheckLinks reports the first link of a doc page to a page not in pages.
func (ds *Docs) CheckLinks(pages []string) error {
	for _, p := range ds.Paths() {
		d := ds.byPath[p]
		for _, l := range d.links {
			if !slices.Contains(pages, l.path) {
				return fmt.Errorf("%s:%d: link to %s, which is not a page",
					d.file, l.line, l.path)
			}
		}
	}
	return nil
}

// Markdown returns the Markdown copy of the doc page at URL path, which the
// site serves next to the page as index.md. Its example and playground
// blocks are expanded into the source code they show, and its links lead
// to the Markdown copies of doc pages and the pages of the others.
func (ds *Docs) Markdown(path string) []byte { return ds.byPath[path].copy }

// docParser parses GitHub Flavored Markdown. A heading takes an explicit
// ID as in "### Attributes {#item-attributes}".
var docParser = parser.New(
	parser.WithExtensions(extension.NewGFMParser()),
	parser.WithAttribute(),
)

// docRenderer renders the nodes of a doc page that need no site HTML.
// Doc sources are repository files, which makes their raw HTML safe.
var docRenderer = goldhtml.New(
	goldhtml.WithUnsafe(),
	goldhtml.WithExtensions(extension.NewGFMHTMLRenderer()),
	goldhtml.WithNodeRendererDecorator(ast.KindLink, docLinks),
	goldhtml.WithNodeRendererDecorator(ast.KindImage, docImages),
)

// staticFiles holds the diagrams that doc pages show, and the stylesheets
// that source blocks show.
//
//go:embed static/*.svg static/*.css
var staticFiles embed.FS

// docImages renders an image, ../static/<name>.svg as [doc.parseLinks] checks,
// as the inline SVG. The SVG styles itself with currentColor and
// the page's CSS variables, which an <img> would not apply.
// Its own aria-label names it; the alt text serves GitHub and the Markdown copy.
func docImages(goldhtml.NodeRenderer) goldhtml.NodeRenderer {
	return goldhtml.NodeRendererFunc(func(
		w io.Writer, src []byte, n ast.Node, entering bool, _ renderer.Context,
	) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		dest := n.(*ast.Image).Destination.Value(src)
		svg, err := fs.ReadFile(
			staticFiles,
			"static/"+strings.TrimPrefix(dest, "../static/"),
		)
		if err != nil {
			return ast.WalkStop, err
		}
		_, err = w.Write(svg)
		return ast.WalkSkipChildren, err
	})
}

// assignIDs sets the ID of each heading of the page that has none: its text
// as [slugify] reduces it, which keeps the IDs of the Templ pages, with a
// "-1", "-2", ... suffix after the first use. goldmark's auto IDs write
// 1 "-" per space or punctuation mark, as in "variants--states" for
// "Variants & states", and would give a {.api-element} heading an ID too.
// The title of a component page is #overview, see [doc.titleID].
func (d *doc) assignIDs(h1 *ast.Heading) {
	used := make(map[string]bool)
	for n := d.root.FirstChild(); n != nil; n = n.NextSibling() {
		h, ok := n.(*ast.Heading)
		if !ok {
			continue
		}
		if class, _ := h.Attribute("class"); class.Value(d.src) == "api-element" {
			continue
		}
		if h == h1 && d.component {
			used["overview"] = true
			continue
		}
		if id, ok := h.Attribute("id"); ok {
			used[id.Value(d.src)] = true
			continue
		}
		base := slugify(d.plainText(h))
		if base == "" {
			base = "section"
		}
		id := base
		for i := 1; used[id]; i++ {
			id = fmt.Sprintf("%s-%d", base, i)
		}
		used[id] = true
		h.SetAttribute("id", text.NewMultiLineValueFromString(id, text.IdentityDecoder))
	}
}

// parseDoc parses src, the source of docs/<name>.md.
func parseDoc(file string, src []byte) (*doc, error) {
	name := strings.TrimSuffix(path.Base(file), ".md")
	d := &doc{
		file:    path.Join("internal/site", file),
		path:    "/" + name + "/",
		src:     src,
		root:    docParser.Parse(src),
		ids:     make(map[string]bool),
		blocks:  make(map[ast.Node]any),
		scripts: make(map[string]bool),
	}
	d.component = componentIcon(d.path) != ""
	h1, ok := d.root.FirstChild().(*ast.Heading)
	if !ok || h1.Level != 1 {
		return nil, fmt.Errorf("%s: no level 1 heading at the start", d.file)
	}
	d.title = d.plainText(h1)
	d.assignIDs(h1)
	d.ids[d.titleID(h1)] = true
	// The intro is the first paragraph of the overview, before any "##".
	for n := h1.NextSibling(); n != nil && d.intro == nil; n = n.NextSibling() {
		if h, ok := n.(*ast.Heading); ok && h.Level == 2 {
			break
		}
		d.intro, _ = n.(*ast.Paragraph)
	}
	if err := d.parseBlocks(h1.NextSibling()); err != nil {
		return nil, err
	}
	if err := d.parseLinks(); err != nil {
		return nil, err
	}
	return d, nil
}

// parseBlocks checks the blocks from first on and parses the example,
// playground and source blocks and the API tables.
func (d *doc) parseBlocks(first ast.Node) error {
	// api is the kind of the API heading before n, whose table n must be.
	var api *apiKind
	// sectionID is the ID of the heading before n, which prefixes the row IDs
	// of an API table.
	var sectionID string
	// inReference is set under "## Reference", the only place where a heading
	// such as "### States" names an API table rather than an example.
	var inReference bool
	for n := first; n != nil; n = n.NextSibling() {
		if api != nil {
			t, ok := n.(*extast.Table)
			if !ok {
				return d.errorf(n, "no table after the %s heading", api.heading)
			}
			tbl, err := d.parseAPITable(t, api, sectionID)
			if err != nil {
				return err
			}
			d.blocks[n], api = tbl, nil
			continue
		}
		switch n := n.(type) {
		case *ast.Heading:
			if n.Level == 1 {
				return d.errorf(n, "a 2nd level 1 heading")
			}
			if class, _ := n.Attribute("class"); class.Value(d.src) == "api-element" {
				d.blocks[n] = apiElement{}
				if p, ok := n.NextSibling().(*ast.Paragraph); ok {
					d.blocks[p] = apiElementDesc{}
				}
				continue
			}
			sectionID = d.headingID(n)
			d.ids[sectionID] = true
			if n.Level == 2 {
				inReference = d.plainText(n) == "Reference"
			}
			if k := apiKindOf(d.plainText(n)); k != nil && n.Level == 3 && inReference {
				d.blocks[n], api = k, k
			}
		case *extast.Table:
			if k := d.apiKindByColumns(n); k != nil {
				tbl, err := d.parseAPITable(n, k, sectionID)
				if err != nil {
					return err
				}
				d.blocks[n] = tbl
			}
		case *ast.CodeBlock:
			lang, _ := n.Language(d.src)
			var blk any
			var err error
			switch lang {
			case "example":
				blk, err = d.parseExample(n)
			case "playground":
				blk, err = d.parsePlayground(n)
			default:
				src, err := d.parseSource(n)
				if err != nil {
					return err
				}
				if src != nil {
					d.blocks[n] = src
				}
				continue
			}
			if err != nil {
				return err
			}
			d.blocks[n] = blk
		case *ast.Blockquote:
			blk, err := d.parseAlert(n)
			if err != nil {
				return err
			}
			if blk != nil {
				d.blocks[n] = blk
			}
		case *ast.List:
			if d.component {
				n.SetAttribute("class",
					text.NewMultiLineValueFromString("demo-note", text.IdentityDecoder))
			}
		}
	}
	if api != nil {
		return fmt.Errorf("%s: no table after the last %s heading", d.file, api.heading)
	}
	return nil
}

// parseLinks resolves the destinations of the links for the HTML page and
// records them for [Docs.CheckLinks] and the Markdown copy.
//
// A link leads to a URL, to "#id" on the page, or to "<name>.md" or "<name>.md#id",
// the page /<name>/. A link to a page that is not yet a
// Markdown file names the file it will be.
func (d *doc) parseLinks() error {
	return ast.Walk(d.root, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if img, ok := n.(*ast.Image); ok && entering {
			dest := img.Destination.Value(d.src)
			name, ok := strings.CutPrefix(dest, "../static/")
			if !ok || !strings.HasSuffix(name, ".svg") || strings.Contains(name, "/") {
				return ast.WalkStop, d.errorf(n,
					"image %q: an image is a diagram, ../static/<name>.svg", dest)
			}
			if _, err := fs.Stat(staticFiles, "static/"+name); err != nil {
				return ast.WalkStop,
					d.errorf(n, "image %q: no internal/site/static/%s", dest, name)
			}
			return ast.WalkSkipChildren, nil
		}
		l, ok := n.(*ast.Link)
		if !ok || !entering {
			return ast.WalkContinue, nil
		}
		raw := l.Destination.Value(d.src)
		u, err := url.Parse(raw)
		if err != nil {
			return ast.WalkStop, d.errorf(n, "link %q: %v", raw, err)
		}
		if u.Scheme != "" || u.Host != "" {
			return ast.WalkContinue, nil
		}
		link := docLink{line: d.line(n), path: d.path, fragment: u.Fragment}
		switch {
		case u.Path == "" && u.Fragment != "" && u.RawQuery == "":
			if !d.ids[u.Fragment] {
				return ast.WalkStop, d.errorf(n, "no #%s on the page", u.Fragment)
			}
		case strings.HasSuffix(u.Path, ".md") && !strings.Contains(u.Path, "/") &&
			u.RawQuery == "" && !l.Destination.IsOwned():
			link.path = "/" + strings.TrimSuffix(u.Path, ".md") + "/"
			link.dest = l.Destination.Index()
			dest := link.path
			if u.Fragment != "" {
				dest += "#" + u.Fragment
			}
			l.Destination = text.NewSingleLineValueFromString(dest, text.IdentityDecoder)
		default:
			return ast.WalkStop, d.errorf(n,
				"link %q: link a URL, #id, or a page as <name>.md", raw)
		}
		d.links = append(d.links, link)
		return ast.WalkContinue, nil
	})
}

// render writes the page body, which [Docs.Page] frames. Like the Templ
// pages, the reference stays in the section of the overview and every other
// level 2 heading starts a section.
func (d *doc) render(ctx context.Context, w io.Writer) error {
	var b bytes.Buffer
	b.WriteString(`<section class="demo">`)
	for n := d.root.FirstChild(); n != nil; n = n.NextSibling() {
		if err := d.renderBlock(ctx, &b, n); err != nil {
			return d.errorf(n, "%v", err)
		}
	}
	b.WriteString(`</section>`)
	_, err := w.Write(b.Bytes())
	return err
}

func (d *doc) renderBlock(ctx context.Context, b *bytes.Buffer, n ast.Node) error {
	switch blk := d.blocks[n].(type) {
	case *exampleBlock:
		return blk.render(ctx, b)
	case *playgroundBlock:
		return Playground(blk.opts).Render(ctx, b)
	case *apiKind:
		h := n.(*ast.Heading)
		return apiSection(d.headingID(h), d.plainText(h), blk.icon).Render(ctx, b)
	case *apiTable:
		return d.renderAPITable(ctx, b, blk)
	case *alertBlock:
		return d.renderAlert(ctx, b, blk)
	case *sourceBlock:
		return renderSource(ctx, b, blk.lang, d.versioned(blk.code))
	}
	switch n := n.(type) {
	case *ast.Heading:
		inner, err := d.inlineHTML(n)
		if err != nil {
			return err
		}
		if _, ok := d.blocks[n].(apiElement); ok {
			fmt.Fprintf(b, `<h%d class="api-element">%s</h%d>`, n.Level, inner, n.Level)
			return nil
		}
		ctx := templ.WithChildren(ctx, templ.Raw(inner))
		switch n.Level {
		case 1:
			if d.component {
				return overviewH2(d.path).Render(ctx, b)
			}
			return anchoredH2(d.titleID(n)).Render(ctx, b)
		case 2:
			if d.plainText(n) != "Reference" {
				b.WriteString(`</section><section class="demo">`)
			}
			return anchoredH2(d.headingID(n)).Render(ctx, b)
		case 3:
			return anchoredH3(d.headingID(n)).Render(ctx, b)
		}
	case *ast.Paragraph:
		if _, ok := d.blocks[n].(apiElementDesc); ok {
			inner, err := d.inlineHTML(n)
			if err != nil {
				return err
			}
			fmt.Fprintf(b, `<p class="api-element-desc">%s</p>`, inner)
			return nil
		}
		// An image on its own is a figure, such as a diagram beside a list.
		if _, ok := n.FirstChild().(*ast.Image); ok && n.ChildCount() == 1 {
			return docRenderer.Render(b, d.src, n.FirstChild())
		}
		class := "demo-note"
		switch {
		case n == d.intro:
			class = "intro"
		case !d.component:
			return docRenderer.Render(b, d.src, n)
		}
		inner, err := d.inlineHTML(n)
		if err != nil {
			return err
		}
		fmt.Fprintf(b, "<p class=%q>%s</p>\n", class, inner)
		return nil
	case *ast.CodeBlock:
		lang, _ := n.Language(d.src)
		return renderSource(ctx, b, lang, n.Value.Str(d.src))
	case *extast.Table:
		return d.renderTable(b, n)
	}
	return docRenderer.Render(b, d.src, n)
}

// docLinks renders a link whose text is only code as [linkChip], unless
// it leads to an ID on the page: component names such as <neo-buttongroup>,
// and event names in the API tables. Another link to a URL opens in a new
// tab and ends in [externalLinkIcon].
func docLinks(next goldhtml.NodeRenderer) goldhtml.NodeRenderer {
	return goldhtml.NodeRendererFunc(func(
		w io.Writer, src []byte, n ast.Node, entering bool, rc renderer.Context,
	) (ast.WalkStatus, error) {
		l := n.(*ast.Link)
		dest := l.Destination.Value(src)
		if code, ok := l.FirstChild().(*ast.CodeSpan); ok &&
			l.ChildCount() == 1 && !strings.HasPrefix(dest, "#") {
			if !entering {
				return ast.WalkContinue, nil
			}
			err := linkChip(code.Value.Value(src), dest).Render(context.Background(), w)
			return ast.WalkSkipChildren, err
		}
		if u, err := url.Parse(dest); err != nil || u.Scheme == "" {
			return next.Render(w, src, n, entering, rc)
		}
		if entering {
			_, err := fmt.Fprintf(w,
				`<a target="_blank" href="%s">`, html.EscapeString(dest))
			return ast.WalkContinue, err
		}
		if err := externalLinkIcon().Render(context.Background(), w); err != nil {
			return ast.WalkStop, err
		}
		_, err := io.WriteString(w, "</a>")
		return ast.WalkContinue, err
	})
}

// inlineHTML returns the HTML of the children of n.
func (d *doc) inlineHTML(n ast.Node) (string, error) {
	var b bytes.Buffer
	for c := n.FirstChild(); c != nil; c = c.NextSibling() {
		if err := docRenderer.Render(&b, d.src, c); err != nil {
			return "", err
		}
	}
	return b.String(), nil
}

// plainText returns the text of n without its inline markup.
func (d *doc) plainText(n ast.Node) string {
	var b strings.Builder
	_ = ast.Walk(n, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		switch n := n.(type) {
		case *ast.Text:
			b.WriteString(n.Value.Value(d.src))
			if n.SoftLineBreak() || n.HardLineBreak() {
				b.WriteByte(' ')
			}
		case *ast.CodeSpan:
			b.WriteString(n.Value.Value(d.src))
			return ast.WalkSkipChildren, nil
		}
		return ast.WalkContinue, nil
	})
	return strings.TrimSpace(b.String())
}

// versioned returns s with {VERSION} replaced by the release.
func (d *doc) versioned(s string) string {
	if d.version == "" {
		return s
	}
	return strings.ReplaceAll(s, "{VERSION}", d.version)
}

func (d *doc) headingID(h *ast.Heading) string {
	id, _ := h.Attribute("id")
	return id.Value(d.src)
}

// titleID returns the ID of the level 1 heading h, see [doc].
func (d *doc) titleID(h *ast.Heading) string {
	if d.component {
		return "overview"
	}
	return d.headingID(h)
}

// line returns the 1-based source line of n,
// or of its closest ancestor with a position.
func (d *doc) line(n ast.Node) int {
	for ; n != nil; n = n.Parent() {
		if p := n.Pos(); p >= 0 {
			return bytes.Count(d.src[:p], []byte("\n")) + 1
		}
	}
	return 0
}

func (d *doc) errorf(n ast.Node, format string, args ...any) error {
	return d.lineErrorf(d.line(n), format, args...)
}

func (d *doc) lineErrorf(line int, format string, args ...any) error {
	return fmt.Errorf("%s:%d: %s", d.file, line, fmt.Sprintf(format, args...))
}

// renderTable writes a table that is not an API table as the site styles
// tables, as the Keys page shows its separators: column-scoped header cells,
// a row header in the first cell of each row, and each cell labeled with its
// column for the stacked layout of narrow screens.
func (d *doc) renderTable(b *bytes.Buffer, t *extast.Table) error {
	var cols []string
	b.WriteString(`<table class="api-table"><thead><tr>`)
	for c := range t.FirstChild().Children() {
		inner, err := d.inlineHTML(c)
		if err != nil {
			return err
		}
		cols = append(cols, d.plainText(c))
		fmt.Fprintf(b, `<th scope="col">%s</th>`, inner)
	}
	b.WriteString(`</tr></thead><tbody>`)
	if body := t.FirstChild().NextSibling(); body != nil {
		for r := range body.Children() {
			b.WriteString(`<tr>`)
			i := 0
			for c := range r.Children() {
				inner, err := d.inlineHTML(c)
				if err != nil {
					return err
				}
				tag, scope := "td", ""
				if i == 0 {
					tag, scope = "th", ` scope="row"`
				}
				fmt.Fprintf(b, `<%s%s data-label="%s">%s</%s>`,
					tag, scope, html.EscapeString(cols[min(i, len(cols)-1)]), inner, tag)
				i++
			}
			b.WriteString(`</tr>`)
		}
	}
	b.WriteString(`</tbody></table>`)
	return nil
}
