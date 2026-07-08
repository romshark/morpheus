package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// Static-source pairs (HTML + Templ) for the per-example demos on the
// Keys page. <neo-keys> is behaviour-only: it binds shortcuts on a
// target element and emits an event on a match. The Datastar attributes
// (data-on:*, data-attr:*) live in the page markup, never in the
// element: config in via attributes, activation out via the event.

var keysScopedHTML = renderExampleHTML(examples.KeysScoped())

//go:embed examples/keys_scoped.templ
var keysScopedTempl string

var keysSequenceHTML = renderExampleHTML(examples.KeysSequence())

//go:embed examples/keys_sequence.templ
var keysSequenceTempl string

var keysReactiveHTML = renderExampleHTML(examples.KeysReactive())

//go:embed examples/keys_reactive.templ
var keysReactiveTempl string

// Global / window example: a target="window" binding fires page-wide, no
// focus needed. mod+enter (the command palette already owns mod+k).
var keysGlobalHTML = renderExampleHTML(examples.KeysGlobal())

//go:embed examples/keys_global.templ
var keysGlobalTempl string

// for="" example: a match clicks the referenced element, so a keyboard
// trigger needs no event handler on <neo-keys>.
var keysForHTML = renderExampleHTML(examples.KeysFor())

//go:embed examples/keys_for.templ
var keysForTempl string

//go:embed examples/keys_for.css
var keysForCSS string
