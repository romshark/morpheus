package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func buttonPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: buttonPlaygroundDefaultHTML},
		{Label: "Variants & states", HTML: buttonVariantsHTML},
		{Label: "Composed content", HTML: buttonComposedHTML, CSS: buttonComposedCSS},
	}
}

//go:embed examples/button_default.html
var buttonPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in
// the Button page's "Examples" section.

var buttonVariantsHTML = renderExampleHTML(examples.ButtonVariants())

//go:embed examples/button_variants.templ
var buttonVariantsTempl string

// Self-sufficient composed-content example. Its styling lives in the
// sibling button_composed.css, scoped into the demo stage, so it stands
// alone in both the Examples section and the editable playground without
// site-local classes. --metric-accent is declared on the root rule and
// cascades to descendants.
var buttonComposedHTML = renderExampleHTML(examples.ButtonComposed())

//go:embed examples/button_composed.templ
var buttonComposedTempl string

//go:embed examples/button_composed.css
var buttonComposedCSS string
