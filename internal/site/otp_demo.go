package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func otpPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: otpPlaygroundDefaultHTML},
		{Label: "Groups", HTML: otpGroupsHTML},
		{Label: "Character rules", HTML: otpRulesHTML},
		{Label: "Placeholder", HTML: otpPlaceholderHTML},
		{Label: "PIN", HTML: otpPinHTML},
		{Label: "Right-to-left", HTML: otpRTLHTML},
		{Label: "Disabled", HTML: otpDisabledHTML},
		{Label: "Sizes", HTML: otpSizesHTML},
		{Label: "Custom properties", HTML: otpCustomPropsHTML, CSS: otpCustomPropsCSS},
		{Label: "Styling parts", HTML: otpPartsHTML, CSS: otpPartsCSS},
		{Label: "Client-side check", HTML: otpCheckHTML, CSS: otpCheckCSS},
		{Label: "Show and hide", HTML: otpRevealHTML},
	}
}

//go:embed examples/otp_default.html
var otpPlaygroundDefaultHTML string

var otpCheckHTML = renderExampleHTML(examples.OTPCheck())

//go:embed examples/otp_check.templ
var otpCheckTempl string

//go:embed examples/otp_check.css
var otpCheckCSS string

var otpGroupsHTML = renderExampleHTML(examples.OTPGroups())

//go:embed examples/otp_groups.templ
var otpGroupsTempl string

var otpRulesHTML = renderExampleHTML(examples.OTPRules())

//go:embed examples/otp_rules.templ
var otpRulesTempl string

var otpPlaceholderHTML = renderExampleHTML(examples.OTPPlaceholder())

//go:embed examples/otp_placeholder.templ
var otpPlaceholderTempl string

var otpPinHTML = renderExampleHTML(examples.OTPPin())

//go:embed examples/otp_pin.templ
var otpPinTempl string

var otpSizesHTML = renderExampleHTML(examples.OTPSizes())

//go:embed examples/otp_sizes.templ
var otpSizesTempl string

var otpDisabledHTML = renderExampleHTML(examples.OTPDisabled())

//go:embed examples/otp_disabled.templ
var otpDisabledTempl string

var otpRevealHTML = renderExampleHTML(examples.OTPReveal())

//go:embed examples/otp_reveal.templ
var otpRevealTempl string

var otpCustomPropsHTML = renderExampleHTML(examples.OTPCustomProps())

//go:embed examples/otp_custom_props.templ
var otpCustomPropsTempl string

//go:embed examples/otp_custom_props.css
var otpCustomPropsCSS string

var otpPartsHTML = renderExampleHTML(examples.OTPParts())

//go:embed examples/otp_parts.templ
var otpPartsTempl string

//go:embed examples/otp_parts.css
var otpPartsCSS string

var otpRTLHTML = renderExampleHTML(examples.OTPRTL())

//go:embed examples/otp_rtl.templ
var otpRTLTempl string
