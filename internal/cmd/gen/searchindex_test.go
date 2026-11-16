package main

import (
	"reflect"
	"testing"
)

// TestPageSections tests that only anchored headings are indexed, that the
// permalink "#" is dropped from the title, that API headings take the
// preceding api-element heading as prefix, and that identified api-table
// rows land under the heading before them.
func TestPageSections(t *testing.T) {
	const body = `<!doctype html><html><body>
<h2 id="overview" class="anchor-h2">Menu <a href="#overview" class="anchor-h2-link">#</a></h2>
<h3 id="demo-title">Not anchored</h3>
<h3 id="attributes" class="anchor-h3 api-heading"><neo-icon name="x"></neo-icon> Attributes <a class="anchor-h3-link">#</a></h3>
<h3 class="api-element">&lt;neo-menuitem&gt;</h3>
<h3 id="menuitem-events" class="anchor-h3 api-heading">Events<a class="anchor-h3-link">#</a></h3>
<table class="api-table"><tbody>
<tr id="menuitem-events-neo-menuitem-select"><th scope="row"><code>neo-menuitem-select</code> <a class="api-row-link">#</a></th><td>x</td></tr>
<tr><th scope="row"><code>no-id</code></th></tr>
</tbody></table>
<table><tr id="other-table"><th scope="row">Not API</th></tr></table>
<h3 id="push-mode" class="anchor-h3">Push   <code>mode</code><a class="anchor-h3-link">#</a></h3>
</body></html>`
	got, err := pageSections([]byte(body))
	if err != nil {
		t.Fatal(err)
	}
	want := []searchIndexSection{
		{ID: "overview", Title: "Menu"},
		{ID: "attributes", Title: "Attributes"},
		{ID: "menuitem-events", Title: "<neo-menuitem> › Events", Items: []searchIndexItem{
			{ID: "menuitem-events-neo-menuitem-select", Name: "neo-menuitem-select"},
		}},
		{ID: "push-mode", Title: "Push mode"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("pageSections:\n got %q\nwant %q", got, want)
	}
}
