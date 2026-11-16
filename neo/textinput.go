package neo

import (
	"maps"

	"github.com/a-h/templ"
)

// TextInputCase is the free-form case transform. Zero value
// ([TextInputCaseDefault]) emits no `case` attribute and preserves the
// typed case. Ignored when Mask is set; use a cased mask letter
// (U, A, l, a) instead.
type TextInputCase string

const (
	TextInputCaseDefault TextInputCase = ""
	TextInputCaseUpper   TextInputCase = "upper"
	TextInputCaseLower   TextInputCase = "lower"
)

// TextInputFormat is the live-formatting mode. Zero value
// ([TextInputFormatDefault]) emits no `format` attribute (mask / plain
// transforms apply instead).
type TextInputFormat string

const (
	TextInputFormatDefault TextInputFormat = ""
	TextInputFormatNumber  TextInputFormat = "number"
)

// TextInputScrub is the drag axis of the scrub handle. Zero value
// ([TextInputScrubDefault]) emits no `scrub` attribute and shows no handle.
type TextInputScrub string

const (
	TextInputScrubDefault    TextInputScrub = ""
	TextInputScrubHorizontal TextInputScrub = "horizontal"
	TextInputScrubVertical   TextInputScrub = "vertical"
)

// TextInputScrubSide is the side of the field the scrub handle sits on. Zero
// value ([TextInputScrubSideDefault]) emits no `scrub-side` attribute (the
// component default is the start).
type TextInputScrubSide string

const (
	TextInputScrubSideDefault TextInputScrubSide = ""
	TextInputScrubSideStart   TextInputScrubSide = "start"
	TextInputScrubSideEnd     TextInputScrubSide = "end"
)

// TextInputType is the native <input type>. It is string-backed and
// accepts values beyond these constants via conversion, but only the
// listed set composes with masking / formatting (others have their own
// neo components or native pickers that don't).
type TextInputType string

const (
	TextInputTypeText     TextInputType = "" // native default
	TextInputTypeSearch   TextInputType = "search"
	TextInputTypeTel      TextInputType = "tel"
	TextInputTypeURL      TextInputType = "url"
	TextInputTypeEmail    TextInputType = "email"
	TextInputTypePassword TextInputType = "password"
)

// TextInputInputmode is the native `inputmode` virtual-keyboard hint.
// String-backed; these are the full WHATWG set.
type TextInputInputmode string

const (
	TextInputInputmodeDefault TextInputInputmode = ""
	TextInputInputmodeNone    TextInputInputmode = "none"
	TextInputInputmodeText    TextInputInputmode = "text"
	TextInputInputmodeDecimal TextInputInputmode = "decimal"
	TextInputInputmodeNumeric TextInputInputmode = "numeric"
	TextInputInputmodeTel     TextInputInputmode = "tel"
	TextInputInputmodeSearch  TextInputInputmode = "search"
	TextInputInputmodeEmail   TextInputInputmode = "email"
	TextInputInputmodeURL     TextInputInputmode = "url"
)

