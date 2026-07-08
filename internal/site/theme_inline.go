package site

// inlineThemeDefaultCSS holds the minified default-theme stylesheet that
// [pageHead] inlines so first paint needs no extra request. Empty until
// [SetInlineThemeDefaultCSS] runs; while empty, pageHead links
// min/theme-default.css instead.
var inlineThemeDefaultCSS string

// SetInlineThemeDefaultCSS sets the CSS [pageHead] inlines in place of the
// theme-default.css <link>. internal/cmd/gen calls it with the built
// min/theme-default.css before rendering pages.
func SetInlineThemeDefaultCSS(css string) { inlineThemeDefaultCSS = css }
