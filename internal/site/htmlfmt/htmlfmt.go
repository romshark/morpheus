// Package htmlfmt pretty-prints compact HTML for the doc-site source tabs.
//
// templ emits HTML on a single line; this re-indents it. x/net/html
// tokenizes (handling quotes, raw-text elements, comments, entities); the
// rest is a width-based indent pass. An element whose whole subtree fits on
// one line stays inline; a longer one breaks each child onto its own line.
// Prose (an element with direct text) flows its inline content instead of
// stacking it, unless it wraps a structural child too wide to inline, which
// forces a stack. A start tag wider than the target wraps one attribute per
// line.
package htmlfmt

import (
	"strings"

	"golang.org/x/net/html"
)

// width is the target line length: start tags and subtrees wider than this
// wrap. Prose content still flows past it (a paragraph is never stacked).
const width = 80

var voidTags = map[string]bool{
	"area": true, "base": true, "br": true, "col": true, "embed": true,
	"hr": true, "img": true, "input": true, "link": true, "meta": true,
	"param": true, "source": true, "track": true, "wbr": true,
}

var rawTextTags = map[string]bool{
	"script": true, "style": true, "textarea": true, "pre": true,
}

type node struct {
	isText   bool
	text     string // raw text / comment / doctype (entities preserved)
	rawOpen  string // start tag, verbatim (preserves attribute values)
	tag      string // lowercased tag name
	void     bool
	children []*node
}

// Format re-indents compact HTML into the doc-site source-tab layout.
func Format(s string) string {
	z := html.NewTokenizer(strings.NewReader(s))
	root := &node{}
	stack := []*node{root}
	cur := func() *node { return stack[len(stack)-1] }
	for {
		tt := z.Next()
		if tt == html.ErrorToken {
			break
		}
		switch tt {
		case html.TextToken, html.CommentToken, html.DoctypeToken:
			cur().children = append(cur().children, &node{isText: true, text: string(z.Raw())})
		case html.StartTagToken, html.SelfClosingTagToken:
			raw := string(z.Raw())
			name, _ := z.TagName()
			n := &node{rawOpen: raw, tag: strings.ToLower(string(name))}
			n.void = tt == html.SelfClosingTagToken || voidTags[n.tag]
			cur().children = append(cur().children, n)
			if !n.void {
				stack = append(stack, n)
			}
		case html.EndTagToken:
			name, _ := z.TagName()
			tag := strings.ToLower(string(name))
			for i := len(stack) - 1; i >= 1; i-- {
				if stack[i].tag == tag {
					stack = stack[:i]
					break
				}
			}
		}
	}
	var b strings.Builder
	for _, n := range root.children {
		writeNode(&b, n, 0)
	}
	return strings.TrimRight(b.String(), "\n")
}

func writeNode(b *strings.Builder, n *node, depth int) {
	ind := strings.Repeat("  ", depth)
	if n.isText {
		if t := strings.TrimSpace(collapseWS(n.text)); t != "" {
			b.WriteString(ind + t + "\n")
		}
		return
	}
	if n.void {
		writeOpenTag(b, ind, n.rawOpen)
		return
	}
	if rawTextTags[n.tag] {
		body := strings.Trim(rawText(n), "\n")
		if !strings.Contains(body, "\n") {
			b.WriteString(ind + n.rawOpen + strings.TrimSpace(body) + "</" + n.tag + ">\n")
			return
		}
		b.WriteString(ind + n.rawOpen + "\n")
		for _, line := range dedentRawLines(body) {
			if line == "" {
				b.WriteString("\n")
				continue
			}
			b.WriteString(ind + "  " + line + "\n")
		}
		b.WriteString(ind + "</" + n.tag + ">\n")
		return
	}
	inline := serializeInline(n)
	openTagFits := len(ind)+len(n.rawOpen) <= width
	// Prose flows its inline content on one line, but only when it is a real
	// paragraph; a direct-text element wrapping a structural child too wide to
	// inline (e.g. a handle <span> nesting a <neo-icon>) is a container, so it
	// stacks instead of emitting one very long line.
	flowProse := hasDirectText(n) && !hasStructuralOversizedChild(n, len(ind)+2)
	// Whole element on one line: its open tag fits and either it flows as
	// prose or the entire subtree fits the width.
	if openTagFits && !strings.Contains(inline, "\n") &&
		(flowProse || len(ind)+len(inline) <= width) {
		b.WriteString(ind + inline + "\n")
		return
	}
	switch {
	case !hasRenderableChildren(n):
		// Empty element: wrap the attribute list, close on the bracket line.
		if writeAttrHead(b, ind, n.rawOpen) {
			b.WriteString(ind + "></" + n.tag + ">\n")
		} else {
			b.WriteString(ind + n.rawOpen + "</" + n.tag + ">\n")
		}
	case flowProse:
		// Prose with an oversized open tag: wrap the attributes, then flow
		// the inline content on the bracket line so the text stays intact.
		if writeAttrHead(b, ind, n.rawOpen) {
			var sb strings.Builder
			for _, c := range n.children {
				sb.WriteString(serializeInline(c))
			}
			b.WriteString(ind + ">" + sb.String() + "</" + n.tag + ">\n")
		} else {
			b.WriteString(ind + inline + "\n")
		}
	default:
		// Container: open tag (attributes wrapped when oversized), then each
		// child on its own line.
		writeOpenTag(b, ind, n.rawOpen)
		for _, c := range n.children {
			writeNode(b, c, depth+1)
		}
		b.WriteString(ind + "</" + n.tag + ">\n")
	}
}

