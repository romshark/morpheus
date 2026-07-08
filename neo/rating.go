package neo

import (
	"math"
	"strconv"
)

// RatingOpts is the attribute surface for <neo-rating>. Numeric
// defaults match the JS host: Max=5, Precision=1, Value=0. Set a numeric
// field when an explicit zero must still be emitted as an attribute
// (e.g. for a Datastar binding) rather than omitted.
type RatingOpts struct {
	Value, Max, Precision Attr[float64]

	// Icon is the neo-icon name drawn for each symbol (default "star").
	Icon Attr[string]
	// Label is the accessible name; also mirrored to aria-label.
	Label Attr[string]
	// Readonly renders the value but blocks interaction (still
	// announced). Disabled also dims it. Both drop it from tab order.
	Readonly Attr[bool]
	Disabled Attr[bool]
	// Size scales the symbol: "" (default) | "sm" | "lg".
	Size Attr[string]
	// AriaLabel is used when Label is empty (e.g. an icon-only rating
	// whose meaning is conveyed elsewhere).
	AriaLabel Attr[string]
}

func (o RatingOpts) max() int {
	m := o.Max.Or(5)
	if m < 1 {
		m = 1
	}
	return int(math.Floor(m))
}

func (o RatingOpts) precision() float64 {
	if p, ok := o.Precision.Value(); ok && p > 0 && p <= 1 {
		return p
	}
	return 1
}

func (o RatingOpts) value() float64 {
	v, ok := o.Value.Value()
	if !ok {
		return 0
	}
	p := o.precision()
	snapped := math.Round(v/p) * p
	clamped := math.Min(float64(o.max()), math.Max(0, snapped))
	d := decimalDigits(p)
	r, _ := strconv.ParseFloat(strconv.FormatFloat(clamped, 'f', d, 64), 64)
	return r
}

func (o RatingOpts) icon() string {
	if icon := o.Icon.Or(""); icon != "" {
		return icon
	}
	return "star"
}

// symbolPct is the fill percentage of the i-th symbol (1-based) for
// the current value: 100 for fully covered, a fraction for the
// partially-covered one under a non-integer value, 0 beyond it.
func (o RatingOpts) symbolPct(i int) float64 {
	frac := o.value() - float64(i-1)
	if frac <= 0 {
		return 0
	}
	if frac >= 1 {
		return 100
	}
	return frac * 100
}

// ratingValueText is the aria-valuetext ("3 / 5"), kept in one place so
// the prerender and the JS host stay phrased identically.
func ratingValueText(value float64, max int) string {
	return formatNumber(value) + " / " + strconv.Itoa(max)
}

// String accessors for the templ prerender (templ attribute values are
// string expressions); each mirrors a JS-host getter.

func (o RatingOpts) maxStr() string   { return strconv.Itoa(o.max()) }
func (o RatingOpts) valueStr() string { return formatNumber(o.value()) }
func (o RatingOpts) precisionStr() string {
	return formatNumber(o.precision())
}
func (o RatingOpts) valueText() string {
	return ratingValueText(o.value(), o.max())
}

func (o RatingOpts) ariaLabel() string {
	if label := o.Label.Or(""); label != "" {
		return label
	}
	return o.AriaLabel.Or("")
}

// symbolIndices is 1..max; templ ranges over it to emit one symbol
// per slot (a plain count loop reads worse in a template).
func (o RatingOpts) symbolIndices() []int {
	n := o.max()
	idx := make([]int, n)
	for i := range idx {
		idx[i] = i + 1
	}
	return idx
}
