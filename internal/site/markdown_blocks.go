package site

import (
	"bytes"
	"context"
	"embed"
	"errors"
	"fmt"
	"html"
	"io"
	"io/fs"
	"maps"
	"path"
	"regexp"
	"slices"
	"strings"
	"unicode"

	"github.com/a-h/templ"
	"github.com/yuin/goldmark/v2/ast"
	extast "github.com/yuin/goldmark/v2/extension/ast"

	"github.com/romshark/morpheus/internal/site/examples"
	"github.com/romshark/morpheus/neo"
)

// docExample is an example of package examples that a doc page shows.
type docExample struct {
	name    string
	live    templ.Component // The preview.
	preview string          // The HTML of the preview, for a playground state.
	html    string          // The HTML tab.
	templ   string          // The Templ tab. Empty for an HTML example.
	css     string          // The CSS tab and the scoped preview style.
	tsx     string          // The TSX tab.
	ts      string          // The TypeScript tab.
	js      string          // A module the page loads, and the Server script tab.
}

// exampleSources holds the example files, as [examples.Sources] does.
var exampleSources fs.FS = examples.Sources

// loadExample loads the example name, which is 1 of:
//
//   - examples/<name>.templ, whose template [examples.Templates] names.
//   - examples/<name>.html.
//   - The directory examples/<name>/, see [loadExampleDir].
//
// The optional examples/<name>.css styles the first 2.
func loadExample(name string) (docExample, error) {
	if fi, err := fs.Stat(exampleSources, name); err == nil && fi.IsDir() {
		return loadExampleDir(name)
	}
	css, err := fs.ReadFile(exampleSources, name+".css")
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return docExample{}, err
	}
	ex := docExample{name: name, css: string(css)}
	if t, ok := examples.Templates[name]; ok {
		src, err := fs.ReadFile(exampleSources, name+".templ")
		if err != nil {
			return docExample{}, err
		}
		ex.live = t()
		ex.html = renderExampleHTML(ex.live)
		ex.preview = ex.html
		ex.templ = string(src)
		return ex, nil
	}
	if _, err := fs.Stat(exampleSources, name+".templ"); err == nil {
		return docExample{}, fmt.Errorf(
			"example %q: add its template to examples.Templates", name)
	}
	src, err := fs.ReadFile(exampleSources, name+".html")
	if errors.Is(err, fs.ErrNotExist) {
		return docExample{}, fmt.Errorf("no example %q in internal/site/examples", name)
	} else if err != nil {
		return docExample{}, err
	}
	if ex.css == "" {
		if ex.css, err = groupCSS(name); err != nil {
			return docExample{}, err
		}
	}
	ex.html = string(src)
	ex.preview = ex.html
	ex.live = templ.Raw(ex.html)
	return ex, nil
}

// groupCSS returns the CSS that the HTML example name shares with the other
// states of its group, <group>.css for <group>_<state>.html, as in
// popover_morph.css for popover_morph_50.html. The longest group wins.
func groupCSS(name string) (string, error) {
	for i := strings.LastIndex(name, "_"); i > 0; i = strings.LastIndex(name[:i], "_") {
		css, err := fs.ReadFile(exampleSources, name[:i]+".css")
		if err == nil {
			return string(css), nil
		}
		if !errors.Is(err, fs.ErrNotExist) {
			return "", err
		}
	}
	return "", nil
}

