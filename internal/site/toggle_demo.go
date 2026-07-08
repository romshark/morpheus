package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func togglePlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: togglePlaygroundDefaultHTML},
		{Label: "Variants", HTML: toggleVariantsHTML},
		{Label: "Sizes", HTML: toggleSizesHTML},
		{Label: "Pressed", HTML: togglePressedHTML},
		{Label: "Disabled", HTML: toggleDisabledHTML},
		{Label: "With icon", HTML: toggleWithIconHTML},
	}
}

//go:embed examples/toggle_default.html
var togglePlaygroundDefaultHTML string

// toggleSlotHTML / toggleSlotTempl are the static source for the
// slot-driven on / off toggle: [data-neo-toggle-off] paints the
// resting label, [data-neo-toggle-on] the pressed one.
var toggleSlotHTML = renderExampleHTML(examples.ToggleSlot())

//go:embed examples/toggle_slot.templ
var toggleSlotTempl string

// Static-source pairs (HTML + Templ) for the per-example demos in
// the Toggle page's "Examples" section.

var toggleVariantsHTML = renderExampleHTML(examples.ToggleVariants())

//go:embed examples/toggle_variants.templ
var toggleVariantsTempl string

var toggleSizesHTML = renderExampleHTML(examples.ToggleSizes())

//go:embed examples/toggle_sizes.templ
var toggleSizesTempl string

var togglePressedHTML = renderExampleHTML(examples.TogglePressed())

//go:embed examples/toggle_pressed.templ
var togglePressedTempl string

var toggleDisabledHTML = renderExampleHTML(examples.ToggleDisabled())

//go:embed examples/toggle_disabled.templ
var toggleDisabledTempl string

var toggleWithIconHTML = renderExampleHTML(examples.ToggleWithIcon())

//go:embed examples/toggle_with_icon.templ
var toggleWithIconTempl string
