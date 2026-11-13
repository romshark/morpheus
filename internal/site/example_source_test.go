package site

import "testing"

// TestUnescapeTempl tests that the escapes templ adds are undone where an
// author writes the plain character, and kept where they are needed.
func TestUnescapeTempl(t *testing.T) {
	for _, tt := range []struct{ name, in, want string }{
		{"attr arrow and and",
			`<a x="(n) =&gt; a &amp;&amp; i &lt;= 4">`,
			`<a x="(n) => a && i <= 4">`},
		{"attr quotes",
			`<a x="$s ? &#39;true&#39; : &#39;false&#39;" y="&#34;q&#34;">`,
			`<a x="$s ? 'true' : 'false'" y="&quot;q&quot;">`},
		{"attr lone ampersand kept",
			`<a x="Europe &amp; Africa" y="&amp;copy;">`,
			`<a x="Europe &amp; Africa" y="&amp;copy;">`},
		{"text quotes",
			`<p>No match &#34;x&#34; isn&#39;t</p>`,
			`<p>No match "x" isn't</p>`},
		{"text angle brackets kept",
			`<code>&lt;neo-x&gt;</code>`,
			`<code>&lt;neo-x&gt;</code>`},
		{"script kept",
			`<script>const q = "&#34;";</script><p>&#34;</p>`,
			`<script>const q = "&#34;";</script><p>"</p>`},
		{"bare attribute kept",
			`<neo-switch checked data-x="&#39;a&#39;"></neo-switch>`,
			`<neo-switch checked data-x="'a'"></neo-switch>`},
	} {
		if got := unescapeTempl(tt.in); got != tt.want {
			t.Errorf("%s:\n got %s\nwant %s", tt.name, got, tt.want)
		}
	}
}
