package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func cardPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: cardPlaygroundDefaultHTML},
		{Label: "Variants", HTML: cardVariantsHTML},
		{Label: "Composed", HTML: cardComposedHTML},
		{Label: "Media hero", HTML: cardMediaHeroHTML, CSS: cardMediaHeroCSS},
		{Label: "Horizontal media", HTML: cardHorizontalHTML, CSS: cardHorizontalCSS},
		{Label: "Adaptive", HTML: cardAdaptiveHTML, CSS: cardAdaptiveCSS},
	}
}

// Card is structural with no clean scalar attribute to bind, so the
// Default state is a plain instance carrying every structural slot.
//
//go:embed examples/card_default.html
var cardPlaygroundDefaultHTML string

// One self-sufficient templ func per example, rendered to HTML for the
// playground state and the Examples-section preview, with the templ
// source embedded for the code tab. Examples using a site-local demo
// class keep their styling in a sibling .css file, embedded for the CSS
// tab and applied scoped to the preview.

var cardVariantsHTML = renderExampleHTML(examples.CardVariants())

//go:embed examples/card_variants.templ
var cardVariantsTempl string

var cardComposedHTML = renderExampleHTML(examples.CardComposed())

//go:embed examples/card_composed.templ
var cardComposedTempl string

var cardMediaHeroHTML = renderExampleHTML(examples.CardMediaHero())

//go:embed examples/card_media_hero.templ
var cardMediaHeroTempl string

//go:embed examples/card_media_hero.css
var cardMediaHeroCSS string

var cardHorizontalHTML = renderExampleHTML(examples.CardHorizontal())

//go:embed examples/card_horizontal.templ
var cardHorizontalTempl string

//go:embed examples/card_horizontal.css
var cardHorizontalCSS string

var cardAdaptiveHTML = renderExampleHTML(examples.CardAdaptive())

//go:embed examples/card_adaptive.templ
var cardAdaptiveTempl string

//go:embed examples/card_adaptive.css
var cardAdaptiveCSS string
