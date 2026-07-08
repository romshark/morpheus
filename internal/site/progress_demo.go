package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

func progressPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: progressPlaygroundDefaultHTML},
		{Label: "Marks with labels", HTML: progressMarksHTML},
		{Label: "Dense mark labels", HTML: progressDenseMarksHTML},
		{Label: "Bare rail", HTML: progressBareRailHTML},
		{Label: "Indeterminate", HTML: progressIndeterminateHTML},
		{Label: "Custom indeterminate animation", HTML: progressPingPongHTML, CSS: progressPingPongCSS},
		{Label: "Vertical", HTML: progressVerticalHTML},
	}
}

//go:embed examples/progress_default.html
var progressPlaygroundDefaultHTML string

// progressMorphStates seeds the "Morphing during interaction" playground.
// Each state is the bar's prerendered markup (what neo.Progress emits and
// the host adopt()s), so a plain fat-morph reconciles the existing fill
// node in place and the easing transition eases it to the new value. A
// children-less <neo-progress> would instead make the morph rebuild the
// JS-rendered fill at the new value, which snaps; see neo-progress.ts.
func progressMorphStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "0%", HTML: progressMorph0HTML},
		{Label: "30%", HTML: progressMorph30HTML},
		{Label: "40%", HTML: progressMorph40HTML},
	}
}

//go:embed examples/progress_morph_0.html
var progressMorph0HTML string

//go:embed examples/progress_morph_30.html
var progressMorph30HTML string

//go:embed examples/progress_morph_40.html
var progressMorph40HTML string

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Progress page's "Examples" section. Each pair shows the markup an
// author would copy/paste verbatim, with no Datastar wiring, no live
// params. The demos these power don't have a live form, so the
// source isn't tracking anything dynamic.

var progressMarksHTML = renderExampleHTML(examples.ProgressMarks())

//go:embed examples/progress_marks.templ
var progressMarksTempl string

var progressDenseMarksHTML = renderExampleHTML(examples.ProgressDenseMarks())

//go:embed examples/progress_dense_marks.templ
var progressDenseMarksTempl string

var progressBareRailHTML = renderExampleHTML(examples.ProgressBareRail())

//go:embed examples/progress_bare_rail.templ
var progressBareRailTempl string

var progressIndeterminateHTML = renderExampleHTML(examples.ProgressIndeterminate())

//go:embed examples/progress_indeterminate.templ
var progressIndeterminateTempl string

// Self-contained ping-pong demo. Keyframes and the part/animation
// override are inlined in a scoped <style> block keyed off a unique
// class, so the example works without any site-local CSS rule.
var progressPingPongHTML = renderExampleHTML(examples.ProgressPingPong())

//go:embed examples/progress_ping_pong.templ
var progressPingPongTempl string

//go:embed examples/progress_ping_pong.css
var progressPingPongCSS string

var progressVerticalHTML = renderExampleHTML(examples.ProgressVertical())

//go:embed examples/progress_vertical.templ
var progressVerticalTempl string

var progressDownloadHTML = renderExampleHTML(examples.ProgressDownload())

//go:embed examples/progress_download.templ
var progressDownloadTempl string

const progressDownloadScript = `import sim from "/static/datasim.js";

sim.post("/progress/download", async (_ctx, sse) => {
  sse.patchSignals({ dl_value: 0, dl_label: "Uploading…" });

  for (let pct = 25; pct <= 100; pct += 25) {
    await sse.delay(1000);
    sse.patchSignals({ dl_value: pct });
  }

  sse.patchSignals({ dl_label: "Done ✓", dl_running: false });
});`
