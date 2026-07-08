// Package datastar provides Datastar-specific wrappers for Morpheus web components.
package datastar

import (
	"strconv"
	"strings"

	"github.com/a-h/templ"

	"github.com/romshark/morpheus/neo"
)

// PopoverAsyncOpts configures PopoverAsync.
//
// ID names the popover and is reused as the AbortController signal name
// and the morph-target id of the body wrapper, so it must be a valid JS
// identifier. URL is the Datastar action POSTed on every open. Loading
// renders inside the body while the request is in flight; Failed renders
// when Datastar dispatches `retries-failed` or finishes the action after
// at least one `error` event (the latter covers `retry: 'auto' / 'never'`
// + HTTP error, where Datastar gives up silently). Pass nil for a
// built-in fallback.
//
// ExtraPostOpts is a JS expression body merged into the @post call,
// typically retry knobs (e.g. `retry: $_my_retry, retryMaxCount:
// $_my_retry_max_count`).
//
// The embedded neo.PopoverOpts carries every base popover option
// (placement, open, screen-offset, flip, trigger-action, …); set it
// as PopoverOpts: neo.PopoverOpts{...}.
type PopoverAsyncOpts struct {
	neo.PopoverOpts
	ID            string
	URL           string
	Loading       templ.Component
	Failed        templ.Component
	ExtraPostOpts string
}

// DrawerAsyncOpts configures DrawerAsync.
//
// ID names the drawer host and is reused as the AbortController
// signal name and the morph-target id of the body wrapper, so it must
// be a valid JS identifier. URL is the Datastar action POSTed on every
// open. Loading renders inside the body while the request is in
// flight; Failed renders when Datastar dispatches `retries-failed` or
// finishes the action after at least one `error` event. Pass nil for a
// built-in fallback.
//
// On a successful response the server is expected to morph
// `<div id="<ID>-body">` with the rendered drawer body. ExtraPostOpts
// is a JS expression body merged into the @post call, typically retry
// knobs (e.g. `retry: $_my_retry, retryMaxCount: $_my_retry_max_count`).
// The embedded neo.DrawerOpts carries every base drawer option
// (side, open, dismissible, touch-dismiss); set it as
// DrawerOpts: neo.DrawerOpts{...}.
type DrawerAsyncOpts struct {
	neo.DrawerOpts
	ID            string
	URL           string
	Loading       templ.Component
	Failed        templ.Component
	Title         string
	Description   string
	CloseLabel    string
	ExtraPostOpts string
}

func drawerAsyncSignals(opts DrawerAsyncOpts) string {
	const s1, s2, s3 = "{", ": new AbortController(), ", "_errors: 0}"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	return b.String()
}

func drawerAsyncOpen(opts DrawerAsyncOpts) string {
	return drawerAsyncResetAndPost(opts)
}

func drawerAsyncClose(opts DrawerAsyncOpts) string {
	const s1, s2, s3 = "$", ".abort(); $", " = new AbortController(); $"
	const s4 = "_errors = 0"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(opts.ID) + len(s4))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString(s4)
	return b.String()
}

func drawerAsyncPost(opts DrawerAsyncOpts) string {
	const s1, s2, s3 = "@post('", "', {", "requestCancellation: $"
	const sep = ", "
	var b strings.Builder
	n := len(s1) + len(opts.URL) + len(s2) + len(s3) + len(opts.ID) + len("})")
	if opts.ExtraPostOpts != "" {
		n += len(opts.ExtraPostOpts) + len(sep)
	}
	b.Grow(n)
	b.WriteString(s1)
	b.WriteString(opts.URL)
	b.WriteString(s2)
	if opts.ExtraPostOpts != "" {
		b.WriteString(opts.ExtraPostOpts)
		b.WriteString(sep)
	}
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString("})")
	return b.String()
}

func drawerAsyncResetAndPost(opts DrawerAsyncOpts) string {
	const s1 = "_errors = 0; document.getElementById('"
	const s2 = "-body').innerHTML = document.getElementById('"
	const s3 = "-tpl-loading').innerHTML; "
	post := drawerAsyncPost(opts)
	var b strings.Builder
	b.Grow(len("$") + len(opts.ID) + len(s1) + len(opts.ID) + len(s2) +
		len(opts.ID) + len(s3) + len(post))
	b.WriteString("$")
	b.WriteString(opts.ID)
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(post)
	return b.String()
}

// drawerAsyncRetry installs click-delegation on the host: a
// descendant carrying [data-neo-popover-async-retry] aborts the
// in-flight fetch, swaps the body back to loading, and re-runs the
// action without closing the drawer. Reuses the popover-async retry
// attribute so retry buttons read the same in every async wrapper.
func drawerAsyncRetry(opts DrawerAsyncOpts) string {
	const s1 = "if (evt.target.closest('[data-neo-popover-async-retry]')) { $"
	const s2 = ".abort(); $"
	const s3 = " = new AbortController(); "
	reset := drawerAsyncResetAndPost(opts)
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(reset) + len(" }"))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(reset)
	b.WriteString(" }")
	return b.String()
}

