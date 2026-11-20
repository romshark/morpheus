package site

import "strings"

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

// docItemID is the id of 1 API table row: sectionID plus the item name
// [slugify]'d, e.g. "css-variables-neo-sortable-drag-shadow".
// The unnamed slot is "default".
func docItemID(sectionID, name string) string {
	s := slugify(name)
	if s == "" {
		s = "default"
	}
	return sectionID + "-" + s
}

// slugify reduces s to lowercase [a-z0-9] runs joined by "-".
func slugify(s string) string {
	var b strings.Builder
	sep := false
	for _, r := range strings.ToLower(s) {
		if ('a' <= r && r <= 'z') || ('0' <= r && r <= '9') {
			if sep && b.Len() > 0 {
				b.WriteByte('-')
			}
			sep = false
			b.WriteRune(r)
		} else {
			sep = true
		}
	}
	return b.String()
}
