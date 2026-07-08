package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func textareaPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: textareaPlaygroundDefaultHTML},
		{Label: "Disabled", HTML: textareaDisabledHTML},
		{Label: "Manual resize", HTML: textareaManualResizeHTML},
		{Label: "Auto-grow height", HTML: textareaAutoGrowHeightHTML},
		{Label: "Auto-grow width", HTML: textareaAutoGrowWidthHTML},
	}
}

//go:embed examples/textarea_default.html
var textareaPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Textarea page's "Examples" section. Each pair shows the verbatim
// markup an author would copy/paste, with no Datastar wiring, no live
// params.

var textareaDisabledHTML = renderExampleHTML(examples.TextareaDisabled())

//go:embed examples/textarea_disabled.templ
var textareaDisabledTempl string

var textareaManualResizeHTML = renderExampleHTML(examples.TextareaManualResize())

//go:embed examples/textarea_manual_resize.templ
var textareaManualResizeTempl string

var textareaAutoGrowHeightHTML = renderExampleHTML(examples.TextareaAutoGrowHeight())

//go:embed examples/textarea_auto_grow_height.templ
var textareaAutoGrowHeightTempl string

var textareaAutoGrowWidthHTML = renderExampleHTML(examples.TextareaAutoGrowWidth())

//go:embed examples/textarea_auto_grow_width.templ
var textareaAutoGrowWidthTempl string
