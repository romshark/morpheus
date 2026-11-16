package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"slices"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

// searchIndexPage lists the anchored sections of 1 page. Path carries the
// -base prefix like the rewritten page links, which lets
// <site-command-palette> match it against the href of its page rows.
type searchIndexPage struct {
	Path     string               `json:"path"`
	Sections []searchIndexSection `json:"sections"`
}

type searchIndexSection struct {
	ID    string            `json:"id"`
	Title string            `json:"title"`
	Items []searchIndexItem `json:"items,omitempty"`
}

// searchIndexItem is 1 row of an API table (attribute, event, CSS
// variable, ...) under its section.
type searchIndexItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// writeSearchIndex writes the section index <site-command-palette> fetches
// on first open. The palette bakes only page rows into each page, because
// 1 row per heading and API item would add thousands of rows to every page.
func writeSearchIndex(path string, pages []pageEntry, base string) error {
	index := make([]searchIndexPage, 0, len(pages))
	for _, p := range pages {
		sections, err := pageSections(p.Body)
		if err != nil {
			return fmt.Errorf("page %s: %w", p.URLPath, err)
		}
		if len(sections) == 0 {
			continue
		}
		index = append(index, searchIndexPage{
			Path: base + p.URLPath, Sections: sections,
		})
	}
	b, err := json.Marshal(index)
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0o644)
}

// pageSections returns the anchored h2/h3 headings of a rendered page in
// document order, each with the API table rows that follow it. An API
// heading (Attributes, Events, ...) is prefixed with the last api-element
// heading before it, because pages that document several elements repeat
// these titles once per element.
func pageSections(body []byte) ([]searchIndexSection, error) {
	doc, err := html.Parse(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	var sections []searchIndexSection
	var element string
	for n := range doc.Descendants() {
		if n.Type != html.ElementNode {
			continue
		}
		if n.DataAtom == atom.Tr {
			if item, ok := apiItem(n); ok && len(sections) > 0 {
				s := &sections[len(sections)-1]
				s.Items = append(s.Items, item)
			}
			continue
		}
		if n.DataAtom != atom.H2 && n.DataAtom != atom.H3 {
			continue
		}
		class := strings.Fields(attr(n, "class"))
		if slices.Contains(class, "api-element") {
			element = headingText(n)
			continue
		}
		if !slices.Contains(class, "anchor-h2") && !slices.Contains(class, "anchor-h3") {
			continue
		}
		id, title := attr(n, "id"), headingText(n)
		if id == "" || title == "" {
			continue
		}
		if element != "" && slices.Contains(class, "api-heading") {
			title = element + " › " + title
		}
		sections = append(sections, searchIndexSection{ID: id, Title: title})
	}
	return sections, nil
}

// apiItem reports the id and row header text of tr when it is an
// identified row of an api-table.
func apiItem(tr *html.Node) (searchIndexItem, bool) {
	id := attr(tr, "id")
	if id == "" {
		return searchIndexItem{}, false
	}
	table := tr.Parent
	for table != nil && table.DataAtom != atom.Table {
		table = table.Parent
	}
	if table == nil || !slices.Contains(strings.Fields(attr(table, "class")), "api-table") {
		return searchIndexItem{}, false
	}
	for c := range tr.ChildNodes() {
		if c.DataAtom == atom.Th && attr(c, "scope") == "row" {
			return searchIndexItem{ID: id, Name: headingText(c)}, true
		}
	}
	return searchIndexItem{}, false
}

// headingText returns the text of heading or row header h without its
// permalink, with runs of whitespace collapsed to 1 space.
func headingText(h *html.Node) string {
	var b strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		for c := range n.ChildNodes() {
			switch c.Type {
			case html.TextNode:
				b.WriteString(c.Data)
			case html.ElementNode:
				class := strings.Fields(attr(c, "class"))
				if slices.Contains(class, "anchor-h2-link") ||
					slices.Contains(class, "anchor-h3-link") ||
					slices.Contains(class, "api-row-link") {
					continue
				}
				walk(c)
			}
		}
	}
	walk(h)
	return strings.Join(strings.Fields(b.String()), " ")
}

func attr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Namespace == "" && a.Key == key {
			return a.Val
		}
	}
	return ""
}