// drawerAsyncOnFetch mirrors popoverAsyncOnFetch's failure contract:
// retries-failed means the network retry budget is exhausted; an
// `error` event increments $<id>_errors so a later `finished` can
// cover HTTP failures that Datastar stops retrying without emitting
// retries-failed.
func drawerAsyncOnFetch(opts DrawerAsyncOpts) string {
	const sw1 = "(document.getElementById('"
	const sw2 = "-body').innerHTML = document.getElementById('"
	const sw3 = "-tpl-failed').innerHTML)"
	var sb strings.Builder
	sb.Grow(len(sw1) + len(opts.ID) + len(sw2) + len(opts.ID) + len(sw3))
	sb.WriteString(sw1)
	sb.WriteString(opts.ID)
	sb.WriteString(sw2)
	sb.WriteString(opts.ID)
	sb.WriteString(sw3)
	swap := sb.String()

	const scope = "evt.detail.el === el"
	const a = "(evt.detail.type === 'retries-failed' && "
	const c = ") || (evt.detail.type === 'error' && "
	const d = " && ++$"
	const e = "_errors) || (evt.detail.type === 'finished' && "
	const f = " && $"
	const g = "_errors > 0 && "
	var b strings.Builder
	b.Grow(len(a) + len(scope) + len(" && ") + len(swap) + len(c) +
		len(scope) + len(d) + len(opts.ID) + len(e) + len(scope) +
		len(f) + len(opts.ID) + len(g) + len(swap) + len(")"))
	b.WriteString(a)
	b.WriteString(scope)
	b.WriteString(" && ")
	b.WriteString(swap)
	b.WriteString(c)
	b.WriteString(scope)
	b.WriteString(d)
	b.WriteString(opts.ID)
	b.WriteString(e)
	b.WriteString(scope)
	b.WriteString(f)
	b.WriteString(opts.ID)
	b.WriteString(g)
	b.WriteString(swap)
	b.WriteString(")")
	return b.String()
}

func popoverAsyncOpen(opts PopoverAsyncOpts) string {
	return popoverAsyncResetAndPost(opts)
}

// popoverAsyncRetry installs click-delegation on the host: a descendant
// carrying [data-neo-popover-async-retry] aborts the in-flight fetch,
// seeds a fresh controller, and re-runs the open path.
func popoverAsyncRetry(opts PopoverAsyncOpts) string {
	const s1 = "if (evt.target.closest('[data-neo-popover-async-retry]')) { $"
	const s2 = ".abort(); $"
	const s3 = " = new AbortController(); "
	reset := popoverAsyncResetAndPost(opts)
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(reset) + len(" }"))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(reset)
	b.WriteString(" }")
	return b.String()
}

func popoverAsyncResetAndPost(opts PopoverAsyncOpts) string {
	const s1 = "_errors = 0; document.getElementById('"
	const s2 = "-body').innerHTML = document.getElementById('"
	const s3 = "-tpl-loading').innerHTML; @post('"
	const s4, sep = "', {", ", "
	var b strings.Builder
	n := len("$") + len(opts.ID) + len(s1) + len(opts.ID) + len(s2) +
		len(opts.ID) + len(s3) + len(opts.URL) + len(s4) +
		len("requestCancellation: $") + len(opts.ID) + len("})")
	if opts.ExtraPostOpts != "" {
		n += len(opts.ExtraPostOpts) + len(sep)
	}
	b.Grow(n)
	b.WriteString("$")
	b.WriteString(opts.ID)
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(opts.URL)
	b.WriteString(s4)
	if opts.ExtraPostOpts != "" {
		b.WriteString(opts.ExtraPostOpts)
		b.WriteString(sep)
	}
	b.WriteString("requestCancellation: $")
	b.WriteString(opts.ID)
	b.WriteString("})")
	return b.String()
}

