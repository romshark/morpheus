package site

import _ "embed"

// comboboxAsyncFailureTempl is the templ source for the "Async load
// with failure swap" demo, single-sourced from the rendered example.
//
//go:embed examples/combobox_async_failure.templ
var comboboxAsyncFailureTempl string

//go:embed examples/combobox_async_failure.css
var comboboxAsyncFailureCSS string
