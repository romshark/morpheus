package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func carouselPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: carouselDefaultHTML, CSS: carouselDefaultCSS},
		{Label: "Multiple slides per view", HTML: carouselMultiHTML, CSS: carouselMultiCSS},
		{Label: "Intrinsic widths", HTML: carouselAutoHTML, CSS: carouselAutoCSS},
		{Label: "Custom navigation styling", HTML: carouselCustomDotsHTML, CSS: carouselCustomDotsCSS},
		{Label: "Autoplay + loop", HTML: carouselAutoplayHTML, CSS: carouselAutoplayCSS},
		{Label: "Custom easing", HTML: carouselEasingHTML, CSS: carouselEasingCSS},
		{Label: "Vertical", HTML: carouselVerticalHTML, CSS: carouselVerticalCSS},
		{Label: "No touch", HTML: carouselNoTouchHTML, CSS: carouselNoTouchCSS},
		{Label: "100 slides", HTML: carouselManySlidesHTML, CSS: carouselManySlidesCSS},
	}
}

// One self-sufficient example templ per case, used as BOTH the playground
// state and the Examples-section render+source. No site-local demo classes:
// every example pairs with a sibling .css injected @scope-d into the demo
// stage, so the source in the editor fully explains its own look. Slides are
// height:100% so they fill the fixed-height stage.

var carouselDefaultHTML = renderExampleHTML(examples.CarouselDefault())

//go:embed examples/carousel_default.css
var carouselDefaultCSS string

var carouselMultiHTML = renderExampleHTML(examples.CarouselMulti())

//go:embed examples/carousel_multi.templ
var carouselMultiTempl string

//go:embed examples/carousel_multi.css
var carouselMultiCSS string

var carouselAutoHTML = renderExampleHTML(examples.CarouselAutoWidth())

//go:embed examples/carousel_auto.templ
var carouselAutoTempl string

//go:embed examples/carousel_auto.css
var carouselAutoCSS string

var carouselCustomDotsHTML = renderExampleHTML(examples.CarouselCustomDots())

//go:embed examples/carousel_custom_dots.templ
var carouselCustomDotsTempl string

//go:embed examples/carousel_custom_dots.css
var carouselCustomDotsCSS string

var carouselAutoplayHTML = renderExampleHTML(examples.CarouselAutoplay())

//go:embed examples/carousel_autoplay.templ
var carouselAutoplayTempl string

//go:embed examples/carousel_autoplay.css
var carouselAutoplayCSS string

var carouselEasingHTML = renderExampleHTML(examples.CarouselEasing())

//go:embed examples/carousel_easing.templ
var carouselEasingTempl string

//go:embed examples/carousel_easing.css
var carouselEasingCSS string

var carouselVerticalHTML = renderExampleHTML(examples.CarouselVertical())

//go:embed examples/carousel_vertical.templ
var carouselVerticalTempl string

//go:embed examples/carousel_vertical.css
var carouselVerticalCSS string

var carouselNoTouchHTML = renderExampleHTML(examples.CarouselNoTouch())

//go:embed examples/carousel_no_touch.templ
var carouselNoTouchTempl string

//go:embed examples/carousel_no_touch.css
var carouselNoTouchCSS string

var carouselManySlidesHTML = renderExampleHTML(examples.CarouselManySlides())

//go:embed examples/carousel_many_slides.templ
var carouselManySlidesTempl string

//go:embed examples/carousel_many_slides.css
var carouselManySlidesCSS string

var carouselCardsHTML = renderExampleHTML(examples.CarouselCards())

//go:embed examples/carousel_cards.templ
var carouselCardsTempl string

//go:embed examples/carousel_cards.css
var carouselCardsCSS string
