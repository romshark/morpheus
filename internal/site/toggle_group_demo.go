package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func toggleGroupPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: toggleGroupPlaygroundDefaultHTML},
		{Label: "Formatting toolbar", HTML: toggleGroupFormattingHTML},
		{Label: "View options", HTML: toggleGroupAlignmentHTML},
		{Label: "Vertical", HTML: toggleGroupVerticalHTML},
	}
}

//go:embed examples/toggle_group_default.html
var toggleGroupPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in
// the Toggle group page's "Examples" section. Each pair shows the
// markup an author would copy/paste verbatim, with no Datastar wiring,
// no live params.

var toggleGroupFormattingHTML = renderExampleHTML(examples.ToggleGroupFormatting())

//go:embed examples/toggle_group_formatting.templ
var toggleGroupFormattingTempl string

var toggleGroupAlignmentHTML = renderExampleHTML(examples.ToggleGroupAlignment())

//go:embed examples/toggle_group_alignment.templ
var toggleGroupAlignmentTempl string

var toggleGroupVerticalHTML = renderExampleHTML(examples.ToggleGroupVertical())

//go:embed examples/toggle_group_vertical.templ
var toggleGroupVerticalTempl string
