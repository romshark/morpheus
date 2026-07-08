package site

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/romshark/morpheus/neo"
)

type PlaygroundState struct {
	Label string
	HTML  string
	// CSS is the state's styling, shown in the editor's CSS tab and
	// applied to the preview wrapped in <style>@scope { … }</style> so it
	// scopes to the preview subtree only. Empty for states with no styling.
	CSS string
}

type PlaygroundOpts struct {
	ID string
	// Height is optional. An empty value tracks preview content until
	// the user resizes the viewport. The playground is always full
	// content width; the preview stage is resizable from its edges.
	Height neo.CSSUnit
	// MinWidth sets the preview stage's minimum width (the resizable's
	// left/right drag lower bound). Empty defaults to "14rem"; raise it for
	// components that need room to stay legible when dragged narrow (e.g. a
	// sidebar shell).
	MinWidth neo.CSSUnit
	States   []PlaygroundState
	// Autoplay starts cycling through enabled states on connect (once in
	// view). Off by default; the user can still opt in via the toolbar.
	Autoplay bool
	// Boundary opts out of individual <neo-boundary> scopes for the
	// preview's overlays (default: all scopes on).
	Boundary BoundaryScopes
}

// playgroundSimWarningShow is the Datastar guard for the toolbar's
// simulator-settings warning. The signals are global, declared by the
// site Settings panel. The preview routes through the simulator, so a
// throttled / erroring / unreachable server makes it look like the live
// preview misbehaves. Mirrors the Settings panel's own warning.
const playgroundSimWarningShow = "$_sim_unreachable || $_sim_server_error || $_sim_latency_max > 0 || $_sim_delay > 0"

func (o PlaygroundOpts) stageMinWidth() neo.CSSUnit {
	if o.MinWidth == "" {
		return "14rem"
	}
	return o.MinWidth
}

// scopedStyleTag wraps CSS in a scoped <style>. @scope with no prelude
// scopes to the <style> element's parent (the preview/stage container), so
// the styles never leak to the page. Empty CSS yields no element. Shared by
// the playground preview and the demo-frame live preview.
func scopedStyleTag(css string) string {
	css = strings.TrimSpace(css)
	if css == "" {
		return ""
	}
	return "<style>@scope {\n" + css + "\n}</style>\n"
}

// playgroundPreviewHTML is a state's initial preview body: its scoped CSS
// followed by its markup. Must match site-playground.ts #previewCode so an
// unedited state patches identically.
func playgroundPreviewHTML(state PlaygroundState) string {
	return scopedStyleTag(state.CSS) + state.HTML
}

func playgroundInitialHTML(states []PlaygroundState) string {
	if len(states) == 0 {
		return ""
	}
	return playgroundPreviewHTML(states[0])
}

func playgroundStateID(id string, index int) string {
	return fmt.Sprintf("%s-state-%d", id, index)
}

func playgroundSignalPrefix(id string) string {
	var b strings.Builder
	for i, r := range id {
		if r == '_' || r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || i > 0 && r >= '0' && r <= '9' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	return b.String()
}

func playgroundSignals(opts PlaygroundOpts) string {
	prefix := playgroundSignalPrefix(opts.ID)
	value, err := json.Marshal(map[string]string{
		prefix + "_code":    playgroundInitialHTML(opts.States),
		prefix + "_signals": "{}",
	})
	if err != nil {
		return "{}"
	}
	return string(value)
}

func playgroundPatchElementsHandler(opts PlaygroundOpts) string {
	prefix := playgroundSignalPrefix(opts.ID)
	return fmt.Sprintf(
		"$%s_code = evt.detail.code; @post('/playground/%s/elements/')",
		prefix, opts.ID,
	)
}

func playgroundPatchSignalsHandler(opts PlaygroundOpts) string {
	prefix := playgroundSignalPrefix(opts.ID)
	return fmt.Sprintf(
		"$%s_signals = evt.detail.signals; @post('/playground/%s/signals/')",
		prefix, opts.ID,
	)
}
