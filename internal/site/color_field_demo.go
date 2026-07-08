package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func colorFieldPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: colorFieldPlaygroundDefaultHTML},
		{Label: "Derived hue", HTML: colorFieldDerivedHueHTML},
		{Label: "Explicit hue", HTML: colorFieldExplicitHueHTML},
		{Label: "Disabled", HTML: colorFieldDisabledHTML},
		{Label: "Custom size", HTML: colorFieldCustomSizeHTML, CSS: colorFieldCustomSizeCSS},
	}
}

//go:embed examples/color_field_default.html
var colorFieldPlaygroundDefaultHTML string

// colorFieldMorphStates seeds the "Morphing during interaction"
// playground. Autoplay fat-morphs attributes onto the same live
// <neo-color-field>: the value flips to a different hue, then the host
// flips to disabled while the element stays mounted. The shared root tag
// keeps idiomorph from tearing the element down across states.
func colorFieldMorphStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Initial", HTML: colorFieldMorphInitialHTML},
		{Label: "Different color", HTML: colorFieldMorphColorHTML},
		{Label: "Disabled", HTML: colorFieldMorphDisabledHTML},
	}
}

//go:embed examples/color_field_morph_initial.html
var colorFieldMorphInitialHTML string

//go:embed examples/color_field_morph_color.html
var colorFieldMorphColorHTML string

//go:embed examples/color_field_morph_disabled.html
var colorFieldMorphDisabledHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Color field page's "Examples" section.

var colorFieldDerivedHueHTML = renderExampleHTML(examples.ColorFieldDerivedHue())

//go:embed examples/color_field_derived_hue.templ
var colorFieldDerivedHueTempl string

var colorFieldExplicitHueHTML = renderExampleHTML(examples.ColorFieldExplicitHue())

//go:embed examples/color_field_explicit_hue.templ
var colorFieldExplicitHueTempl string

var colorFieldDisabledHTML = renderExampleHTML(examples.ColorFieldDisabled())

//go:embed examples/color_field_disabled.templ
var colorFieldDisabledTempl string

var colorFieldCustomSizeHTML = renderExampleHTML(examples.ColorFieldCustomSize())

//go:embed examples/color_field_custom_size.templ
var colorFieldCustomSizeTempl string

//go:embed examples/color_field_custom_size.css
var colorFieldCustomSizeCSS string
