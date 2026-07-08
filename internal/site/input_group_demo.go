package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// One templ source per example under examples/, driving both the live
// preview (rendered HTML) and the Templ source tab. Input group is a
// layout primitive whose styling (border, radius, focus ring) wraps an
// inner `<input>` plus zero-or-more leading/trailing addon children.
// There's no per-instance live-knob worth toggling, so the page has no
// live-params playground, only static examples that show how to compose
// addons around a field.

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
