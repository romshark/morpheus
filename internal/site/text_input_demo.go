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
		{Label: "Stepper", HTML: textInputStepperHTML},
		{Label: "Scrub", HTML: textInputScrubHTML},
		{Label: "Stepper customization", HTML: textInputStepperCustomHTML, CSS: textInputStepperCustomCSS},
		{Label: "Scrub customization", HTML: textInputScrubCustomHTML},
		{Label: "Disabled", HTML: textInputDisabledHTML},
	}
}

//go:embed examples/text_input_default.html
var textInputPlaygroundDefaultHTML string

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

var textInputStepperHTML = renderExampleHTML(examples.TextInputStepper())

//go:embed examples/text_input_stepper.templ
var textInputStepperTempl string

var textInputStepperCustomHTML = renderExampleHTML(examples.TextInputStepperCustom())

//go:embed examples/text_input_stepper_custom.templ
var textInputStepperCustomTempl string

//go:embed examples/text_input_stepper_custom.css
var textInputStepperCustomCSS string

var textInputScrubHTML = renderExampleHTML(examples.TextInputScrub())

//go:embed examples/text_input_scrub.templ
var textInputScrubTempl string

var textInputScrubCustomHTML = renderExampleHTML(examples.TextInputScrubCustom())

//go:embed examples/text_input_scrub_custom.templ
var textInputScrubCustomTempl string

var textInputDisabledHTML = renderExampleHTML(examples.TextInputDisabled())

//go:embed examples/text_input_disabled.templ
var textInputDisabledTempl string

var textInputAutocompleteHTML = renderExampleHTML(examples.TextInputAutocomplete())

//go:embed examples/text_input_autocomplete.templ
var textInputAutocompleteTempl string

//go:embed examples/text_input_autocomplete.css
var textInputAutocompleteCSS string

//go:embed static/sim/textinput/suggest.js
var textInputSuggestScript string

func textInputSuggestStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Initial", HTML: textInputSuggestInitialHTML},
		{Label: "Suggestions", HTML: textInputSuggestFilledHTML},
		{Label: "Disabled", HTML: textInputSuggestDisabledHTML},
		{Label: "Rich", HTML: textInputSuggestRichHTML, CSS: textInputSuggestRichCSS},
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

//go:embed examples/text_input_suggest_rich.css
var textInputSuggestRichCSS string
