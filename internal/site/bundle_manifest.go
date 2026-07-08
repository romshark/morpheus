package site

import "strings"

// BundleManifestEntry is one row of dst/static/bundle-manifest.json,
// consumed by static/min/bundlebuilder.min.js to assemble the selected
// bundle in the browser.
type BundleManifestEntry struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Bound bool   `json:"bound"`
	// JS is the TypeScript module filename under static/bundle-src/
	// (e.g. "neo-button.ts"), or "" when the node has no module.
	JS string `json:"js"`
	// CSS is the stylesheet module filename under static/bundle-css/.
	CSS string `json:"css"`
	// Owners (bound nodes only) are the selectable ids that pull this
	// node in; it's in the bundle when any owner is selected. Mirrors
	// the graph's bundleSpanDisabled rule.
	Owners []string `json:"owners,omitempty"`
}

// bundleSlug is bundleNodeID without the "graph-" prefix, the stem
// used for source asset filenames ("neo-button", "neo-toast").
func bundleSlug(name string) string {
	return strings.TrimPrefix(bundleNodeID(name), "graph-")
}

// bundleJSModule returns the web/lib module filename for a component,
// or "" for non-element nodes. internal/cmd/gen blanks it if the file is
// absent so the manifest never points at a missing source.
func bundleJSModule(name string) string {
	if !strings.HasPrefix(name, "neo-") {
		return ""
	}
	return name + ".ts"
}

func bundleCSSModule(name string) string {
	switch name {
	case "neo-layout":
		return "_layout.css"
	case "neo-boundary":
		return "_boundary.css"
	case "neo-spinner":
		return "neo-spinner.global.css"
	}
	return bundleSlug(name) + ".css"
}

// BundleManifestEntries is the full node set with the asset wiring the
// in-browser builder needs. Order matches bundleNodes (sorted).
func BundleManifestEntries() []BundleManifestEntry {
	nodes := bundleNodes()
	out := make([]BundleManifestEntry, 0, len(nodes))
	for _, nd := range nodes {
		e := BundleManifestEntry{
			ID:    nd.ID,
			Name:  nd.Name,
			Bound: nd.Bound,
			JS:    bundleJSModule(nd.Name),
			CSS:   bundleCSSModule(nd.Name),
		}
		if nd.Bound {
			e.Owners = nd.dependentIDs
		}
		out = append(out, e)
	}
	return out
}