// popoverAsyncOnFetch listens for Datastar's `datastar-fetch` events,
// auto-bound to document. Three paths trigger the swap:
//   - `retries-failed`: Datastar exhausted its retry budget (network
//     throws only; HTTP errors never reach this).
//   - `error`: bumps $<id>_errors so we can distinguish a clean
//     `finished` from a finished-after-failure.
//   - `finished` after at least one error: Datastar gave up without
//     dispatching retries-failed (`retry: 'auto' / 'never'` + HTTP
//     error). For `retry: 'error' / 'always'` + HTTP error this never
//     fires because the loop is infinite; the user opted into that.
func popoverAsyncOnFetch(opts PopoverAsyncOpts) string {
	const sw1 = "(document.getElementById('"
	const sw2 = "-body').innerHTML = document.getElementById('"
	const sw3 = "-tpl-failed').innerHTML)"
	var sb strings.Builder
	sb.Grow(len(sw1) + len(opts.ID) + len(sw2) + len(opts.ID) + len(sw3))
	sb.WriteString(sw1)
	sb.WriteString(opts.ID)
	sb.WriteString(sw2)
	sb.WriteString(opts.ID)
	sb.WriteString(sw3)
	swap := sb.String()

	const scope = "evt.detail.el === el"
	const a = "(evt.detail.type === 'retries-failed' && "
	const c = ") || (evt.detail.type === 'error' && "
	const d = " && ++$"
	const e = "_errors) || (evt.detail.type === 'finished' && "
	const f = " && $"
	const g = "_errors > 0 && "
	var b strings.Builder
	b.Grow(len(a) + len(scope) + len(" && ") + len(swap) + len(c) +
		len(scope) + len(d) + len(opts.ID) + len(e) + len(scope) +
		len(f) + len(opts.ID) + len(g) + len(swap) + len(")"))
	b.WriteString(a)
	b.WriteString(scope)
	b.WriteString(" && ")
	b.WriteString(swap)
	b.WriteString(c)
	b.WriteString(scope)
	b.WriteString(d)
	b.WriteString(opts.ID)
	b.WriteString(e)
	b.WriteString(scope)
	b.WriteString(f)
	b.WriteString(opts.ID)
	b.WriteString(g)
	b.WriteString(swap)
	b.WriteString(")")
	return b.String()
}

func popoverAsyncClose(opts PopoverAsyncOpts) string {
	const s1, s2, s3 = "$", ".abort(); $", " = new AbortController(); $"
	const s4 = "_errors = 0"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(opts.ID) + len(s4))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString(s4)
	return b.String()
}

func popoverAsyncSignals(opts PopoverAsyncOpts) string {
	const s1, s2, s3 = "{", ": new AbortController(), ", "_errors: 0}"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	return b.String()
}

// SelectAsyncOpts configures SelectAsync.
//
// ID names the host and is reused as the AbortController signal name,
// so it must be a valid JS identifier. URL is the Datastar action
// POSTed on every open. Loading renders inside the host's
// [data-neo-async-placeholder] slot; the select kit clones the slot
// above the listbox on each open. Failed renders in the visible
// loading clone after Datastar exhausts its retry budget; pass nil for
// a built-in fallback. ExtraPostOpts is a JS expression body merged
// into the @post call (typically retry knobs).
//
// On a successful response the server is expected to morph
// `<neo-datalist id="<ID>-options">` with the rendered options; the
// select kit hides the loading clone automatically once options
// arrive.
// The embedded neo.SelectOpts carries every base select option
// (value, placeholder, typeahead, placement, …); set it as
// SelectOpts: neo.SelectOpts{...}. Async is forced on regardless.
type SelectAsyncOpts struct {
	neo.SelectOpts
	ID            string
	URL           string
	Loading       templ.Component
	Failed        templ.Component
	ExtraPostOpts string
}

// selectAsyncNeoOpts forces Async on so the kit always renders the
// async placeholder slot, regardless of what the caller passed.
func selectAsyncNeoOpts(opts SelectAsyncOpts) neo.SelectOpts {
	o := opts.SelectOpts
	o.Async = neo.Set(true)
	return o
}

func selectAsyncSignals(opts SelectAsyncOpts) string {
	const s1, s2, s3 = "{", ": new AbortController(), ", "_errors: 0}"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	return b.String()
}

func selectAsyncOpen(opts SelectAsyncOpts) string {
	const s1 = "$"
	const s2 = "_errors = 0; "
	post := selectAsyncPost(opts)
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(post))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(post)
	return b.String()
}

func selectAsyncClose(opts SelectAsyncOpts) string {
	const s1, s2, s3 = "$", ".abort(); $", " = new AbortController(); $"
	const s4 = "_errors = 0"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(opts.ID) + len(s4))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString(s4)
	return b.String()
}

func selectAsyncPost(opts SelectAsyncOpts) string {
	const s1, s2, s3 = "@post('", "', {", "requestCancellation: $"
	const sep = ", "
	var b strings.Builder
	n := len(s1) + len(opts.URL) + len(s2) + len(s3) + len(opts.ID) + len("})")
	if opts.ExtraPostOpts != "" {
		n += len(opts.ExtraPostOpts) + len(sep)
	}
	b.Grow(n)
	b.WriteString(s1)
	b.WriteString(opts.URL)
	b.WriteString(s2)
	if opts.ExtraPostOpts != "" {
		b.WriteString(opts.ExtraPostOpts)
		b.WriteString(sep)
	}
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString("})")
	return b.String()
}

