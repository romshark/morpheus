package site

import (
	"maps"
	"strings"

	"github.com/a-h/templ"

	"github.com/romshark/morpheus/internal/href"
	"github.com/romshark/morpheus/neo"
)

// simSliderAttrs lives here rather than inline in site.templ because
// templ's struct-literal blocks can't carry computed string
// concatenations cleanly.
func simSliderAttrs(a simSliderArgs) templ.Attributes {
	attrs := templ.Attributes{
		"class":                     "sim-settings-slider",
		"data-attr:value":           "$" + a.Signal,
		"data-on:neo-slider-input":  "$" + a.Signal + " = Number(evt.detail.value)",
		"data-on:neo-slider-change": "$" + a.Signal + " = Number(evt.detail.value)",
	}
	if a.ID != "" {
		attrs["id"] = a.ID
	}
	if a.DisabledExpr != "" {
		attrs["data-attr:disabled"] = a.DisabledExpr
	}
	return attrs
}

// DemoFrameOpts configures demoFrameWith, the wrapper every per-page
// demo composes around its content.
// BoundaryScopes tunes the <neo-boundary> scopes on a preview region. The
// zero value keeps the default scopes (dismiss + positioning) and renders no
// attribute. Any non-zero field renders an explicit scope="…" token list:
// NoDismiss / NoPositioning drop a default scope, Scroll / Stacking add an
// opt-in one. See the Boundary page.
type BoundaryScopes struct {
	NoDismiss     bool
	NoPositioning bool
	Scroll        bool
	Stacking      bool
}

// attrs renders the boundary's scope attribute. The zero value yields nil
// (no attribute, so the element keeps its default dismiss+positioning scope);
// any deviation yields an explicit scope token list, which replaces the
// default entirely.
func (s BoundaryScopes) attrs() templ.Attributes {
	if s == (BoundaryScopes{}) {
		return nil
	}
	var tokens []string
	if !s.NoDismiss {
		tokens = append(tokens, "dismiss")
	}
	if !s.NoPositioning {
		tokens = append(tokens, "positioning")
	}
	if s.Scroll {
		tokens = append(tokens, "scroll")
	}
	if s.Stacking {
		tokens = append(tokens, "stacking")
	}
	return templ.Attributes{"scope": strings.Join(tokens, " ")}
}

type DemoFrameOpts struct {
	Width          string
	Height         string
	StageMinHeight string
	StageMaxHeight string
	StageMinWidth  string
	StageMaxWidth  string
	StageClass     string
	StageHandles   neo.ResizableHandles

	// Boundary opts out of individual <neo-boundary> scopes for the
	// stage's overlays (default: all scopes on).
	Boundary BoundaryScopes

	// StageAttrs is the escape hatch for stage attributes the dedicated
	// fields above don't cover (e.g. data-attr:width, min-width).
	StageAttrs templ.Attributes

	// HTMLSource / TemplSource non-empty adds source tabs to the footer.
	HTMLSource  string
	TemplSource string
	CSSSource   string

	// TSXSource / TypeScriptSource add React (.tsx) and ambient-types
	// (.ts) tabs, used by the framework-integration pages.
	TSXSource        string
	TypeScriptSource string

	// ScriptSource is typically embedded from the .js module the page
	// also loads at runtime so the tab can't drift from reality.
	ScriptSource string

	// DefaultTab overrides which footer tab opens first (e.g. "tsx").
	// Empty starts the demo collapsed on the "hide" tab.
	DefaultTab string
}

// demoTabsActive starts demos collapsed on the "hide" tab unless a
// DefaultTab override is set.
func demoTabsActive(opts DemoFrameOpts) string {
	if opts.DefaultTab != "" {
		return opts.DefaultTab
	}
	return "hide"
}

func (o DemoFrameOpts) handles() neo.ResizableHandles {
	if o.StageHandles == 0 {
		return neo.ResizableBottom | neo.ResizableRight | neo.ResizableBottomRight
	}
	return o.StageHandles
}