// TextInputOpts is the typed attribute surface for <neo-textinput>.
// The zero value renders a plain text field. Unset fields emit nothing
// (the component's own default applies).
//
// Native passthrough attributes not modelled here (autocomplete,
// maxlength, pattern, ...) and arbitrary attributes
// (style, aria-*, data-* / Datastar bindings) go through the trailing
// [templ.Attributes] of [TextInputAttrs].
type TextInputOpts struct {
	Name        Attr[string]
	Type        Attr[TextInputType]
	Value       Attr[string]
	Placeholder Attr[string]
	Inputmode   Attr[TextInputInputmode]
	// List points at a shared <neo-datalist> by id (like native
	// <input list>) to source autocomplete suggestions. Inline
	// suggestion options take precedence.
	List Attr[string]

	Mask   Attr[string]
	Format Attr[TextInputFormat]
	Prefix Attr[string]

	// DecimalPlaces caps decimals for Format "number"; the component
	// default is -1 (unbounded). Set(0) emits an explicit 0; unset omits
	// the attribute.
	DecimalPlaces Attr[int]
	// DecimalMark is the Format "number" decimal separator, "." or
	// ",". Empty omits the attribute (component default ".").
	DecimalMark Attr[string]
	// ThousandsSeparator is the Format "number" grouping separator.
	// Empty omits the attribute (component default ",").
	ThousandsSeparator Attr[string]

	NumericOnly Attr[bool]
	Case        Attr[TextInputCase]
	SubmitRaw   Attr[bool]
	// Stepper shows increment and decrement buttons on a number field
	// (Format "number" or type "number").
	Stepper Attr[bool]
	// IncrementIcon and DecrementIcon name the stepper button icons
	// (default an up and a down chevron).
	IncrementIcon Attr[string]
	DecrementIcon Attr[string]
	// Scrub shows a drag handle in a number field that steps the value
	// along the given axis. ScrubIcon names its icon, ScrubSide places it
	// at the start or the end of the field and ScrubSensitivity sets the
	// steps per pixel of drag (component default 0.5).
	Scrub            Attr[TextInputScrub]
	ScrubIcon        Attr[string]
	ScrubSide        Attr[TextInputScrubSide]
	ScrubSensitivity Attr[float64]
	// Min, Max and Step bound and size the ArrowUp/ArrowDown and stepper
	// steps of a number field. Pass step="any" through the attrs of
	// [TextInputAttrs].
	Min  Attr[float64]
	Max  Attr[float64]
	Step Attr[float64]

	// Size is the control-size step ("sm" | "lg"); empty is the default
	// size. Shared with the other row controls so they line up.
	Size Attr[string]

	Disabled Attr[bool]
	Readonly Attr[bool]
	Required Attr[bool]
}

// textInputMergedAttrs flattens opts into an attribute map, then lets
// caller attrs override (matching templ's last-attribute-wins order so
// the escape hatch can patch any field).
func textInputMergedAttrs(opts TextInputOpts, attrs templ.Attributes) templ.Attributes {
	a := templ.Attributes{}
	maps.Copy(a, opts.Name.Attrs("name"))
	maps.Copy(a, opts.Type.Attrs("type"))
	maps.Copy(a, opts.Value.Attrs("value"))
	maps.Copy(a, opts.Placeholder.Attrs("placeholder"))
	maps.Copy(a, opts.Inputmode.Attrs("inputmode"))
	maps.Copy(a, opts.List.Attrs("list"))
	maps.Copy(a, opts.Mask.Attrs("mask"))
	maps.Copy(a, opts.Format.Attrs("format"))
	maps.Copy(a, opts.Prefix.Attrs("prefix"))
	maps.Copy(a, opts.DecimalPlaces.Attrs("decimal-places"))
	maps.Copy(a, opts.DecimalMark.Attrs("decimal-mark"))
	maps.Copy(a, opts.ThousandsSeparator.Attrs("thousands-separator"))
	maps.Copy(a, opts.NumericOnly.Attrs("numeric-only"))
	maps.Copy(a, opts.Case.Attrs("case"))
	maps.Copy(a, opts.Size.Attrs("size"))
	maps.Copy(a, opts.SubmitRaw.Attrs("submit-raw"))
	maps.Copy(a, opts.Stepper.Attrs("stepper"))
	maps.Copy(a, opts.IncrementIcon.Attrs("increment-icon"))
	maps.Copy(a, opts.DecrementIcon.Attrs("decrement-icon"))
	maps.Copy(a, opts.Scrub.Attrs("scrub"))
	maps.Copy(a, opts.ScrubIcon.Attrs("scrub-icon"))
	maps.Copy(a, opts.ScrubSide.Attrs("scrub-side"))
	maps.Copy(a, opts.ScrubSensitivity.Attrs("scrub-sensitivity"))
	maps.Copy(a, opts.Min.Attrs("min"))
	maps.Copy(a, opts.Max.Attrs("max"))
	maps.Copy(a, opts.Step.Attrs("step"))
	maps.Copy(a, opts.Disabled.Attrs("disabled"))
	maps.Copy(a, opts.Readonly.Attrs("readonly"))
	maps.Copy(a, opts.Required.Attrs("required"))
	maps.Copy(a, attrs)
	return a
}