// writeOpenTag emits a start tag, breaking each attribute onto its own line
// when the one-line form would exceed width. The closing bracket sits on its
// own line aligned with the tag.
func writeOpenTag(b *strings.Builder, ind, rawOpen string) {
	if len(ind)+len(rawOpen) <= width {
		b.WriteString(ind + rawOpen + "\n")
		return
	}
	_, _, selfClose, _ := splitStartTag(rawOpen)
	if !writeAttrHead(b, ind, rawOpen) {
		b.WriteString(ind + rawOpen + "\n")
		return
	}
	if selfClose {
		b.WriteString(ind + "/>\n")
	} else {
		b.WriteString(ind + ">\n")
	}
}

// writeAttrHead writes a start tag with one attribute per line, stopping
// before the closing bracket so the caller appends it as ">", "/>",
// "></tag>", or ">…</tag>":
//
//	<tag
//	  attr1
//	  attr2
//
// Returns false (writing nothing) when the tag has no parseable attributes.
func writeAttrHead(b *strings.Builder, ind, rawOpen string) bool {
	name, attrs, _, ok := splitStartTag(rawOpen)
	if !ok || len(attrs) == 0 {
		return false
	}
	b.WriteString(ind + "<" + name + "\n")
	for _, a := range attrs {
		b.WriteString(ind + "  " + a + "\n")
	}
	return true
}

// splitStartTag parses a start tag into its tag name and verbatim attribute
// tokens (each "name" or "name=value", quotes/entities kept), reporting
// whether it self-closes. Quote-aware so values with spaces, "=", or ">"
// don't split. ok is false for anything not shaped like a tag.
func splitStartTag(raw string) (name string, attrs []string, selfClose, ok bool) {
	if len(raw) < 2 || raw[0] != '<' || raw[len(raw)-1] != '>' {
		return "", nil, false, false
	}
	s := raw[1 : len(raw)-1]
	if strings.HasSuffix(s, "/") {
		selfClose = true
		s = s[:len(s)-1]
	}
	i := 0
	for i < len(s) && !isASCIISpace(s[i]) {
		i++
	}
	name = s[:i]
	if name == "" {
		return "", nil, false, false
	}
	s = s[i:]
	for p := 0; p < len(s); {
		for p < len(s) && isASCIISpace(s[p]) {
			p++
		}
		if p >= len(s) {
			break
		}
		start := p
		for p < len(s) && !isASCIISpace(s[p]) && s[p] != '=' {
			p++
		}
		if p < len(s) && s[p] == '=' {
			p++
			if p < len(s) && (s[p] == '"' || s[p] == '\'') {
				q := s[p]
				for p++; p < len(s) && s[p] != q; p++ {
				}
				if p < len(s) {
					p++
				}
			} else {
				for p < len(s) && !isASCIISpace(s[p]) {
					p++
				}
			}
		}
		attrs = append(attrs, s[start:p])
	}
	return name, attrs, selfClose, true
}