// selectAsyncRetry installs click-delegation on the host: a descendant
// carrying [data-neo-popover-async-retry] aborts the in-flight fetch,
// then re-runs the load by calling the select host's reload().
func selectAsyncRetry(opts SelectAsyncOpts) string {
	const s1 = "if (evt.composedPath().some((n) => n instanceof Element && n.closest('[data-neo-popover-async-retry]'))) { $"
	const s2 = ".abort(); $"
	const s3 = " = new AbortController(); document.getElementById('"
	const s4 = "').reload(); }"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(opts.ID) + len(s4))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString(s4)
	return b.String()
}

// selectAsyncOnFetch mirrors popoverAsyncOnFetch's three-disjunct
// listener. The swap writes the failed template into the visible
// loading clone, leaving the source loading slot untouched so retry or
// reopen can restore loading before re-posting.
func selectAsyncOnFetch(opts SelectAsyncOpts) string {
	const sw1 = "((n) => (n && (n.innerHTML = document.getElementById('"
	const sw2 = "-tpl-failed').innerHTML), true))(document.getElementById('"
	const sw3 = "')?.shadowRoot?.querySelector('[data-neo-select-list] [data-neo-async-placeholder]'))"
	var sb strings.Builder
	sb.Grow(len(sw1) + len(opts.ID) + len(sw2) + len(opts.ID) + len(sw3))
	sb.WriteString(sw1)
	sb.WriteString(opts.ID)
	sb.WriteString(sw2)
	sb.WriteString(opts.ID)
	sb.WriteString(sw3)
	swap := sb.String()

	const scope = "evt.detail.el === el"
	const a = "(evt.detail.type === 'retries-failed' && "
	const c = ") || (evt.detail.type === 'error' && "
	const d = " && ++$"
	const e = "_errors) || (evt.detail.type === 'finished' && "
	const f = " && $"
	const g = "_errors > 0 && "
	var b strings.Builder
	b.Grow(len(a) + len(scope) + len(" && ") + len(swap) + len(c) +
		len(scope) + len(d) + len(opts.ID) + len(e) + len(scope) +
		len(f) + len(opts.ID) + len(g) + len(swap) + len(")"))
	b.WriteString(a)
	b.WriteString(scope)
	b.WriteString(" && ")
	b.WriteString(swap)
	b.WriteString(c)
	b.WriteString(scope)
	b.WriteString(d)
	b.WriteString(opts.ID)
	b.WriteString(e)
	b.WriteString(scope)
	b.WriteString(f)
	b.WriteString(opts.ID)
	b.WriteString(g)
	b.WriteString(swap)
	b.WriteString(")")
	return b.String()
}

// ComboboxAsyncOpts configures ComboboxAsync.
//
// ID names the host and is reused as the AbortController signal name,
// so it must be a valid JS identifier. URL is the Datastar action
// POSTed on every open. Loading renders inside the host's
// [data-neo-async-placeholder] slot; the combobox kit clones the
// slot above the listbox on each open. Failed renders in the visible
// loading clone after Datastar exhausts its retry budget; pass nil for
// a built-in fallback. ExtraPostOpts is a JS expression body merged
// into the @post call (typically retry knobs).
// SearchDebounce coalesces live-search keystrokes before the
// combobox dispatches `neo-combobox-search`.
//
// On a successful response the server is expected to morph
// `<neo-datalist id="<ID>-options">` with the rendered options; the
// combobox kit hides the loading clone automatically once options
// arrive.
// The embedded neo.ComboboxOpts carries every base combobox option
// (placeholder, search, placement, …); set it as
// ComboboxOpts: neo.ComboboxOpts{...}. Async is forced on regardless.
type ComboboxAsyncOpts struct {
	neo.ComboboxOpts
	ID  string
	URL string
	// SearchSignal is the Datastar signal the live-search query is
	// mirrored into before each @post. The combobox reports the query
	// in the `neo-combobox-search` event detail; this wrapper copies it
	// onto the signal (the kit writes no framework attribute itself).
	// Empty leaves the query out of the request.
	SearchSignal  string
	Loading       templ.Component
	Failed        templ.Component
	ExtraPostOpts string
}

// comboboxAsyncNeoOpts forces Async on so the kit always renders the
// async placeholder slot, regardless of what the caller passed.
func comboboxAsyncNeoOpts(opts ComboboxAsyncOpts) neo.ComboboxOpts {
	o := opts.ComboboxOpts
	o.Async = neo.Set(true)
	return o
}

