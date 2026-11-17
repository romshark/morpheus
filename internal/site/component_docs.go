package site

import (
	"strings"

	"github.com/a-h/templ"
)

type DocAttribute struct {
	Name    string
	Type    string
	Default string
	// Reflected marks an attribute the component writes back to the DOM
	// as its state changes (internal -> attribute). Observed marks one the
	// component reacts to when changed from outside, e.g. author, morph,
	// or framework binding (attribute -> internal). The flags are independent.
	// An attribute can be both, either, or neither. Each renders a badge in
	// the Type column.
	Reflected   bool
	Observed    bool
	Description templ.Component
}

type DocSlot struct {
	Name        string
	Description templ.Component
}

type DocEvent struct {
	Name        string
	URL         string // if set, Name renders as an external link (W3C / MDN)
	Detail      string
	Bubbles     bool
	Description templ.Component
}

// DocState documents a CSS custom state the component sets on itself as
// its internal state changes. Name is the bare state name; it renders as
// :state(<Name>). States are not attributes. Nothing outside the component
// sets them, and a morph cannot strip them.
type DocState struct {
	Name        string
	Description templ.Component
}

// DocPart documents a shadow ::part() exposed for page CSS. Name is the
// bare part name; it renders as ::part(<Name>).
type DocPart struct {
	Name        string
	Description templ.Component
}

// DocCSSProp documents a CSS custom property the component reads. Name is
// the full property (e.g. "--neo-card-gap"); Default is the fallback value.
type DocCSSProp struct {
	Name        string
	Default     string
	Description templ.Component
}

// Icons of the API table kinds. The API headings show them, and each
// api-table carries its kind's icon in data-icon, which the search index
// passes on to the Mod+K palette rows of the table's items.
const (
	iconAttributes = "parentheses"
	iconStates     = "activity"
	iconSlots      = "chevrons-left-right-ellipsis"
	iconEvents     = "message-square-more"
	iconParts      = "component"
	iconCSSProps   = "braces"
)

// docSectionID joins an optional Prefix with a section name to
// produce the `id` (and URL fragment) of a ComponentDocs subsection.
// Empty prefix yields just `name`.
func docSectionID(prefix, name string) string {
	if prefix == "" {
		return name
	}
	return prefix + "-" + name
}

// docItemID is the id of 1 API table row: sectionID plus the item name
// reduced to lowercase [a-z0-9] runs joined by "-", e.g.
// "css-variables-neo-sortable-drag-shadow". The unnamed slot is "default".
func docItemID(sectionID, name string) string {
	var b strings.Builder
	b.WriteString(sectionID)
	sep := true
	for _, r := range strings.ToLower(name) {
		if ('a' <= r && r <= 'z') || ('0' <= r && r <= '9') {
			if sep {
				b.WriteByte('-')
				sep = false
			}
			b.WriteRune(r)
		} else {
			sep = true
		}
	}
	if b.Len() == len(sectionID) {
		b.WriteString("-default")
	}
	return b.String()
}

type ComponentDoc struct {
	// Prefix namespaces the per-section anchored h3 ids when more than
	// one ComponentDoc renders on the same page (e.g. menu / menuitem /
	// submenu on /menu/). Empty Prefix yields "attributes" / "slots" /
	// "events"; a non-empty Prefix yields "<prefix>-attributes" etc.
	Prefix     string
	Attributes []DocAttribute
	States     []DocState
	Slots      []DocSlot
	Events     []DocEvent
	Parts      []DocPart
	CSSProps   []DocCSSProp
}
