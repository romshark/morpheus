package site

import "github.com/a-h/templ"

// lfSearchAttrs wires the landing search field's server-driven
// suggestions. Each debounced keystroke updates the lf_search_q signal
// and @posts to the datasim handler (web/site/landing-sim.ts), which
// morphs <neo-option> rows into the [slot="suggestions"] container by id.
// The AbortController cancels the in-flight request on the next keystroke.
// The debounce modifier (`.200ms`) lives in a templ.Attributes key rather
// than a raw element attribute, which templ can't parse.
func lfSearchAttrs() templ.Attributes {
	return templ.Attributes{
		"id":           "lf-search",
		"type":         "search",
		"aria-label":   "Search",
		"value":        "open release",
		"placeholder":  "Search releases…",
		"autocomplete": "off",
		"data-signals": "{lf_search_q: '', lf_search_ctrl: new AbortController()}",
		"data-on:neo-textinput-input__debounce.200ms": "$lf_search_q = evt.detail.value; " +
			"$lf_search_ctrl.abort(); $lf_search_ctrl = new AbortController(); " +
			"@post('/lf-search/suggest/', {requestCancellation: $lf_search_ctrl})",
	}
}
