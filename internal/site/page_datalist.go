package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// Static example sources for the Datalist page. Each example file is the
// single source for both its live demo and its code tab.

var datalistSharedHTML = renderExampleHTML(examples.DatalistShared())

//go:embed examples/datalist_shared.templ
var datalistSharedTempl string

//go:embed examples/datalist_shared.css
var datalistSharedCSS string
