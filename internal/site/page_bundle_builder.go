package site

import (
	"sort"
	"strconv"
	"strings"
)

// bundleDep is one component and the components it creates or
// coordinates at runtime: a target B is in A's list when A's module
// renders B (e.g. neo-toaster builds neo-toast) or A is built around B
// as a first-class child contract (e.g. neo-contextmenu requires a
// neo-menu child). Derived from web/lib by hand; keep in sync.
//
// Excluded on purpose: shared CSS/positioning primitives a component
// only borrows (neo-slider inlines neo-tooltip's pill CSS but renders
// no neo-tooltip element; neo-select reuses popover marks without a
// neo-popover element), and optional author-supplied siblings a
// component merely interoperates with (a neo-button may host a
// neo-menu, a neo-carousel's prev/next may be a plain <button>).
type bundleDep struct {
	Name string
	On   []string
}

var bundleComponents = []bundleDep{
	{"neo-select", []string{
		"neo-icon", "neo-spinner", "neo-datalist", "neo-option", "neo-optgroup",
	}},
	{"neo-combobox", []string{
		"neo-icon", "neo-spinner", "neo-datalist", "neo-option", "neo-optgroup",
	}},
	{"neo-datalist", []string{"neo-option", "neo-optgroup"}},
	{"neo-textinput", []string{"neo-datalist", "neo-option", "neo-optgroup"}},
	{"neo-breadcrumb", []string{
		"neo-popover", "neo-button", "neo-icon", "neo-navgroup",
	}},
	{"neo-menu", []string{"neo-menuitem", "neo-submenu"}},
	{"neo-submenu", []string{"neo-menuitem"}},
	{"neo-contextmenu", []string{"neo-menu"}},
	{"neo-tabs", []string{"neo-tablist", "neo-tab", "neo-tabpanel"}},
	{"neo-carousel", []string{"neo-carousel-track", "neo-carousel-slide"}},
	{"neo-tree", []string{"neo-tree-item", "neo-icon"}},
	{"neo-pagination", []string{"neo-button", "neo-icon"}},
	{"neo-buttongroup", []string{"neo-button"}},
	{"neo-toggle-group", []string{"neo-toggle"}},
	{"neo-radio-group", []string{"neo-radio"}},
	{"neo-input-group", []string{"neo-textinput", "neo-icon", "neo-kbd"}},
	{"neo-toaster", []string{
		"neo-toast", "neo-button", "neo-icon", "neo-spinner",
	}},
	{"neo-resizable", []string{"neo-icon"}},
	{"neo-rating", []string{"neo-icon"}},
	{"neo-avatars", []string{"neo-avatar"}},
}

// bundleStandalone lists components with no component-level
// dependencies: they neither render nor require another neo-* element.
// A component reached only through a dependency edge (neo-icon,
// neo-option, …) is omitted here; it enters the graph as that edge's
// target. neo-link is excluded entirely; it ships no JS or CSS module,
// so it is not a bundle unit.
var bundleStandalone = []string{
	"neo-alert", "neo-badge", "neo-boundary", "neo-card", "neo-checkbox",
	"neo-clipcopy", "neo-color-field", "neo-condition", "neo-dialog", "neo-drawer",
	"neo-elastic", "neo-kbd", "neo-keys", "neo-layout", "neo-lightbox",
	"neo-persist", "neo-progress", "neo-revealable", "neo-sidebar", "neo-skeleton",
	"neo-slider", "neo-slider-range", "neo-sortable", "neo-switch", "neo-textarea",
	"neo-tooltip",
}

// bundleDisabled marks components rendered as disabled in the graph
// (struck through, non-interactive, dashed edges). Keyed by component
// name. Empty by default; populate to exclude a node from a bundle.
var bundleDisabled = map[string]bool{}

// bundleBound lists structural sub-components that have no standalone
// identity: they only exist inside a parent (e.g. neo-menuitem is
// only meaningful inside neo-menu). They get no toggle of their own;
// in the graph they're tied to their owners, enabled exactly when
// some component that uses them is selected.
var bundleBound = map[string]bool{
	"neo-option":         true,
	"neo-optgroup":       true,
	"neo-menuitem":       true,
	"neo-submenu":        true,
	"neo-tablist":        true,
	"neo-tab":            true,
	"neo-tabpanel":       true,
	"neo-carousel-track": true,
	"neo-carousel-slide": true,
	"neo-tree-item":      true,
	"neo-radio":          true,
	"neo-toast":          true,
}