// comboboxAsyncAttrs is the Datastar wiring forwarded onto the
// delegated <neo-combobox>. The search listener is only bound for a
// live-search combobox (comboboxAsyncSearch is empty otherwise).
func comboboxAsyncAttrs(opts ComboboxAsyncOpts) templ.Attributes {
	a := templ.Attributes{
		"id":                        opts.ID,
		"data-signals":              comboboxAsyncSignals(opts),
		"data-on:neo-combobox-load": comboboxAsyncOpen(opts),
		"data-on:neo-popover-close": comboboxAsyncClose(opts),
		"data-on:datastar-fetch":    comboboxAsyncOnFetch(opts),
		"data-on:click":             comboboxAsyncRetry(opts),
	}
	if opts.LiveSearch.Or(false) {
		a["data-on:neo-combobox-search"] = comboboxAsyncSearch(opts)
	}
	return a
}

func comboboxAsyncSignals(opts ComboboxAsyncOpts) string {
	const s1, s2, s3 = "{", ": new AbortController(), ", "_errors: 0"
	var quotedBind string
	if opts.SearchSignal != "" {
		quotedBind = strconv.Quote(opts.SearchSignal)
	}
	var b strings.Builder
	n := len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) + len("}")
	if quotedBind != "" {
		n += len(", ") + len(quotedBind) + len(": ''")
	}
	b.Grow(n)
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	if quotedBind != "" {
		b.WriteString(", ")
		b.WriteString(quotedBind)
		b.WriteString(": ''")
	}
	b.WriteString("}")
	return b.String()
}

func comboboxAsyncOpen(opts ComboboxAsyncOpts) string {
	const s1, s2 = "$", "_errors = 0; "
	post := comboboxAsyncPost(opts)
	var b strings.Builder
	n := len(s1) + len(opts.ID) + len(s2) + len(post)
	if opts.SearchSignal != "" {
		n += len("$") + len(opts.SearchSignal) + len(" = ''; ")
	}
	b.Grow(n)
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	if opts.SearchSignal != "" {
		b.WriteString("$")
		b.WriteString(opts.SearchSignal)
		b.WriteString(" = ''; ")
	}
	b.WriteString(post)
	return b.String()
}

func comboboxAsyncSearch(opts ComboboxAsyncOpts) string {
	if !opts.LiveSearch.Or(false) {
		return ""
	}
	const s1, s2, s3 = "$", ".abort(); $", " = new AbortController(); $"
	const s4 = "_errors = 0; "
	const mirror = " = evt.detail.query; "
	post := comboboxAsyncPost(opts)
	var b strings.Builder
	n := len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(opts.ID) + len(s4) + len(post)
	if opts.SearchSignal != "" {
		n += len("$") + len(opts.SearchSignal) + len(mirror)
	}
	b.Grow(n)
	// Mirror the query from the combobox's `neo-combobox-search` detail
	// onto the bound signal before posting; the kit reports the query
	// through the event and writes no framework attribute itself.
	if opts.SearchSignal != "" {
		b.WriteString("$")
		b.WriteString(opts.SearchSignal)
		b.WriteString(mirror)
	}
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString(s4)
	b.WriteString(post)
	return b.String()
}

func comboboxAsyncClose(opts ComboboxAsyncOpts) string {
	const s1, s2, s3 = "$", ".abort(); $", " = new AbortController(); $"
	const s4 = "_errors = 0"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(opts.ID) + len(s4))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString(s4)
	return b.String()
}

func comboboxAsyncPost(opts ComboboxAsyncOpts) string {
	const s1, s2, s3 = "@post('", "', {", "requestCancellation: $"
	const sep = ", "
	var b strings.Builder
	n := len(s1) + len(opts.URL) + len(s2) + len(s3) + len(opts.ID) + len("})")
	if opts.ExtraPostOpts != "" {
		n += len(opts.ExtraPostOpts) + len(sep)
	}
	b.Grow(n)
	b.WriteString(s1)
	b.WriteString(opts.URL)
	b.WriteString(s2)
	if opts.ExtraPostOpts != "" {
		b.WriteString(opts.ExtraPostOpts)
		b.WriteString(sep)
	}
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString("})")
	return b.String()
}

// comboboxAsyncRetry installs click-delegation on the host: a
// descendant carrying [data-neo-popover-async-retry] aborts the
// in-flight fetch, then re-runs the load by calling the combobox
// host's reload(), which clears options, re-shows the loading slot,
// and re-fires the @post action. Reuses the popover-async retry
// attribute so retry buttons read the same in either context.
func comboboxAsyncRetry(opts ComboboxAsyncOpts) string {
	const s1 = "if (evt.composedPath().some((n) => n instanceof Element && n.closest('[data-neo-popover-async-retry]'))) { $"
	const s2 = ".abort(); $"
	const s3 = " = new AbortController(); document.getElementById('"
	const s4 = "').reload(); }"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(opts.ID) + len(s4))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString(s4)
	return b.String()
}

