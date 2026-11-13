package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func autohidePlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{
			Label: "Default",
			HTML:  autohidePlaygroundDefaultHTML, CSS: autohideDefaultCSS,
		},
		{
			Label: "Bottom tab bar",
			HTML:  autohideBottomHTML, CSS: autohideBottomCSS,
		},
		{
			Label: "Below a banner",
			HTML:  autohideBannerHTML, CSS: autohideBannerCSS,
		},
		{
			Label: "Style by state",
			HTML:  autohideScrolledHTML, CSS: autohideScrolledCSS,
		},
		{
			Label: "Popover in the bar",
			HTML:  autohidePopoverHTML, CSS: autohidePopoverCSS,
		},
		{
			Label: "Pin the bar",
			HTML:  autohidePinHTML, CSS: autohidePinCSS,
		},
	}
}

//go:embed examples/autohide_default.html
var autohidePlaygroundDefaultHTML string

//go:embed examples/autohide_default.css
var autohideDefaultCSS string

var autohideBottomHTML = renderExampleHTML(examples.AutohideBottom())

//go:embed examples/autohide_bottom.templ
var autohideBottomTempl string

//go:embed examples/autohide_bottom.css
var autohideBottomCSS string

var autohideBannerHTML = renderExampleHTML(examples.AutohideBanner())

//go:embed examples/autohide_banner.templ
var autohideBannerTempl string

//go:embed examples/autohide_banner.css
var autohideBannerCSS string

var autohideScrolledHTML = renderExampleHTML(examples.AutohideScrolled())

//go:embed examples/autohide_scrolled.templ
var autohideScrolledTempl string

//go:embed examples/autohide_scrolled.css
var autohideScrolledCSS string

var autohidePinHTML = renderExampleHTML(examples.AutohidePin())

//go:embed examples/autohide_pin.templ
var autohidePinTempl string

//go:embed examples/autohide_pin.css
var autohidePinCSS string

var autohidePopoverHTML = renderExampleHTML(examples.AutohidePopover())

//go:embed examples/autohide_popover.templ
var autohidePopoverTempl string

//go:embed examples/autohide_popover.css
var autohidePopoverCSS string
