package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

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

// sortableMorphStates seeds the "Morphing during interaction"
// playground. Autoplay fat-morphs the item list onto the same live
// <neo-sortable> (tolerate-reorder set). "Same items" re-emits the same
// ids in the same order, a literal no-op, so an in-flight drag is
// untouched. "Different order" reorders the same id set, which the kit
// reconciles in place so the drag survives. "Different items" swaps an
// id, which can't map onto the gesture, so the kit cancels the drag.
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

// sortablePlaygroundDefaultHTML is the overview playground's first
// state: four handled, id'd rows with a signal-editable orientation.
//
//go:embed examples/sortable_default.html
var sortablePlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Sortable page's "Examples" section. Each pair is the markup an author
// would copy verbatim (no Datastar wiring), so the snippet stays
// legible next to the rendered, draggable demo.

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

// sortableNodragHTML shows the data-neo-sortable-nodrag escape hatch: a
// whole-item grip whose <neo-switch> stays operable because its wrapper
// is marked nodrag.
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

// sortableScrollableHTML wraps 20 handled rows in an overflow:auto box:
// the sortable clamps the lifted item to the scroll viewport and the
// list scrolls under it. One source drives the Examples demo and the
// playground state.
var sortableScrollableHTML = renderExampleHTML(examples.SortableScrollable())

//go:embed examples/sortable_scrollable.templ
var sortableScrollableTempl string

//go:embed examples/sortable_scrollable.css
var sortableScrollableCSS string

// sortablePlaceholderHTML pairs with a sibling .css carrying the
// drop-indicator styling, injected @scope-d so the same source drives
// both the Examples demo and the playground state. The dashed outline
// reads bigger than the kit-sized slot via outline-offset, so the
// measured gap stays item-sized.
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
