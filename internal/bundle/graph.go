package bundle

import (
	"maps"
	"slices"
	"strings"
)

// dep lists the components Name needs at runtime. On holds the ones its
// module renders (neo-toaster renders neo-toast) and the children it
// requires (neo-contextmenu requires neo-menu). Maintained by hand from
// web/lib.
//
// Inlined CSS and optional children are not edges. neo-slider inlines
// neo-tooltip's pill CSS, and neo-button may hold a neo-menu.
// [stylesheets] adds the sheets a component reads tokens from.
type dep struct {
	Name string
	On   []string
}

var deps = []dep{
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

// standalone lists the components no dep mentions. neo-link has no files
// because neo-button.css holds its rules ([sheetUsers]).
var standalone = []string{
	"neo-alert", "neo-aura", "neo-badge", "neo-boundary", "neo-card", "neo-checkbox",
	"neo-clipcopy", "neo-color-field", "neo-dialog", "neo-drawer", "neo-elastic",
	"neo-if-network", "neo-if-platform", "neo-kbd", "neo-keys", "neo-layout",
	"neo-lightbox", "neo-link", "neo-persist", "neo-progress", "neo-revealable",
	"neo-sidebar", "neo-skeleton", "neo-slider", "neo-slider-range", "neo-sortable",
	"neo-switch", "neo-textarea", "neo-tooltip",
}

// disabled excludes components from every bundle.
// The landing page's graph strikes them through.
var disabled = map[string]bool{}

// bound lists sub-components that exist only inside a parent, such as
// neo-menuitem in neo-menu. They are not selectable and ship with any
// selected component that uses them.
var bound = map[string]bool{
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

// Node is one component of the graph.
type Node struct {
	// ID is the manifest entry id and the landing graph's element id,
	// such as graph-neo-select.
	ID   string
	Name string
	// DependsOn are the ids of the direct dependencies.
	DependsOn []string
	Disabled  bool
	Bound     bool

	// Requires are the selectable transitive dependencies, which selecting
	// the node adds.
	Requires []string
	// RequiredBy are the selectable transitive dependents.
	// They lock the node's toggle, or own a bound node.
	RequiredBy []string
}

// ShortName is the name without "neo-". The bundle builder page shows it,
// and ?components= and -components take it.
func (nd Node) ShortName() string { return strings.TrimPrefix(nd.Name, "neo-") }

// Selectable reports whether a selection can name nd.
func (nd Node) Selectable() bool { return !nd.Bound && !nd.Disabled }

// nodeID turns a component name into a [Node.ID].
func nodeID(name string) string { return "graph-" + name }

// Nodes returns every component sorted by name.
func Nodes() []Node {
	depsByName := make(map[string][]string, len(deps))
	dependents := make(map[string][]string)
	names := make(map[string]struct{})
	for _, c := range deps {
		depsByName[c.Name] = c.On
		names[c.Name] = struct{}{}
		for _, t := range c.On {
			names[t] = struct{}{}
			dependents[t] = append(dependents[t], c.Name)
		}
	}
	for _, s := range standalone {
		names[s] = struct{}{}
	}

	// Bound nodes never enter a selection, lock or owner set.
	// Sorted ns gives sorted ids.
	selectableIDs := func(ns []string) []string {
		ids := make([]string, 0, len(ns))
		for _, n := range ns {
			if !bound[n] {
				ids = append(ids, nodeID(n))
			}
		}
		return ids
	}

	out := make([]Node, 0, len(names))
	for _, nm := range slices.Sorted(maps.Keys(names)) {
		var ids []string
		for _, t := range depsByName[nm] {
			ids = append(ids, nodeID(t))
		}

		out = append(out, Node{
			ID:         nodeID(nm),
			Name:       nm,
			DependsOn:  ids,
			Disabled:   disabled[nm],
			Bound:      bound[nm],
			Requires:   selectableIDs(reachable(nm, depsByName)),
			RequiredBy: selectableIDs(reachable(nm, dependents)),
		})
	}
	return out
}

// reachable returns the sorted nodes reachable from name over adj,
// which are the dependencies, or the dependents over the inverted map.
func reachable(name string, adj map[string][]string) []string {
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
	return slices.Sorted(maps.Keys(seen))
}

// Selection is what a list of component names selects.
type Selection struct {
	// IDs are the named components and their requirements, in [Nodes] order.
	// [Build] takes them.
	IDs []string
	// Named are the ids of the named components, in [Nodes] order.
	Named []string
	// Unknown are the names that match no selectable component.
	Unknown []string
	// Missing are the short names of the named components a version lacks.
	Missing []string
}

// Select reads component names as the bundle builder page reads
// ?components=. A value holds comma-separated short names in any case,
// with or without "neo-". absent are the ids the version lacks.
func Select(values, absent []string) Selection {
	nodes := Nodes()
	byName := make(map[string]Node, len(nodes))
	for _, nd := range nodes {
		if nd.Selectable() {
			byName[nd.ShortName()] = nd
		}
	}
	var s Selection
	named := make(map[string]bool)
	picked := make(map[string]bool)
	for raw := range strings.SplitSeq(strings.Join(values, ","), ",") {
		raw = strings.TrimSpace(raw)
		name := strings.TrimPrefix(strings.ToLower(raw), "neo-")
		nd, ok := byName[name]
		switch {
		case !ok:
			if name != "" {
				s.Unknown = append(s.Unknown, raw)
			}
		case slices.Contains(absent, nd.ID):
			s.Missing = append(s.Missing, nd.ShortName())
		default:
			named[nd.ID] = true
			picked[nd.ID] = true
			for _, id := range nd.Requires {
				picked[id] = true
			}
		}
	}
	for _, nd := range nodes {
		if picked[nd.ID] && !slices.Contains(absent, nd.ID) {
			s.IDs = append(s.IDs, nd.ID)
		}
		if named[nd.ID] {
			s.Named = append(s.Named, nd.ID)
		}
	}
	return s
}
