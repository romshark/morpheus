package site

import _ "embed"

//go:embed static/theme-default.css
var themeDefaultCSS string

//go:embed examples/theming_body.css
var themingBodyCSS string
