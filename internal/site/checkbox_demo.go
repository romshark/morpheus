package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// Embedded from the same .js module the page loads at runtime so the
// "Server script" tab on the tree-with-checkboxes demo can't drift.

//go:embed static/sim/checkbox/tree.js
var checkboxTreeScript string

func checkboxPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: checkboxPlaygroundDefaultHTML, CSS: checkboxPlaygroundDefaultCSS},
		{Label: "States", HTML: checkboxStatesHTML, CSS: checkboxStatesCSS},
		{Label: "Small size", HTML: checkboxSmallHTML},
		{Label: "Disabled", HTML: checkboxDisabledHTML},
		{Label: "With label", HTML: checkboxWithLabelHTML, CSS: checkboxWithLabelCSS},
		{Label: "Settings group", HTML: checkboxSettingsGroupHTML, CSS: checkboxSettingsGroupCSS},
	}
}

//go:embed examples/checkbox_default.html
var checkboxPlaygroundDefaultHTML string

//go:embed examples/checkbox_default.css
var checkboxPlaygroundDefaultCSS string

// Static-source pairs (HTML + Templ) for the per-example demos in
// the Checkbox page's "Examples" section.

var checkboxStatesHTML = renderExampleHTML(examples.CheckboxStates())

//go:embed examples/checkbox_states.templ
var checkboxStatesTempl string

//go:embed examples/checkbox_states.css
var checkboxStatesCSS string

var checkboxTreeHTML = renderExampleHTML(examples.CheckboxTree())

//go:embed examples/checkbox_tree.templ
var checkboxTreeTempl string

var checkboxSmallHTML = renderExampleHTML(examples.CheckboxSmall())

//go:embed examples/checkbox_small.templ
var checkboxSmallTempl string

var checkboxDisabledHTML = renderExampleHTML(examples.CheckboxDisabled())

//go:embed examples/checkbox_disabled.templ
var checkboxDisabledTempl string

var checkboxWithLabelHTML = renderExampleHTML(examples.CheckboxWithLabel())

//go:embed examples/checkbox_with_label.templ
var checkboxWithLabelTempl string

//go:embed examples/checkbox_with_label.css
var checkboxWithLabelCSS string

// .checkbox-row's descendant rules (& > neo-checkbox, & > span > strong,
// …) can't be inlined, so the row layout lives in a scoped <style> block
// keyed by a unique class. The group/row base boxes stay inline.
var checkboxSettingsGroupHTML = renderExampleHTML(examples.CheckboxSettingsGroup())

//go:embed examples/checkbox_settings_group.templ
var checkboxSettingsGroupTempl string

//go:embed examples/checkbox_settings_group.css
var checkboxSettingsGroupCSS string