// comboboxAsyncOnFetch mirrors popoverAsyncOnFetch's three-disjunct
// listener: retries-failed exhausts the retry budget; an `error` event
// bumps $<id>_errors so we can distinguish a clean `finished` from a
// finished-after-failure (`retry: 'auto' / 'never'` + HTTP error). The
// swap writes the failed template into the listbox's navgroup as a
// [data-neo-empty-results] child; the kit's mutation observer treats
// that as "no results, show inline empty-results", and the kit's CSS
// suppresses its default "No results" hint when the listbox already
// has a descendant carrying that attribute. Mutating the navgroup
// (rather than the loading clone) avoids tripping the same observer
// into showing the default "No results" text.
func comboboxAsyncOnFetch(opts ComboboxAsyncOpts) string {
	const sw1 = "((n) => (n && (n.innerHTML = document.getElementById('"
	const sw2 = "-tpl-failed').innerHTML), true))(document.getElementById('"
	const sw3 = "-options'))"
	var sb strings.Builder
	sb.Grow(len(sw1) + len(opts.ID) + len(sw2) + len(opts.ID) + len(sw3))
	sb.WriteString(sw1)
	sb.WriteString(opts.ID)
	sb.WriteString(sw2)
	sb.WriteString(opts.ID)
	sb.WriteString(sw3)
	swap := sb.String()

	const scope = "evt.detail.el === el"
	const a = "(evt.detail.type === 'retries-failed' && "
	const c = ") || (evt.detail.type === 'error' && "
	const d = " && ++$"
	const e = "_errors) || (evt.detail.type === 'finished' && "
	const f = " && $"
	const g = "_errors > 0 && "
	var b strings.Builder
	b.Grow(len(a) + len(scope) + len(" && ") + len(swap) + len(c) +
		len(scope) + len(d) + len(opts.ID) + len(e) + len(scope) +
		len(f) + len(opts.ID) + len(g) + len(swap) + len(")"))
	b.WriteString(a)
	b.WriteString(scope)
	b.WriteString(" && ")
	b.WriteString(swap)
	b.WriteString(c)
	b.WriteString(scope)
	b.WriteString(d)
	b.WriteString(opts.ID)
	b.WriteString(e)
	b.WriteString(scope)
	b.WriteString(f)
	b.WriteString(opts.ID)
	b.WriteString(g)
	b.WriteString(swap)
	b.WriteString(")")
	return b.String()
}

// DialogAsyncOpts configures DialogAsync.
//
// ID names the dialog host and is reused as the AbortController signal
// name and the morph-target id of the body wrapper, so it must be a
// valid JS identifier. URL is the Datastar action POSTed on every open.
// Loading renders inside the body while the request is in flight;
// Failed renders when Datastar dispatches `retries-failed` or finishes
// the action after at least one `error` event. Pass nil for a built-in
// fallback.
//
// On a successful response the server is expected to morph
// `<div id="<ID>-body">` with the rendered dialog body. ExtraPostOpts
// is a JS expression body merged into the @post call, typically retry
// knobs (e.g. `retry: $_my_retry, retryMaxCount: $_my_retry_max_count`).
// The embedded neo.DialogOpts carries every base dialog option (open,
// dismissible); set it as DialogOpts: neo.DialogOpts{...}.
type DialogAsyncOpts struct {
	neo.DialogOpts
	ID            string
	URL           string
	Loading       templ.Component
	Failed        templ.Component
	Title         string
	Description   string
	CloseLabel    string
	ExtraPostOpts string
}

func dialogAsyncSignals(opts DialogAsyncOpts) string {
	const s1, s2, s3 = "{", ": new AbortController(), ", "_errors: 0}"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	return b.String()
}

func dialogAsyncOpen(opts DialogAsyncOpts) string {
	return dialogAsyncResetAndPost(opts)
}

func dialogAsyncClose(opts DialogAsyncOpts) string {
	const s1, s2, s3 = "$", ".abort(); $", " = new AbortController(); $"
	const s4 = "_errors = 0"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(opts.ID) + len(s4))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString(s4)
	return b.String()
}

func dialogAsyncPost(opts DialogAsyncOpts) string {
	const s1, s2, s3 = "@post('", "', {", "requestCancellation: $"
	const sep = ", "
	var b strings.Builder
	n := len(s1) + len(opts.URL) + len(s2) + len(s3) + len(opts.ID) + len("})")
	if opts.ExtraPostOpts != "" {
		n += len(opts.ExtraPostOpts) + len(sep)
	}
	b.Grow(n)
	b.WriteString(s1)
	b.WriteString(opts.URL)
	b.WriteString(s2)
	if opts.ExtraPostOpts != "" {
		b.WriteString(opts.ExtraPostOpts)
		b.WriteString(sep)
	}
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString("})")
	return b.String()
}

