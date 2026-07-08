package site

import (
	_ "embed"

	"github.com/a-h/templ"
)

// frameworksRaw embeds a repository-authored HTML fragment verbatim so
// the live preview and its HTML source tab render from one string.
func frameworksRaw(raw string) templ.Component { return templ.Raw(raw) }

//go:embed static/sim/frameworks/accent.js
var frameworksAccentScript string

//go:embed examples/datastar_local.html
var datastarLocalHTML string

//go:embed examples/datastar_morph.html
var datastarMorphHTML string

// Alpine itself is loaded once by a <script defer> in the page body.
//
//go:embed examples/alpine_demo.html
var alpineDemoHTML string
