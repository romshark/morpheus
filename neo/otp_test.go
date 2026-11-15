package neo

import (
	"strings"
	"testing"

	"github.com/a-h/templ"
)

// TestOTPAttrs tests that the options render as the attributes <neo-otp>
// reads and that a caller attribute is passed through.
func TestOTPAttrs(t *testing.T) {
	out := renderComponent(t, OTPAttrs(OTPOpts{
		Name:        Set("code"),
		Value:       Set(""),
		Mask:        Set("###-###"),
		Placeholder: Set("0"),
		Conceal:     Set(true),
		Autosubmit:  Set(false),
		Size:        Set("sm"),
	}, templ.Attributes{"autocomplete": "off"}))
	for _, want := range []string{
		`name="code"`, `value=""`, `mask="###-###"`, `placeholder="0"`,
		` conceal`, `autosubmit="false"`, `size="sm"`, `autocomplete="off"`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("want %s, got %q", want, out)
		}
	}
}
