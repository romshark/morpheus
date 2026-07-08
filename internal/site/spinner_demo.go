package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func spinnerPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: spinnerPlaygroundDefaultHTML},
		{Label: "Indeterminate", HTML: spinnerDefaultHTML, CSS: spinnerDefaultCSS},
		{Label: "Determinate (progress ring)", HTML: spinnerDeterminateHTML, CSS: spinnerDeterminateCSS},
		{Label: "Labelled, with value tooltip", HTML: spinnerLabeledHTML, CSS: spinnerLabeledCSS},
		{Label: "Sizes", HTML: spinnerSizesHTML, CSS: spinnerSizesCSS},
		{Label: "Inherits parent color", HTML: spinnerColorHTML, CSS: spinnerColorCSS},
	}
}

// Determinate ring whose value is signal-editable through the
// playground's signal controls.
//
//go:embed examples/spinner_playground_default.html
var spinnerPlaygroundDefaultHTML string

// spinnerMorphStates seeds the "Morphing during interaction" playground.
// Every state is a bare host. The SVG ring lives in shadow DOM, so a
// Datastar fat morph only reconciles attributes and determinate values can
// ease between positions without rebuilding the arc.
func spinnerMorphStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Indetermined", HTML: spinnerMorphIndeterminateHTML},
		{Label: "0%", HTML: spinnerMorph0HTML},
		{Label: "30%", HTML: spinnerMorph30HTML},
		{Label: "70%", HTML: spinnerMorph70HTML},
		{Label: "100%", HTML: spinnerMorph100HTML},
	}
}

//go:embed examples/spinner_morph_indeterminate.html
var spinnerMorphIndeterminateHTML string

//go:embed examples/spinner_morph_0.html
var spinnerMorph0HTML string

//go:embed examples/spinner_morph_30.html
var spinnerMorph30HTML string

//go:embed examples/spinner_morph_70.html
var spinnerMorph70HTML string

//go:embed examples/spinner_morph_100.html
var spinnerMorph100HTML string

// Single-source pairs for the per-example demos in the Spinner page's
// "Examples" section: each templ under examples/ drives both the live
// preview and the rendered-HTML tab, with its .templ embedded verbatim
// for the Templ tab. The custom element owns its shadow ring, so each
// example only authors the public host.

var spinnerDefaultHTML = renderExampleHTML(examples.SpinnerDefault())

//go:embed examples/spinner_default.templ
var spinnerDefaultTempl string

//go:embed examples/spinner_default.css
var spinnerDefaultCSS string

var spinnerSizesHTML = renderExampleHTML(examples.SpinnerSizes())

//go:embed examples/spinner_sizes.templ
var spinnerSizesTempl string

//go:embed examples/spinner_sizes.css
var spinnerSizesCSS string

var spinnerColorHTML = renderExampleHTML(examples.SpinnerColor())

//go:embed examples/spinner_color.templ
var spinnerColorTempl string

//go:embed examples/spinner_color.css
var spinnerColorCSS string

var spinnerDeterminateHTML = renderExampleHTML(examples.SpinnerDeterminate())

//go:embed examples/spinner_determinate.templ
var spinnerDeterminateTempl string

//go:embed examples/spinner_determinate.css
var spinnerDeterminateCSS string

// Tooltip example: the value lives in a wrapping <neo-tooltip>
// (hover/focus), never painted on the ring.
var spinnerLabeledHTML = renderExampleHTML(examples.SpinnerLabeled())

//go:embed examples/spinner_labeled.templ
var spinnerLabeledTempl string

//go:embed examples/spinner_labeled.css
var spinnerLabeledCSS string

// The animated example drives `value` from a tiny inline script so the
// ring visibly progresses; the source pair shows the host markup plus
// the ticking script verbatim. No tooltip here; a static tooltip text
// would lag the live value.
var spinnerAnimatedHTML = renderExampleHTML(examples.SpinnerAnimated())

//go:embed examples/spinner_animated.templ
var spinnerAnimatedTempl string

//go:embed examples/spinner_animated.css
var spinnerAnimatedCSS string
