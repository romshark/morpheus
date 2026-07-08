package neo

import (
	"math"
	"strconv"
	"strings"
)

// SliderMark describes one anchor mark on a Slider's rail. Value is
// the numeric position. Label is the optional caption beneath the rail
// (empty draws just the dot). Marks outside [Min, Max] are skipped.
type SliderMark struct {
	Value float64
	Label string
}

// SliderOpts numeric defaults match the JS host: Min=0, Max=100,
// Step=1, Value=Min. Set a numeric field when an explicit zero needs to
// override the default (e.g. Set(0) on Min emits the attribute with "0"
// verbatim for clarity / Datastar binding).
type SliderOpts[N Number] struct {
	Min, Max, Step, Value Attr[N]

	Label Attr[string]
	Unit  Attr[string]

	// HideValue suppresses the editable readout.
	HideValue Attr[bool]
	// HideTooltip suppresses the value bubble above the thumb.
	HideTooltip Attr[bool]
	Vertical    Attr[bool]
	// StaticMarks makes marks decorative (no click-to-snap).
	StaticMarks Attr[bool]
	// MarksOnly constrains navigation to land on a mark value.
	MarksOnly Attr[bool]
	Disabled  Attr[bool]

	// Easing is the transition shorthand for thumb/fill animation
	// between commits.
	Easing    Attr[string]
	Marks     []SliderMark
	AriaLabel Attr[string]
}

// formatNumber renders n in its shortest string form: minimum-precision
// 'g' for floats, base 10 for integers. Matches the JS `String(num)`
// pretty-print used in min/max/value attrs.
func formatNumber[N Number](n N) string {
	switch v := any(n).(type) {
	case float64:
		return strconv.FormatFloat(v, 'g', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(v), 'g', -1, 32)
	case uint, uint8, uint16, uint32, uint64:
		return strconv.FormatUint(uint64(n), 10)
	default: // signed integers
		return strconv.FormatInt(int64(n), 10)
	}
}

// decimalDigits returns the number of decimal digits in a step value,
// mirroring the JS `decimalDigits(step)` helper.
func decimalDigits(step float64) int {
	if step <= 0 || math.IsNaN(step) || math.IsInf(step, 0) {
		return 0
	}
	s := strconv.FormatFloat(step, 'g', -1, 64)
	if _, after, ok := strings.Cut(s, "."); ok {
		// Account for trailing exponent like "1.5e-3".
		tail := after
		if exp := strings.IndexByte(tail, 'e'); exp >= 0 {
			frac := exp
			extra, _ := strconv.Atoi(strings.TrimPrefix(tail[exp+1:], "+"))
			return frac - extra
		}
		return len(tail)
	}
	if _, after, ok := strings.Cut(s, "e-"); ok {
		n, _ := strconv.Atoi(after)
		return n
	}
	return 0
}

// formatPct renders a percentage trimmed to its minimum representation.
func formatPct(p float64) string {
	return strconv.FormatFloat(p, 'f', -1, 64) + "%"
}