// loadExampleDir loads the example in the directory examples/<name>/, for an
// example whose preview differs from the source it shows. preview.html is the preview,
// and the HTML tab unless another .html file is. Each other file fills the tab of
// its extension: .html, .css, .tsx, .ts, or .js, a module the page also loads.
// The .css file also styles the preview.
func loadExampleDir(name string) (docExample, error) {
	entries, err := fs.ReadDir(exampleSources, name)
	if err != nil {
		return docExample{}, err
	}
	ex := docExample{name: name}
	tabs := map[string]*string{
		".html": &ex.html, ".css": &ex.css, ".tsx": &ex.tsx, ".ts": &ex.ts, ".js": &ex.js,
	}
	hasPreview := false
	for _, e := range entries {
		file := path.Join(name, e.Name())
		if e.IsDir() {
			return docExample{}, fmt.Errorf("example %q: %s is a directory", name, file)
		}
		src, err := fs.ReadFile(exampleSources, file)
		if err != nil {
			return docExample{}, err
		}
		if e.Name() == "preview.html" {
			ex.preview, hasPreview = string(src), true
			continue
		}
		dst, ok := tabs[path.Ext(file)]
		if !ok {
			return docExample{}, fmt.Errorf(
				"example %q: %s is not .html, .css, .tsx, .ts or .js", name, file)
		}
		if *dst != "" {
			return docExample{}, fmt.Errorf(
				"example %q: 2 %s files", name, path.Ext(file))
		}
		*dst = string(src)
	}
	if !hasPreview {
		return docExample{}, fmt.Errorf("example %q: no %s/preview.html", name, name)
	}
	if ex.html == "" {
		ex.html = ex.preview
	}
	ex.live = templ.Raw(ex.preview)
	return ex, nil
}

// markdown returns the code blocks of the sources of ex.
func (ex docExample) markdown() string {
	var b strings.Builder
	writeFence(&b, "html", ex.html)
	for _, s := range []struct{ lang, code string }{
		{"templ", ex.templ}, {"css", ex.css}, {"tsx", ex.tsx}, {"ts", ex.ts}, {"js", ex.js},
	} {
		if s.code != "" {
			b.WriteString("\n")
			writeFence(&b, s.lang, s.code)
		}
	}
	return b.String()
}

// writeFence writes code as a fenced code block in lang.
// The fence is longer than any run of backticks in code.
func writeFence(b *strings.Builder, lang, code string) {
	longest, run := 0, 0
	for _, c := range code {
		if c == '`' {
			run++
			longest = max(longest, run)
		} else {
			run = 0
		}
	}
	fence := strings.Repeat("`", max(3, longest+1))
	fmt.Fprintf(b, "%s%s\n%s\n%s\n", fence, lang, strings.TrimRight(code, "\n"), fence)
}

// simFS holds the in-browser server simulator scripts of the demos.
//
//go:embed static/sim
var simFS embed.FS

// exampleBlock is a code block like
//
//	```example button_variants
//	min-height: max-content
//	```
//
// that shows the example in a demo frame with its source tabs. Its body
// holds options, 1 "key: value" per line, see [doc.blockOptions]:
//
//   - The [DemoFrameOpts] ones in [exampleOptions].
//   - script names a simulator module under internal/site/static, as in
//     "sim/frameworks/accent.js". The page loads it, and the Server script
//     tab shows it. An example with a .js file of its own takes no script.
//   - wrap is the class of a <div> around the preview, for site layout
//     that the source tabs leave out.
//   - tabs lists the source tabs to show, as in "tabs: templ css" for a
//     demo whose HTML says little. "tabs: none" shows the preview alone,
//     for a preview of the site itself, such as the theme showcase.
//     The Markdown copy shows the same sources.
//   - simulator adds the hint that loading states need simulated delay,
//     "delay", or the server error controls and that hint, "errors".
//   - boundary lists the scopes of the <neo-boundary> around the preview,
//     as in "dismiss" for a boundary that doesn't position overlays.
type exampleBlock struct {
	ex   docExample
	opts DemoFrameOpts
	live templ.Component
	// scriptTag loads the script of the example. The first block of the
	// page with that script has it; the others leave it empty.
	scriptTag string
	noTabs    bool
	onlyTabs  []string // The tabs of "tabs: html css", nil for all.
	// simulator is "delay" for the hint that loading states need simulated
	// delay, and "errors" for the server error controls above that hint.
	simulator string
}

