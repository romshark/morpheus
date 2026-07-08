package neo

// SpinnerOpts is the determinate-ring attribute surface for
// <neo-spinner>. Numeric defaults match the JS host: Min=0, Max=100,
// Value=Min. Set a numeric field when an explicit zero must still be
// emitted as an attribute (otherwise it's omitted and the host falls
// back to its default).
type SpinnerOpts[N Number] struct {
	Min, Max, Value Attr[N]

	// Indeterminate forces the spin even when a value is set.
	Indeterminate Attr[bool]

	// Label is the accessible name; with it set the spinner reports
	// role="progressbar".
	Label Attr[string]
	// Tooltip wraps the ring in a <neo-tooltip> showing the value
	// (plus Unit) on hover/focus; no text is painted on the ring
	// itself. The tooltip text is rendered from the initial value;
	// drive a changing value through aria-valuenow rather than this.
	Tooltip Attr[bool]
	Unit    Attr[string]

	// Easing animates the arc between value commits: same shorthand
	// as ProgressOpts.Easing.
	Easing    Attr[string]
	AriaLabel Attr[string]
}

func (o SpinnerOpts[N]) min() N {
	return o.Min.Or(0)
}

func (o SpinnerOpts[N]) max() N {
	m := o.Max.Or(100)
	return max(m, o.min()+1)
}

func (o SpinnerOpts[N]) value() N {
	v := o.Value.Or(o.min())
	return min(max(v, o.min()), o.max())
}

// determinate reports whether a value is set and the spin isn't forced.
func (o SpinnerOpts[N]) determinate() bool {
	return o.Value.IsSet() && !o.Indeterminate.Or(false)
}

func (o SpinnerOpts[N]) ariaLabel() string {
	if label := o.Label.Or(""); label != "" {
		return label
	}
	return o.AriaLabel.Or("")
}

func (o SpinnerOpts[N]) valueStr() string { return formatNumber(o.value()) }

// tooltipText is the value (+ unit) shown in the optional wrapping
// tooltip.
func (o SpinnerOpts[N]) tooltipText() string {
	return formatNumber(o.value()) + o.Unit.Or("")
}
