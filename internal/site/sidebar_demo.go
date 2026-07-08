package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func sidebarPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: sidebarDefaultHTML},
		{Label: "Mixed breakpoints", HTML: sidebarMixedBreakpointsHTML, CSS: sidebarMixedBreakpointsCSS},
		{Label: "Resizable widths", HTML: sidebarResizableHTML, CSS: sidebarResizableCSS},
		{Label: "Touch-dismiss", HTML: sidebarTouchDismissHTML, CSS: sidebarTouchDismissCSS},
		{Label: "Minimized rail", HTML: sidebarMinimizedHTML},
	}
}

// Each example carries its own sibling scoped CSS (the .sb-shell app-shell
// scaffolding plus per-example demo classes) and is used as BOTH the
// playground state and the Examples-section render+source (via templ.Raw).
// container-type + container-name resolve the sidebar's overlay threshold
// against the shell box (narrowing the frame flips overlay mode on a wide
// desktop); contain:paint makes it the containing block for the fixed
// slide-in (Safari ignores container-type layout containment, so fixed
// descendants escape without it).

// sidebarDefaultHTML binds the sidebar's open state to the editable boolean
// signal `sidebar_open`. The toggle button writes the signal so the
// playground control and the in-frame button stay in sync.
//
//go:embed examples/sidebar_default.html
var sidebarDefaultHTML string

// sidebarMixedBreakpointsHTML: a left nav at overlay-breakpoint="30rem"
// and a right settings drawer at overlay-breakpoint="50rem".
var sidebarMixedBreakpointsHTML = renderExampleHTML(examples.SidebarMixedBreakpoints())

//go:embed examples/sidebar_mixed_breakpoints.templ
var sidebarMixedBreakpointsTempl string

//go:embed examples/sidebar_mixed_breakpoints.css
var sidebarMixedBreakpointsCSS string

// sidebarResizableHTML: each sidebar wrapped in <neo-resizable> with bounded
// width; --neo-sidebar-width follows --neo-resizable-width.
var sidebarResizableHTML = renderExampleHTML(examples.SidebarResizable())

//go:embed examples/sidebar_resizable.templ
var sidebarResizableTempl string

//go:embed examples/sidebar_resizable.css
var sidebarResizableCSS string

// sidebarTouchDismissHTML: an overlay sidebar with a pinned drag-to-close
// threshold and a <neo-slider> that opts out of the dismiss gesture.
var sidebarTouchDismissHTML = renderExampleHTML(examples.SidebarTouchDismiss())

//go:embed examples/sidebar_touch_dismiss.templ
var sidebarTouchDismissTempl string

//go:embed examples/sidebar_touch_dismiss.css
var sidebarTouchDismissCSS string

// sidebarMinimizedHTML: a [data-neo-sidebar-minimized] child renders a
// compact rail when the sidebar is closed in wide, in-flow mode.
//
//go:embed examples/sidebar_minimized.html
var sidebarMinimizedHTML string

// sidebarAsyncLoadingHTML: each open posts to the server, which morphs the
// account panel into the content slot; close resets it to the skeleton.
var sidebarAsyncLoadingHTML = renderExampleHTML(examples.SidebarAsyncLoading())

//go:embed examples/sidebar_async_loading.templ
var sidebarAsyncLoadingTempl string

//go:embed examples/sidebar_async_loading.css
var sidebarAsyncLoadingCSS string

// sidebarAsyncScript is the simulator handler powering sidebarAsyncLoadingHTML,
// embedded from the same module the page loads so its Server-script tab can't
// drift.
//
//go:embed static/sim/sidebar/async.js
var sidebarAsyncScript string

// sidebarAsyncFailureTempl is the templ source for the SidebarAsync
// "Async load with failure swap" demo.
//
//go:embed examples/sidebar_async_failure.templ
var sidebarAsyncFailureTempl string

//go:embed examples/sidebar_async_failure.css
var sidebarAsyncFailureCSS string

// sidebarAsyncFailureScript is the simulator handler powering the
// failure-swap demo, embedded from the module the page loads so its
// Server-script tab can't drift.
//
//go:embed static/sim/sidebar/asyncfail.js
var sidebarAsyncFailureScript string
