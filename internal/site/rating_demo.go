package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func ratingPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: ratingPlaygroundDefaultHTML},
		{Label: "Basic", HTML: ratingBasicHTML},
		{Label: "Half-symbol precision", HTML: ratingHalfHTML},
		{Label: "Read-only", HTML: ratingReadonlyHTML},
		{Label: "Disabled", HTML: ratingDisabledHTML},
		{Label: "Custom range", HTML: ratingTenHTML},
		{Label: "Hearts, large", HTML: ratingHeartsHTML},
		{Label: "Themed via custom properties", HTML: ratingFireHTML, CSS: ratingFireCSS},
	}
}

//go:embed examples/rating_default.html
var ratingPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Rating page's "Examples" / "Customization" sections. Each pair is the
// markup an author copies verbatim, with no Datastar wiring.

var ratingBasicHTML = renderExampleHTML(examples.RatingBasic())

//go:embed examples/rating_basic.templ
var ratingBasicTempl string

var ratingHalfHTML = renderExampleHTML(examples.RatingHalf())

//go:embed examples/rating_half.templ
var ratingHalfTempl string

var ratingReadonlyHTML = renderExampleHTML(examples.RatingReadonly())

//go:embed examples/rating_readonly.templ
var ratingReadonlyTempl string

var ratingDisabledHTML = renderExampleHTML(examples.RatingDisabled())

//go:embed examples/rating_disabled.templ
var ratingDisabledTempl string

var ratingTenHTML = renderExampleHTML(examples.RatingTen())

//go:embed examples/rating_ten.templ
var ratingTenTempl string

// Customization: different icon (hearts) and a bespoke colour/size
// theme via the rating-fire class overriding the --neo-rating-* vars.

var ratingHeartsHTML = renderExampleHTML(examples.RatingHearts())

//go:embed examples/rating_hearts.templ
var ratingHeartsTempl string

var ratingFireHTML = renderExampleHTML(examples.RatingFire())

//go:embed examples/rating_fire.templ
var ratingFireTempl string

//go:embed examples/rating_fire.css
var ratingFireCSS string