func (o DemoFrameOpts) stageAttributes() templ.Attributes {
	a := stageAttrs(o.StageClass,
		o.StageMinHeight, o.StageMaxHeight,
		o.StageMinWidth, o.StageMaxWidth,
		o.Width, o.Height)
	maps.Copy(a, o.StageAttrs)
	return a
}

// stageAttrs emits width/height as both attributes (recognised by the
// JS host as drag bounds) and inline styles (so first-paint matches
// the post-upgrade size and the stage doesn't visibly shrink as the
// bundle runs).
func stageAttrs(
	extraClass,
	minHeight, maxHeight, minWidth, maxWidth,
	width, height string,
) templ.Attributes {
	cls := "demo-frame-stage"
	if extraClass != "" {
		cls += " " + extraClass
	}
	if minHeight == "" {
		minHeight = "12rem"
	}
	if maxHeight == "" {
		maxHeight = "48rem"
	}
	if minWidth == "" {
		minWidth = "10%"
	}
	if maxWidth == "" {
		maxWidth = "100%"
	}
	a := templ.Attributes{
		"class": cls,
		// Focus sink: without it, a dot-grid click focuses #app-main
		// and Tab restarts at the page top instead of entering the demo.
		"tabindex":   "-1",
		"min-height": minHeight,
		"max-height": maxHeight,
		"min-width":  minWidth,
		"max-width":  maxWidth,
	}
	if width != "" {
		a["width"] = width
	}
	if height != "" {
		a["height"] = height
	}
	var style string
	if width != "" {
		style += "width: " + width + ";"
	}
	if height != "" {
		style += "height: " + height + ";"
	}
	if style != "" {
		a["style"] = style
	}
	return a
}

type NavLink struct {
	Path  string
	Label string
}

var SectionLinks = []NavLink{
	{href.PageGettingStarted(), "Getting started"},
	{href.PageFrameworks(), "Frameworks"},
	{href.PageTheming(), "Theming"},
	{href.PageServerDriven(), "Server-driven architecture"},
	{href.PageProjectStatus(), "Status & Contribution"},
}

var UtilityLinks = []NavLink{
	{href.PageBoundary(), "Boundary"},
	{href.PageCondition(), "Condition"},
	{href.PageKeys(), "Keys"},
	{href.PagePersist(), "Persist"},
}

// DataLinks lists the data components: elements that only carry option
// data for a control to read. They render nothing and have no behavior
// of their own, which sets them apart from the headless-but-functional
// UtilityLinks.
var DataLinks = []NavLink{
	{href.PageOption(), "Option"},
	{href.PageOptgroup(), "Optgroup"},
	{href.PageDatalist(), "Datalist"},
}

