package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// Embedded from the same .js modules the page loads at runtime so each
// "Server script" tab can't drift.

//go:embed static/sim/elastic/list.js
var elasticGrowingListScript string

//go:embed static/sim/elastic/async.js
var elasticAsyncScript string

func elasticPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: elasticPlaygroundDefaultHTML},
		{Label: "Bigger content", HTML: elasticPlaygroundBiggerHTML},
	}
}

// elasticMorphStates seeds the "Morphing during interaction" playground.
// Autoplay fat-morphs the inner content onto the same live <neo-elastic>:
// content grows and shrinks while the host stays mounted, so each state's
// height shift rides the elastic transition. The shared root tag keeps
// idiomorph from tearing the element down across states.
func elasticMorphStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Initial", HTML: elasticMorphInitialHTML},
		{Label: "Taller content", HTML: elasticMorphTallerHTML},
		{Label: "Shorter content", HTML: elasticMorphShorterHTML},
	}
}

//go:embed examples/elastic_morph_initial.html
var elasticMorphInitialHTML string

//go:embed examples/elastic_morph_taller.html
var elasticMorphTallerHTML string

//go:embed examples/elastic_morph_shorter.html
var elasticMorphShorterHTML string

// elasticPlaygroundDefaultHTML is the baseline content height the
// playground animates away from; switching to elasticPlaygroundBiggerHTML
// grows the host to a much taller payload.
//
//go:embed examples/elastic_default.html
var elasticPlaygroundDefaultHTML string

//go:embed examples/elastic_bigger.html
var elasticPlaygroundBiggerHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Elastic page's "Examples" section. Each pair shows the markup an
// author would copy/paste verbatim, with no Datastar wiring outside the
// parts that demonstrate the dynamic behaviour, no live params.

var elasticToggleRevealHTML = renderExampleHTML(examples.ElasticToggleReveal())

//go:embed examples/elastic_toggle_reveal.templ
var elasticToggleRevealTempl string

var elasticGrowingListHTML = renderExampleHTML(examples.ElasticGrowingList())

//go:embed examples/elastic_growing_list.templ
var elasticGrowingListTempl string

var elasticContentSwapHTML = renderExampleHTML(examples.ElasticContentSwap())

//go:embed examples/elastic_content_swap.templ
var elasticContentSwapTempl string

//go:embed examples/elastic_content_swap.css
var elasticContentSwapCSS string

var elasticAsyncPlaceholderHTML = renderExampleHTML(examples.ElasticAsyncPlaceholder())

//go:embed examples/elastic_async_placeholder.templ
var elasticAsyncPlaceholderTempl string

//go:embed examples/elastic_async_placeholder.css
var elasticAsyncPlaceholderCSS string
