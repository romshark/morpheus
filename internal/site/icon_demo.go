package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func iconPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: iconPlaygroundDefaultHTML},
		{Label: "Gallery", HTML: iconGalleryHTML},
		{Label: "Sizes", HTML: iconSizesHTML, CSS: iconSizesCSS},
		{Label: "Inherits text colour", HTML: iconCurrentColorHTML, CSS: iconCurrentColorCSS},
		{Label: "In buttons", HTML: iconInButtonHTML},
		{Label: "Inline in prose", HTML: iconInlineProseHTML},
	}
}

//go:embed examples/icon_default.html
var iconPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Icon page's "Examples" section. Each pair shows the markup an author
// would copy/paste verbatim, with no Datastar wiring, no live params.

var iconGalleryHTML = renderExampleHTML(examples.IconGallery())

//go:embed examples/icon_gallery.templ
var iconGalleryTempl string

var iconSizesHTML = renderExampleHTML(examples.IconSizes())

//go:embed examples/icon_sizes.templ
var iconSizesTempl string

//go:embed examples/icon_sizes.css
var iconSizesCSS string

var iconCurrentColorHTML = renderExampleHTML(examples.IconCurrentColor())

//go:embed examples/icon_current_color.templ
var iconCurrentColorTempl string

//go:embed examples/icon_current_color.css
var iconCurrentColorCSS string

var iconInButtonHTML = renderExampleHTML(examples.IconInButton())

//go:embed examples/icon_in_button.templ
var iconInButtonTempl string

var iconInlineProseHTML = renderExampleHTML(examples.IconInlineProse())

//go:embed examples/icon_inline_prose.templ
var iconInlineProseTempl string
