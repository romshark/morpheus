package neo

import (
	"maps"
	"strings"

	"github.com/a-h/templ"
)

// ResizableHandles is a bitmask of the directions a Resizable exposes
// drag handles for. Combine with `|`.
type ResizableHandles uint16

const (
	ResizableTop ResizableHandles = 1 << iota
	ResizableBottom
	ResizableLeft
	ResizableRight
	ResizableTopLeft
	ResizableTopRight
	ResizableBottomLeft
	ResizableBottomRight
)

// names returns the CSS-friendly handle names for the set bits in
// stable order. Mirrors ALL_HANDLES in web/src/neo-resizable/neo-resizable.ts.
func (h ResizableHandles) names() []string {
	out := make([]string, 0, 8)
	if h&ResizableTop != 0 {
		out = append(out, "top")
	}
	if h&ResizableBottom != 0 {
		out = append(out, "bottom")
	}
	if h&ResizableLeft != 0 {
		out = append(out, "left")
	}
	if h&ResizableRight != 0 {
		out = append(out, "right")
	}
	if h&ResizableTopLeft != 0 {
		out = append(out, "top-left")
	}
	if h&ResizableTopRight != 0 {
		out = append(out, "top-right")
	}
	if h&ResizableBottomLeft != 0 {
		out = append(out, "bottom-left")
	}
	if h&ResizableBottomRight != 0 {
		out = append(out, "bottom-right")
	}
	return out
}

// String renders the set bits as the space-separated value the
// `handles=""` attribute expects.
func (h ResizableHandles) String() string {
	return strings.Join(h.names(), " ")
}

// resizableIconByName mirrors DEFAULT_ICON in web/src/neo-resizable/neo-resizable.ts.
// Keep the two in sync.
var resizableIconByName = map[string]string{
	"top":          "grip-horizontal",
	"bottom":       "grip-horizontal",
	"left":         "grip-vertical",
	"right":        "grip-vertical",
	"top-left":     "move-diagonal-2",
	"bottom-right": "move-diagonal-2",
	"top-right":    "move-diagonal",
	"bottom-left":  "move-diagonal",
}

// ResizableOpts is the typed attribute surface for <neo-resizable>.
// The sizing fields are CSS lengths mirrored to inline style for first
// paint and emitted as the element's observed attributes.
type ResizableOpts[N Number] struct {
	// Handles is the bitmask of edges/corners to expose drag handles
	// for. Zero value exposes none (resize disabled).
	Handles Attr[ResizableHandles]
	// Width / Height are the initial size.
	Width, Height Attr[CSSUnit]
	// Min/Max bounds; any CSS length, or "none" to clear a default.
	MinWidth, MaxWidth   Attr[CSSUnit]
	MinHeight, MaxHeight Attr[CSSUnit]
	// StepHorizontal / StepVertical snap width / height to a pixel grid
	// during resize. Zero (the default) means free resize on that axis.
	StepHorizontal, StepVertical Attr[N]
	// HandleIcons overrides the default glyph for specific handles, keyed
	// by handle name ("bottom-right", "top", …). The supplied content
	// renders inside that handle instead of the default <neo-icon>, and is
	// prerendered so the glyph survives morphs and matches first paint.
	HandleIcons map[string]templ.Component
}

// resizableMergedAttrs flattens the opts sizing fields into the
// attribute map (caller attrs win), then runs the existing
// first-paint inline-style mirroring over the result.
func resizableMergedAttrs[N Number](
	opts ResizableOpts[N],
	attrs templ.Attributes,
) templ.Attributes {
	a := templ.Attributes{}
	if width := opts.Width.Or(""); width != "" {
		a["width"] = width
	}
	if height := opts.Height.Or(""); height != "" {
		a["height"] = height
	}
	if minWidth := opts.MinWidth.Or(""); minWidth != "" {
		a["min-width"] = minWidth
	}
	if maxWidth := opts.MaxWidth.Or(""); maxWidth != "" {
		a["max-width"] = maxWidth
	}
	if minHeight := opts.MinHeight.Or(""); minHeight != "" {
		a["min-height"] = minHeight
	}
	if maxHeight := opts.MaxHeight.Or(""); maxHeight != "" {
		a["max-height"] = maxHeight
	}
	if stepH := opts.StepHorizontal.Or(0); stepH > 0 {
		a["step-horizontal"] = formatNumber(stepH)
	}
	if stepV := opts.StepVertical.Or(0); stepV > 0 {
		a["step-vertical"] = formatNumber(stepV)
	}
	maps.Copy(a, attrs)
	return resizableRenderAttrs(a)
}

var resizableSizeAttrs = []struct {
	attr string
	css  string
}{
	{"width", "width"},
	{"height", "height"},
	{"min-width", "min-width"},
	{"max-width", "max-width"},
	{"min-height", "min-height"},
	{"max-height", "max-height"},
}

// resizableRenderAttrs preserves the public sizing attributes and
// mirrors them into inline CSS for first paint.
func resizableRenderAttrs(attrs templ.Attributes) templ.Attributes {
	if len(attrs) == 0 {
		return attrs
	}

	out := make(templ.Attributes, len(attrs)+1)
	for k, v := range attrs {
		out[k] = v
	}

	var b strings.Builder
	for _, item := range resizableSizeAttrs {
		value, ok := resizableAttrString(attrs[item.attr])
		if !ok {
			continue
		}
		b.WriteString(item.css)
		b.WriteByte(':')
		b.WriteString(value)
		b.WriteByte(';')
		if item.attr == "width" || item.attr == "height" {
			b.WriteString("--neo-resizable-")
			b.WriteString(item.attr)
			b.WriteByte(':')
			b.WriteString(value)
			b.WriteByte(';')
		}
	}
	if b.Len() == 0 {
		return attrs
	}

	if style, ok := resizableAttrString(attrs["style"]); ok {
		out["style"] = appendCSS(style, b.String())
	} else {
		out["style"] = b.String()
	}
	return out
}

func resizableAttrString(v any) (string, bool) {
	switch v := v.(type) {
	case string:
		return strings.TrimSpace(v), strings.TrimSpace(v) != ""
	case *string:
		if v == nil {
			return "", false
		}
		return strings.TrimSpace(*v), strings.TrimSpace(*v) != ""
	case templ.SafeCSS:
		return strings.TrimSpace(string(v)), strings.TrimSpace(string(v)) != ""
	case templ.SafeCSSProperty:
		return strings.TrimSpace(string(v)), strings.TrimSpace(string(v)) != ""
	default:
		return "", false
	}
}

func appendCSS(base, extra string) string {
	base = strings.TrimSpace(base)
	if base == "" {
		return extra
	}
	if !strings.HasSuffix(base, ";") {
		base += ";"
	}
	return base + extra
}
