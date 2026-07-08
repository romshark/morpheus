package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func buttongroupPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: buttongroupPlaygroundDefaultHTML},
		{Label: "Horizontal", HTML: buttongroupHorizontalHTML},
		{Label: "Vertical", HTML: buttongroupVerticalHTML},
	}
}

//go:embed examples/buttongroup_default.html
var buttongroupPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in
// the Button group page's "Examples" section.

var buttongroupHorizontalHTML = renderExampleHTML(examples.ButtongroupHorizontal())

//go:embed examples/buttongroup_horizontal.templ
var buttongroupHorizontalTempl string

var buttongroupVerticalHTML = renderExampleHTML(examples.ButtongroupVertical())

//go:embed examples/buttongroup_vertical.templ
var buttongroupVerticalTempl string
