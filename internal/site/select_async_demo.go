package site

import _ "embed"

// selectAsyncFailureTempl is the templ source for the SelectAsync
// "Async load with failure swap" demo.
//
//go:embed examples/select_async_failure.templ
var selectAsyncFailureTempl string

//go:embed examples/select_async_failure.css
var selectAsyncFailureCSS string
