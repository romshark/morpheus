package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func clipcopyPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: clipcopyPlaygroundDefaultHTML},
		{Label: "Icon + target ref", HTML: clipcopyTargetHTML, CSS: clipcopyTargetCSS},
	}
}

//go:embed examples/clipcopy_default.html
var clipcopyPlaygroundDefaultHTML string

// Self-sufficient "Icon + target ref" example, used as BOTH the
// playground state and the Examples-section render+source. A
// `<neo-clipcopy for="…">` reads its value from the textContent of a
// sibling `<code>`, copying whatever the user sees without duplicating
// the literal. The code element's styling lives in the sibling
// clipcopy_target.css, scoped into the demo stage.
var clipcopyTargetHTML = renderExampleHTML(examples.ClipcopyTarget())

//go:embed examples/clipcopy_target.templ
var clipcopyTargetTempl string

//go:embed examples/clipcopy_target.css
var clipcopyTargetCSS string