// exampleOptions are the options of an example block that set [DemoFrameOpts] fields.
var exampleOptions = map[string]func(*DemoFrameOpts, string){
	"width":      func(o *DemoFrameOpts, v string) { o.Width = v },
	"height":     func(o *DemoFrameOpts, v string) { o.Height = v },
	"min-height": func(o *DemoFrameOpts, v string) { o.StageMinHeight = v },
	"max-height": func(o *DemoFrameOpts, v string) { o.StageMaxHeight = v },
	"min-width":  func(o *DemoFrameOpts, v string) { o.StageMinWidth = v },
	"max-width":  func(o *DemoFrameOpts, v string) { o.StageMaxWidth = v },
	"class":      func(o *DemoFrameOpts, v string) { o.StageClass = v },
	"style":      func(o *DemoFrameOpts, v string) { o.StageAttrs = templ.Attributes{"style": v} },
	"tab":        func(o *DemoFrameOpts, v string) { o.DefaultTab = v },
}

func (d *doc) parseExample(n *ast.CodeBlock) (*exampleBlock, error) {
	words, err := d.infoWords(n)
	if err != nil {
		return nil, err
	}
	if len(words) != 1 {
		return nil, d.errorf(n, "an example block names 1 example")
	}
	options, err := d.blockOptions(d.bodyLines(n))
	if err != nil {
		return nil, err
	}
	var tabsLine int
	blk := &exampleBlock{}
	if blk.ex, err = loadExample(words[0]); err != nil {
		return nil, d.errorf(n, "%v", err)
	}
	blk.opts.HTMLSource = blk.ex.html
	blk.opts.TemplSource = blk.ex.templ
	blk.opts.CSSSource = blk.ex.css
	blk.opts.TSXSource = blk.ex.tsx
	blk.opts.TypeScriptSource = blk.ex.ts
	blk.opts.ScriptSource = blk.ex.js
	blk.live = blk.ex.live
	if js := blk.ex.js; js != "" {
		if strings.Contains(strings.ToLower(js), "</script") {
			return nil,
				d.errorf(n, "example %q: its .js file holds </script", blk.ex.name)
		}
		d.loadScript(blk, "example "+blk.ex.name, `<script type="module">`+js+`</script>`)
	}
	for _, o := range options {
		switch o.key {
		case "script":
			if blk.ex.js != "" {
				return nil, d.lineErrorf(o.line,
					"example %q has a .js file and a script option", blk.ex.name)
			}
			src, err := fs.ReadFile(simFS, path.Join("static", o.value))
			if err != nil || !strings.HasPrefix(o.value, "sim/") {
				return nil, d.lineErrorf(o.line,
					"script %s: no internal/site/static/sim file", o.value)
			}
			blk.opts.ScriptSource = string(src)
			url := "/static/" + o.value
			d.loadScript(blk, url,
				`<script type="module" src="`+html.EscapeString(url)+`"></script>`)
		case "wrap":
			blk.live = wrapDiv(o.value, blk.live)
		case "boundary":
			if blk.opts.Boundary, err = boundaryScopes(o.value); err != nil {
				return nil, d.lineErrorf(o.line, "%v", err)
			}
		case "simulator":
			if o.value != "delay" && o.value != "errors" {
				return nil, d.lineErrorf(o.line, "simulator %s, want delay or errors", o.value)
			}
			blk.simulator = o.value
		case "tabs":
			if o.value == "none" {
				blk.noTabs = true
				break
			}
			blk.onlyTabs = strings.Fields(o.value)
			tabsLine = o.line
		default:
			set, ok := exampleOptions[o.key]
			if !ok {
				return nil, d.lineErrorf(o.line, "unknown example option %s", o.key)
			}
			set(&blk.opts, o.value)
		}
	}
	if blk.onlyTabs != nil {
		shown := blk.tabs()
		for _, t := range blk.onlyTabs {
			if !slices.Contains(shown, t) || t == "hide" {
				return nil, d.lineErrorf(tabsLine, "tabs %s, want none or some of %q", t, shown[1:])
			}
		}
	}
	for _, t := range []struct {
		name string
		src  *string
	}{
		{"html", &blk.opts.HTMLSource},
		{"templ", &blk.opts.TemplSource},
		{"css", &blk.opts.CSSSource},
		{"tsx", &blk.opts.TSXSource},
		{"typescript", &blk.opts.TypeScriptSource},
		{"script", &blk.opts.ScriptSource},
	} {
		if blk.noTabs || blk.onlyTabs != nil && !slices.Contains(blk.onlyTabs, t.name) {
			*t.src = ""
		}
	}
	for _, o := range options {
		if o.key == "tab" && !slices.Contains(blk.tabs(), o.value) {
			return nil, d.lineErrorf(o.line, "tab %s, want 1 of %q", o.value, blk.tabs())
		}
	}
	return blk, nil
}