func dialogAsyncResetAndPost(opts DialogAsyncOpts) string {
	const s1 = "_errors = 0; document.getElementById('"
	const s2 = "-body').innerHTML = document.getElementById('"
	const s3 = "-tpl-loading').innerHTML; "
	post := dialogAsyncPost(opts)
	var b strings.Builder
	b.Grow(len("$") + len(opts.ID) + len(s1) + len(opts.ID) + len(s2) +
		len(opts.ID) + len(s3) + len(post))
	b.WriteString("$")
	b.WriteString(opts.ID)
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(post)
	return b.String()
}

// dialogAsyncRetry installs click-delegation on the host: a descendant
// carrying [data-neo-popover-async-retry] aborts the in-flight fetch,
// swaps the body back to loading, and re-runs the action without
// closing the dialog. Reuses the popover-async retry attribute so retry
// buttons read the same in every async wrapper.
func dialogAsyncRetry(opts DialogAsyncOpts) string {
	const s1 = "if (evt.target.closest('[data-neo-popover-async-retry]')) { $"
	const s2 = ".abort(); $"
	const s3 = " = new AbortController(); "
	reset := dialogAsyncResetAndPost(opts)
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(reset) + len(" }"))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(reset)
	b.WriteString(" }")
	return b.String()
}

// dialogAsyncOnFetch mirrors popoverAsyncOnFetch's failure contract:
// retries-failed means the network retry budget is exhausted; an
// `error` event increments $<id>_errors so a later `finished` can cover
// HTTP failures that Datastar stops retrying without emitting
// retries-failed.
func dialogAsyncOnFetch(opts DialogAsyncOpts) string {
	const sw1 = "(document.getElementById('"
	const sw2 = "-body').innerHTML = document.getElementById('"
	const sw3 = "-tpl-failed').innerHTML)"
	var sb strings.Builder
	sb.Grow(len(sw1) + len(opts.ID) + len(sw2) + len(opts.ID) + len(sw3))
	sb.WriteString(sw1)
	sb.WriteString(opts.ID)
	sb.WriteString(sw2)
	sb.WriteString(opts.ID)
	sb.WriteString(sw3)
	swap := sb.String()

	const scope = "evt.detail.el === el"
	const a = "(evt.detail.type === 'retries-failed' && "
	const c = ") || (evt.detail.type === 'error' && "
	const d = " && ++$"
	const e = "_errors) || (evt.detail.type === 'finished' && "
	const f = " && $"
	const g = "_errors > 0 && "
	var b strings.Builder
	b.Grow(len(a) + len(scope) + len(" && ") + len(swap) + len(c) +
		len(scope) + len(d) + len(opts.ID) + len(e) + len(scope) +
		len(f) + len(opts.ID) + len(g) + len(swap) + len(")"))
	b.WriteString(a)
	b.WriteString(scope)
	b.WriteString(" && ")
	b.WriteString(swap)
	b.WriteString(c)
	b.WriteString(scope)
	b.WriteString(d)
	b.WriteString(opts.ID)
	b.WriteString(e)
	b.WriteString(scope)
	b.WriteString(f)
	b.WriteString(opts.ID)
	b.WriteString(g)
	b.WriteString(swap)
	b.WriteString(")")
	return b.String()
}

// SidebarAsyncOpts configures SidebarAsync.
//
// ID names the sidebar host and is reused as the AbortController signal
// name and the morph-target id of the content slot, so it must be a
// valid JS identifier. URL is the Datastar action POSTed on every open.
// Loading renders inside the content slot while the request is in
// flight; Failed renders when Datastar dispatches `retries-failed` or
// finishes the action after at least one `error` event. Pass nil for a
// built-in fallback. Header and Footer render in the sidebar's
// [data-neo-sidebar-header] / [data-neo-sidebar-footer] slots; pass nil
// to omit.
//
// On a successful response the server is expected to morph
// `<div id="<ID>-body">` with the rendered content. ExtraPostOpts is a
// JS expression body merged into the @post call, typically retry knobs.
// The embedded neo.SidebarOpts carries every base sidebar option (side,
// overlay, breakpoint, …); set it as SidebarOpts: neo.SidebarOpts{...}.
// Set SidebarOpts.Manual so a wide-viewport auto-open doesn't POST
// before the user asks. The trigger lives outside the wrapper: wire a
// button to `document.getElementById('<ID>').toggle()`.
type SidebarAsyncOpts struct {
	neo.SidebarOpts
	ID            string
	URL           string
	Loading       templ.Component
	Failed        templ.Component
	Header        templ.Component
	Footer        templ.Component
	ExtraPostOpts string
}

func sidebarAsyncSignals(opts SidebarAsyncOpts) string {
	const s1, s2, s3 = "{", ": new AbortController(), ", "_errors: 0}"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	return b.String()
}

