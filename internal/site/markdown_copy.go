package site

import (
	"bytes"
	"slices"
	"strings"

	"github.com/yuin/goldmark/v2/ast"
)

// markdownCopy returns the Markdown copy of d, see [Docs.Markdown].
// Its links are relative, which keeps them working under the -base prefix
// of internal/cmd/gen.
func (ds *Docs) markdownCopy(d *doc) []byte {
	type edit struct {
		start, stop int
		text        string
	}
	var edits []edit
	// Links that use 1 reference definition share a destination.
	seen := make(map[int]bool)
	for _, l := range d.links {
		if l.dest.IsEmpty() || seen[l.dest.Start] {
			continue
		}
		seen[l.dest.Start] = true
		target := l.path
		if _, ok := ds.byPath[l.path]; ok {
			target += "index.md"
		}
		u := relURL(d.path, target)
		if l.fragment != "" {
			u += "#" + l.fragment
		}
		edits = append(edits, edit{l.dest.Start, l.dest.Stop, u})
	}

	shown := make(map[string]bool)
	for _, blk := range d.blocks {
		if e, ok := blk.(*exampleBlock); ok {
			shown[e.ex.name] = true
		}
	}
	// A <script> block loads code for the page, and a <template> block holds
	// a response of the in-browser server simulator. Neither is content.
	for n := d.root.FirstChild(); n != nil; n = n.NextSibling() {
		h, ok := n.(*ast.HTMLBlock)
		if !ok {
			continue
		}
		first := bytes.TrimSpace(h.Value.Bytes(d.src))
		if !bytes.HasPrefix(first, []byte("<script")) && !bytes.HasPrefix(first, []byte("<template")) {
			continue
		}
		segs := h.Value.Segments()
		last := segs[len(segs)-1]
		stop := lineEnd(d.src, max(last.Start, last.Stop-1))
		edits = append(edits, edit{n.Pos(), skipBlankLine(d.src, stop), ""})
	}
	for n, blk := range d.blocks {
		var repl string
		switch blk := blk.(type) {
		case *exampleBlock:
			repl = blk.markdown()
		case *sourceBlock:
			var b strings.Builder
			writeFence(&b, blk.lang, d.versioned(blk.code))
			repl = b.String()
		case *playgroundBlock:
			// The playground is interactive only. Keep the states,
			// such as the Default, that no example block shows.
			var parts []string
			for _, ex := range blk.states {
				if !shown[ex.name] {
					parts = append(parts, ex.markdown())
				}
			}
			repl = strings.Join(parts, "\n")
		default:
			continue
		}
		start := n.Pos()
		stop := fenceEnd(d.src, start)
		if repl == "" {
			stop = skipBlankLine(d.src, stop)
		}
		edits = append(edits, edit{start, stop, repl})
	}

	slices.SortFunc(edits, func(a, b edit) int { return a.start - b.start })
	var b bytes.Buffer
	last := 0
	for _, e := range edits {
		b.Write(d.src[last:e.start])
		b.WriteString(e.text)
		last = e.stop
	}
	b.Write(d.src[last:])
	return b.Bytes()
}

// fenceEnd returns the offset after the closing fence line of the fenced
// code block whose opening fence line starts at start, or len(src) for a
// block that the document end closes.
func fenceEnd(src []byte, start int) int {
	first, _, _ := bytes.Cut(src[start:], []byte("\n"))
	open := bytes.TrimLeft(first, " ")
	marker := open[0]
	n := len(open) - len(bytes.TrimLeft(open, string(marker)))
	off := start + len(first) + 1
	for off < len(src) {
		line, _, _ := bytes.Cut(src[off:], []byte("\n"))
		next := off + len(line) + 1
		t := bytes.TrimSpace(line)
		if len(t) >= n && len(bytes.Trim(t, string(marker))) == 0 {
			return min(next, len(src))
		}
		off = next
	}
	return len(src)
}

// lineEnd returns the offset after the end of the line holding offset i.
func lineEnd(src []byte, i int) int {
	if j := bytes.IndexByte(src[i:], '\n'); j >= 0 {
		return i + j + 1
	}
	return len(src)
}

// skipBlankLine returns the offset after the empty line at i, or i if the line
// at i is not empty. A block removed with it leaves 1 blank line between its neighbors.
func skipBlankLine(src []byte, i int) int {
	if bytes.HasPrefix(src[i:], []byte("\n")) {
		return i + 1
	}
	return i
}

// relURL returns the URL of the page or file at target relative to the
// Markdown copy of the page at from: "../button-group/" from "/button/".
func relURL(from, target string) string {
	depth := strings.Count(strings.Trim(from, "/"), "/") + 1
	if from == "/" {
		depth = 0
	}
	return strings.Repeat("../", depth) + strings.TrimPrefix(target, "/")
}
