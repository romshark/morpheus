package site

import (
	"slices"
	"strings"

	"github.com/romshark/morpheus/internal/bundle"
)

// bundleSelSignal holds the selected component ids.
// The toggles and the count derive from it.
const bundleSelSignal = "$bundleSel"

// bundleVersionSignal holds the selected [BundleVersion] name.
const bundleVersionSignal = "$bundleVersion"

// bundleAbsentExpr is the selected version's [BundleVersion.Absent].
const bundleAbsentExpr = "window.__bundleURL.absent(" + bundleVersionSignal + ")"

// BundleVersion is a release tag the bundle builder builds, or "main" for
// the working tree. Absent are the selectable ids it lacks and Themes its
// [bundle.Manifest.Themes]. internal/cmd/gen lists the default first,
// which is the newest release without a pre-release suffix.
type BundleVersion struct {
	Name   string   `json:"name"`
	Absent []string `json:"absent,omitempty"`
	Themes []string `json:"-"`
}

func bundleVersionLabel(versions []BundleVersion, i int) string {
	switch {
	case versions[i].Name == "main":
		return "main (unreleased)"
	case i == 0:
		return versions[i].Name + " (latest)"
	}
	return versions[i].Name
}

// bundleVersionChange is the version select's change handler.
// A full selection stays full. Any other drops the ids the new version lacks and
// adds the requirements it has.
func bundleVersionChange() string {
	ids := "window.__bundleURL.ids"
	full := ids + ".every(s => " +
		bundleSelSignal + ".includes(s) || " + bundleAbsentExpr + ".includes(s))"
	return bundleSelSignal + " = window.__bundleURL.withDeps(" +
		full + " ? " + ids + " : " + bundleSelSignal + ", evt.detail.value); " +
		bundleVersionSignal + " = evt.detail.value"
}

// bundleSignals seeds the signals from [bundleURLBootstrap].
const bundleSignals = "{bundleSel: window.__bundleURL.selected, " +
	"bundleVersion: window.__bundleURL.version}"

// bundleSizeUpdate passes the signals to bundle-size.ts on each change.
const bundleSizeUpdate = "window.__bundleSizeUpdate(" +
	bundleSelSignal + ", " + bundleVersionSignal + ")"

// bundleURLData is the page's bundle-components JSON, which
// [bundleURLBootstrap] and bundle-size.ts read.
type bundleURLData struct {
	Components []bundleURLComponent `json:"components"`
	Versions   []BundleVersion      `json:"versions"`
}

// bundleURLComponent is a selectable component in [bundleURLData].
// Name is its [bundle.Node.ShortName] and Deps its [bundle.Node.Requires].
type bundleURLComponent struct {
	ID   string   `json:"id"`
	Name string   `json:"name"`
	Deps []string `json:"deps,omitempty"`
}

func bundleURLComponents() []bundleURLComponent {
	var out []bundleURLComponent
	for _, nd := range bundle.Nodes() {
		if !nd.Selectable() {
			continue
		}
		out = append(out, bundleURLComponent{
			ID:   nd.ID,
			Name: nd.ShortName(),
			Deps: nd.Requires,
		})
	}
	return out
}

// bundleFile is a size table row. Name is the row's data-file and the
// ?file= value. Zip puts the file in the archive by default.
type bundleFile struct {
	Name string
	Zip  bool
}

// bundleDefaultTheme is the theme the components need.
const bundleDefaultTheme = "theme-default.css"

// bundleFiles are the built files, then the themes of all versions with
// [bundleDefaultTheme] first. bundle-size.ts leaves the row of a theme
// the selected version lacks empty.
func bundleFiles(versions []BundleVersion) []bundleFile {
	files := []bundleFile{
		{"morpheus.min.js", true},
		{"morpheus.min.css", true},
		{"morpheus.js", false},
		{"morpheus.css", false},
	}
	var themes []string
	for _, v := range versions {
		for _, t := range v.Themes {
			if !slices.Contains(themes, t) {
				themes = append(themes, t)
			}
		}
	}
	if i := slices.Index(themes, bundleDefaultTheme); i > 0 {
		themes = slices.Insert(slices.Delete(themes, i, i+1), 0, bundleDefaultTheme)
	}
	for _, t := range themes {
		files = append(files, bundleFile{t, t == bundleDefaultTheme})
	}
	return files
}

