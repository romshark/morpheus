package neo

import "strings"

// BoundaryScopes selects which overlay concerns a <neo-boundary> owns.
// The zero value keeps the element default (dismiss + positioning) and
// emits no attribute; any non-zero field emits an explicit scope="…"
// token list that replaces the default. NoDismiss / NoPositioning drop a
// default scope; Scroll / Stacking add an opt-in one.
type BoundaryScopes struct {
	NoDismiss     bool
	NoPositioning bool
	Scroll        bool
	Stacking      bool
}

// scope renders the space-separated token list, or "" for the element
// default (no attribute).
func (s BoundaryScopes) scope() string {
	if s == (BoundaryScopes{}) {
		return ""
	}
	var tokens []string
	if !s.NoDismiss {
		tokens = append(tokens, "dismiss")
	}
	if !s.NoPositioning {
		tokens = append(tokens, "positioning")
	}
	if s.Scroll {
		tokens = append(tokens, "scroll")
	}
	if s.Stacking {
		tokens = append(tokens, "stacking")
	}
	return strings.Join(tokens, " ")
}

// BoundaryOpts is the typed attribute surface for <neo-boundary>.
type BoundaryOpts struct {
	Scopes Attr[BoundaryScopes]
}
