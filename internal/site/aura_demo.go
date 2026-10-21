package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func auraPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: auraPlaygroundDefaultHTML},
		{Label: "Lights", HTML: auraLightsHTML, CSS: auraLightsCSS},
		{Label: "Highlight one option", HTML: auraPricingHTML, CSS: auraPricingCSS},
		{Label: "Form control", HTML: auraInputHTML, CSS: auraInputCSS},
		{Label: "Ring width", HTML: auraWidthHTML, CSS: auraWidthCSS},
		{Label: "Color and track", HTML: auraColorHTML, CSS: auraColorCSS},
		{Label: "Any element", HTML: auraRadiusHTML, CSS: auraRadiusCSS},
		{Label: "Disabled", HTML: auraDisabledHTML, CSS: auraDisabledCSS},
	}
}

//go:embed examples/aura_default.html
var auraPlaygroundDefaultHTML string

var auraLightsHTML = renderExampleHTML(examples.AuraLights())

//go:embed examples/aura_lights.templ
var auraLightsTempl string

//go:embed examples/aura_lights.css
var auraLightsCSS string

var auraPricingHTML = renderExampleHTML(examples.AuraPricing())

//go:embed examples/aura_pricing.templ
var auraPricingTempl string

//go:embed examples/aura_pricing.css
var auraPricingCSS string

var auraInputHTML = renderExampleHTML(examples.AuraInput())

//go:embed examples/aura_input.templ
var auraInputTempl string

//go:embed examples/aura_input.css
var auraInputCSS string

var auraWidthHTML = renderExampleHTML(examples.AuraWidth())

//go:embed examples/aura_width.templ
var auraWidthTempl string

//go:embed examples/aura_width.css
var auraWidthCSS string

var auraColorHTML = renderExampleHTML(examples.AuraColor())

//go:embed examples/aura_color.templ
var auraColorTempl string

//go:embed examples/aura_color.css
var auraColorCSS string

var auraRadiusHTML = renderExampleHTML(examples.AuraRadius())

//go:embed examples/aura_radius.templ
var auraRadiusTempl string

//go:embed examples/aura_radius.css
var auraRadiusCSS string

var auraDisabledHTML = renderExampleHTML(examples.AuraDisabled())

//go:embed examples/aura_disabled.templ
var auraDisabledTempl string

//go:embed examples/aura_disabled.css
var auraDisabledCSS string