func sidebarAsyncOpen(opts SidebarAsyncOpts) string {
	return sidebarAsyncResetAndPost(opts)
}

func sidebarAsyncClose(opts SidebarAsyncOpts) string {
	const s1, s2, s3 = "$", ".abort(); $", " = new AbortController(); $"
	const s4 = "_errors = 0"
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(opts.ID) + len(s4))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString(s4)
	return b.String()
}

func sidebarAsyncPost(opts SidebarAsyncOpts) string {
	const s1, s2, s3 = "@post('", "', {", "requestCancellation: $"
	const sep = ", "
	var b strings.Builder
	n := len(s1) + len(opts.URL) + len(s2) + len(s3) + len(opts.ID) + len("})")
	if opts.ExtraPostOpts != "" {
		n += len(opts.ExtraPostOpts) + len(sep)
	}
	b.Grow(n)
	b.WriteString(s1)
	b.WriteString(opts.URL)
	b.WriteString(s2)
	if opts.ExtraPostOpts != "" {
		b.WriteString(opts.ExtraPostOpts)
		b.WriteString(sep)
	}
	b.WriteString(s3)
	b.WriteString(opts.ID)
	b.WriteString("})")
	return b.String()
}

func sidebarAsyncResetAndPost(opts SidebarAsyncOpts) string {
	const s1 = "_errors = 0; document.getElementById('"
	const s2 = "-body').innerHTML = document.getElementById('"
	const s3 = "-tpl-loading').innerHTML; "
	post := sidebarAsyncPost(opts)
	var b strings.Builder
	b.Grow(len("$") + len(opts.ID) + len(s1) + len(opts.ID) + len(s2) +
		len(opts.ID) + len(s3) + len(post))
	b.WriteString("$")
	b.WriteString(opts.ID)
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(post)
	return b.String()
}

// sidebarAsyncRetry installs click-delegation on the host: a descendant
// carrying [data-neo-popover-async-retry] aborts the in-flight fetch,
// swaps the content back to loading, and re-runs the action without
// closing the sidebar. Reuses the popover-async retry attribute so retry
// buttons read the same in every async wrapper.
func sidebarAsyncRetry(opts SidebarAsyncOpts) string {
	const s1 = "if (evt.target.closest('[data-neo-popover-async-retry]')) { $"
	const s2 = ".abort(); $"
	const s3 = " = new AbortController(); "
	reset := sidebarAsyncResetAndPost(opts)
	var b strings.Builder
	b.Grow(len(s1) + len(opts.ID) + len(s2) + len(opts.ID) + len(s3) +
		len(reset) + len(" }"))
	b.WriteString(s1)
	b.WriteString(opts.ID)
	b.WriteString(s2)
	b.WriteString(opts.ID)
	b.WriteString(s3)
	b.WriteString(reset)
	b.WriteString(" }")
	return b.String()
}

// sidebarAsyncOnFetch mirrors popoverAsyncOnFetch's failure contract:
// retries-failed means the network retry budget is exhausted; an
// `error` event increments $<id>_errors so a later `finished` can cover
// HTTP failures that Datastar stops retrying without emitting
// retries-failed.
func sidebarAsyncOnFetch(opts SidebarAsyncOpts) string {
	const sw1 = "(document.getElementById('"
	const sw2 = "-body').innerHTML = document.getElementById('"
	const sw3 = "-tpl-failed').innerHTML)"
	var sb strings.Builder
	sb.Grow(len(sw1) + len(opts.ID) + len(sw2) + len(opts.ID) + len(sw3))
	sb.WriteString(sw1)
	sb.WriteString(opts.ID)
	sb.WriteString(sw2)
	sb.WriteString(opts.ID)
	sb.WriteString(sw3)
	swap := sb.String()

	const scope = "evt.detail.el === el"
	const a = "(evt.detail.type === 'retries-failed' && "
	const c = ") || (evt.detail.type === 'error' && "
	const d = " && ++$"
	const e = "_errors) || (evt.detail.type === 'finished' && "
	const f = " && $"
	const g = "_errors > 0 && "
	var b strings.Builder
	b.Grow(len(a) + len(scope) + len(" && ") + len(swap) + len(c) +
		len(scope) + len(d) + len(opts.ID) + len(e) + len(scope) +
		len(f) + len(opts.ID) + len(g) + len(swap) + len(")"))
	b.WriteString(a)
	b.WriteString(scope)
	b.WriteString(" && ")
	b.WriteString(swap)
	b.WriteString(c)
	b.WriteString(scope)
	b.WriteString(d)
	b.WriteString(opts.ID)
	b.WriteString(e)
	b.WriteString(scope)
	b.WriteString(f)
	b.WriteString(opts.ID)
	b.WriteString(g)
	b.WriteString(swap)
	b.WriteString(")")
	return b.String()
}
