package site

import (
	"context"
	"strings"

	"github.com/a-h/templ"
	"golang.org/x/net/html"

	"github.com/romshark/morpheus/internal/site/htmlfmt"
)

// Single source for demo examples: each is one templ function under
// examples/, driving the live preview and the rendered HTML tab; its
// .templ file is embedded verbatim for the Templ tab.

func renderExampleHTML(c templ.Component) string {
	var b strings.Builder
	if err := c.Render(context.Background(), &b); err != nil {
		panic(err)
	}
	return htmlfmt.Format(collapseInlinedIcons(strings.TrimSpace(b.String())))
}

// collapseInlinedIcons restores each <neo-icon> to the form an author
// writes. neo.Icon server-inlines the SVG body (tagged with
// data-neo-icon-base) to kill the first-paint fetch flash; in a copy-paste
// source tab that inlined markup is noise, so drop the SVG and the
// server-only base hint, leaving <neo-icon name="…">. Tokens outside a
// <neo-icon> are emitted verbatim so bare boolean attributes survive.
func collapseInlinedIcons(s string) string {
	if !strings.Contains(s, "<neo-icon") {
		return s
	}
	var b strings.Builder
	z := html.NewTokenizer(strings.NewReader(s))
	depth := 0 // >0 while inside a <neo-icon> subtree
	for {
		tt := z.Next()
		if tt == html.ErrorToken {
			break
		}
		name, hasAttr := z.TagName()
		tag := string(name)
		switch tt {
		case html.StartTagToken:
			if tag == "neo-icon" {
				if depth == 0 {
					b.WriteString(cleanIconOpen(z, hasAttr))
				}
				depth++
				continue
			}
		case html.EndTagToken:
			if tag == "neo-icon" {
				depth--
				if depth == 0 {
					b.WriteString("</neo-icon>")
				}
				continue
			}
		}
		if depth == 0 {
			b.Write(z.Raw())
		}
	}
	return b.String()
}

// cleanIconOpen rebuilds a <neo-icon> start tag from its attributes,
// dropping the server-only data-neo-icon-base hint.
func cleanIconOpen(z *html.Tokenizer, hasAttr bool) string {
	var b strings.Builder
	b.WriteString("<neo-icon")
	for hasAttr {
		var k, v []byte
		k, v, hasAttr = z.TagAttr()
		if string(k) == "data-neo-icon-base" {
			continue
		}
		b.WriteByte(' ')
		b.Write(k)
		b.WriteString(`="`)
		b.WriteString(html.EscapeString(string(v)))
		b.WriteByte('"')
	}
	b.WriteByte('>')
	return b.String()
}
