package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func resizablePlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: resizableStateDefaultHTML, CSS: resizableStateDefaultCSS},
		{Label: "Bottom-right corner", HTML: resizableCornerHTML, CSS: resizableCornerCSS},
		{Label: "Edges only", HTML: resizableEdgesHTML, CSS: resizableEdgesCSS},
		{Label: "All eight handles", HTML: resizableAllHTML, CSS: resizableAllCSS},
		{Label: "Vertical only", HTML: resizableVerticalHTML, CSS: resizableVerticalCSS},
		{Label: "Horizontal only", HTML: resizableHorizontalHTML, CSS: resizableHorizontalCSS},
		{Label: "Step grid", HTML: resizableStepHTML, CSS: resizableStepCSS},
		{Label: "Custom handle icon", HTML: resizableCustomIconHTML, CSS: resizableCustomIconCSS},
	}
}

// resizableStateDefaultHTML binds the initial width to an editable signal.
//
//go:embed examples/resizable_state_default.html
var resizableStateDefaultHTML string

//go:embed examples/resizable_state_default.css
var resizableStateDefaultCSS string

// Self-sufficient per-example markup for the Resizable page's "Examples"
// section and the matching playground states. Each is one templ function
// under examples/, rendered for both the live preview and the HTML tab;
// the .templ file is embedded verbatim for the Templ tab.

var resizableCornerHTML = renderExampleHTML(examples.ResizableCorner())

//go:embed examples/resizable_corner.templ
var resizableCornerTempl string

//go:embed examples/resizable_corner.css
var resizableCornerCSS string

var resizableEdgesHTML = renderExampleHTML(examples.ResizableEdges())

//go:embed examples/resizable_edges.templ
var resizableEdgesTempl string

//go:embed examples/resizable_edges.css
var resizableEdgesCSS string

var resizableAllHTML = renderExampleHTML(examples.ResizableAll())

//go:embed examples/resizable_all.templ
var resizableAllTempl string

//go:embed examples/resizable_all.css
var resizableAllCSS string

var resizableVerticalHTML = renderExampleHTML(examples.ResizableVertical())

//go:embed examples/resizable_vertical.templ
var resizableVerticalTempl string

//go:embed examples/resizable_vertical.css
var resizableVerticalCSS string

var resizableHorizontalHTML = renderExampleHTML(examples.ResizableHorizontal())

//go:embed examples/resizable_horizontal.templ
var resizableHorizontalTempl string

//go:embed examples/resizable_horizontal.css
var resizableHorizontalCSS string

var resizableStepHTML = renderExampleHTML(examples.ResizableStep())

//go:embed examples/resizable_step.templ
var resizableStepTempl string

//go:embed examples/resizable_step.css
var resizableStepCSS string

// Custom-icon example: the author-supplied glyph sits where the default
// lucide icon would; the scoped <style> only restyles its glyph size
// (was `.resizable-example-custom-icon`), not its positioning.
var resizableCustomIconHTML = renderExampleHTML(examples.ResizableCustomIcon())

//go:embed examples/resizable_custom_icon.templ
var resizableCustomIconTempl string

//go:embed examples/resizable_custom_icon.css
var resizableCustomIconCSS string
