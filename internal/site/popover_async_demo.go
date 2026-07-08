package site

import _ "embed"

// popoverAsyncTempl is the templ source for the "Async load with
// failure swap" demo, embedded verbatim from the example that also
// drives the live preview.
//
//go:embed examples/popover_async_failure.templ
var popoverAsyncTempl string
