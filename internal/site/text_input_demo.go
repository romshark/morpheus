package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func textInputPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: textInputPlaygroundDefaultHTML},
		{Label: "Card-style mask", HTML: textInputCardMaskHTML},
		{Label: "Mixed mask", HTML: textInputMixedMaskHTML},
		{Label: "Phone", HTML: textInputPhoneHTML},
		{Label: "Date", HTML: textInputDateHTML},
		{Label: "Number", HTML: textInputNumberHTML},
		{Label: "Number (EU)", HTML: textInputNumberEUHTML},
		{Label: "Disabled", HTML: textInputDisabledHTML},
	}
}

//go:embed examples/text_input_default.html
var textInputPlaygroundDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Input page's "Examples" section. Each pair shows the verbatim markup
// an author would copy/paste, with no Datastar wiring, no live-param
// signals.

var textInputCardMaskHTML = renderExampleHTML(examples.TextInputCardMask())

//go:embed examples/text_input_card_mask.templ
var textInputCardMaskTempl string

var textInputMixedMaskHTML = renderExampleHTML(examples.TextInputMixedMask())

//go:embed examples/text_input_mixed_mask.templ
var textInputMixedMaskTempl string

var textInputPhoneHTML = renderExampleHTML(examples.TextInputPhone())

//go:embed examples/text_input_phone.templ
var textInputPhoneTempl string

var textInputDateHTML = renderExampleHTML(examples.TextInputDate())

//go:embed examples/text_input_date.templ
var textInputDateTempl string

var textInputNumberHTML = renderExampleHTML(examples.TextInputNumber())

//go:embed examples/text_input_number.templ
var textInputNumberTempl string

var textInputNumberEUHTML = renderExampleHTML(examples.TextInputNumberEu())

//go:embed examples/text_input_number_eu.templ
var textInputNumberEUTempl string

var textInputDisabledHTML = renderExampleHTML(examples.TextInputDisabled())

//go:embed examples/text_input_disabled.templ
var textInputDisabledTempl string

// Datastar "Autocomplete" example: the field's own value stays free
// text; the server morphs <neo-option> rows into the suggestions slot.
// The .js handler is embedded so the demo's "Server script" tab can't
// drift from the module the page loads at runtime.

var textInputAutocompleteHTML = renderExampleHTML(examples.TextInputAutocomplete())

//go:embed examples/text_input_autocomplete.templ
var textInputAutocompleteTempl string

//go:embed examples/text_input_autocomplete.css
var textInputAutocompleteCSS string

//go:embed static/sim/textinput/suggest.js
var textInputSuggestScript string

// textInputSuggestStates seeds the "Suggestion states" playground. Each
// state is a fat-morph of the suggestions slot onto the same live
// <neo-textinput>: empty, plain rows, some disabled, then rich rows. The
// `open` attribute forces the popover open so each state is visible
// without focusing the preview.
func textInputSuggestStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Initial", HTML: textInputSuggestInitialHTML},
		{Label: "Suggestions", HTML: textInputSuggestFilledHTML},
		{Label: "Disabled", HTML: textInputSuggestDisabledHTML},
		{Label: "Rich", HTML: textInputSuggestRichHTML},
		{Label: "No results", HTML: textInputSuggestEmptyHTML},
	}
}

//go:embed examples/text_input_suggest_initial.html
var textInputSuggestInitialHTML string

//go:embed examples/text_input_suggest_filled.html
var textInputSuggestFilledHTML string

//go:embed examples/text_input_suggest_disabled.html
var textInputSuggestDisabledHTML string

//go:embed examples/text_input_suggest_rich.html
var textInputSuggestRichHTML string

//go:embed examples/text_input_suggest_empty.html
var textInputSuggestEmptyHTML string
