package htmlfmt

import "testing"

func TestFormat(t *testing.T) {
	for _, tc := range []struct {
		name, in, want string
	}{{
		// A direct-text item wrapping a handle <span> that nests a <neo-icon>
		// is a container, not prose: it stacks so no line blows past width.
		name: "structural prose stacks",
		in: `<div id="laptop" data-neo-sortable-item>` +
			`<span data-neo-sortable-handle aria-hidden="true">` +
			`<neo-icon name="grip-vertical"></neo-icon></span> Laptop</div>`,
		want: `<div id="laptop" data-neo-sortable-item>
  <span data-neo-sortable-handle aria-hidden="true">
    <neo-icon name="grip-vertical"></neo-icon>
  </span>
  Laptop
</div>`,
	}, {
		// A real paragraph flows past width: its inline children hold only
		// text, so nothing forces a stack.
		name: "paragraph flows",
		in:   `<p>Press <kbd>g</kbd> then <kbd>h</kbd> to go to the home view and reset every panel here.</p>`,
		want: `<p>Press <kbd>g</kbd> then <kbd>h</kbd> to go to the home view and reset every panel here.</p>`,
	}, {
		// A bare <neo-icon> beside text holds no nested element, so it is not
		// structural and the line still flows.
		name: "bare icon flows",
		in:   `<span data-neo-sortable-handle><neo-icon name="grip-vertical"></neo-icon> Drag</span>`,
		want: `<span data-neo-sortable-handle><neo-icon name="grip-vertical"></neo-icon> Drag</span>`,
	}} {
		t.Run(tc.name, func(t *testing.T) {
			if got := Format(tc.in); got != tc.want {
				t.Errorf("Format mismatch\n--- got ---\n%s\n--- want ---\n%s", got, tc.want)
			}
		})
	}
}
