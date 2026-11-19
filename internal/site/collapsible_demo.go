package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func collapsiblePlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: collapsiblePlaygroundDefaultHTML},
		{Label: "Accordion", HTML: collapsibleAccordionHTML, CSS: collapsibleAccordionCSS},
		{Label: "Read more", HTML: collapsibleReadMoreHTML, CSS: collapsibleReadMoreCSS},
		{Label: "Animated trigger", HTML: collapsibleAnimatedTriggerHTML, CSS: collapsibleAnimatedTriggerCSS},
		{Label: "Customized", HTML: collapsibleCustomizedHTML, CSS: collapsibleCustomizedCSS},
		{Label: "Sidebar", HTML: collapsibleSidebarHTML, CSS: collapsibleSidebarCSS},
	}
}

func collapsibleMorphStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Closed", HTML: collapsibleMorph1HTML, CSS: collapsibleMorphCSS},
		{Label: "Opened", HTML: collapsibleMorph2HTML, CSS: collapsibleMorphCSS},
		{Label: "Shipped", HTML: collapsibleMorph3HTML, CSS: collapsibleMorphCSS},
	}
}

//go:embed examples/collapsible_default.html
var collapsiblePlaygroundDefaultHTML string

var collapsibleAccordionHTML = renderExampleHTML(examples.CollapsibleAccordion())

//go:embed examples/collapsible_accordion.templ
var collapsibleAccordionTempl string

//go:embed examples/collapsible_accordion.css
var collapsibleAccordionCSS string

var collapsibleReadMoreHTML = renderExampleHTML(examples.CollapsibleReadMore())

//go:embed examples/collapsible_read_more.templ
var collapsibleReadMoreTempl string

//go:embed examples/collapsible_read_more.css
var collapsibleReadMoreCSS string

var collapsibleAnimatedTriggerHTML = renderExampleHTML(examples.CollapsibleAnimatedTrigger())

//go:embed examples/collapsible_animated_trigger.templ
var collapsibleAnimatedTriggerTempl string

//go:embed examples/collapsible_animated_trigger.css
var collapsibleAnimatedTriggerCSS string

var collapsibleCustomizedHTML = renderExampleHTML(examples.CollapsibleCustomized())

//go:embed examples/collapsible_customized.templ
var collapsibleCustomizedTempl string

//go:embed examples/collapsible_customized.css
var collapsibleCustomizedCSS string

var collapsibleSidebarHTML = renderExampleHTML(examples.CollapsibleSidebar())

//go:embed examples/collapsible_sidebar.templ
var collapsibleSidebarTempl string

//go:embed examples/collapsible_sidebar.css
var collapsibleSidebarCSS string

//go:embed examples/collapsible_morph_1.html
var collapsibleMorph1HTML string

//go:embed examples/collapsible_morph_2.html
var collapsibleMorph2HTML string

//go:embed examples/collapsible_morph_3.html
var collapsibleMorph3HTML string

//go:embed examples/collapsible_morph.css
var collapsibleMorphCSS string