// boundaryScopes returns the scopes of the <neo-boundary> around a preview
// from its scope tokens, as in "dismiss" for a boundary without positioning.
func boundaryScopes(tokens string) (BoundaryScopes, error) {
	s := BoundaryScopes{NoDismiss: true, NoPositioning: true}
	for _, t := range strings.Fields(tokens) {
		switch t {
		case "dismiss":
			s.NoDismiss = false
		case "positioning":
			s.NoPositioning = false
		case "scroll":
			s.Scroll = true
		case "stacking":
			s.Stacking = true
		default:
			return s, fmt.Errorf("boundary %s, want dismiss, positioning, scroll or stacking", t)
		}
	}
	return s, nil
}

// apiElement marks a heading like "### `<neo-menuitem>` {.api-element}",
// which names the element that the API tables after it document on a page
// that documents several. apiElementDesc marks the paragraph after it.
type (
	apiElement     struct{}
	apiElementDesc struct{}
)

// tabs returns the footer tabs of the frame of blk, as [demoTabsFooter] names them.
func (blk *exampleBlock) tabs() []string {
	tabs := []string{"hide"}
	for _, t := range []struct{ name, src string }{
		{"html", blk.opts.HTMLSource},
		{"templ", blk.opts.TemplSource},
		{"css", blk.opts.CSSSource},
		{"tsx", blk.opts.TSXSource},
		{"typescript", blk.opts.TypeScriptSource},
		{"script", blk.opts.ScriptSource},
	} {
		if t.src != "" {
			tabs = append(tabs, t.name)
		}
	}
	return tabs
}

// loadScript sets tag, the element that loads the script key,
// on blk if blk is the first block of d with that script.
func (d *doc) loadScript(blk *exampleBlock, key, tag string) {
	if !d.scripts[key] {
		blk.scriptTag = tag
		d.scripts[key] = true
	}
}

// markdown returns the code blocks of the source tabs of blk.
func (blk *exampleBlock) markdown() string {
	var b strings.Builder
	for _, t := range []struct{ lang, code string }{
		{"html", blk.opts.HTMLSource},
		{"templ", blk.opts.TemplSource},
		{"css", blk.opts.CSSSource},
		{"tsx", blk.opts.TSXSource},
		{"ts", blk.opts.TypeScriptSource},
		{"js", blk.opts.ScriptSource},
	} {
		if t.code != "" {
			if b.Len() > 0 {
				b.WriteString("\n")
			}
			writeFence(&b, t.lang, t.code)
		}
	}
	return b.String()
}

func (blk *exampleBlock) render(ctx context.Context, b *bytes.Buffer) error {
	b.WriteString(blk.scriptTag)
	if blk.simulator == "errors" {
		if err := serverErrorControls().Render(ctx, b); err != nil {
			return err
		}
	}
	if blk.simulator != "" {
		if err := simDelayHint().Render(ctx, b); err != nil {
			return err
		}
	}
	return demoFrameWith(blk.opts).Render(templ.WithChildren(ctx, blk.live), b)
}

// wrapDiv returns c inside a <div> of class.
func wrapDiv(class string, c templ.Component) templ.Component {
	return templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		if _, err := fmt.Fprintf(w,
			`<div class="%s">`, html.EscapeString(class)); err != nil {
			return err
		}
		if err := c.Render(ctx, w); err != nil {
			return err
		}
		_, err := io.WriteString(w, `</div>`)
		return err
	})
}

// playgroundBlock is a code block like
//
//	```playground
//	height: 20rem
//	- button_default: Default
//	- button_variants: Variants & states
//	```
//
// that shows a [Playground] with 1 state per list item: an example and its label.
// The other lines are options, see [doc.blockOptions]. id sets the playground ID,
// "<page>-playground" by default.
// height and min-width set [PlaygroundOpts] Height and MinWidth.
type playgroundBlock struct {
	opts   PlaygroundOpts
	states []docExample
}

