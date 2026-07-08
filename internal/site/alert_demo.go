package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func alertPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: alertPlaygroundDefaultHTML},
		{Label: "With actions", HTML: alertWithActionsHTML},
		{Label: "Variants", HTML: alertVariantsHTML, CSS: alertVariantsCSS},
	}
}

// Static-source pairs for the Alert page. Alert is CSS-only, so the
// examples render directly and their source snippets can stay literal.

//go:embed examples/alert_default.html
var alertPlaygroundDefaultHTML string

var alertVariantsHTML = renderExampleHTML(examples.AlertVariants())

//go:embed examples/alert_variants.templ
var alertVariantsTempl string

//go:embed examples/alert_variants.css
var alertVariantsCSS string

var alertWithActionsHTML = renderExampleHTML(examples.AlertWithActions())

//go:embed examples/alert_with_actions.templ
var alertWithActionsTempl string