func serializeInline(n *node) string {
	if n.isText {
		return collapseWS(n.text)
	}
	if n.void {
		return n.rawOpen
	}
	if rawTextTags[n.tag] {
		return n.rawOpen + rawText(n) + "</" + n.tag + ">"
	}
	var sb strings.Builder
	sb.WriteString(n.rawOpen)
	for _, c := range n.children {
		sb.WriteString(serializeInline(c))
	}
	sb.WriteString("</" + n.tag + ">")
	return sb.String()
}

// dedentRawLines normalizes a multi-line raw-text body (a <style> or <script>
// block carried verbatim from .templ source). Example sources indent with
// tabs, and the block sits a few levels deep in its templ function, so each
// line arrives with that base tab nesting. Strip the common leading tabs (so
// the block doesn't double-indent under the writer's own prefix), then expand
// the remaining per-rule leading tabs to two spaces, matching the 2-space
// scheme of the surrounding HTML. Blank lines collapse to empty; trailing
// whitespace is trimmed.
func dedentRawLines(body string) []string {
	lines := strings.Split(body, "\n")
	prefix := ""
	seen := false
	for _, l := range lines {
		if strings.TrimSpace(l) == "" {
			continue
		}
		lead := l[:len(l)-len(strings.TrimLeft(l, " \t"))]
		if !seen {
			prefix, seen = lead, true
			continue
		}
		prefix = commonPrefix(prefix, lead)
	}
	out := make([]string, 0, len(lines))
	for _, l := range lines {
		l = strings.TrimRight(l, " \t")
		if l == "" {
			out = append(out, "")
			continue
		}
		l = strings.TrimPrefix(l, prefix)
		if n := len(l) - len(strings.TrimLeft(l, "\t")); n > 0 {
			l = strings.Repeat("  ", n) + l[n:]
		}
		out = append(out, l)
	}
	return out
}

func commonPrefix(a, b string) string {
	n := min(len(a), len(b))
	i := 0
	for i < n && a[i] == b[i] {
		i++
	}
	return a[:i]
}

func rawText(n *node) string {
	var sb strings.Builder
	for _, c := range n.children {
		if c.isText {
			sb.WriteString(c.text)
		}
	}
	return sb.String()
}

// hasRenderableChildren reports whether the element has any child that
// produces output: a non-whitespace text node or any element. An element
// without one is empty, so its close tag rides the bracket line.
func hasRenderableChildren(n *node) bool {
	for _, c := range n.children {
		if !c.isText || strings.TrimSpace(c.text) != "" {
			return true
		}
	}
	return false
}

// hasDirectText reports whether the element holds prose: a direct,
// non-whitespace text child. Such elements stay inline so a paragraph
// flows instead of stacking each text run and inline element on its own line.
func hasDirectText(n *node) bool {
	for _, c := range n.children {
		if c.isText && strings.TrimSpace(c.text) != "" {
			return true
		}
	}
	return false
}

// hasStructuralOversizedChild reports whether any element child both nests
// its own element children and is too wide to inline at childIndent. Such a
// child must break onto its own lines, so its direct-text parent is a
// structural container, not a flowing paragraph. A paragraph's inline children
// (text-only <kbd>, <code>, <a>) hold no nested element, so they never qualify
// and prose keeps flowing.
func hasStructuralOversizedChild(n *node, childIndent int) bool {
	for _, c := range n.children {
		if c.isText || c.void || rawTextTags[c.tag] {
			continue
		}
		if hasChildElement(c) && childIndent+len(serializeInline(c)) > width {
			return true
		}
	}
	return false
}

// hasChildElement reports whether the element holds at least one element child.
func hasChildElement(n *node) bool {
	for _, c := range n.children {
		if !c.isText {
			return true
		}
	}
	return false
}

// collapseWS reduces internal whitespace runs to single spaces while keeping
// a single boundary space when the original had one, so inline prose like
// `press <kbd>g</kbd> then` keeps its spacing.
func collapseWS(s string) string {
	if strings.TrimSpace(s) == "" {
		return ""
	}
	lead := isASCIISpace(s[0])
	trail := isASCIISpace(s[len(s)-1])
	core := strings.Join(strings.Fields(s), " ")
	if lead {
		core = " " + core
	}
	if trail {
		core += " "
	}
	return core
}

func isASCIISpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f'
}