func (d *doc) parsePlayground(n *ast.CodeBlock) (*playgroundBlock, error) {
	words, err := d.infoWords(n)
	if err != nil {
		return nil, err
	}
	if len(words) > 0 {
		return nil, d.errorf(n, "unexpected %q after playground", words[0])
	}
	blk := &playgroundBlock{opts: PlaygroundOpts{
		ID: strings.Trim(d.path, "/") + "-playground",
	}}
	var optionLines []blockLine
	for _, l := range d.bodyLines(n) {
		item, ok := strings.CutPrefix(l.text, "- ")
		if !ok {
			optionLines = append(optionLines, l)
			continue
		}
		name, label, ok := strings.Cut(item, ":")
		name, label = strings.TrimSpace(name), strings.TrimSpace(label)
		if !ok || name == "" || label == "" {
			return nil, d.lineErrorf(l.line,
				"playground state %q: want - <example>: <label>", l.text)
		}
		ex, err := loadExample(name)
		if err != nil {
			return nil, d.lineErrorf(l.line, "%v", err)
		}
		if ex.js != "" {
			return nil, d.lineErrorf(l.line,
				"example %q has a .js file, which a playground doesn't load", name)
		}
		blk.states = append(blk.states, ex)
		blk.opts.States = append(blk.opts.States,
			PlaygroundState{Label: label, HTML: ex.preview, CSS: ex.css})
	}
	options, err := d.blockOptions(optionLines)
	if err != nil {
		return nil, err
	}
	for _, o := range options {
		switch o.key {
		case "id":
			blk.opts.ID = o.value
		case "height":
			blk.opts.Height = neo.CSSUnit(o.value)
		case "min-width":
			blk.opts.MinWidth = neo.CSSUnit(o.value)
		case "autoplay":
			if o.value != "true" {
				return nil, d.lineErrorf(o.line, "autoplay %s, want true", o.value)
			}
			blk.opts.Autoplay = true
		case "boundary":
			if blk.opts.Boundary, err = boundaryScopes(o.value); err != nil {
				return nil, d.lineErrorf(o.line, "%v", err)
			}
		default:
			return nil, d.lineErrorf(o.line, "unknown playground option %s", o.key)
		}
	}
	if len(blk.states) == 0 {
		return nil, d.errorf(n, "a playground block lists its states as - <example>: <label>")
	}
	return blk, nil
}

// infoWords returns the words after the language in the info string of n.
// Options go in the body of the block, not in the info string.
func (d *doc) infoWords(n *ast.CodeBlock) ([]string, error) {
	words := strings.Fields(n.Info.Value(d.src))[1:]
	for _, w := range words {
		if strings.Contains(w, "=") {
			return nil,
				d.errorf(n, "%s: options go in the block body, 1 key: value per line", w)
		}
	}
	return words, nil
}

// blockLine is a non-blank line of the body of a code block.
type blockLine struct {
	line int    // 1-based source line.
	text string // Without surrounding space.
}

// bodyLines returns the non-blank lines of the body of n.
func (d *doc) bodyLines(n *ast.CodeBlock) []blockLine {
	var lines []blockLine
	for _, seg := range n.Value.Segments() {
		if t := strings.TrimSpace(seg.Str(d.src)); t != "" {
			lines = append(lines, blockLine{
				line: bytes.Count(d.src[:seg.Start], []byte("\n")) + 1,
				text: t,
			})
		}
	}
	return lines
}

// blockOption is an option of an example or playground block.
type blockOption struct {
	key, value string
	line       int
}

// blockOptions parses lines as options, "key: value" each.
// The value is the rest of the line, without quotes.
func (d *doc) blockOptions(lines []blockLine) ([]blockOption, error) {
	var options []blockOption
	seen := make(map[string]bool)
	for _, l := range lines {
		key, value, ok := strings.Cut(l.text, ":")
		key, value = strings.TrimSpace(key), strings.TrimSpace(value)
		if !ok || key == "" || value == "" || strings.ContainsFunc(key, unicode.IsSpace) {
			return nil, d.lineErrorf(l.line, "%q: want key: value", l.text)
		}
		if seen[key] {
			return nil, d.lineErrorf(l.line, "%s set 2 times", key)
		}
		seen[key] = true
		options = append(options, blockOption{key: key, value: value, line: l.line})
	}
	return options, nil
}

