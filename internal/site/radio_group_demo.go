package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func radioGroupPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: radioGroupPlaygroundDefaultHTML},
		{Label: "Horizontal", HTML: radioGroupHorizontalHTML, CSS: radioGroupHorizontalCSS},
		{Label: "Rich rows", HTML: radioGroupRichRowsHTML, CSS: radioGroupRichRowsCSS},
		{Label: "Disabled", HTML: radioGroupDisabledHTML, CSS: radioGroupDisabledCSS},
		{Label: "Auto-activate", HTML: radioGroupAutoActivateHTML, CSS: radioGroupAutoActivateCSS},
	}
}

//go:embed examples/radio_group_default.html
var radioGroupPlaygroundDefaultHTML string

var radioGroupHorizontalHTML = renderExampleHTML(examples.RadioGroupHorizontal())

//go:embed examples/radio_group_horizontal.templ
var radioGroupHorizontalTempl string

//go:embed examples/radio_group_horizontal.css
var radioGroupHorizontalCSS string

var radioGroupRichRowsHTML = renderExampleHTML(examples.RadioGroupRichRows())

//go:embed examples/radio_group_rich_rows.templ
var radioGroupRichRowsTempl string

//go:embed examples/radio_group_rich_rows.css
var radioGroupRichRowsCSS string

var radioGroupDisabledHTML = renderExampleHTML(examples.RadioGroupDisabled())

//go:embed examples/radio_group_disabled.templ
var radioGroupDisabledTempl string

//go:embed examples/radio_group_disabled.css
var radioGroupDisabledCSS string

var radioGroupAutoActivateHTML = renderExampleHTML(examples.RadioGroupAutoActivate())

//go:embed examples/radio_group_auto_activate.templ
var radioGroupAutoActivateTempl string

//go:embed examples/radio_group_auto_activate.css
var radioGroupAutoActivateCSS string
