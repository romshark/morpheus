package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// Single sources for the Boundary page demos. Each demo's HTML is the
// same string the page renders live and shows in its code tab.

var boundaryScopedDismissHTML = renderExampleHTML(examples.BoundaryScopedDismiss())

//go:embed examples/boundary_scoped_dismiss.templ
var boundaryScopedDismissTempl string

//go:embed examples/boundary_scoped_dismiss.css
var boundaryScopedDismissCSS string

var boundaryPositioningHTML = renderExampleHTML(examples.BoundaryPositioning())

//go:embed examples/boundary_positioning.templ
var boundaryPositioningTempl string

//go:embed examples/boundary_positioning.css
var boundaryPositioningCSS string

var boundaryScrollHTML = renderExampleHTML(examples.BoundaryScroll())

//go:embed examples/boundary_scroll.templ
var boundaryScrollTempl string

//go:embed examples/boundary_scroll.css
var boundaryScrollCSS string

var boundaryStackingHTML = renderExampleHTML(examples.BoundaryStacking())

//go:embed examples/boundary_stacking.templ
var boundaryStackingTempl string

//go:embed examples/boundary_stacking.css
var boundaryStackingCSS string

var boundaryNestedHTML = renderExampleHTML(examples.BoundaryNested())

//go:embed examples/boundary_nested.templ
var boundaryNestedTempl string

//go:embed examples/boundary_nested.css
var boundaryNestedCSS string