// apiKind is a kind of API table, named by the level 3 heading above it,
// as [ComponentDocs] renders it.
type apiKind struct {
	heading string
	icon    string
	columns []string
}

var apiKinds = []*apiKind{
	{"Attributes", iconAttributes, []string{"Name", "Type", "Default", "Description"}},
	{"States", iconStates, []string{"Name", "Description"}},
	{"Slots", iconSlots, []string{"Name", "Description"}},
	{"Events", iconEvents, []string{"Name", "Detail", "Bubbles", "Description"}},
	{"Parts", iconParts, []string{"Name", "Description"}},
	{"CSS variables", iconCSSProps, []string{"Name", "Default", "Description"}},
}

func apiKindOf(heading string) *apiKind {
	for _, k := range apiKinds {
		if k.heading == heading {
			return k
		}
	}
	return nil
}

// apiKindByColumns returns the API kind whose columns t has, if only 1 kind
// has them: Attributes, Events or CSS variables. Such a table is an API table
// under any heading, such as Kit-wide variables on the Theming page.
func (d *doc) apiKindByColumns(t *extast.Table) *apiKind {
	var header []string
	for c := range t.FirstChild().Children() {
		header = append(header, d.plainText(c))
	}
	var kind *apiKind
	for _, k := range apiKinds {
		if slices.Equal(header, k.columns) {
			if kind != nil {
				return nil
			}
			kind = k
		}
	}
	return kind
}

// apiTable is an API table. A Type cell is the type in backticks,
// followed by the flags reflected and observed, as in "`boolean`, observed".
// An empty Type, Default or Detail cell renders "none".
type apiTable struct {
	kind *apiKind
	rows []apiRow
}

type apiRow struct {
	id                  string
	cells               []*extast.TableCell
	reflected, observed bool
}

func (d *doc) parseAPITable(
	t *extast.Table, kind *apiKind, sectionID string,
) (*apiTable, error) {
	var header []string
	for c := range t.FirstChild().Children() {
		header = append(header, d.plainText(c))
	}
	if !slices.Equal(header, kind.columns) {
		return nil, d.errorf(t,
			"%s columns %q, want %q", kind.heading, header, kind.columns)
	}
	tbl := &apiTable{kind: kind}
	body := t.FirstChild().NextSibling()
	if body == nil {
		return nil, d.errorf(t, "%s table has no rows", kind.heading)
	}
	for r := range body.Children() {
		row := apiRow{}
		for c := range r.Children() {
			row.cells = append(row.cells, c.(*extast.TableCell))
		}
		if len(row.cells) != len(kind.columns) {
			return nil, d.errorf(r,
				"%d cells, want %d", len(row.cells), len(kind.columns))
		}
		name := d.plainText(row.cells[0])
		if name == "" {
			return nil, d.errorf(r, "no name")
		}
		// The ID names the bare state or part, as [ComponentDocs] does.
		for _, w := range []string{":state(", "::part("} {
			if inner, ok := strings.CutPrefix(name, w); ok {
				name = strings.TrimSuffix(inner, ")")
			}
		}
		row.id = docItemID(sectionID, name)
		if d.ids[row.id] {
			return nil, d.errorf(r, "ID %s used 2 times", row.id)
		}
		d.ids[row.id] = true
		for i, col := range kind.columns {
			switch col {
			case "Type":
				if err := d.cutFlags(row.cells[i], &row); err != nil {
					return nil, d.errorf(r, "%v", err)
				}
			case "Bubbles":
				if b := d.plainText(row.cells[i]); b != "yes" && b != "no" {
					return nil, d.errorf(r, "Bubbles %q, want yes or no", b)
				}
			}
		}
		tbl.rows = append(tbl.rows, row)
	}
	return tbl, nil
}

