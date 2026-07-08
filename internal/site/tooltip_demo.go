package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func tooltipPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: tooltipPlaygroundDefaultHTML},
		{Label: "Placements", HTML: tooltipPlacementsHTML},
		{Label: "Shorthand body", HTML: tooltipShorthandHTML},
		{Label: "Rich content", HTML: tooltipRichHTML, CSS: tooltipRichCSS},
		{Label: "Delays", HTML: tooltipDelaysHTML},
	}
}

//go:embed examples/tooltip_default.html
var tooltipPlaygroundDefaultHTML string

// Per-example demos for the Tooltip page's "Examples" section. Most are
// templ-sourced: renderExampleHTML drives the live preview and HTML tab,
// the .templ file is embedded verbatim for the Templ tab.
//
// tooltipRichHTML is used as BOTH the playground "Rich content" state and
// the Examples render + source; its styling lives in the sibling
// tooltip_rich.css, injected @scope-d into the demo stage.

var tooltipPlacementsHTML = renderExampleHTML(examples.TooltipPlacements())

//go:embed examples/tooltip_placements.templ
var tooltipPlacementsTempl string

//go:embed examples/tooltip_placements.css
var tooltipPlacementsCSS string

var tooltipShorthandHTML = renderExampleHTML(examples.TooltipShorthand())

//go:embed examples/tooltip_shorthand.templ
var tooltipShorthandTempl string

var tooltipRichHTML = renderExampleHTML(examples.TooltipRich())

//go:embed examples/tooltip_rich.templ
var tooltipRichTempl string

//go:embed examples/tooltip_rich.css
var tooltipRichCSS string

var tooltipDelaysHTML = renderExampleHTML(examples.TooltipDelays())

//go:embed examples/tooltip_delays.templ
var tooltipDelaysTempl string
