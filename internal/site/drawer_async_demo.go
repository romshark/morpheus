package site

import _ "embed"

// drawerAsyncFailureTempl is the templ source for the DrawerAsync
// "Async load with failure swap" demo.
//
//go:embed examples/drawer_async_failure.templ
var drawerAsyncFailureTempl string

//go:embed examples/drawer_async_failure.css
var drawerAsyncFailureCSS string
