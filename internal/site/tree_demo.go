package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// Embedded from the same .js modules the page loads at runtime so the
// "Server script" tabs can't drift.

//go:embed static/sim/tree/loadnode.js
var treeLoadNodeScript string

// LazyNode is one node of the async-loading tree demo. Branches carry
// Children; leaves leave it nil. Path uniquely identifies the node.
// The DOM id is derived from Path and is what the async demo posts
// back to the simulated server. Fields are exported so the page-local
// JSONScript can feed the static-site simulator.
type LazyNode struct {
	Path     string     `json:"path"`
	Label    string     `json:"label"`
	Children []LazyNode `json:"children,omitempty"`
}

// LazyTreeData is the demo's static tree shape. Two levels of dynamic
// loading: clicking a root expands it and triggers the first fetch;
// clicking a sub-branch returned by that fetch triggers the second.
var LazyTreeData = []LazyNode{
	{Path: "src", Label: "src", Children: []LazyNode{
		{Path: "src/components", Label: "components", Children: []LazyNode{
			{Path: "src/components/Button.tsx", Label: "Button.tsx"},
			{Path: "src/components/Card.tsx", Label: "Card.tsx"},
			{Path: "src/components/Modal.tsx", Label: "Modal.tsx"},
		}},
		{Path: "src/hooks", Label: "hooks", Children: []LazyNode{
			{Path: "src/hooks/useDebounce.ts", Label: "useDebounce.ts"},
			{Path: "src/hooks/useMediaQuery.ts", Label: "useMediaQuery.ts"},
		}},
		{Path: "src/App.tsx", Label: "App.tsx"},
	}},
	{Path: "docs", Label: "docs", Children: []LazyNode{
		{Path: "docs/intro.md", Label: "intro.md"},
		{Path: "docs/guide", Label: "guide", Children: []LazyNode{
			{Path: "docs/guide/setup.md", Label: "setup.md"},
			{Path: "docs/guide/usage.md", Label: "usage.md"},
		}},
		{Path: "docs/api.md", Label: "api.md"},
	}},
	{Path: "tests", Label: "tests", Children: []LazyNode{
		{Path: "tests/unit", Label: "unit", Children: []LazyNode{
			{Path: "tests/unit/parser.test.ts", Label: "parser.test.ts"},
			{Path: "tests/unit/router.test.ts", Label: "router.test.ts"},
		}},
		{Path: "tests/integration.test.ts", Label: "integration.test.ts"},
	}},
}

// Static-source pairs (HTML + Templ) for the per-example demos in the
// Tree page's "Examples" section. The HTML tab is the example's own
// rendered output; the Templ tab embeds its .templ source verbatim.

var treeFileSystemHTML = renderExampleHTML(examples.TreeFileSystem())

//go:embed examples/tree_file_system.templ
var treeFileSystemTempl string

var treeCategoriesHTML = renderExampleHTML(examples.TreeCategories())

//go:embed examples/tree_categories.templ
var treeCategoriesTempl string

var treeSingleRootHTML = renderExampleHTML(examples.TreeSingleRoot())

//go:embed examples/tree_single_root.templ
var treeSingleRootTempl string

var treeExplorerHTML = renderExampleHTML(examples.TreeExplorer())

//go:embed examples/tree_explorer.templ
var treeExplorerTempl string

var treeAsyncHTML = renderExampleHTML(examples.TreeAsync())

//go:embed examples/tree_async.templ
var treeAsyncTempl string

//go:embed examples/tree_async.css
var treeAsyncCSS string

var treeBookmarksHTML = renderExampleHTML(examples.TreeBookmarks())

//go:embed examples/tree_bookmarks.templ
var treeBookmarksTempl string

func treePlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: treePlaygroundDefaultHTML},
		{Label: "File system", HTML: treeFileSystemHTML},
		{Label: "Single root, all collapsed", HTML: treeSingleRootHTML},
	}
}

// treePlaygroundDefaultHTML is a small structural tree. Tree has no
// scalar host attribute worth binding, so the default state is a plain
// instance with no data-signals.
//
//go:embed examples/tree_default.html
var treePlaygroundDefaultHTML string
