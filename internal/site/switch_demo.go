package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func switchPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: switchPlaygroundDefaultHTML},
		{Label: "States", HTML: switchStatesHTML, CSS: switchStatesCSS},
		{Label: "Small size", HTML: switchSmallHTML},
		{Label: "Disabled", HTML: switchDisabledHTML},
		{Label: "With label", HTML: switchWithLabelHTML, CSS: switchWithLabelCSS},
		{Label: "Settings group", HTML: switchSettingsGroupHTML, CSS: switchSettingsGroupCSS},
	}
}

// Default playground state. `checked` is the primary editable
// attribute; it's boolean, so the signal seeds a JSON boolean (true),
// not a string. Namespaced to avoid clashing with other playgrounds.
// The label is inline-styled (mirroring `.switch-label`) so the editable
// CodeMirror document needs no site stylesheet class.
//
//go:embed examples/switch_default.html
var switchPlaygroundDefaultHTML string

// One self-sufficient example per state. Each is the single source for
// BOTH the playground state and the Examples-section render+source, with
// its sibling .css embedded and injected scoped so the shown source fully
// explains its own look.

var switchStatesHTML = renderExampleHTML(examples.SwitchStates())

//go:embed examples/switch_states.templ
var switchStatesTempl string

//go:embed examples/switch_states.css
var switchStatesCSS string

var switchWithLabelHTML = renderExampleHTML(examples.SwitchWithLabel())

//go:embed examples/switch_with_label.templ
var switchWithLabelTempl string

//go:embed examples/switch_with_label.css
var switchWithLabelCSS string

var switchSettingsGroupHTML = renderExampleHTML(examples.SwitchSettingsGroup())

//go:embed examples/switch_settings_group.templ
var switchSettingsGroupTempl string

//go:embed examples/switch_settings_group.css
var switchSettingsGroupCSS string

// Static-source pairs (HTML + Templ) for the per-example demos that
// don't rely on a site-local class.

var switchSmallHTML = renderExampleHTML(examples.SwitchSmall())

//go:embed examples/switch_small.templ
var switchSmallTempl string

var switchDisabledHTML = renderExampleHTML(examples.SwitchDisabled())

//go:embed examples/switch_disabled.templ
var switchDisabledTempl string
