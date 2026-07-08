package neo

type ColorFieldOpts[N Number] struct {
	// Value is a #rrggbb color.
	Value Attr[string]
	// Hue is optional; when set it controls the field's base hue while
	// the draggable handle edits saturation/value.
	Hue       Attr[N]
	Disabled  Attr[bool]
	AriaLabel Attr[string]
}