// cutFlags removes the flags after the type in the Type cell of row and sets them on row.
func (d *doc) cutFlags(cell *extast.TableCell, row *apiRow) error {
	typ := cell.FirstChild()
	if typ == nil {
		return nil
	}
	if _, ok := typ.(*ast.CodeSpan); !ok {
		return errors.New("a Type cell starts with the type in backticks")
	}
	var flags strings.Builder
	for c := typ.NextSibling(); c != nil; {
		next := c.NextSibling()
		t, ok := c.(*ast.Text)
		if !ok {
			return errors.New("a Type cell holds the type and flags only")
		}
		flags.WriteString(t.Value.Value(d.src))
		cell.RemoveChild(c)
		c = next
	}
	for _, f := range strings.FieldsFunc(flags.String(), func(r rune) bool {
		return r == ',' || unicode.IsSpace(r)
	}) {
		switch f {
		case "reflected":
			row.reflected = true
		case "observed":
			row.observed = true
		default:
			return fmt.Errorf("flag %q, want reflected or observed", f)
		}
	}
	return nil
}

func (d *doc) renderAPITable(ctx context.Context, b *bytes.Buffer, t *apiTable) error {
	fmt.Fprintf(b, `<table class="api-table" data-icon="%s"><thead><tr>`, t.kind.icon)
	for _, c := range t.kind.columns {
		fmt.Fprintf(b, `<th scope="col">%s</th>`, c)
	}
	b.WriteString(`</tr></thead><tbody>`)
	for _, row := range t.rows {
		fmt.Fprintf(b, `<tr id="%s">`, html.EscapeString(row.id))
		for i, col := range t.kind.columns {
			inner, err := d.inlineHTML(row.cells[i])
			if err != nil {
				return err
			}
			if inner == "" && (col == "Type" || col == "Default" || col == "Detail") {
				inner = "none"
			}
			if i == 0 {
				err := docNameCell(row.id).
					Render(templ.WithChildren(ctx, templ.Raw(inner)), b)
				if err != nil {
					return err
				}
				continue
			}
			fmt.Fprintf(b, `<td data-label="%s">`, col)
			if col != "Type" {
				b.WriteString(inner)
				b.WriteString(`</td>`)
				continue
			}
			b.WriteString(`<span class="api-type">`)
			b.WriteString(inner)
			if row.reflected {
				if err := docReflectedBadge().Render(ctx, b); err != nil {
					return err
				}
			}
			if row.observed {
				if err := docObservedBadge().Render(ctx, b); err != nil {
					return err
				}
			}
			b.WriteString(`</span></td>`)
		}
		b.WriteString(`</tr>`)
	}
	b.WriteString(`</tbody></table>`)
	return nil
}

// alertBlock is a GitHub alert that renders as a <neo-alert>:
//
//	> [!NOTE]
//	> ### Every Morpheus demo uses Datastar
//	>
//	> In order to avoid hosting a server, ...
//
// The heading is the optional title. 1 paragraph is the description,
// because [neo.AlertDescription] is a <p>.
type alertBlock struct {
	kind  alertKind
	title *ast.Heading
	desc  *ast.Paragraph
}

type alertKind struct {
	variant neo.AlertVariant
	icon    string
}

// alertKinds maps the GitHub alert kinds that
// doc pages use to the variants of <neo-alert>.
var alertKinds = map[string]alertKind{
	"NOTE":    {neo.AlertVariantInfo, "info"},
	"WARNING": {neo.AlertVariantWarning, "triangle-alert"},
}

// alertMarker matches the first line of a GitHub alert, such as "[!NOTE]".
var alertMarker = regexp.MustCompile(`^\[!([A-Z]+)\]\s*$`)

