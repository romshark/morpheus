package main

import "testing"

// TestRewriteHTMLBasePlaygroundState tests that the base prefixes asset and
// page URLs in plain markup and in the escaped markup of a playground state,
// and leaves escaped URLs outside a state, as in a source tab, as written.
func TestRewriteHTMLBasePlaygroundState(t *testing.T) {
	const in = `<img src="/static/a.webp"><a href="/compare/">x</a>` +
		`<template data-playground-state data-label="B">` +
		`&lt;img src=&#34;/static/a.webp&#34;&gt;&lt;a href=&#34;/compare/#x&#34;&gt;` +
		`</template>` +
		`<pre>src=&#34;/static/a.webp&#34;</pre>`
	const want = `<img src="/m/static/a.webp"><a href="/m/compare/">x</a>` +
		`<template data-playground-state data-label="B">` +
		`&lt;img src=&#34;/m/static/a.webp&#34;&gt;&lt;a href=&#34;/m/compare/#x&#34;&gt;` +
		`</template>` +
		`<pre>src=&#34;/static/a.webp&#34;</pre>`
	got := string(rewriteHTMLBase([]byte(in), "/m", []string{"/", "/compare/"}))
	if got != want {
		t.Errorf("\nwant %s\ngot  %s", want, got)
	}
}