// ComponentLinks lists all per-component pages in the order they
// appear in the sidebar. Adding a new <neo-X> page is a two-step:
//  1. Create page_X.go + page_X.templ that follow the existing pattern
//     (`Page<Name>` struct + `pageX()` template wrapped in
//     `@appLayout("/x")`).
//  2. Append the entry here so the sidebar surfaces it.
var ComponentLinks = []NavLink{
	{href.PageAlert(), "Alert"},
	{href.PageAvatar(), "Avatar"},
	{href.PageAvatars(), "Avatars"},
	{href.PageBadge(), "Badge"},
	{href.PageBreadcrumb(), "Breadcrumb"},
	{href.PageButton(), "Button"},
	{href.PageButtonGroup(), "Button group"},
	{href.PageCard(), "Card"},
	{href.PageCarousel(), "Carousel"},
	{href.PageCheckbox(), "Checkbox"},
	{href.PageClipcopy(), "Clipcopy"},
	{href.PageCombobox(), "Combobox"},
	{href.PageContextMenu(), "Context menu"},
	{href.PageColorField(), "Color field"},
	{href.PageDialog(), "Dialog"},
	{href.PageDrawer(), "Drawer"},
	{href.PageElastic(), "Elastic"},
	{href.PageIcon(), "Icon"},
	{href.PageInputGroup(), "Input group"},
	{href.PageKbd(), "Kbd"},
	{href.PageLayout(), "Layout"},
	{href.PageLightbox(), "Lightbox"},
	{href.PageLink(), "Link"},
	{href.PageMenu(), "Menu"},
	{href.PageNavgroup(), "Navgroup"},
	{href.PagePagination(), "Pagination"},
	{href.PagePopover(), "Popover"},
	{href.PageProgress(), "Progress"},
	{href.PageRadioGroup(), "Radio group"},
	{href.PageRating(), "Rating"},
	{href.PageResizable(), "Resizable"},
	{href.PageRevealable(), "Revealable"},
	{href.PageSelect(), "Select"},
	{href.PageSidebar(), "Sidebar"},
	{href.PageSkeleton(), "Skeleton"},
	{href.PageSlider(), "Slider"},
	{href.PageSliderRange(), "Slider range"},
	{href.PageSortable(), "Sortable"},
	{href.PageSpinner(), "Spinner"},
	{href.PageSwitch(), "Switch"},
	{href.PageTabs(), "Tabs"},
	{href.PageTextInput(), "Text input"},
	{href.PageTextarea(), "Textarea"},
	{href.PageToaster(), "Toaster"},
	{href.PageToggle(), "Toggle"},
	{href.PageToggleGroup(), "Toggle group"},
	{href.PageTooltip(), "Tooltip"},
	{href.PageTree(), "Tree"},
}

// cmdkRow is one baked entry in the ⌘K command palette: a site page
// plus the section it lives under (shown as a muted tag).
type cmdkRow struct {
	Path  string
	Label string
	Group string
}

// commandPaletteRows flattens every navigable page into the palette's
// static row list, preserving sidebar grouping/order. Baked into light
// DOM at render time; the browser-side <site-command-palette> only
// filters and ranks.
func commandPaletteRows() []cmdkRow {
	groups := []struct {
		name  string
		links []NavLink
	}{
		{"Section", SectionLinks},
		{"Component", ComponentLinks},
		{"Utility Component", UtilityLinks},
		{"Data Component", DataLinks},
	}
	var rows []cmdkRow
	for _, g := range groups {
		for _, l := range g.links {
			rows = append(rows, cmdkRow{Path: l.Path, Label: l.Label, Group: g.name})
		}
	}
	return rows
}

// pageBreadcrumb maps currentPath to its breadcrumb trail:
//
//	index               -> Morpheus
//	/components/        -> Morpheus > Components
//	ComponentLinks      -> Morpheus > Components > <title>
//	UtilityLinks        -> Morpheus > Components > <title>
//	SectionLinks / etc  -> Morpheus > <title>
func pageBreadcrumb(currentPath, title string) []neo.BreadcrumbItem {
	if currentPath == href.PageIndex() {
		return []neo.BreadcrumbItem{{Label: "Morpheus"}}
	}
	if currentPath == href.PageComponents() {
		return []neo.BreadcrumbItem{
			{Label: "Morpheus", Href: href.PageIndex()},
			{Label: "Components"},
		}
	}
	if isInLinks(currentPath, ComponentLinks) || isInLinks(currentPath, UtilityLinks) || isInLinks(currentPath, DataLinks) {
		return []neo.BreadcrumbItem{
			{Label: "Morpheus", Href: href.PageIndex()},
			{Label: "Components", Href: href.PageComponents()},
			{Label: title},
		}
	}
	return []neo.BreadcrumbItem{
		{Label: "Morpheus", Href: href.PageIndex()},
		{Label: title},
	}
}

func isInLinks(path string, links []NavLink) bool {
	for _, l := range links {
		if l.Path == path {
			return true
		}
	}
	return false
}