// bundleNode is the per-name data the <bundle-graph> element reads
// from one declarative child plus what the Datastar selection model
// needs: a stable element id, the visible label, the comma-separated
// target ids it depends on ("" when none), and the id sets the
// include/exclude rules are built from.
type bundleNode struct {
	ID        string
	Name      string
	DependsOn string
	Disabled  bool
	// Bound: a structural child with no toggle; its graph state is
	// derived from dependentIDs (the owners that pull it in).
	Bound bool

	// transDepIDs: the selectable ids this component transitively
	// depends on. Selecting it pulls all of them in so the bundle
	// stays dependency-closed (bound children are derived, not added).
	transDepIDs []string
	// dependentIDs: the selectable ids that transitively depend on
	// this one. For a selectable node it's the lock set (can't switch
	// off while any is selected); for a bound node it's the owner set
	// (enabled iff any is selected).
	dependentIDs []string
}

// $bundleSel is the local Datastar signal: the array of selected
// component ids. Default = every component (all included). The graph
// span's `disabled`, each toggle's `pressed`/`disabled`, and the
// count all derive from it; nothing mutates the SVG directly.
const bundleSelSignal = "$bundleSel"

// bundleSelectableIDs is every toggleable (non-bound, non-Disabled)
// component id: the universe the signal and bulk actions act on.
func bundleSelectableIDs() []string {
	var ids []string
	for _, nd := range bundleNodes() {
		if !nd.Bound && !nd.Disabled {
			ids = append(ids, nd.ID)
		}
	}
	return ids
}

// bundleSignals seeds the signal with every selectable component
// (all included by default).
func bundleSignals() string {
	return "{bundleSel: " + jsIDArray(bundleSelectableIDs()) + "}"
}

// bundleEnableAllExpr / bundleDisableAllExpr are the bulk click
// handlers. "Enable all" restores the full selectable set; "disable
// all" clears it, valid because with nothing selected nothing is
// required.
func bundleEnableAllExpr() string {
	return bundleSelSignal + " = " + jsIDArray(bundleSelectableIDs())
}

func bundleDisableAllExpr() string {
	return bundleSelSignal + " = []"
}

// bundleCountText is the data-text expression shown above the graph.
// The denominator is the selectable count; bound children aren't
// individually selected, they ride along with their owners.
func bundleCountText() string {
	return bundleSelSignal + ".length + ' / " +
		strconv.Itoa(len(bundleSelectableIDs())) + " components selected'"
}

// bundleSpanDisabled drives the graph node's `disabled` attribute. A
// selectable node is disabled when it's not in the selection; a bound
// child is disabled unless one of its owners is selected, so it
// stays tied to its parent.
func bundleSpanDisabled(nd bundleNode) string {
	if nd.Bound {
		if len(nd.dependentIDs) == 0 {
			return "true"
		}
		parts := make([]string, len(nd.dependentIDs))
		for i, id := range nd.dependentIDs {
			parts[i] = bundleSelSignal + ".includes('" + id + "')"
		}
		return "!(" + strings.Join(parts, " || ") + ")"
	}
	return "!" + bundleSelSignal + ".includes('" + nd.ID + "')"
}

// bundleTogglePressed drives a toggle's pressed state = selected.
func bundleTogglePressed(nd bundleNode) string {
	return bundleSelSignal + ".includes('" + nd.ID + "')"
}

// bundleToggleLock drives a toggle's `disabled` attribute: the toggle
// locks (can't be switched off) while any component that depends on
// this one is still selected. That's the "can't disable a component
// other enabled components depend on" rule.
func bundleToggleLock(nd bundleNode) string {
	if len(nd.dependentIDs) == 0 {
		return "false"
	}
	parts := make([]string, len(nd.dependentIDs))
	for i, id := range nd.dependentIDs {
		parts[i] = bundleSelSignal + ".includes('" + id + "')"
	}
	return strings.Join(parts, " || ")
}

// bundleToggleChange is the neo-toggle-change handler. Selecting a
// component also pulls in its whole dependency closure (kept unique);
// deselecting just drops the component itself; the lock guarantees
// nothing selected still needs it.
func bundleToggleChange(nd bundleNode) string {
	add := append([]string{nd.ID}, nd.transDepIDs...)
	return bundleSelSignal + " = evt.detail.pressed" +
		" ? [...new Set([..." + bundleSelSignal + ", " + jsIDList(add) + "])]" +
		" : " + bundleSelSignal + ".filter(s => s !== '" + nd.ID + "')"
}

// bundleInitiallyLocked: with the default all-selected state, a node
// is locked from the start when anything depends on it (and that
// dependent isn't itself disabled by default).
func bundleInitiallyLocked(nd bundleNode) bool {
	return len(nd.dependentIDs) > 0
}

// jsIDList renders ids as a quoted, comma-separated list (no
// brackets): graph-a,graph-b -> 'graph-a', 'graph-b'.
func jsIDList(ids []string) string {
	q := make([]string, len(ids))
	for i, id := range ids {
		q[i] = "'" + id + "'"
	}
	return strings.Join(q, ", ")
}

