package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func odometerPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: odometerPlaygroundDefaultHTML},
		{Label: "Formatted values", HTML: odometerFormats1HTML},
		{Label: "Other digit scripts", HTML: odometerScripts1HTML},
		{Label: "Custom properties", HTML: odometerCustomPropsHTML},
		{Label: "Styling parts", HTML: odometerParts1HTML, CSS: odometerPartsCSS},
	}
}

func odometerPartsStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "12,480 / −4.5 °C", HTML: odometerParts1HTML, CSS: odometerPartsCSS},
		{Label: "12,481 / −0.5 °C", HTML: odometerParts2HTML, CSS: odometerPartsCSS},
		{Label: "12,509 / 2.0 °C", HTML: odometerParts3HTML, CSS: odometerPartsCSS},
		{Label: "13,002 / 11.5 °C", HTML: odometerParts4HTML, CSS: odometerPartsCSS},
	}
}

func odometerFormatsStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "$9.99", HTML: odometerFormats1HTML},
		{Label: "$12.49", HTML: odometerFormats2HTML},
		{Label: "$1,024.00", HTML: odometerFormats3HTML},
		{Label: "$987.65", HTML: odometerFormats4HTML},
	}
}

func odometerScriptsStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "987 km", HTML: odometerScripts1HTML},
		{Label: "1,002 km", HTML: odometerScripts2HTML},
		{Label: "1,234 km", HTML: odometerScripts3HTML},
	}
}

//go:embed examples/odometer_default.html
var odometerPlaygroundDefaultHTML string

//go:embed examples/odometer_formats_1.html
var odometerFormats1HTML string

//go:embed examples/odometer_formats_2.html
var odometerFormats2HTML string

//go:embed examples/odometer_formats_3.html
var odometerFormats3HTML string

//go:embed examples/odometer_formats_4.html
var odometerFormats4HTML string

var odometerCustomPropsHTML = renderExampleHTML(examples.OdometerCustomProps())

//go:embed examples/odometer_custom_props.templ
var odometerCustomPropsTempl string

//go:embed examples/odometer_scripts_1.html
var odometerScripts1HTML string

//go:embed examples/odometer_scripts_2.html
var odometerScripts2HTML string

//go:embed examples/odometer_scripts_3.html
var odometerScripts3HTML string

//go:embed examples/odometer_parts_1.html
var odometerParts1HTML string

//go:embed examples/odometer_parts_2.html
var odometerParts2HTML string

//go:embed examples/odometer_parts_3.html
var odometerParts3HTML string

//go:embed examples/odometer_parts_4.html
var odometerParts4HTML string

//go:embed examples/odometer_parts.css
var odometerPartsCSS string

var odometerCartHTML = renderExampleHTML(examples.OdometerCart())

//go:embed examples/odometer_cart.templ
var odometerCartTempl string

//go:embed static/sim/odometer/cart.js
var odometerCartScript string
