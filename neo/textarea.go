package neo

import (
	"maps"

	"github.com/a-h/templ"
)

// TextareaOpts is the typed attribute surface for <neo-textarea>. The
// field lives in the component's shadow root, so these become host
// attributes (the component forwards the native ones to the inner field).
// The zero value renders a plain multi-line field. Native attributes not
// modelled here and arbitrary attributes (style, aria-*, data-* / Datastar
// bindings) go through the trailing templ.Attributes of TextareaAttrs.
type TextareaOpts struct {
	Name        Attr[string]
	Value       Attr[string]
	Placeholder Attr[string]
	// Rows / Cols set the field's intrinsic size. Rows also drops the
	// min-height floor, so Rows: Set(1) renders a single row.
	Rows      Attr[int]
	Cols      Attr[int]
	MaxLength Attr[int]

	Readonly Attr[bool]
	Disabled Attr[bool]
	Required Attr[bool]

	// Size is the control-size step ("sm" | "lg"); empty is the default
	// size. Shared with the other row controls so they line up.
	Size Attr[string]

	// ScaleHorizontal / ScaleVertical show the manual resize handle on
	// that axis. Setting AutoResize* on an axis disables manual resize
	// on that axis (auto-resize wins).
	ScaleHorizontal Attr[bool]
	ScaleVertical   Attr[bool]

	// AutoResizeWidth / AutoResizeHeight auto-grow the field: Set("") means
	// "unlimited growth" (no cap); Set of a non-empty CSS length (e.g.
	// "100%", "40rem") caps growth and starts scrolling; unset leaves the
	// axis fixed.
	AutoResizeWidth  Attr[CSSUnit]
	AutoResizeHeight Attr[CSSUnit]
}

// textareaMergedAttrs flattens opts into host attributes, then lets caller
// attrs override (templ's last-attribute-wins order, so the escape hatch
// can patch any field).
func textareaMergedAttrs(opts TextareaOpts, attrs templ.Attributes) templ.Attributes {
	a := templ.Attributes{}
	maps.Copy(a, opts.Name.Attrs("name"))
	maps.Copy(a, opts.Value.Attrs("value"))
	maps.Copy(a, opts.Placeholder.Attrs("placeholder"))
	maps.Copy(a, opts.Rows.Attrs("rows"))
	maps.Copy(a, opts.Cols.Attrs("cols"))
	maps.Copy(a, opts.MaxLength.Attrs("maxlength"))
	maps.Copy(a, opts.Readonly.Attrs("readonly"))
	maps.Copy(a, opts.Disabled.Attrs("disabled"))
	maps.Copy(a, opts.Required.Attrs("required"))
	maps.Copy(a, opts.Size.Attrs("size"))
	maps.Copy(a, opts.ScaleHorizontal.Attrs("scale-horizontal"))
	maps.Copy(a, opts.ScaleVertical.Attrs("scale-vertical"))
	maps.Copy(a, opts.AutoResizeWidth.Attrs("auto-resize-width"))
	maps.Copy(a, opts.AutoResizeHeight.Attrs("auto-resize-height"))
	maps.Copy(a, attrs)
	return a
}
