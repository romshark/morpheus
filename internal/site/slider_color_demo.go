package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func sliderColorPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: sliderColorPlaygroundDefaultHTML},
		{Label: "Channels", HTML: sliderColorChannelsHTML},
		{Label: "Explicit hue", HTML: sliderColorExplicitHueHTML},
		{Label: "Vertical", HTML: sliderColorVerticalHTML},
		{Label: "Disabled", HTML: sliderColorDisabledHTML},
	}
}

//go:embed examples/slider_color_default.html
var sliderColorPlaygroundDefaultHTML string

var sliderColorChannelsHTML = renderExampleHTML(examples.SliderColorChannels())

//go:embed examples/slider_color_channels.templ
var sliderColorChannelsTempl string

var sliderColorExplicitHueHTML = renderExampleHTML(examples.SliderColorExplicitHue())

//go:embed examples/slider_color_explicit_hue.templ
var sliderColorExplicitHueTempl string

var sliderColorVerticalHTML = renderExampleHTML(examples.SliderColorVertical())

//go:embed examples/slider_color_vertical.templ
var sliderColorVerticalTempl string

var sliderColorDisabledHTML = renderExampleHTML(examples.SliderColorDisabled())

//go:embed examples/slider_color_disabled.templ
var sliderColorDisabledTempl string

var sliderColorSharedHTML = renderExampleHTML(examples.SliderColorShared())

//go:embed examples/slider_color_shared.templ
var sliderColorSharedTempl string
