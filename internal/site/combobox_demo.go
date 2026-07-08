package site

import (
	_ "embed"
	"github.com/romshark/morpheus/internal/site/examples"
)

// Embedded from the same .js modules the page loads at runtime so the
// "Server script" tabs can't drift.

//go:embed static/sim/combobox/async-load.js
var comboboxAsyncLoadScript string

//go:embed static/sim/combobox/asyncload.js
var comboboxAsyncFailureScript string

//go:embed static/sim/combobox/search.js
var comboboxSearchScript string

//go:embed static/sim/combobox/lazy-once.js
var comboboxLazyOnceScript string

// comboboxPlaygroundStates seeds the overview playground. Default first,
// then one state per documented example reusing the static `*HTML`
// sources so preview and copyable source stay in lockstep.
func comboboxPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: comboboxPlaygroundDefaultHTML},
		{Label: "Disabled control", HTML: comboboxDisabledControlHTML},
		{Label: "Grouped options", HTML: comboboxGroupedHTML, CSS: comboboxGroupedCSS},
		{Label: "Multiple selection", HTML: comboboxMultipleHTML},
		{Label: "Rich options", HTML: comboboxRichOptionsHTML, CSS: comboboxRichOptionsCSS},
		{Label: "Custom trigger face", HTML: comboboxCustomTriggerFaceHTML, CSS: comboboxCustomTriggerFaceCSS},
		{Label: "Multi-select chips", HTML: comboboxMultiFaceHTML, CSS: comboboxMultiFaceCSS},
		{Label: "Open above", HTML: comboboxOpenAboveHTML},
	}
}

// comboboxMorphStates seeds the "Morphing during interaction"
// playground. Autoplay cycles the states, each one a fat-morph of the
// option list onto the same live <neo-combobox>: options appear,
// disappear, and flip to disabled while the element stays mounted (and
// its popover open). The shared root tag is what lets idiomorph keep the
// element across states.
func comboboxMorphStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: comboboxMorphDefaultHTML},
		{Label: "Add more options", HTML: comboboxMorphMoreHTML},
		{Label: "Disable some options", HTML: comboboxMorphDisabledHTML},
	}
}

//go:embed examples/combobox_morph_default.html
var comboboxMorphDefaultHTML string

//go:embed examples/combobox_morph_more.html
var comboboxMorphMoreHTML string

//go:embed examples/combobox_morph_disabled.html
var comboboxMorphDisabledHTML string

// comboboxPlaygroundDefaultHTML is the overview playground's Default
// state. The primary editable attribute is `value`, bound to the
// signal-editable `combobox_value`.
// data-signals sits on the <neo-combobox> itself, not a wrapper <div>:
// the playground morphs each state into the preview container, and
// idiomorph only preserves a node when its tag matches across states.
// Every other state's root is <neo-combobox>, so a wrapper here would
// make the Default↔other transitions swap the root tag, tear down the
// element, and close an open popover.
//
//go:embed examples/combobox_default.html
var comboboxPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in
// the Combobox page's "Examples" section.

var comboboxDisabledControlHTML = renderExampleHTML(examples.ComboboxDisabledControl())

//go:embed examples/combobox_disabled_control.templ
var comboboxDisabledControlTempl string

var comboboxFormSubmissionHTML = renderExampleHTML(examples.ComboboxFormSubmission())

//go:embed examples/combobox_form.templ
var comboboxFormSubmissionTempl string

//go:embed examples/combobox_form.css
var comboboxFormSubmissionCSS string

var comboboxGroupedHTML = renderExampleHTML(examples.ComboboxGrouped())

//go:embed examples/combobox_grouped.templ
var comboboxGroupedTempl string

//go:embed examples/combobox_grouped.css
var comboboxGroupedCSS string

var comboboxMultipleHTML = renderExampleHTML(examples.ComboboxMultiple())

//go:embed examples/combobox_multiple.templ
var comboboxMultipleTempl string

var comboboxAsyncHTML = renderExampleHTML(examples.ComboboxAsync())

//go:embed examples/combobox_async.templ
var comboboxAsyncTempl string

//go:embed examples/combobox_async.css
var comboboxAsyncCSS string

var comboboxLazyHTML = renderExampleHTML(examples.ComboboxLazy())

//go:embed examples/combobox_lazy.templ
var comboboxLazyTempl string

//go:embed examples/combobox_lazy.css
var comboboxLazyCSS string

var comboboxLiveSearchHTML = renderExampleHTML(examples.ComboboxLiveSearch())

//go:embed examples/combobox_live_search.templ
var comboboxLiveSearchTempl string

//go:embed examples/combobox_live_search.css
var comboboxLiveSearchCSS string

var comboboxOpenAboveHTML = renderExampleHTML(examples.ComboboxOpenAbove())

//go:embed examples/combobox_open_above.templ
var comboboxOpenAboveTempl string

var comboboxRichOptionsHTML = renderExampleHTML(examples.ComboboxRichOptions())

//go:embed examples/combobox_rich_options.templ
var comboboxRichOptionsTempl string

//go:embed examples/combobox_rich_options.css
var comboboxRichOptionsCSS string

var comboboxCustomTriggerFaceHTML = renderExampleHTML(examples.ComboboxCustomTriggerFace())

//go:embed examples/combobox_custom_trigger_face.templ
var comboboxCustomTriggerFaceTempl string

//go:embed examples/combobox_custom_trigger_face.css
var comboboxCustomTriggerFaceCSS string

var comboboxMultiFaceHTML = renderExampleHTML(examples.ComboboxMultiFace())

//go:embed examples/combobox_multi_face.templ
var comboboxMultiFaceTempl string

//go:embed examples/combobox_multi_face.css
var comboboxMultiFaceCSS string
