package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// One templ source per example under examples/, driving both the live
// preview (rendered HTML) and the Templ source tab.

// inputGroupPlaygroundStates seeds the playground with the editable
// Default state plus a curated set of the page's static examples. Only
// self-contained examples are reused so each state's CSS tab is the full
// source (the range/comparison/domain demos lean on global classes in
// style.css and would show an empty CSS tab).
func inputGroupPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: inputGroupDefaultHTML, CSS: inputGroupDefaultCSS},
		{Label: "Currency prefix", HTML: inputGroupCurrencyHTML},
		{Label: "Search", HTML: inputGroupSearchIconHTML},
		{Label: "Search with shortcut", HTML: inputGroupSearchShortcutHTML},
		{Label: "Search with submit", HTML: inputGroupSearchSubmitHTML},
		{Label: "Toolbar", HTML: inputGroupToolbarHTML, CSS: inputGroupToolbarCSS},
		{Label: "Disabled", HTML: inputGroupDisabledHTML},
	}
}

//go:embed examples/input_group_default.html
var inputGroupDefaultHTML string

//go:embed examples/input_group_default.css
var inputGroupDefaultCSS string

var inputGroupCurrencyHTML = renderExampleHTML(examples.InputGroupCurrency())

//go:embed examples/input_group_currency.templ
var inputGroupCurrencyTempl string

var inputGroupDomainHTML = renderExampleHTML(examples.InputGroupDomain())

//go:embed examples/input_group_domain.templ
var inputGroupDomainTempl string

var inputGroupRangeHTML = renderExampleHTML(examples.InputGroupRange())

//go:embed examples/input_group_range.templ
var inputGroupRangeTempl string

var inputGroupComparisonHTML = renderExampleHTML(examples.InputGroupComparison())

//go:embed examples/input_group_comparison.templ
var inputGroupComparisonTempl string

var inputGroupSearchIconHTML = renderExampleHTML(examples.InputGroupSearchIcon())

//go:embed examples/input_group_search_icon.templ
var inputGroupSearchIconTempl string

var inputGroupSearchShortcutHTML = renderExampleHTML(examples.InputGroupSearchShortcut())

//go:embed examples/input_group_search_shortcut.templ
var inputGroupSearchShortcutTempl string

var inputGroupSearchSubmitHTML = renderExampleHTML(examples.InputGroupSearchSubmit())

//go:embed examples/input_group_search_submit.templ
var inputGroupSearchSubmitTempl string

var inputGroupDisabledHTML = renderExampleHTML(examples.InputGroupDisabled())

//go:embed examples/input_group_disabled.templ
var inputGroupDisabledTempl string

var inputGroupToolbarHTML = renderExampleHTML(examples.InputGroupToolbar())

//go:embed examples/input_group_toolbar.templ
var inputGroupToolbarTempl string

//go:embed examples/input_group_toolbar.css
var inputGroupToolbarCSS string
