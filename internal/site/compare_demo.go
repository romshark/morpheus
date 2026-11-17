package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func comparePlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: comparePlaygroundDefaultHTML},
		{Label: "Vertical", HTML: compareVerticalHTML},
		{Label: "Captions", HTML: compareCaptionsHTML, CSS: compareCaptionsCSS},
		{Label: "HTML layers", HTML: compareRedesignHTML, CSS: compareRedesignCSS},
		{Label: "Customized", HTML: compareCustomizedHTML, CSS: compareCustomizedCSS},
	}
}

func compareMorphStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Jar 4", HTML: compareMorph1HTML},
		{Label: "Jar 6", HTML: compareMorph2HTML},
	}
}

//go:embed examples/compare_default.html
var comparePlaygroundDefaultHTML string

var compareVerticalHTML = renderExampleHTML(examples.CompareVertical())

//go:embed examples/compare_vertical.templ
var compareVerticalTempl string

var compareCaptionsHTML = renderExampleHTML(examples.CompareCaptions())

//go:embed examples/compare_captions.templ
var compareCaptionsTempl string

//go:embed examples/compare_captions.css
var compareCaptionsCSS string

var compareRedesignHTML = renderExampleHTML(examples.CompareRedesign())

//go:embed examples/compare_redesign.templ
var compareRedesignTempl string

//go:embed examples/compare_redesign.css
var compareRedesignCSS string

var compareCustomizedHTML = renderExampleHTML(examples.CompareCustomized())

//go:embed examples/compare_customized.templ
var compareCustomizedTempl string

//go:embed examples/compare_customized.css
var compareCustomizedCSS string

//go:embed examples/compare_morph_1.html
var compareMorph1HTML string

//go:embed examples/compare_morph_2.html
var compareMorph2HTML string

var compareServerHTML = renderExampleHTML(examples.CompareServer())

//go:embed examples/compare_server.templ
var compareServerTempl string

//go:embed static/sim/compare/position.js
var compareServerScript string
