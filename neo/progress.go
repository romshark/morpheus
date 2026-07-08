package neo

// ProgressMark describes one anchor mark on a Progress bar's rail.
// Value is the numeric position; Label is the optional caption beneath
// the rail (empty draws just the dot). Marks outside [Min, Max] are skipped.
type ProgressMark struct {
	Value float64
	Label string
}

// ProgressOpts numeric defaults match the JS host: Min=0, Max=100,
// Value=Min. Set a numeric field when an explicit zero needs to be
// emitted as an attribute (otherwise omitted, host uses its default).
type ProgressOpts[N Number] struct {
	Min, Max, Value Attr[N]

	Label Attr[string]
	Unit  Attr[string]

	// HideValue suppresses the value readout (and unit); combined
	// with empty Label this hides the header entirely.
	HideValue Attr[bool]
	Vertical  Attr[bool]
	// Indeterminate replaces the determinate fill with a looping
	// animation; Value is ignored while on, and the bar reads as
	// `aria-valuenow=""` so AT announces indeterminate state.
	Indeterminate Attr[bool]

	// Easing is the transition shorthand for the fill: same syntax as
	// SliderOpts.Easing.
	Easing    Attr[string]
	Marks     []ProgressMark
	AriaLabel Attr[string]
}

func (o ProgressOpts[N]) min() N {
	return o.Min.Or(0)
}

func (o ProgressOpts[N]) max() N {
	m := o.Max.Or(100)
	return max(m, o.min()+1)
}

func (o ProgressOpts[N]) value() N {
	v := o.Value.Or(o.min())
	return min(max(v, o.min()), o.max())
}

// ariaName is the progressbar's accessible name: the visible Label when set,
// else the explicit AriaLabel. Computed in Go to avoid an `else if` in the
// templ attribute list, which templ fmt mis-normalizes into a stray `else`.
func (o ProgressOpts[N]) ariaName() string {
	if label := o.Label.Or(""); label != "" {
		return label
	}
	return o.AriaLabel.Or("")
}
