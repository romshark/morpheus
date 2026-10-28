package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// sortablePlaygroundStates omits the group examples. A group is document
// wide: the playground copy and the demo frame copy of one example would
// connect into a single group spanning the page.
func sortablePlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: sortablePlaygroundDefaultHTML},
		{Label: "Sortable list", HTML: sortableListHTML, CSS: sortableListCSS},
		{Label: "Whole-item drag", HTML: sortableWholeHTML, CSS: sortableWholeCSS},
		{Label: "Drag-free control", HTML: sortableNodragHTML, CSS: sortableNodragCSS},
		{Label: "Horizontal row", HTML: sortableRowHTML, CSS: sortableRowCSS},
		{Label: "Grid", HTML: sortableGridHTML, CSS: sortableGridCSS},
		{Label: "Unbounded", HTML: sortableUnboundedHTML, CSS: sortableUnboundedCSS},
		{Label: "Scrollable parent", HTML: sortableScrollableHTML, CSS: sortableScrollableCSS},
		{Label: "Custom move easing", HTML: sortableEasingHTML, CSS: sortableEasingCSS},
		{Label: "Custom placement indicator", HTML: sortablePlaceholderHTML, CSS: sortablePlaceholderCSS},
		{Label: "Disabled", HTML: sortableDisabledHTML, CSS: sortableDisabledCSS},
	}
}

func sortableMorphStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Initial", HTML: sortableMorphInitialHTML},
		{Label: "Same items", HTML: sortableMorphSameHTML},
		{Label: "Different order", HTML: sortableMorphReorderHTML},
		{Label: "Different items", HTML: sortableMorphDifferentHTML},
	}
}

//go:embed examples/sortable_morph_initial.html
var sortableMorphInitialHTML string

//go:embed examples/sortable_morph_same.html
var sortableMorphSameHTML string

//go:embed examples/sortable_morph_reorder.html
var sortableMorphReorderHTML string

//go:embed examples/sortable_morph_different.html
var sortableMorphDifferentHTML string

//go:embed examples/sortable_default.html
var sortablePlaygroundDefaultHTML string

var sortableListHTML = renderExampleHTML(examples.SortableList())

//go:embed examples/sortable_list.templ
var sortableListTempl string

//go:embed examples/sortable_list.css
var sortableListCSS string

var sortableWholeHTML = renderExampleHTML(examples.SortableWhole())

//go:embed examples/sortable_whole.templ
var sortableWholeTempl string

//go:embed examples/sortable_whole.css
var sortableWholeCSS string

var sortableNodragHTML = renderExampleHTML(examples.SortableNodrag())

//go:embed examples/sortable_nodrag.templ
var sortableNodragTempl string

//go:embed examples/sortable_nodrag.css
var sortableNodragCSS string

var sortableRowHTML = renderExampleHTML(examples.SortableRow())

//go:embed examples/sortable_row.templ
var sortableRowTempl string

//go:embed examples/sortable_row.css
var sortableRowCSS string

var sortableGridHTML = renderExampleHTML(examples.SortableGrid())

//go:embed examples/sortable_grid.templ
var sortableGridTempl string

//go:embed examples/sortable_grid.css
var sortableGridCSS string

var sortableEasingHTML = renderExampleHTML(examples.SortableEasing())

//go:embed examples/sortable_easing.templ
var sortableEasingTempl string

//go:embed examples/sortable_easing.css
var sortableEasingCSS string

var sortableUnboundedHTML = renderExampleHTML(examples.SortableUnbounded())

//go:embed examples/sortable_unbounded.templ
var sortableUnboundedTempl string

//go:embed examples/sortable_unbounded.css
var sortableUnboundedCSS string

var sortableScrollableHTML = renderExampleHTML(examples.SortableScrollable())

//go:embed examples/sortable_scrollable.templ
var sortableScrollableTempl string

//go:embed examples/sortable_scrollable.css
var sortableScrollableCSS string

var sortablePlaceholderHTML = renderExampleHTML(examples.SortablePlaceholder())

//go:embed examples/sortable_placeholder.templ
var sortablePlaceholderTempl string

//go:embed examples/sortable_placeholder.css
var sortablePlaceholderCSS string

var sortableDisabledHTML = renderExampleHTML(examples.SortableDisabled())

//go:embed examples/sortable_disabled.templ
var sortableDisabledTempl string

//go:embed examples/sortable_disabled.css
var sortableDisabledCSS string

var sortableDockHTML = renderExampleHTML(examples.SortableDock())

//go:embed examples/sortable_dock.templ
var sortableDockTempl string

//go:embed examples/sortable_dock.css
var sortableDockCSS string

var sortableGroupHTML = renderExampleHTML(examples.SortableGroup())

//go:embed examples/sortable_group.templ
var sortableGroupTempl string

//go:embed examples/sortable_group.css
var sortableGroupCSS string

var sortableGroupRowHTML = renderExampleHTML(examples.SortableGroupRow())

//go:embed examples/sortable_group_row.templ
var sortableGroupRowTempl string

//go:embed examples/sortable_group_row.css
var sortableGroupRowCSS string

var sortableGroupLockedHTML = renderExampleHTML(examples.SortableGroupLocked())

//go:embed examples/sortable_group_locked.templ
var sortableGroupLockedTempl string

//go:embed examples/sortable_group_locked.css
var sortableGroupLockedCSS string
