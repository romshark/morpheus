package neo

import (
	"context"
	"strings"
	"testing"

	"github.com/a-h/templ"
)

// TestSliderColorAttrs tests that set options render as attributes and unset
// ones render nothing.
func TestSliderColorAttrs(t *testing.T) {
	for _, tc := range []struct {
		name string
		opts SliderColorOpts
		want string
	}{
		{"unset", SliderColorOpts{}, `<neo-slider-color id="s"></neo-slider-color>`},
		{"set", SliderColorOpts{
			Channel:   Set(SliderColorChannelSaturation),
			Value:     Set("#2563eb"),
			Hue:       Set(221.5),
			Label:     Set("Saturation"),
			HideValue: Set(true),
			Vertical:  Set(false),
			Easing:    Set("200ms"),
			Disabled:  Set(true),
			AriaLabel: Set("Accent saturation"),
		}, `<neo-slider-color channel="saturation" value="#2563eb" hue="221.5" label="Saturation"` +
			` hide-value vertical="false" easing="200ms" disabled aria-label="Accent saturation"` +
			` id="s"></neo-slider-color>`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var b strings.Builder
			err := SliderColorAttrs(tc.opts, templ.Attributes{"id": "s"}).Render(context.Background(), &b)
			if err != nil {
				t.Fatalf("render: %v", err)
			}
			if got := b.String(); got != tc.want {
				t.Errorf("want %s, got %s", tc.want, got)
			}
		})
	}
}
