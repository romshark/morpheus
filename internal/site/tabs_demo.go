package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func tabsPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: tabsPlaygroundDefaultHTML},
		{Label: "Icons + labels", HTML: tabsIconsHTML},
		{Label: "No animation", HTML: tabsNoAnimationHTML},
		{Label: "Custom animation", HTML: tabsCustomAnimationHTML},
		{Label: "Custom styling", HTML: tabsUnderlineHTML, CSS: tabsUnderlineCSS},
		{Label: "Auto-activate", HTML: tabsAutoActivateHTML},
		{Label: "Vertical", HTML: tabsVerticalHTML},
	}
}

//go:embed examples/tabs_default.html
var tabsPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in
// the Tabs page's "Examples" section. Each pair shows the markup an
// author would copy/paste verbatim, with no Datastar wiring, no live
// params.

var tabsIconsHTML = renderExampleHTML(examples.TabsIcons())

//go:embed examples/tabs_icons.templ
var tabsIconsTempl string

var tabsNoAnimationHTML = renderExampleHTML(examples.TabsNoAnimation())

//go:embed examples/tabs_no_animation.templ
var tabsNoAnimationTempl string

var tabsCustomAnimationHTML = renderExampleHTML(examples.TabsCustomAnimation())

//go:embed examples/tabs_custom_animation.templ
var tabsCustomAnimationTempl string

// The custom-property overrides and descendant rules (incl. the
// runtime-driven [aria-selected] state, which can't be inlined) live
// in a sibling .css file keyed to a unique wrapper class.
var tabsUnderlineHTML = renderExampleHTML(examples.TabsUnderline())

//go:embed examples/tabs_underline.templ
var tabsUnderlineTempl string

//go:embed examples/tabs_underline.css
var tabsUnderlineCSS string

var tabsAutoActivateHTML = renderExampleHTML(examples.TabsAutoActivate())

//go:embed examples/tabs_auto_activate.templ
var tabsAutoActivateTempl string

var tabsVerticalHTML = renderExampleHTML(examples.TabsVertical())

//go:embed examples/tabs_vertical.templ
var tabsVerticalTempl string
