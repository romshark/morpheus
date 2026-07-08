package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func menuPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: menuPlaygroundDefaultHTML},
		{Label: "Push mode", HTML: menuPushModeHTML},
		{Label: "Open above", HTML: menuOpenAboveHTML, CSS: menuOpenAboveCSS},
		{Label: "Disabled rows", HTML: menuDisabledRowsHTML},
	}
}

// menuMorphStates seeds the "Morphing during interaction" playground.
// Autoplay cycles the states, each a fat-morph of the item list onto the
// same live <neo-menu>: rows appear, disappear, and flip to disabled
// while the trigger and panel stay mounted (and the menu open). The
// shared <neo-button> root is what lets idiomorph keep the element.
func menuMorphStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Initial", HTML: menuMorphInitialHTML},
		{Label: "Disabled options", HTML: menuMorphDisabledHTML},
		{Label: "More options", HTML: menuMorphMoreHTML},
	}
}

//go:embed examples/menu_morph_initial.html
var menuMorphInitialHTML string

//go:embed examples/menu_morph_disabled.html
var menuMorphDisabledHTML string

//go:embed examples/menu_morph_more.html
var menuMorphMoreHTML string

// menuPlaygroundDefaultHTML: a representative trigger + menu with
// items, separators, and nested submenus.
//
//go:embed examples/menu_default.html
var menuPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in
// the Menu page's "Examples" section. Each pair shows the markup an
// author would copy/paste verbatim, with no Datastar wiring, no live
// params.

var menuDisabledRowsHTML = renderExampleHTML(examples.MenuDisabledRows())

//go:embed examples/menu_disabled_rows.templ
var menuDisabledRowsTempl string

var menuPushModeHTML = renderExampleHTML(examples.MenuPushMode())

//go:embed examples/menu_push_mode.templ
var menuPushModeTempl string

var menuOpenAboveHTML = renderExampleHTML(examples.MenuOpenAbove())

//go:embed examples/menu_open_above.templ
var menuOpenAboveTempl string

//go:embed examples/menu_open_above.css
var menuOpenAboveCSS string
