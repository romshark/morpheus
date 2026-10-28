package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

//go:embed static/action_to_patch.svg
var actionToPatchDiagram string

//go:embed static/cqrs_arch_go.svg
var cqrsArchDiagram string

//go:embed static/sim/serverdriven/asyncload.js
var serverDrivenAsyncLoadScript string

//go:embed static/sim/serverdriven/asyncfail.js
var serverDrivenAsyncFailScript string

//go:embed static/sim/serverdriven/uncommitted.js
var serverDrivenUncommittedScript string

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

var serverDrivenAsyncLoadHTML = renderExampleHTML(examples.ServerDrivenAsyncLoad())

//go:embed examples/server_driven_async_load.templ
var serverDrivenAsyncLoadTempl string

//go:embed examples/server_driven_async_load.css
var serverDrivenAsyncLoadCSS string

var serverDrivenAsyncFailHTML = renderExampleHTML(examples.ServerDrivenAsyncFail())

//go:embed examples/server_driven_async_fail.templ
var serverDrivenAsyncFailTempl string

//go:embed examples/server_driven_async_fail.css
var serverDrivenAsyncFailCSS string

var serverDrivenUncommittedHTML = renderExampleHTML(examples.ServerDrivenUncommitted())

//go:embed examples/server_driven_uncommitted.templ
var serverDrivenUncommittedTempl string

//go:embed examples/server_driven_uncommitted.css
var serverDrivenUncommittedCSS string
