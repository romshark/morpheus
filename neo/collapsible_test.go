package neo

import (
	"context"
	"io"
	"strings"
	"testing"

	"github.com/a-h/templ"
)

// TestCollapsibleAttrs tests that set options render as attributes, unset
// ones render nothing, and the children pass through.
func TestCollapsibleAttrs(t *testing.T) {
	summary := templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		_, err := io.WriteString(w, `<span slot="summary">Shipping</span>`)
		return err
	})
	ctx := templ.WithChildren(context.Background(), summary)
	for _, tc := range []struct {
		name string
		opts CollapsibleOpts
		want string
	}{
		{"unset", CollapsibleOpts{},
			`<neo-collapsible id="c"><span slot="summary">Shipping</span></neo-collapsible>`},
		{"open", CollapsibleOpts{Open: Set(true), Name: Set("faq")},
			`<neo-collapsible open name="faq" id="c"><span slot="summary">Shipping</span></neo-collapsible>`},
		{"closed", CollapsibleOpts{Open: Set(false)},
			`<neo-collapsible open="false" id="c"><span slot="summary">Shipping</span></neo-collapsible>`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var b strings.Builder
			err := CollapsibleAttrs(tc.opts, templ.Attributes{"id": "c"}).Render(ctx, &b)
			if err != nil {
				t.Fatalf("render: %v", err)
			}
			if got := b.String(); got != tc.want {
				t.Errorf("want %s, got %s", tc.want, got)
			}
		})
	}
}
