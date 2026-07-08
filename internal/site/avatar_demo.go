package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func avatarPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: avatarPlaygroundDefaultHTML},
		{Label: "Image", HTML: avatarImageHTML},
		{Label: "Fallback", HTML: avatarFallbackHTML},
	}
}

// Avatar is a style-only frame with no attribute-driven variants, so
// the Default state is plain markup with no signal-editable attribute.
//
//go:embed examples/avatar_default.html
var avatarPlaygroundDefaultHTML string

var avatarImageHTML = renderExampleHTML(examples.AvatarImage())

//go:embed examples/avatar_image.templ
var avatarImageTempl string

var avatarFallbackHTML = renderExampleHTML(examples.AvatarFallback())

//go:embed examples/avatar_fallback.templ
var avatarFallbackTempl string
