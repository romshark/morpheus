package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Persist page's "Examples" section. Persist is a behavioural primitive.
// It wraps a child and snapshots a few properties on listed events,
// no per-instance knobs worth a live-params form. Each pair shows the
// markup an author would copy/paste verbatim.

var persistScrollHTML = renderExampleHTML(examples.PersistScroll())

//go:embed examples/persist_scroll.templ
var persistScrollTempl string

var persistTextareaHTML = renderExampleHTML(examples.PersistTextarea())

//go:embed examples/persist_textarea.templ
var persistTextareaTempl string

var persistMultiHTML = renderExampleHTML(examples.PersistMulti())

//go:embed examples/persist_multi.templ
var persistMultiTempl string

var persistVideoHTML = renderExampleHTML(examples.PersistVideo())

//go:embed examples/persist_video.templ
var persistVideoTempl string
