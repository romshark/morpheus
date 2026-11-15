package neo

import (
	"regexp"
	"strings"
	"testing"

	"github.com/a-h/templ"
)

// TestFormControlPresenceAttrs tests that the form-associated wrappers render
// `disabled` and `readonly` bare for true and omit them for false. The
// browser disables a form-associated element whenever `disabled` is present.
func TestFormControlPresenceAttrs(t *testing.T) {
	disabled := regexp.MustCompile(`\sdisabled[\s>]`)
	readonly := regexp.MustCompile(`\sreadonly[\s>]`)
	falseAttr := regexp.MustCompile(`\s(disabled|readonly)="`)
	for _, tc := range []struct {
		name     string
		render   func(on bool) templ.Component
		readonly bool
	}{
		{"TextInput", func(on bool) templ.Component {
			return TextInput(TextInputOpts{Disabled: Set(on), Readonly: Set(on)})
		}, true},
		{"Textarea", func(on bool) templ.Component {
			return Textarea(TextareaOpts{Disabled: Set(on), Readonly: Set(on)})
		}, true},
		{"OTP", func(on bool) templ.Component {
			return OTP(OTPOpts{Disabled: Set(on), Readonly: Set(on)})
		}, true},
		{"Select", func(on bool) templ.Component {
			return Select(SelectOpts{Disabled: Set(on)})
		}, false},
		{"Combobox", func(on bool) templ.Component {
			return Combobox(ComboboxOpts{Disabled: Set(on)})
		}, false},
		{"SliderRange", func(on bool) templ.Component {
			return SliderRange(SliderRangeOpts[float64]{Disabled: Set(on)})
		}, false},
		{"RadioGroup", func(on bool) templ.Component {
			return RadioGroup(RadioGroupOpts{Disabled: Set(on)})
		}, false},
		{"Checkbox", func(on bool) templ.Component {
			return Checkbox(CheckboxOpts{Disabled: Set(on)})
		}, false},
		{"Switch", func(on bool) templ.Component {
			return Switch(SwitchOpts{Disabled: Set(on)})
		}, false},
		{"Slider", func(on bool) templ.Component {
			return Slider(SliderOpts[float64]{Disabled: Set(on)})
		}, false},
		{"Rating", func(on bool) templ.Component {
			return Rating(RatingOpts{Disabled: Set(on)})
		}, false},
		{"ColorField", func(on bool) templ.Component {
			return ColorField(ColorFieldOpts[float64]{Disabled: Set(on)})
		}, false},
		{"ToggleGroup", func(on bool) templ.Component {
			return ToggleGroup(ToggleGroupOpts{Disabled: Set(on)})
		}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			on := renderComponent(t, tc.render(true))
			if !disabled.MatchString(on) {
				t.Errorf("Set(true): want bare disabled, got %q", on)
			}
			if tc.readonly && !readonly.MatchString(on) {
				t.Errorf("Set(true): want bare readonly, got %q", on)
			}
			off := renderComponent(t, tc.render(false))
			if disabled.MatchString(off) || readonly.MatchString(off) || falseAttr.MatchString(off) {
				t.Errorf("Set(false): want no disabled or readonly, got %q", off)
			}
		})
	}
}

// TestFormControlNameValueRequired tests that the form control wrappers render
// the attributes their form value and validity read.
func TestFormControlNameValueRequired(t *testing.T) {
	for _, tc := range []struct {
		name string
		c    templ.Component
		want []string
	}{
		{"Checkbox", Checkbox(CheckboxOpts{
			Name: Set("terms"), Value: Set("yes"), Required: Set(true),
		}), []string{`name="terms"`, `value="yes"`, ` required`}},
		{"Switch", Switch(SwitchOpts{
			Name: Set("dark"), Value: Set("1"), Required: Set(true),
		}), []string{`name="dark"`, `value="1"`, ` required`}},
		{"RadioGroup", RadioGroup(RadioGroupOpts{
			Name: Set("size"), Value: Set("m"), Required: Set(true),
		}), []string{`name="size"`, `value="m"`, ` required`}},
		{"Slider", Slider(SliderOpts[float64]{
			Name: Set("vol"), Value: Set(3.0),
		}), []string{`name="vol"`, `value="3"`}},
		{"SliderRange", SliderRange(SliderRangeOpts[float64]{
			Name: Set("price"), ValueMin: Set(1.0), ValueMax: Set(5.0),
		}), []string{`name="price"`, `value-min="1"`, `value-max="5"`}},
		{"Rating", Rating(RatingOpts{
			Name: Set("stars"), Value: Set(4.0), Required: Set(true),
		}), []string{`name="stars"`, `value="4"`, ` required`}},
		{"ColorField", ColorField(ColorFieldOpts[float64]{
			Name: Set("color"), Value: Set("#ff0000"),
		}), []string{`name="color"`, `value="#ff0000"`}},
		{"ToggleGroup", ToggleGroup(ToggleGroupOpts{
			Name: Set("fmt"), Value: Set("b,i"), Required: Set(true),
		}), []string{`name="fmt"`, `value="b,i"`, ` required`}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			out := renderComponent(t, tc.c)
			for _, want := range tc.want {
				if !strings.Contains(out, want) {
					t.Errorf("want %s, got %q", want, out)
				}
			}
		})
	}
}
