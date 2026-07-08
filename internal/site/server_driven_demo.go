package site

import _ "embed"

// Source strings (HTML + Templ) and embedded sim handlers for the
// Server-driven page's live demos, surfaced in each demo's "Server
// script" / source tabs. Embedding the same .js modules the page loads
// at runtime keeps the tabs from drifting.

// Inlined (not <img>-referenced) so strokes inherit currentColor and
// track --page-fg across light/dark/system theme modes. Muted
// annotations map to var(--muted); green accents stay literal.
//
//go:embed static/action_to_patch.svg
var actionToPatchDiagram string

//go:embed static/cqrs_arch_go.svg
var cqrsArchDiagram string

//go:embed static/sim/serverdriven/asyncload.js
var serverDrivenAsyncLoadScript string

//go:embed static/sim/serverdriven/asyncfail.js
var serverDrivenAsyncFailScript string

// Command patches playground: one popover, three states that each
// patch its `open` attribute. "No command" omits the attribute, so the
// morph leaves the popover's current open state untouched.

//go:embed examples/server_driven_command_open.html
var serverDrivenCommandOpenHTML string

//go:embed examples/server_driven_command_close.html
var serverDrivenCommandCloseHTML string

//go:embed examples/server_driven_command_keep.html
var serverDrivenCommandKeepHTML string

func serverDrivenCommandStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "No command", HTML: serverDrivenCommandKeepHTML},
		{Label: "Open", HTML: serverDrivenCommandOpenHTML},
		{Label: "Close", HTML: serverDrivenCommandCloseHTML},
	}
}

//go:embed examples/server_driven_async_load.templ
var serverDrivenAsyncLoadTempl string

//go:embed examples/server_driven_async_load.css
var serverDrivenAsyncLoadCSS string

//go:embed examples/server_driven_async_fail.templ
var serverDrivenAsyncFailTempl string

//go:embed examples/server_driven_async_fail.css
var serverDrivenAsyncFailCSS string
