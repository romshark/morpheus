package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func navgroupPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: navgroupPlaygroundDefaultHTML},
		{Label: "Toolbar", HTML: navgroupToolbarHTML},
		{Label: "Vertical", HTML: navgroupVerticalHTML},
		{Label: "Grid", HTML: navgroupGridHTML, CSS: navgroupGridCSS},
		{Label: "Media controls", HTML: navgroupMediaHTML},
	}
}

//go:embed examples/navgroup_default.html
var navgroupPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in
// the Navgroup page's "Examples" section.

var navgroupToolbarHTML = renderExampleHTML(examples.NavgroupToolbar())

//go:embed examples/navgroup_toolbar.templ
var navgroupToolbarTempl string

var navgroupGridHTML = renderExampleHTML(examples.NavgroupGrid())

//go:embed examples/navgroup_grid.templ
var navgroupGridTempl string

//go:embed examples/navgroup_grid.css
var navgroupGridCSS string

var navgroupMediaHTML = renderExampleHTML(examples.NavgroupMedia())

//go:embed examples/navgroup_media.templ
var navgroupMediaTempl string

var navgroupVerticalHTML = renderExampleHTML(examples.NavgroupVertical())

//go:embed examples/navgroup_vertical.templ
var navgroupVerticalTempl string
