package neo

import (
	"context"
	"io"
	"strings"
	"testing"

	"github.com/a-h/templ"
)

// TestCompareAttrs tests that set options render as attributes, unset ones
// render nothing, and the children pass through.
func TestCompareAttrs(t *testing.T) {
	img := templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		_, err := io.WriteString(w, `<img slot="before">`)
		return err
	})
	ctx := templ.WithChildren(context.Background(), img)
	for _, tc := range []struct {
		name string
		opts CompareOpts
		want string
	}{
		{"unset", CompareOpts{},
			`<neo-compare id="c"><img slot="before"></neo-compare>`},
		{"set", CompareOpts{
			Value:        Set(37.5),
			Min:          Set(10.0),
			Max:          Set(90.0),
			Vertical:     Set(true),
			Disabled:     Set(false),
			Recenter:     Set(false),
			DividerLabel: Set("Vorher und nachher"),
		}, `<neo-compare value="37.5" min="10" max="90" vertical disabled="false" recenter="false"` +
			` divider-label="Vorher und nachher" id="c"><img slot="before"></neo-compare>`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var b strings.Builder
			err := CompareAttrs(tc.opts, templ.Attributes{"id": "c"}).Render(ctx, &b)
			if err != nil {
				t.Fatalf("render: %v", err)
			}
			if got := b.String(); got != tc.want {
				t.Errorf("want %s, got %s", tc.want, got)
			}
		})
	}
}
