package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func contextMenuPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: contextMenuPlaygroundDefaultHTML},
		{Label: "Simple", HTML: contextMenuSimpleHTML, CSS: contextMenuSimpleCSS},
		{Label: "Nested", HTML: contextMenuNestedHTML, CSS: contextMenuNestedCSS},
		{Label: "Custom content", HTML: contextMenuCustomHTML, CSS: contextMenuCustomCSS},
	}
}

// One self-sufficient templ func per example, rendered to HTML for the
// playground state and the Examples-section preview, with the templ source
// embedded for the code tab. Each example keeps its styling in a sibling
// .css file, embedded for the CSS tab and applied scoped to the preview.

//go:embed examples/context_menu_default.html
var contextMenuPlaygroundDefaultHTML string

var contextMenuSimpleHTML = renderExampleHTML(examples.ContextMenuSimple())

//go:embed examples/context_menu_simple.templ
var contextMenuSimpleTempl string

//go:embed examples/context_menu_simple.css
var contextMenuSimpleCSS string

var contextMenuNestedHTML = renderExampleHTML(examples.ContextMenuNested())

//go:embed examples/context_menu_nested.templ
var contextMenuNestedTempl string

//go:embed examples/context_menu_nested.css
var contextMenuNestedCSS string

var contextMenuCustomHTML = renderExampleHTML(examples.ContextMenuCustom())

//go:embed examples/context_menu_custom.templ
var contextMenuCustomTempl string

//go:embed examples/context_menu_custom.css
var contextMenuCustomCSS string
