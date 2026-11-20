package site

import (
	"context"
	"io/fs"
	"maps"
	"slices"
	"strings"
	"testing"
	"testing/fstest"
)

// TestLoadDocs tests that the doc pages in docs/ parse and render.
func TestLoadDocs(t *testing.T) {
	ds, err := LoadDocs("v0.0.0")
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range ds.Paths() {
		var b strings.Builder
		if err := ds.Page(p, "v0").Render(context.Background(), &b); err != nil {
			t.Errorf("%s: %v", p, err)
		}
	}
}

// TestDocHeadingIDs tests that heading IDs join lowercase [a-z0-9] runs
// with 1 "-", as the IDs of the Templ pages do.
func TestDocHeadingIDs(t *testing.T) {
	d := mustParseDoc(t,
		"# Title\n\n## Variants & states\n\n### `<neo-x>` in a form\n\n## !!\n")
	want := []string{"neo-x-in-a-form", "section", "title", "variants-states"}
	if got := slices.Sorted(maps.Keys(d.ids)); !slices.Equal(got, want) {
		t.Errorf("ids = %q, want %q", got, want)
	}
}

// TestParseDocErrors tests that a doc page with a broken block, API table
// or link fails with its file and line.
func TestParseDocErrors(t *testing.T) {
	const attrs = "## Reference\n\n### Attributes\n\n" +
		"| Name | Type | Default | Description |" +
		"\n| --- | --- | --- | --- |\n"
	for _, tt := range []struct{ src, err string }{
		{
			"Text\n",
			"x.md: no level 1 heading at the start",
		},
		{
			"# A\n\n# B\n",
			"x.md:3: a 2nd level 1 heading",
		},
		{
			"# A\n\n```example no_such_example\n```\n",
			`x.md:3: no example "no_such_example" in internal/site/examples`,
		},
		{
			"# A\n\n```example\n```\n",
			"x.md:3: an example block names 1 example",
		},
		{
			"# A\n\n```example button_variants min-height=\"1\"\n```\n",
			`x.md:3: min-height="1": options go in the block body, 1 key: value per line`,
		},
		{
			"# A\n\n```example button_variants\nmin-height: 1rem\ntab: tsx\n```\n",
			`x.md:5: tab tsx, want 1 of ["hide" "html" "templ"]`,
		},
		{
			"# A\n\n```example button_variants\nscript: sim/none.js\n```\n",
			`x.md:4: script sim/none.js: no internal/site/static/sim file`,
		},
		{
			"# A\n\n```example button_variants\nscript: style.css\n```\n",
			`x.md:4: script style.css: no internal/site/static/sim file`,
		},
		{
			"# A\n\n```example button_variants\n\nsize: 1\n```\n",
			`x.md:5: unknown example option size`,
		},
		{
			"# A\n\n```example button_variants\nmin-height\n```\n",
			`x.md:4: "min-height": want key: value`,
		},
		{
			"# A\n\n```example button_variants\nmin-height:\n```\n",
			`x.md:4: "min-height:": want key: value`,
		},
		{
			"# A\n\n```example button_variants\nmin height: 1rem\n```\n",
			`x.md:4: "min height: 1rem": want key: value`,
		},
		{
			"# A\n\n```example button_variants\ntab: html\ntab: templ\n```\n",
			`x.md:5: tab set 2 times`,
		},
		{
			"# A\n\n```playground\n- button_default\n```\n",
			`x.md:4: playground state "- button_default": want - <example>: <label>`,
		},
		{
			"# A\n\n```playground\nheight: 20rem\n```\n",
			"x.md:3: a playground block lists its states as - <example>: <label>",
		},
		{
			"# A\n\n```playground\n- button_default: Default\n- no_such_example: X\n```\n",
			`x.md:5: no example "no_such_example" in internal/site/examples`,
		},
		{
			"# A\n\n```playground\n- button_default: Default\nspeed: fast\n```\n",
			`x.md:5: unknown playground option speed`,
		},
		{
			"# A\n\n```playground id=\"x\"\n- button_default: Default\n```\n",
			`x.md:3: id="x": options go in the block body, 1 key: value per line`,
		},
		{
			"# A\n\n## Reference\n\n### Events\n\nText\n",
			"x.md:7: no table after the Events heading",
		},
		{
			"# A\n\n## Reference\n\n### Slots\n",
			"x.md: no table after the last Slots heading",
		},
		{
			"# A\n\n## Reference\n\n### Slots\n\n| Name | Detail |\n| --- | --- |\n| a | b |\n",
			`x.md:7: Slots columns ["Name" "Detail"], want ["Name" "Description"]`,
		},
		{
			"# A\n\n" + attrs + "| `a` | `string`, mirrored | | D |\n",
			`x.md:9: flag "mirrored", want reflected or observed`,
		},
		{
			"# A\n\n" + attrs + "| `a` | string | | D |\n",
			"x.md:9: a Type cell starts with the type in backticks",
		},
		{
			"# A\n\n" + attrs + "| `a` | | | D |\n| `a` | | | D |\n",
			"x.md:10: ID attributes-a used 2 times",
		},
		{
			"# A\n\n## Reference\n\n### Events\n\n" +
				"| Name | Detail | Bubbles | Description |" +
				"\n| --- | --- | --- | --- |\n" +
				"| `e` | | maybe | D |\n",
			`x.md:9: Bubbles "maybe", want yes or no`,
		},
		{
			"# A\n\nSee [b](#nope).\n",
			"x.md:3: no #nope on the page",
		},
		{
			"# A\n\nSee [b](/button/).\n",
			`x.md:3: link "/button/": link a URL, #id, or a page as <name>.md`,
		},
		{
			"# A\n\nSee [b](../x.md).\n",
			`x.md:3: link "../x.md": link a URL, #id, or a page as <name>.md`,
		},
	} {
		_, err := parseDoc("docs/x.md", []byte(tt.src))
		want := "internal/site/docs/" + tt.err
		if err == nil || err.Error() != want {
			t.Errorf("source %q:\n got error %v\nwant error %s", tt.src, err, want)
		}
	}
}