// jsIDArray wraps jsIDList in brackets.
func jsIDArray(ids []string) string {
	return "[" + jsIDList(ids) + "]"
}

// bundleNodeID turns a component name into a DOM-safe element id,
// e.g. "neo-select" -> "graph-neo-select", "neo-toast" ->
// "graph-neo-toast". dash starts true so a leading non-alnum
// (like "[") doesn't produce a doubled separator after "graph-".
func bundleNodeID(name string) string {
	var b strings.Builder
	b.WriteString("graph-")
	dash := true
	for _, r := range strings.ToLower(name) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			dash = false
		case !dash:
			b.WriteByte('-')
			dash = true
		}
	}
	return strings.TrimRight(b.String(), "-")
}

// bundleNodes returns every component (dependency parents, their
// targets, and standalone ones) sorted by name, ready to emit as
// <bundle-graph> children.
func bundleNodes() []bundleNode {
	depsByName := make(map[string][]string, len(bundleComponents))
	names := make(map[string]struct{})
	for _, c := range bundleComponents {
		depsByName[c.Name] = c.On
		names[c.Name] = struct{}{}
		for _, t := range c.On {
			names[t] = struct{}{}
		}
	}
	for _, s := range bundleStandalone {
		names[s] = struct{}{}
	}

	// Invert the edges so we can walk dependents.
	dependents := make(map[string][]string)
	for _, c := range bundleComponents {
		for _, t := range c.On {
			dependents[t] = append(dependents[t], c.Name)
		}
	}

	sorted := make([]string, 0, len(names))
	for nm := range names {
		sorted = append(sorted, nm)
	}
	sort.Strings(sorted)

	// selectableIDs maps a list of names to ids, dropping bound ones;
	// bound children never enter the signal or the lock/owner sets.
	selectableIDs := func(ns []string) []string {
		ids := make([]string, 0, len(ns))
		for _, n := range ns {
			if !bundleBound[n] {
				ids = append(ids, bundleNodeID(n))
			}
		}
		sort.Strings(ids)
		return ids
	}

	out := make([]bundleNode, 0, len(sorted))
	for _, nm := range sorted {
		var ids []string
		for _, t := range depsByName[nm] {
			ids = append(ids, bundleNodeID(t))
		}

		out = append(out, bundleNode{
			ID:           bundleNodeID(nm),
			Name:         nm,
			DependsOn:    strings.Join(ids, ","),
			Disabled:     bundleDisabled[nm],
			Bound:        bundleBound[nm],
			transDepIDs:  selectableIDs(bundleReachable(nm, depsByName)),
			dependentIDs: selectableIDs(bundleReachable(nm, dependents)),
		})
	}
	return out
}

// bundleBoundIDs is bundleBound keyed by graph node id instead of name.
func bundleBoundIDs() map[string]bool {
	ids := make(map[string]bool, len(bundleBound))
	for name := range bundleBound {
		ids[bundleNodeID(name)] = true
	}
	return ids
}

// bundleStandaloneNodes is the landing "Modular Bundle" graph's node
// set: standalone components only. Bound sub-components (neo-option,
// neo-tab, …) are dropped, and any dependency edge pointing at one is
// stripped so the graph references only rendered nodes. The interactive
// bundle-builder graph keeps using bundleNodes() and still shows them.
func bundleStandaloneNodes() []bundleNode {
	boundIDs := bundleBoundIDs()
	all := bundleNodes()
	out := make([]bundleNode, 0, len(all))
	for _, nd := range all {
		if nd.Bound {
			continue
		}
		if nd.DependsOn != "" {
			kept := make([]string, 0)
			for _, id := range strings.Split(nd.DependsOn, ",") {
				if !boundIDs[id] {
					kept = append(kept, id)
				}
			}
			nd.DependsOn = strings.Join(kept, ",")
		}
		out = append(out, nd)
	}
	return out
}

// bundleReachable returns every node reachable from name over adj
// (excluding name itself), sorted and deduped. Used both ways: with
// the dependency map it yields transitive dependencies, with the
// inverted map it yields transitive dependents. The visited set also
// guards against cycles.
func bundleReachable(name string, adj map[string][]string) []string {
	seen := make(map[string]bool)
	var dfs func(string)
	dfs = func(n string) {
		for _, d := range adj[n] {
			if !seen[d] {
				seen[d] = true
				dfs(d)
			}
		}
	}
	dfs(name)
	out := make([]string, 0, len(seen))
	for d := range seen {
		out = append(out, d)
	}
	sort.Strings(out)
	return out
}
