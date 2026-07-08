package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func layoutPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Composition", HTML: layoutCompositionPlaygroundHTML, CSS: layoutOverviewCSS},
		{Label: "Wrapping cluster", HTML: layoutClusterHTML},
		{Label: "Responsive grid", HTML: layoutGridHTML, CSS: layoutGridCSS},
		{Label: "Responsive conditional rendering", HTML: layoutConditionalHTML},
		{Label: "Responsive collapse", HTML: layoutCollapseHTML},
		{Label: "Alignment", HTML: layoutAlignHTML},
		{Label: "Child attributes", HTML: layoutShellHTML, CSS: layoutShellCSS},
		{Label: "Spacer", HTML: layoutSpacerHTML},
		{Label: "Split row and column gaps", HTML: layoutSeparateGapsHTML},
		{Label: "Reverse direction", HTML: layoutReverseHTML},
		{Label: "Inline flow", HTML: layoutInlineHTML},
	}
}

// Layout demos source from examples/. <neo-layout> is CSS-only and the
// demos use only kit pieces (neo-layout, neo-card, neo-badge, neo-button)
// plus plain HTML. A few demos add a sibling .css scoped into the stage
// for card flex-basis and scroll padding that has no neo-* attribute.

var layoutOverviewHTML = renderExampleHTML(examples.LayoutOverview())

//go:embed examples/layout_overview.templ
var layoutOverviewTempl string

//go:embed examples/layout_overview.css
var layoutOverviewCSS string

// Playground composition reuses the overview example.
var layoutCompositionPlaygroundHTML = layoutOverviewHTML

var layoutClusterHTML = renderExampleHTML(examples.LayoutCluster())

//go:embed examples/layout_cluster.templ
var layoutClusterTempl string

var layoutGridHTML = renderExampleHTML(examples.LayoutGrid())

//go:embed examples/layout_grid.templ
var layoutGridTempl string

//go:embed examples/layout_grid.css
var layoutGridCSS string

var layoutConditionalHTML = renderExampleHTML(examples.LayoutConditional())

//go:embed examples/layout_conditional.templ
var layoutConditionalTempl string

var layoutAlignHTML = renderExampleHTML(examples.LayoutAlign())

//go:embed examples/layout_align.templ
var layoutAlignTempl string

var layoutShellHTML = renderExampleHTML(examples.LayoutShell())

//go:embed examples/layout_shell.templ
var layoutShellTempl string

//go:embed examples/layout_shell.css
var layoutShellCSS string

var layoutSpacerHTML = renderExampleHTML(examples.LayoutSpacer())

//go:embed examples/layout_spacer.templ
var layoutSpacerTempl string

var layoutCollapseHTML = renderExampleHTML(examples.LayoutCollapse())

//go:embed examples/layout_collapse.templ
var layoutCollapseTempl string

var layoutSeparateGapsHTML = renderExampleHTML(examples.LayoutSeparateGaps())

//go:embed examples/layout_separate_gaps.templ
var layoutSeparateGapsTempl string

var layoutReverseHTML = renderExampleHTML(examples.LayoutReverse())

//go:embed examples/layout_reverse.templ
var layoutReverseTempl string

var layoutInlineHTML = renderExampleHTML(examples.LayoutInline())

//go:embed examples/layout_inline.templ
var layoutInlineTempl string
