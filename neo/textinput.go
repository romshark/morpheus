package neo

import (
	"maps"

	"github.com/a-h/templ"
)

// TextInputCase is the free-form case transform. Zero value
// (TextInputCaseDefault) emits no `case` attribute and preserves the
// typed case. Ignored when Mask is set; use a cased mask letter
// (U, A, l, a) instead.
type TextInputCase string

const (
	TextInputCaseDefault TextInputCase = ""
	TextInputCaseUpper   TextInputCase = "upper"
	TextInputCaseLower   TextInputCase = "lower"
)

// TextInputFormat is the live-formatting mode. Zero value
// (TextInputFormatDefault) emits no `format` attribute (mask / plain
// transforms apply instead).
type TextInputFormat string

const (
	TextInputFormatDefault TextInputFormat = ""
	TextInputFormatNumber  TextInputFormat = "number"
)

// TextInputType is the native <input type>. String-backed: values
// beyond these constants are accepted via conversion, but the listed
// set is what composes with masking / formatting (others have their
// own neo components or native pickers that don't).
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
// maxlength, pattern, min/max/step, …) and arbitrary attributes
// (style, aria-*, data-* / Datastar bindings) go through the trailing
// templ.Attributes of TextInputAttrs.
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
	maps.Copy(a, opts.Disabled.Attrs("disabled"))
	maps.Copy(a, opts.Readonly.Attrs("readonly"))
	maps.Copy(a, opts.Required.Attrs("required"))
	maps.Copy(a, attrs)
	return a
}