// bundleEnableAllExpr and bundleDisableAllExpr are the bulk handlers.
// Disable all also clears locked ids. An empty selection requires nothing.
const (
	bundleEnableAllExpr = bundleSelSignal +
		" = window.__bundleURL.ids.filter(s => !" + bundleAbsentExpr + ".includes(s))"
	bundleDisableAllExpr = bundleSelSignal + " = []"
)

// bundleCountText is the size card's count of selected over the
// version's selectable components.
const bundleCountText = bundleSelSignal + ".length + ' / ' + " +
	"(window.__bundleURL.ids.length - " +
	bundleAbsentExpr + ".length) + ' components selected'"

// bundleTogglePressed is a toggle's pressed as 'true' or 'false'.
// Datastar removes the attribute for a bare false, and neo-toggle keeps
// its state when pressed is removed.
func bundleTogglePressed(nd bundle.Node) string {
	return "(" + bundleSelSignal + ".includes('" + nd.ID + "') ? 'true' : 'false')"
}

// bundleToggleLock is a toggle's disabled expression, true while a
// selected component requires it or the version lacks it.
func bundleToggleLock(nd bundle.Node) string {
	parts := []string{bundleAbsentExpr + ".includes('" + nd.ID + "')"}
	for _, id := range nd.RequiredBy {
		parts = append(parts, bundleSelSignal+".includes('"+id+"')")
	}
	return strings.Join(parts, " || ")
}

// bundleToggleChange is the neo-toggle-change handler. Selecting adds the
// requirements the version has. Deselecting drops only the component,
// because the lock guarantees that no selected component needs it.
func bundleToggleChange(nd bundle.Node) string {
	return bundleSelSignal + " = evt.detail.pressed" +
		" ? window.__bundleURL.withDeps([..." + bundleSelSignal + ", '" + nd.ID + "'], " +
		bundleVersionSignal + ")" +
		" : " + bundleSelSignal + ".filter(s => s !== '" + nd.ID + "')"
}

// bundleInitiallyLocked is the lock in the server-rendered, all-selected
// state.
func bundleInitiallyLocked(nd bundle.Node) bool {
	return len(nd.RequiredBy) > 0
}

// bundleDependsOn is a <bundle-graph> child's depends-on attribute.
func bundleDependsOn(nd bundle.Node) string { return strings.Join(nd.DependsOn, ",") }

// bundleStandaloneNodes is the landing page's "Modular Bundle" graph,
// which is [bundle.Nodes] without the bound nodes and their edges.
func bundleStandaloneNodes() []bundle.Node {
	all := bundle.Nodes()
	boundIDs := make(map[string]bool)
	for _, nd := range all {
		if nd.Bound {
			boundIDs[nd.ID] = true
		}
	}
	out := make([]bundle.Node, 0, len(all))
	for _, nd := range all {
		if nd.Bound {
			continue
		}
		nd.DependsOn = slices.DeleteFunc(nd.DependsOn,
			func(id string) bool { return boundIDs[id] })
		out = append(out, nd)
	}
	return out
}

// bundleCLIRun and bundleCLITool are the command line section's snippets,
// pinned to the release the site was built from.
func bundleCLIRun(version string) string {
	return "go run github.com/romshark/morpheus@" + version +
		" bundle -components select,dialog -o static/morpheus"
}

func bundleCLITool(version string) string {
	return "go get -tool github.com/romshark/morpheus@" + version + "\n" +
		"go tool morpheus bundle -components select,dialog -o static/morpheus"
}
