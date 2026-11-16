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

// BoundaryScopes tunes the <neo-boundary> scopes on a preview region.
// The zero value keeps the default scopes (dismiss + positioning) and renders no
// attribute. Any non-zero field renders an explicit scope="..." token list.
// NoDismiss / NoPositioning drop a default scope, Scroll / Stacking add an
// opt-in one. See the Boundary page.
type BoundaryScopes struct {
	NoDismiss     bool
	NoPositioning bool
	Scroll        bool
	Stacking      bool
}

// attrs renders the boundary's scope attribute. The zero value yields nil
// (no attribute, which keeps the element's default dismiss+positioning scope);
// any deviation yields an explicit scope token list, which replaces the default entirely.
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

// DemoFrameOpts configures demoFrameWith, the wrapper every per-page
// demo composes around its content.
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

	// StageAttrs carries stage attributes no dedicated field covers
	// (e.g. data-attr:width, min-width).
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

// demoTabsActive starts demos collapsed on the "hide" tab
// unless a DefaultTab override is set.
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

// stageAttrs emits width/height as both attributes (recognised by the JS host
// as drag bounds) and inline styles (so first-paint matches the post-upgrade size
// and the stage doesn't visibly shrink as the bundle runs).
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
		// Focus sink. Without it, a dot-grid click focuses #app-main
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
	{href.PageBundleBuilder(), "Bundle builder"},
	{href.PageServerDriven(), "Server-driven architecture"},
	{href.PageProjectStatus(), "Status & Contribution"},
}

// NavGroup is a titled list of pages in the sidebar, on the components index
// and in the Mod+K palette. Icon is the sidebar heading's icon and names a file
// in static/icons and in static/icons-matrix.
type NavGroup struct {
	Name  string // singular, as in "Input"
	Icon  string
	Links []NavLink
}

// Heading is the group's title in the sidebar and on the components index.
func (g NavGroup) Heading() string { return g.Name + " Components" }

// ComponentGroups lists every component page by the task it serves, in sidebar
// order. Each page is in exactly 1 group, and each group is alphabetical.
// Adding a <neo-X> page takes 2 steps:
//  1. Create page_X.go + page_X.templ that follow the existing pattern
//     (`Page<Name>` struct + `pageX()` template wrapped in
//     `@appLayout("/x")`).
//  2. Add the entry to its group here so the sidebar surfaces it.
var ComponentGroups = []NavGroup{
	{"Action", "play", []NavLink{
		{href.PageButton(), "Button"},
		{href.PageButtonGroup(), "Button group"},
		{href.PageClipcopy(), "Clipcopy"},
		{href.PageLink(), "Link"},
	}},
	{"Input", "chevrons-up-down", []NavLink{
		{href.PageCheckbox(), "Checkbox"},
		{href.PageColorField(), "Color field"},
		{href.PageCombobox(), "Combobox"},
		{href.PageInputGroup(), "Input group"},
		{href.PageOTP(), "OTP"},
		{href.PageRadioGroup(), "Radio group"},
		{href.PageRating(), "Rating"},
		{href.PageSelect(), "Select"},
		{href.PageSlider(), "Slider"},
		{href.PageSliderRange(), "Slider range"},
		{href.PageSwitch(), "Switch"},
		{href.PageTextInput(), "Text input"},
		{href.PageTextarea(), "Textarea"},
		{href.PageToggle(), "Toggle"},
		{href.PageToggleGroup(), "Toggle group"},
	}},
	{"Data", "braces", []NavLink{
		{href.PageDatalist(), "Datalist"},
		{href.PageOptgroup(), "Optgroup"},
		{href.PageOption(), "Option"},
	}},
	{"Navigation", "menu", []NavLink{
		{href.PageBreadcrumb(), "Breadcrumb"},
		{href.PagePagination(), "Pagination"},
		{href.PageSidebar(), "Sidebar"},
		{href.PageTabs(), "Tabs"},
		{href.PageTree(), "Tree"},
	}},
	{"Overlay", "message-square", []NavLink{
		{href.PageContextMenu(), "Context menu"},
		{href.PageDialog(), "Dialog"},
		{href.PageDrawer(), "Drawer"},
		{href.PageLightbox(), "Lightbox"},
		{href.PageMenu(), "Menu"},
		{href.PagePopover(), "Popover"},
		{href.PageTooltip(), "Tooltip"},
	}},
	{"Feedback", "activity", []NavLink{
		{href.PageAlert(), "Alert"},
		{href.PageProgress(), "Progress"},
		{href.PageSkeleton(), "Skeleton"},
		{href.PageSpinner(), "Spinner"},
		{href.PageToaster(), "Toaster"},
	}},
	{"Display", "eye", []NavLink{
		{href.PageAura(), "Aura"},
		{href.PageAvatar(), "Avatar"},
		{href.PageAvatars(), "Avatars"},
		{href.PageBadge(), "Badge"},
		{href.PageCard(), "Card"},
		{href.PageCarousel(), "Carousel"},
		{href.PageIcon(), "Icon"},
		{href.PageKbd(), "Kbd"},
		{href.PageOdometer(), "Odometer"},
		{href.PageRevealable(), "Revealable"},
	}},
	{"Layout", "move-diagonal", []NavLink{
		{href.PageAutohide(), "Autohide"},
		{href.PageElastic(), "Elastic"},
		{href.PageLayout(), "Layout"},
		{href.PageResizable(), "Resizable"},
		{href.PageSortable(), "Sortable"},
	}},
	{"Utility", "square-function", []NavLink{
		{href.PageBoundary(), "Boundary"},
		{href.PageIfNetwork(), "If network"},
		{href.PageIfPlatform(), "If platform"},
		{href.PageKeys(), "Keys"},
		{href.PageNavgroup(), "Navgroup"},
		{href.PagePersist(), "Persist"},
	}},
}

// cmdkRow is one baked entry in the Mod+K command palette, a site page
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
	var rows []cmdkRow
	for _, l := range SectionLinks {
		rows = append(rows, cmdkRow{Path: l.Path, Label: l.Label, Group: "Section"})
	}
	for _, g := range ComponentGroups {
		for _, l := range g.Links {
			rows = append(rows, cmdkRow{Path: l.Path, Label: l.Label, Group: g.Name + " Component"})
		}
	}
	return rows
}

// pageBreadcrumb maps currentPath to its breadcrumb trail:
//
//	index               -> Morpheus
//	/components/        -> Morpheus > Components
//	ComponentGroups     -> Morpheus > Components > <title>
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
	if isComponentPage(currentPath) {
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

func isComponentPage(path string) bool {
	for _, g := range ComponentGroups {
		for _, l := range g.Links {
			if l.Path == path {
				return true
			}
		}
	}
	return false
}
