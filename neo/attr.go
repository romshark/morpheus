package neo

import (
	"fmt"

	"github.com/a-h/templ"
)

type Number interface {
	uint | uint8 | uint16 | uint32 | uint64 |
		int | int8 | int16 | int32 | int64 |
		float32 | float64
}

// Attr is an optional Templ parameter. The zero value is "not set" and
// renders no attribute, so an explicit zero/empty/false can be
// represented distinctly from unset. Construct a set value with Set.
type Attr[T any] struct {
	value T
	isSet bool
}

// Set marks a value present, so it renders even when it is the zero value
// (Set("") renders name="", Set(false) renders name="false").
func Set[T any](value T) Attr[T] {
	return Attr[T]{value: value, isSet: true}
}

// Value reports the value and whether it was set.
func (a Attr[T]) Value() (T, bool) { return a.value, a.isSet }

// IsSet reports whether the attribute was set.
func (a Attr[T]) IsSet() bool { return a.isSet }

// Or returns the value when set, else dflt. Convenience for consumers that
// need the effective value (e.g. a wrapper reading a delegated field).
func (a Attr[T]) Or(dflt T) T {
	if a.isSet {
		return a.value
	}
	return dflt
}

// Attrs renders the attribute under name when set, else nothing (spread it
// with { a.Attrs("name")... }). A set bool renders as a bare attribute for
// true and name="false" for false, matching the boolean command contract;
// every other type renders name="value".
func (a Attr[T]) Attrs(name string) templ.Attributes {
	if !a.isSet {
		return nil
	}
	switch v := any(a.value).(type) {
	case bool:
		if v {
			return templ.Attributes{name: true}
		}
		return templ.Attributes{name: "false"}
	default:
		return templ.Attributes{name: fmt.Sprintf("%v", v)}
	}
}
