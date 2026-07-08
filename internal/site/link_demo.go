package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func linkPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: linkPlaygroundDefaultHTML},
		{Label: "Variants & states", HTML: linkVariantsHTML},
		{Label: "Inline in prose", HTML: linkProseHTML},
		{Label: "Call to action", HTML: linkCtaHTML},
	}
}

//go:embed examples/link_default.html
var linkPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Link page's "Examples" section.

var linkVariantsHTML = renderExampleHTML(examples.LinkVariants())

//go:embed examples/link_variants.templ
var linkVariantsTempl string

var linkProseHTML = renderExampleHTML(examples.LinkProse())

//go:embed examples/link_prose.templ
var linkProseTempl string

var linkCtaHTML = renderExampleHTML(examples.LinkCta())

//go:embed examples/link_cta.templ
var linkCtaTempl string
