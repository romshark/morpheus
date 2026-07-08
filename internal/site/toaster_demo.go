package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// Embedded from the same .js modules the page loads at runtime so the
// "Server script" tabs can't drift.

//go:embed static/sim/toaster/app-shell.js
var toasterAppShellScript string

//go:embed static/sim/toaster/action.js
var toasterActionScript string

//go:embed static/sim/toaster/patch-update.js
var toasterPatchUpdateScript string

//go:embed static/sim/toaster/patch-append.js
var toasterPatchAppendScript string

//go:embed static/sim/toaster/patch-replace.js
var toasterPatchReplaceScript string

func toasterPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: toasterPlaygroundDefaultHTML},
		{Label: "Variants", HTML: toasterVariantsHTML},
		{Label: "Title + description", HTML: toasterTitleDescHTML},
		{Label: "Stack + dismiss-all", HTML: toasterStackDismissHTML},
	}
}

// The Default playground state demonstrates a contained toaster driven
// imperatively: its triggers target the example's own toaster via
// getElementById, not the page-wide NeoToast singleton. The scoped
// <style> caps the contained stack's max-height (a descendant rule that
// can't be inlined onto the host); the host frame's inline flex layout
// anchors the toaster and stacks the triggers at the top.
//
//go:embed examples/toaster_default.html
var toasterPlaygroundDefaultHTML string

// toasterAppShellHTML / toasterAppShellTempl are the static source for
// the "Triggers the app-shell toaster" example: two buttons that POST
// to the show / dismiss handlers of the page-level toaster.
var toasterAppShellHTML = renderExampleHTML(examples.ToasterAppShell())

//go:embed examples/toaster_app_shell.templ
var toasterAppShellTempl string

// Per-example demos for the Toaster page's "Examples" section. Each
// shows the markup an author would copy/paste verbatim, with no Datastar
// simulator wiring; the real-world equivalent of each handler is in the
// comments above the markup.

// The vanilla "Show a toast" example: a plain click listener invoking
// the contained toaster's instance show(). Self-sufficient: the host
// frame is inlined and the handler ships inline, so no Datastar and no
// site-local classes.
var toasterVanillaHTML = renderExampleHTML(examples.ToasterVanilla())

//go:embed examples/toaster_vanilla.templ
var toasterVanillaTempl string

//go:embed examples/toaster_vanilla.css
var toasterVanillaCSS string

var toasterLoadingAsyncHTML = renderExampleHTML(examples.ToasterLoadingAsync())

//go:embed examples/toaster_loading_async.templ
var toasterLoadingAsyncTempl string

var toasterPatchAppendHTML = renderExampleHTML(examples.ToasterPatchAppend())

//go:embed examples/toaster_patch_append.templ
var toasterPatchAppendTempl string

var toasterPatchReplaceHTML = renderExampleHTML(examples.ToasterPatchReplace())

//go:embed examples/toaster_patch_replace.templ
var toasterPatchReplaceTempl string

var toasterPatchUpdateHTML = renderExampleHTML(examples.ToasterPatchUpdate())

//go:embed examples/toaster_patch_update.templ
var toasterPatchUpdateTempl string

var toasterActionButtonHTML = renderExampleHTML(examples.ToasterActionButton())

//go:embed examples/toaster_action_button.templ
var toasterActionButtonTempl string

var toasterVariantsHTML = renderExampleHTML(examples.ToasterVariants())

//go:embed examples/toaster_variants.templ
var toasterVariantsTempl string

var toasterTitleDescHTML = renderExampleHTML(examples.ToasterTitleDesc())

//go:embed examples/toaster_title_desc.templ
var toasterTitleDescTempl string

var toasterStackDismissHTML = renderExampleHTML(examples.ToasterStackDismiss())

//go:embed examples/toaster_stack_dismiss.templ
var toasterStackDismissTempl string
