package neo

import (
	"context"
	"io"
	"strings"
	"testing"

	"github.com/a-h/templ"
)

// TestOdometerAttrs tests that the children render as the bare element text
// and that a caller attribute passes through.
func TestOdometerAttrs(t *testing.T) {
	text := templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		_, err := io.WriteString(w, "$1,234.56")
		return err
	})
	ctx := templ.WithChildren(context.Background(), text)
	var b strings.Builder
	if err := OdometerAttrs(templ.Attributes{"id": "total"}).Render(ctx, &b); err != nil {
		t.Fatalf("render: %v", err)
	}
	const want = `<neo-odometer id="total">$1,234.56</neo-odometer>`
	if got := b.String(); got != want {
		t.Errorf("want %s, got %s", want, got)
	}
}