// parseAlert returns the alert of q, or nil if q is a plain blockquote.
func (d *doc) parseAlert(q *ast.Blockquote) (*alertBlock, error) {
	p, ok := q.FirstChild().(*ast.Paragraph)
	if !ok || len(p.Source()) == 0 {
		return nil, nil
	}
	m := alertMarker.FindStringSubmatch(p.Source()[0].Str(d.src))
	if m == nil {
		return nil, nil
	}
	blk := &alertBlock{}
	if blk.kind, ok = alertKinds[m[1]]; !ok {
		return nil, d.errorf(q,
			"alert kind %s, want %s", m[1], slices.Sorted(maps.Keys(alertKinds)))
	}
	// The marker spans the first line of p.
	for c := p.FirstChild(); c != nil; {
		next := c.NextSibling()
		p.RemoveChild(c)
		if t, ok := c.(*ast.Text); ok && (t.SoftLineBreak() || t.HardLineBreak()) {
			break
		}
		c = next
	}
	if p.ChildCount() == 0 {
		q.RemoveChild(p)
	}
	n := q.FirstChild()
	if h, ok := n.(*ast.Heading); ok {
		blk.title, n = h, n.NextSibling()
	}
	blk.desc, ok = n.(*ast.Paragraph)
	if !ok || n.NextSibling() != nil {
		return nil, d.errorf(q, "an alert holds an optional heading and 1 paragraph")
	}
	return blk, nil
}

func (d *doc) renderAlert(ctx context.Context, b *bytes.Buffer, blk *alertBlock) error {
	desc, err := d.inlineHTML(blk.desc)
	if err != nil {
		return err
	}
	var title string
	if blk.title != nil {
		if title, err = d.inlineHTML(blk.title); err != nil {
			return err
		}
	}
	content := templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		if blk.title != nil {
			err := neo.AlertTitle(blk.title.Level).
				Render(templ.WithChildren(ctx, templ.Raw(title)), w)
			if err != nil {
				return err
			}
		}
		return neo.AlertDescription().Render(templ.WithChildren(ctx, templ.Raw(desc)), w)
	})
	body := templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		err := neo.AlertIcon().Render(templ.WithChildren(ctx, neo.Icon(blk.kind.icon)), w)
		if err != nil {
			return err
		}
		return neo.AlertContent().Render(templ.WithChildren(ctx, content), w)
	})
	// On a component page an alert stands above a demo, as .demo-callout.
	var attrs templ.Attributes
	if d.component {
		attrs = templ.Attributes{"class": "demo-callout"}
	}
	opts := neo.AlertOpts{Variant: neo.Set(blk.kind.variant)}
	return neo.AlertAttrs(opts, attrs).Render(templ.WithChildren(ctx, body), b)
}

// sourceBlock is a code block like
//
//	```css ../static/theme-default.css
//	```
//
// that shows a file of internal/site/static or internal/site/examples read-only,
// as the site ships or runs it. The block has no body.
type sourceBlock struct {
	lang, code string
}

// parseSource returns the source block of n,
// or nil if n is a code block with its own body.
func (d *doc) parseSource(n *ast.CodeBlock) (*sourceBlock, error) {
	words := strings.Fields(n.Info.Value(d.src))
	if len(words) < 2 {
		return nil, nil
	}
	if len(words) > 2 || len(n.Value.Segments()) > 0 {
		return nil, d.errorf(n, "a source block names 1 file and has no body")
	}
	file := words[1]
	var fsys fs.FS
	var name string
	if rest, ok := strings.CutPrefix(file, "../static/"); ok &&
		!strings.Contains(rest, "/") {
		fsys, name = staticFiles, "static/"+rest
	} else if rest, ok := strings.CutPrefix(file, "../examples/"); ok {
		fsys, name = exampleSources, rest
	} else {
		return nil, d.errorf(n,
			"source %s: want ../static/<file> or ../examples/<file>", file)
	}
	code, err := fs.ReadFile(fsys, name)
	if err != nil {
		return nil, d.errorf(n,
			"source %s: no internal/site/%s", file, strings.TrimPrefix(file, "../"))
	}
	return &sourceBlock{lang: words[0], code: string(code)}, nil
}

// renderSource writes code in the read-only editor of the site,
// inside the .theming-source frame that every page puts around code.
func renderSource(ctx context.Context, b *bytes.Buffer, lang, code string) error {
	b.WriteString(`<div class="theming-source">`)
	if err := sourceCodeEditor(lang, code).Render(ctx, b); err != nil {
		return err
	}
	b.WriteString(`</div>`)
	return nil
}