// TestAPITable tests the row IDs, the "none" of empty cells, and the flags
// of an API table.
func TestAPITable(t *testing.T) {
	d := mustParseDoc(t, "# A\n\n## Reference\n\n### States {#item-states}\n\n"+
		"| Name | Description |\n| --- | --- |\n| `:state(open)` | Open. |\n\n"+
		"### Attributes\n\n"+
		"| Name | Type | Default | Description |\n"+
		"| --- | --- | --- | --- |\n"+
		"| `open` | `boolean`, reflected, observed | |"+
		" Opens it, see [`:state(open)`](#item-states-open). |\n")
	var b strings.Builder
	if err := d.render(context.Background(), &b); err != nil {
		t.Fatal(err)
	}
	html := b.String()
	for _, want := range []string{
		`<tr id="item-states-open">`,
		`<tr id="attributes-open">`,
		`<td data-label="Default">none</td>`,
		`<span class="api-type"><code>boolean</code><neo-tooltip text="Reflected:`,
		`</neo-tooltip><neo-tooltip text="Observed:`,
		`<a href="#item-states-open"><code>:state(open)</code></a>`,
	} {
		if !strings.Contains(html, want) {
			t.Errorf("no %s in\n%s", want, html)
		}
	}
	if strings.Contains(html, "reflected, observed") {
		t.Errorf("flags left in the Type cell:\n%s", html)
	}
}

// TestMarkdownCopy tests that the Markdown copy expands example blocks,
// keeps only the playground states no example block shows, and rewrites
// page links relative to the copy.
func TestMarkdownCopy(t *testing.T) {
	d := mustParseDoc(t, "# A\n\nSee [b](b.md#x) and [c](c.md).\n\n"+
		"```playground\n- button_default: Default\n- button_variants: Variants\n```\n\n"+
		"## Examples\n\n```example button_variants\n```\n\nEnd.\n")
	b, err := parseDoc("docs/b.md", []byte("# B\n\n## X\n"))
	if err != nil {
		t.Fatal(err)
	}
	ds := &Docs{byPath: map[string]*doc{d.path: d, b.path: b}}
	got := string(ds.markdownCopy(d))
	defaultHTML := mustExample(t, "button_default").html
	variants := mustExample(t, "button_variants").markdown()
	want := "# A\n\nSee [b](../b/index.md#x) and [c](../c/).\n\n" +
		"```html\n" + defaultHTML + "\n```\n\n" +
		"## Examples\n\n" + variants + "\nEnd.\n"
	if got != want {
		t.Errorf("copy:\n%s\nwant:\n%s", got, want)
	}
	if !strings.Contains(variants, "```templ\npackage examples") {
		t.Errorf("no templ block in the example copy:\n%s", variants)
	}
}

