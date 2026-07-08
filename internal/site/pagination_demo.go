package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func paginationPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: paginationPlaygroundDefaultHTML},
		{Label: "Sibling count = 2", HTML: paginationSiblingHTML},
		{Label: "Boundary count = 2", HTML: paginationBoundaryHTML},
		{Label: "First page", HTML: paginationFirstPageHTML},
		{Label: "Last page", HTML: paginationLastPageHTML},
		{Label: "Short run", HTML: paginationShortRunHTML},
		{Label: "Custom prev / next slots", HTML: paginationCustomSlotsHTML},
		{Label: "No prev / next buttons", HTML: paginationEmptySlotsHTML},
		{Label: "Disabled", HTML: paginationDisabledHTML},
	}
}

//go:embed examples/pagination_default.html
var paginationPlaygroundDefaultHTML string

// Per-example demos in the "Examples" section: each is single-sourced from
// its examples/*.templ file. The HTML tab is the rendered component, the
// Templ tab is that file embedded as-is.

//go:embed examples/pagination_sibling.templ
var paginationSiblingTempl string

//go:embed examples/pagination_boundary.templ
var paginationBoundaryTempl string

//go:embed examples/pagination_first_page.templ
var paginationFirstPageTempl string

//go:embed examples/pagination_last_page.templ
var paginationLastPageTempl string

//go:embed examples/pagination_short_run.templ
var paginationShortRunTempl string

//go:embed examples/pagination_custom_slots.templ
var paginationCustomSlotsTempl string

//go:embed examples/pagination_empty_slots.templ
var paginationEmptySlotsTempl string

//go:embed examples/pagination_disabled.templ
var paginationDisabledTempl string

var (
	paginationSiblingHTML     = renderExampleHTML(examples.PaginationSibling())
	paginationBoundaryHTML    = renderExampleHTML(examples.PaginationBoundary())
	paginationFirstPageHTML   = renderExampleHTML(examples.PaginationFirstPage())
	paginationLastPageHTML    = renderExampleHTML(examples.PaginationLastPage())
	paginationShortRunHTML    = renderExampleHTML(examples.PaginationShortRun())
	paginationCustomSlotsHTML = renderExampleHTML(examples.PaginationCustomSlots())
	paginationEmptySlotsHTML  = renderExampleHTML(examples.PaginationEmptySlots())
	paginationDisabledHTML    = renderExampleHTML(examples.PaginationDisabled())
)
