package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func dialogPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: dialogPlaygroundDefaultHTML},
		{Label: "Non-dismissible", HTML: dialogNonDismissibleHTML},
		{Label: "Custom surface", HTML: dialogCustomSurfaceHTML, CSS: dialogCustomSurfaceCSS},
	}
}

// dialogMorphStates seeds the "Morphing during interaction" playground.
// Autoplay fat-morphs the dialog body onto the same live <neo-dialog>
// while it's open. The <neo-dialog>, trigger, and <dialog> wrapper are
// identical across states, so idiomorph keeps the dialog mounted and
// open; only the content inside the <neo-elastic> body differs, which
// animates the dialog's height between the two layouts.
func dialogMorphStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Initial", HTML: dialogMorphInitialHTML},
		{Label: "Different content", HTML: dialogMorphDifferentHTML},
	}
}

//go:embed examples/dialog_morph_initial.html
var dialogMorphInitialHTML string

//go:embed examples/dialog_morph_different.html
var dialogMorphDifferentHTML string

//go:embed examples/dialog_default.html
var dialogPlaygroundDefaultHTML string

// asyncDialogDefaultHTML is the profile body the failure-swap demo morphs
// in on a successful retry. The async-loading example inlines its own copy
// in dialog_async_html.
//
//go:embed examples/async_dialog_default.html
var asyncDialogDefaultHTML string

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Dialog page's "Examples" section.

var dialogNonDismissibleHTML = renderExampleHTML(examples.DialogNonDismissible())

//go:embed examples/dialog_non_dismissible.templ
var dialogNonDismissibleTempl string

var dialogCustomSurfaceHTML = renderExampleHTML(examples.DialogCustomSurface())

//go:embed examples/dialog_custom_surface.templ
var dialogCustomSurfaceTempl string

//go:embed examples/dialog_custom_surface.css
var dialogCustomSurfaceCSS string

var dialogAsyncLoadingHTML = renderExampleHTML(examples.DialogAsyncLoading())

//go:embed examples/dialog_async_loading.templ
var dialogAsyncLoadingTempl string

//go:embed examples/dialog_async_loading.css
var dialogAsyncLoadingCSS string

// dialogAsyncFailureTempl is the templ source for the DialogAsync
// "Async load with failure swap" demo.
//
//go:embed examples/dialog_async_failure.templ
var dialogAsyncFailureTempl string

//go:embed examples/dialog_async_failure.css
var dialogAsyncFailureCSS string

var dialogContinuousPatchingHTML = renderExampleHTML(examples.DialogContinuousPatching())

//go:embed examples/dialog_continuous_patching.templ
var dialogContinuousPatchingTempl string

//go:embed examples/dialog_continuous_patching.css
var dialogContinuousPatchingCSS string
