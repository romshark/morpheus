package site

import "github.com/a-h/templ"

type DocAttribute struct {
	Name    string
	Type    string
	Default string
	// Reflected marks an attribute the component writes back to the DOM
	// as its state changes (internal -> attribute). Observed marks one the
	// component reacts to when changed from outside, e.g. author, morph, or
	// framework binding (attribute -> internal). Independent: an attribute
	// can be both, either, or neither. Each renders a badge in the Type
	// column.
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

// docSectionID joins an optional Prefix with a section name to
// produce the `id` (and URL fragment) of a ComponentDocs subsection.
// Empty prefix yields just `name`.
func docSectionID(prefix, name string) string {
	if prefix == "" {
		return name
	}
	return prefix + "-" + name
}

type ComponentDoc struct {
	// Prefix namespaces the per-section anchored h3 ids when more than
	// one ComponentDoc renders on the same page (e.g. menu / menuitem /
	// submenu on /menu/). Empty Prefix yields "attributes" / "slots" /
	// "events"; a non-empty Prefix yields "<prefix>-attributes" etc.
	Prefix     string
	Attributes []DocAttribute
	Slots      []DocSlot
	Events     []DocEvent
	Parts      []DocPart
	CSSProps   []DocCSSProp
}