// TestFenceEnd tests the end of fenced code blocks, including a longer
// closing fence and a block the document end closes.
func TestFenceEnd(t *testing.T) {
	for _, tt := range []struct {
		src  string
		want int
	}{
		{
			"```a\n```\nrest",
			9,
		},
		{
			"````a\n```\n`````\nrest",
			16,
		},
		{
			"~~~a\nx\n~~~",
			10,
		},
		{
			"```a\nx\n",
			7,
		},
	} {
		if got := fenceEnd([]byte(tt.src), 0); got != tt.want {
			t.Errorf("fenceEnd(%q) = %d, want %d", tt.src, got, tt.want)
		}
	}
}

func mustParseDoc(t *testing.T, src string) *doc {
	t.Helper()
	d, err := parseDoc("docs/x.md", []byte(src))
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func mustExample(t *testing.T, name string) docExample {
	t.Helper()
	ex, err := loadExample(name)
	if err != nil {
		t.Fatal(err)
	}
	return ex
}

// TestGuidePage tests that a page outside [ComponentGroups] keeps the ID of
// its title, that its first paragraph is the .intro and the rest of its prose
// is plain, and that its external links open in a new tab.
func TestGuidePage(t *testing.T) {
	d := mustParseDoc(t,
		"# Some guide\n\nIntro.\n\n"+
			"Read [Datastar](https://data-star.dev) and [x](#some-guide).\n\n- Item\n")
	if d.component {
		t.Fatal("docs/x.md is a component page")
	}
	var b strings.Builder
	if err := d.render(context.Background(), &b); err != nil {
		t.Fatal(err)
	}
	html := b.String()
	for _, want := range []string{
		`<h2 id="some-guide" class="anchor-h2">`,
		`<p class="intro">Intro.</p>`,
		`<p>Read <a target="_blank" href="https://data-star.dev">` +
			`Datastar<svg class="inline-link-icon"`,
		`</svg></a> and <a href="#some-guide">x</a>.</p>`,
		"<ul>\n<li>Item</li>",
	} {
		if !strings.Contains(html, want) {
			t.Errorf("no %s in\n%s", want, html)
		}
	}
}

// TestAlert tests that a GitHub alert renders as a <neo-alert> with its
// optional title, and that a broken alert fails the build.
func TestAlert(t *testing.T) {
	for _, tt := range []struct{ src, want, notWant string }{
		{
			"> [!NOTE]\n> ### Title `x`\n>\n> Body [b](#a).\n",
			`<h3 data-neo-alert-title>Title <code>x</code></h3>` +
				`<p data-neo-alert-description>Body <a href="#a">b</a>.</p>`,
			"",
		},
		{
			"> [!NOTE]\n> Body.\n",
			`<p data-neo-alert-description>Body.</p>`,
			"data-neo-alert-title",
		},
		{
			"> Quote.\n",
			"<blockquote>\n<p>Quote.</p>\n</blockquote>",
			"neo-alert",
		},
	} {
		d := mustParseDoc(t, "# A\n\n"+tt.src)
		var b strings.Builder
		if err := d.render(context.Background(), &b); err != nil {
			t.Fatal(err)
		}
		html := b.String()
		if !strings.Contains(html, tt.want) ||
			tt.notWant != "" && strings.Contains(html, tt.notWant) {
			t.Errorf("source %q:\n%s\nwant %s", tt.src, html, tt.want)
		}
		if tt.notWant == "" && !strings.Contains(html, `<neo-alert variant="info"`) {
			t.Errorf("source %q: no info alert in\n%s", tt.src, html)
		}
	}
	for _, tt := range []struct{ src, err string }{
		{
			"> [!TIP]\n> Body.\n",
			"x.md:3: alert kind TIP, want [NOTE WARNING]",
		},
		{
			"> [!NOTE]\n> One.\n>\n> Two.\n",
			"x.md:3: an alert holds an optional heading and 1 paragraph",
		},
		{
			"> [!NOTE]\n> ### Title\n",
			"x.md:3: an alert holds an optional heading and 1 paragraph",
		},
	} {
		_, err := parseDoc("docs/x.md", []byte("# A\n\n"+tt.src))
		if want := "internal/site/docs/" + tt.err; err == nil || err.Error() != want {
			t.Errorf("source %q:\n got error %v\nwant error %s", tt.src, err, want)
		}
	}
}

// TestImage tests that an image of a diagram in static/ renders as its
// inline SVG without a <p>, and that other images fail the build.
func TestImage(t *testing.T) {
	d := mustParseDoc(t,
		"# A\n\nIntro.\n\n![Round trip](../static/action_to_patch.svg)\n")
	var b strings.Builder
	if err := d.render(context.Background(), &b); err != nil {
		t.Fatal(err)
	}
	if html := b.String(); !strings.Contains(html, `</p>
<svg version="1.1"`) {
		t.Errorf("no inline SVG after the intro in\n%s", html)
	}
	for _, tt := range []struct{ src, err string }{
		{
			"![x](img.png)\n",
			`x.md:3: image "img.png": an image is a diagram, ../static/<name>.svg`,
		},
		{
			"![x](../static/icons/x.svg)\n",
			`x.md:3: image "../static/icons/x.svg": ` +
				`an image is a diagram, ../static/<name>.svg`,
		},
		{
			"![x](../static/none.svg)\n",
			`x.md:3: image "../static/none.svg": no internal/site/static/none.svg`,
		},
	} {
		_, err := parseDoc("docs/x.md", []byte("# A\n\n"+tt.src))
		if want := "internal/site/docs/" + tt.err; err == nil || err.Error() != want {
			t.Errorf("source %q:\n got error %v\nwant error %s", tt.src, err, want)
		}
	}
}

// TestExampleBlockScript tests that the page loads the script attribute's
// module once for 2 blocks, that wrap puts a <div> around the preview, and
// that the copy shows the script and drops the page's <script> blocks.
func TestExampleBlockScript(t *testing.T) {
	const ex = "```example datastar_morph\nwrap: w" +
		"\nscript: sim/frameworks/accent.js\n```\n\n"
	d := mustParseDoc(t, "# A\n\n"+ex+ex+
		"<script type=\"module\" src=\"/static/react-demo.js\"></script>\n\nEnd.\n")
	var b strings.Builder
	if err := d.render(context.Background(), &b); err != nil {
		t.Fatal(err)
	}
	html := b.String()
	load := `<script type="module" src="/static/sim/frameworks/accent.js"></script>`
	if n := strings.Count(html, load); n != 1 {
		t.Errorf("%d script elements, want 1", n)
	}
	if !strings.Contains(html, `<div class="w"><div id="fw-accent"`) {
		t.Errorf("no wrapped preview in\n%s", html)
	}
	if !strings.Contains(html, `Server script`) {
		t.Errorf("no Server script tab in\n%s", html)
	}
	ds := &Docs{byPath: map[string]*doc{d.path: d}}
	copy := string(ds.markdownCopy(d))
	if strings.Contains(copy, "react-demo.js") {
		t.Errorf("page script in the copy:\n%s", copy)
	}
	if strings.Count(copy, "```js\nimport sim from") != 2 ||
		!strings.HasSuffix(copy, "```\n\nEnd.\n") {
		t.Errorf("copy:\n%s", copy)
	}
}

// TestExampleDir tests that a directory example shows preview.html in the viewport,
// fills the tabs from its other files, and loads its .js once per page, inline.
func TestExampleDir(t *testing.T) {
	useExamples(t, fstest.MapFS{
		"app/preview.html":  {Data: []byte(`<div id="mount"></div>`)},
		"app/index.html":    {Data: []byte(`<script src="/src/main.tsx"></script>`)},
		"app/App.tsx":       {Data: []byte(`export function App() {}`)},
		"app/types.d.ts":    {Data: []byte(`declare module "x" {}`)},
		"app/server.js":     {Data: []byte(`sim.post("/app/");`)},
		"app/app.css":       {Data: []byte(`#mount { color: red; }`)},
		"bare/preview.html": {Data: []byte(`<p>bare</p>`)},
	})
	const ex = "```example app\ntab: tsx\n```\n\n"
	d := mustParseDoc(t, "# A\n\n"+ex+ex+"```example bare\n```\n")
	var b strings.Builder
	if err := d.render(context.Background(), &b); err != nil {
		t.Fatal(err)
	}
	html := b.String()
	if n := strings.Count(
		html, `<script type="module">sim.post("/app/");</script>`,
	); n != 1 {
		t.Errorf("%d inline scripts, want 1", n)
	}
	for _, want := range []string{
		`<div id="mount"></div>`,
		`<template>export function App() {}</template>`,
		`<template>declare module &#34;x&#34; {}</template>`,
		`<template>&lt;script src=&#34;/src/main.tsx&#34;&gt;&lt;/script&gt;</template>`,
		`<template>sim.post(&#34;/app/&#34;);</template>`,
		`<template>&lt;p&gt;bare&lt;/p&gt;</template>`,
	} {
		if !strings.Contains(html, want) {
			t.Errorf("no %s in\n%s", want, html)
		}
	}
	ds := &Docs{byPath: map[string]*doc{d.path: d}}
	copy := string(ds.markdownCopy(d))
	for _, want := range []string{
		"```html\n<script src",
		"```tsx\n",
		"```ts\n",
		"```css\n",
		"```js\nsim.post",
		"```html\n<p>bare</p>",
	} {
		if !strings.Contains(copy, want) {
			t.Errorf("no %q in the copy:\n%s", want, copy)
		}
	}
	if strings.Contains(copy, `<div id="mount">`) {
		t.Errorf("preview.html in the copy:\n%s", copy)
	}
}

// TestExampleDirErrors tests that a broken directory example fails the build.
func TestExampleDirErrors(t *testing.T) {
	useExamples(t, fstest.MapFS{
		"nopreview/index.html": {Data: []byte(`x`)},
		"twots/preview.html":   {Data: []byte(`x`)},
		"twots/a.ts":           {Data: []byte(`a`)},
		"twots/b.d.ts":         {Data: []byte(`b`)},
		"templ/preview.html":   {Data: []byte(`x`)},
		"templ/x.templ":        {Data: []byte(`x`)},
		"endtag/preview.html":  {Data: []byte(`x`)},
		"endtag/s.js":          {Data: []byte(`"</script>"`)},
		"js/preview.html":      {Data: []byte(`x`)},
		"js/s.js":              {Data: []byte(`x`)},
		"unregistered.templ":   {Data: []byte(`templ Unregistered() {}`)},
	})
	for _, tt := range []struct{ src, err string }{
		{
			"```example nopreview\n```\n",
			`3: example "nopreview": no nopreview/preview.html`,
		},
		{
			"```example twots\n```\n",
			`3: example "twots": 2 .ts files`,
		},
		{
			"```example templ\n```\n",
			`3: example "templ": templ/x.templ is not .html, .css, .tsx, .ts or .js`,
		},
		{
			"```example endtag\n```\n",
			`3: example "endtag": its .js file holds </script`,
		},
		{
			"```example js\nscript: sim/frameworks/accent.js\n```\n",
			`4: example "js" has a .js file and a script option`,
		},
		{
			"```example unregistered\n```\n",
			`3: example "unregistered": add its template to examples.Templates`,
		},
		{
			"```playground\n- js: JS\n```\n",
			`4: example "js" has a .js file, which a playground doesn't load`,
		},
	} {
		_, err := parseDoc("docs/x.md", []byte("# A\n\n"+tt.src))
		want := "internal/site/docs/x.md:" + tt.err
		if err == nil || err.Error() != want {
			t.Errorf("source %q:\n got error %v\nwant error %s", tt.src, err, want)
		}
	}
}

// useExamples replaces the example files with fsys for the test.
func useExamples(t *testing.T, fsys fs.FS) {
	old := exampleSources
	exampleSources = fsys
	t.Cleanup(func() { exampleSources = old })
}

// TestSourceBlock tests that a code block that names a file shows that file
// in the read-only editor, as a code block with a body shows its body,
// and that the copy expands the file.
func TestSourceBlock(t *testing.T) {
	d := mustParseDoc(t,
		"# A\n\n```css ../examples/theming_body.css\n```\n\n```go\nx := 1\n```\n")
	var b strings.Builder
	if err := d.render(context.Background(), &b); err != nil {
		t.Fatal(err)
	}
	html := b.String()
	for _, want := range []string{
		`<div class="theming-source">` +
			`<site-codemirror language="css" readonly lazy><template>body {`,
		`<div class="theming-source">` +
			`<site-codemirror language="go" readonly lazy><template>x := 1</template>`,
	} {
		if !strings.Contains(html, want) {
			t.Errorf("no %s in\n%s", want, html)
		}
	}
	ds := &Docs{byPath: map[string]*doc{d.path: d}}
	if copy := string(ds.markdownCopy(d)); !strings.HasPrefix(
		copy, "# A\n\n```css\nbody {\n",
	) {
		t.Errorf("copy:\n%s", copy)
	}
	for _, tt := range []struct{ src, err string }{
		{
			"```css ../examples/theming_body.css\nx\n```\n",
			"x.md:3: a source block names 1 file and has no body",
		},
		{
			"```css a b\n```\n",
			"x.md:3: a source block names 1 file and has no body",
		},
		{
			"```css style.css\n```\n",
			"x.md:3: source style.css: want ../static/<file> or ../examples/<file>",
		},
		{
			"```css ../static/none.css\n```\n",
			"x.md:3: source ../static/none.css: no internal/site/static/none.css",
		},
	} {
		_, err := parseDoc("docs/x.md", []byte("# A\n\n"+tt.src))
		if want := "internal/site/docs/" + tt.err; err == nil || err.Error() != want {
			t.Errorf("source %q:\n got error %v\nwant error %s", tt.src, err, want)
		}
	}
}

// TestExampleNoTabs tests that "tabs: none" shows the preview without source
// tabs, and that the copy leaves the block out.
func TestExampleNoTabs(t *testing.T) {
	d := mustParseDoc(t,
		"# A\n\nIntro.\n\n```example theming_swatches\ntabs: none\n```\n\nEnd.\n")
	var b strings.Builder
	if err := d.render(context.Background(), &b); err != nil {
		t.Fatal(err)
	}
	if html := b.String(); !strings.Contains(html, `<div class="theming-swatches">`) ||
		strings.Contains(html, "demo-frame-footer") {
		t.Errorf("want the preview without tabs in\n%s", html)
	}
	ds := &Docs{byPath: map[string]*doc{d.path: d}}
	if copy := string(ds.markdownCopy(d)); copy != "# A\n\nIntro.\n\nEnd.\n" {
		t.Errorf("copy:\n%s", copy)
	}
	_, err := parseDoc("docs/x.md",
		[]byte("# A\n\n```example theming_swatches\ntabs: templ\n```\n"))
	if want := `internal/site/docs/x.md:4: tabs templ, want none or some of ["html"]`; err == nil ||
		err.Error() != want {
		t.Errorf("got error %v, want %s", err, want)
	}
}

// TestAPITableByColumns tests that a table with the columns of only 1 API
// kind is an API table under any heading, with row IDs after that heading,
// and that a Name | Description table there is a site table without IDs.
func TestAPITableByColumns(t *testing.T) {
	d := mustParseDoc(t, "# A\n\n### Kit-wide {#kit}\n\nText.\n\n"+
		"| Name | Default | Description |\n| --- | --- | --- |\n| `--x` | `1` | X. |\n\n"+
		"| Name | Description |\n| --- | --- |\n| a | b |\n")
	var b strings.Builder
	if err := d.render(context.Background(), &b); err != nil {
		t.Fatal(err)
	}
	html := b.String()
	for _, want := range []string{
		`<h3 id="kit" class="anchor-h3">Kit-wide`,
		`<table class="api-table" data-icon="braces">`,
		`<tr id="kit-x">`,
		`<table class="api-table"><thead><tr><th scope="col">Name</th><th scope="col">Description</th>`,
		`<tr><th scope="row" data-label="Name">a</th><td data-label="Description">b</td></tr>`,
	} {
		if !strings.Contains(html, want) {
			t.Errorf("no %s in\n%s", want, html)
		}
	}
}
