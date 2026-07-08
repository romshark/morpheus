package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func avatarsPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: avatarsPlaygroundDefaultHTML},
		{Label: "Fixed collapse", HTML: avatarsBasicHTML},
		{Label: "Responsive collapse", HTML: avatarsResponsiveHTML},
		{Label: "Virtual overflow", HTML: avatarsOverflowHTML},
		{Label: "Clickable overflow", HTML: avatarsClickableHTML, CSS: avatarsClickableCSS},
		{Label: "Photographic images", HTML: avatarsPhotosHTML},
		{Label: "Links", HTML: avatarsLinksHTML},
	}
}

// collapse-at is the primary editable scalar; bind it so the
// playground exposes a numeric control via the avatars_collapse_at
// signal.
//
//go:embed examples/avatars_default.html
var avatarsPlaygroundDefaultHTML string

var avatarsBasicHTML = renderExampleHTML(examples.AvatarsBasic())

//go:embed examples/avatars_basic.templ
var avatarsBasicTempl string

var avatarsResponsiveHTML = renderExampleHTML(examples.AvatarsResponsive())

//go:embed examples/avatars_responsive.templ
var avatarsResponsiveTempl string

var avatarsOverflowHTML = renderExampleHTML(examples.AvatarsOverflow())

//go:embed examples/avatars_overflow.templ
var avatarsOverflowTempl string

// Self-sufficient: the overflow panel content is spelled out and the
// panel layout is inlined so the example depends on no site stylesheet
// classes.
var avatarsClickableHTML = renderExampleHTML(examples.AvatarsClickable())

//go:embed examples/avatars_clickable.templ
var avatarsClickableTempl string

//go:embed examples/avatars_clickable.css
var avatarsClickableCSS string

var avatarsPhotosHTML = renderExampleHTML(examples.AvatarsPhotos())

//go:embed examples/avatars_photos.templ
var avatarsPhotosTempl string

var avatarsLinksHTML = renderExampleHTML(examples.AvatarsLinks())

//go:embed examples/avatars_links.templ
var avatarsLinksTempl string
