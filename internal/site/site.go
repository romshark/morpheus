package site

import (
	"maps"
	"strings"

	"github.com/a-h/templ"

	"github.com/romshark/morpheus/internal/href"
	"github.com/romshark/morpheus/neo"
)

// simSliderAttrs lives here rather than inline in site.templ because
// templ's struct-literal blocks can't carry computed string concatenations cleanly.
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
// The zero value keeps the default scopes (dismiss + positioning) and renders
// no attribute. Any non-zero field renders an explicit scope="..." token list.
// NoDismiss / NoPositioning drop a default scope, Scroll / Stacking add an opt-in one.
// See the Boundary page.
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

// NavLink is a page in the sidebar, on the components index and in the Mod+K palette.
// Icon names a file in static/icons and in static/icons-matrix.
type NavLink struct {
	Path  string
	Label string
	Icon  string
}

// DocLinks are the guide pages under the sidebar's Documentation heading.
var DocLinks = []NavLink{
	{href.PageGettingStarted(), "Getting started", "rocket"},
	{href.PageFrameworks(), "Frameworks", "code"},
	{href.PageTheming(), "Theming", "sparkles"},
	{href.PageServerDriven(), "Server-driven architecture", "arrow-left-right"},
	{href.PageProjectStatus(), "Status & Contribution", "sprout"},
}

// ToolLinks are the pages under the sidebar's Tools heading.
var ToolLinks = []NavLink{
	{href.PageBundleBuilder(), "Bundle builder", "download"},
}

// NavGroup is a titled list of pages in the sidebar, on the components index
// and in the Mod+K palette. Icon is the sidebar heading's icon and names a file
// in static/icons and in static/icons-matrix.
type NavGroup struct {
	Name  string // singular, as in "Input"
	Links []NavLink
}

// Heading is the group's title in the sidebar and on the components index.
func (g NavGroup) Heading() string { return g.Name + " Components" }

// ComponentGroups lists every component page by the task it serves, in sidebar order.
// Each page is in exactly 1 group, and each group is alphabetical.
// Adding a <neo-X> page takes 2 steps:
//  1. Write docs/x.md and list it in buildPages of internal/cmd/gen, as
//     internal/site/README.md describes.
//  2. Add the entry to its group here so the sidebar surfaces it, and draw
//     its icon as static/icons/component-x.svg (36x24, stroke 1.5) and
//     static/icons-matrix/component-x.svg (18x12 pixel grid). The part the
//     component adds is full color. Its frame, context and content are at
//     opacity .4. Put frames on the keylines the other icons share, e.g.
//     the wide field 2.25-33.75 x 5.25-18.75 of component-select.svg.
var ComponentGroups = []NavGroup{
	{"Action", []NavLink{
		{href.PageButton(), "Button", "component-button"},
		{href.PageButtonGroup(), "Button group", "component-button-group"},
		{href.PageClipcopy(), "Clipcopy", "component-clipcopy"},
		{href.PageContextMenu(), "Context menu", "component-context-menu"},
		{href.PageLink(), "Link", "component-link"},
		{href.PageMenu(), "Menu", "component-menu"},
	}},
	{"Input", []NavLink{
		{href.PageCheckbox(), "Checkbox", "component-checkbox"},
		{href.PageColorField(), "Color field", "component-color-field"},
		{href.PageCombobox(), "Combobox", "component-combobox"},
		{href.PageInputGroup(), "Input group", "component-input-group"},
		{href.PageOTP(), "OTP", "component-otp"},
		{href.PageRadioGroup(), "Radio group", "component-radio-group"},
		{href.PageRating(), "Rating", "component-rating"},
		{href.PageSelect(), "Select", "component-select"},
		{href.PageSlider(), "Slider", "component-slider"},
		{href.PageSliderRange(), "Slider range", "component-slider-range"},
		{href.PageSwitch(), "Switch", "component-switch"},
		{href.PageTextInput(), "Text input", "component-text-input"},
		{href.PageTextarea(), "Textarea", "component-textarea"},
		{href.PageToggle(), "Toggle", "component-toggle"},
		{href.PageToggleGroup(), "Toggle group", "component-toggle-group"},
	}},
	{"Data", []NavLink{
		{href.PageDatalist(), "Datalist", "component-datalist"},
		{href.PageOptgroup(), "Optgroup", "component-optgroup"},
		{href.PageOption(), "Option", "component-option"},
	}},
	{"Navigation", []NavLink{
		{href.PageBreadcrumb(), "Breadcrumb", "component-breadcrumb"},
		{href.PageCarousel(), "Carousel", "component-carousel"},
		{href.PagePagination(), "Pagination", "component-pagination"},
		{href.PageSidebar(), "Sidebar", "component-sidebar"},
		{href.PageTabs(), "Tabs", "component-tabs"},
		{href.PageTree(), "Tree", "component-tree"},
	}},
	{"Overlay", []NavLink{
		{href.PageDialog(), "Dialog", "component-dialog"},
		{href.PageDrawer(), "Drawer", "component-drawer"},
		{href.PageLightbox(), "Lightbox", "component-lightbox"},
		{href.PagePopover(), "Popover", "component-popover"},
		{href.PageTooltip(), "Tooltip", "component-tooltip"},
	}},
	{"Feedback", []NavLink{
		{href.PageAlert(), "Alert", "component-alert"},
		{href.PageProgress(), "Progress", "component-progress"},
		{href.PageSkeleton(), "Skeleton", "component-skeleton"},
		{href.PageSpinner(), "Spinner", "component-spinner"},
		{href.PageToaster(), "Toaster", "component-toaster"},
	}},
	{"Display", []NavLink{
		{href.PageAura(), "Aura", "component-aura"},
		{href.PageAvatar(), "Avatar", "component-avatar"},
		{href.PageAvatars(), "Avatars", "component-avatars"},
		{href.PageBadge(), "Badge", "component-badge"},
		{href.PageCompare(), "Compare", "component-compare"},
		{href.PageIcon(), "Icon", "component-icon"},
		{href.PageKbd(), "Kbd", "component-kbd"},
		{href.PageOdometer(), "Odometer", "component-odometer"},
		{href.PageRevealable(), "Revealable", "component-revealable"},
	}},
	{"Layout", []NavLink{
		{href.PageAutohide(), "Autohide", "component-autohide"},
		{href.PageCard(), "Card", "component-card"},
		{href.PageCollapsible(), "Collapsible", "component-collapsible"},
		{href.PageElastic(), "Elastic", "component-elastic"},
		{href.PageLayout(), "Layout", "component-layout"},
		{href.PageResizable(), "Resizable", "component-resizable"},
		{href.PageSortable(), "Sortable", "component-sortable"},
	}},
	{"Utility", []NavLink{
		{href.PageBoundary(), "Boundary", "component-boundary"},
		{href.PageIfNetwork(), "If network", "component-if-network"},
		{href.PageIfPlatform(), "If platform", "component-if-platform"},
		{href.PageKeys(), "Keys", "component-keys"},
		{href.PageNavgroup(), "Navgroup", "component-navgroup"},
		{href.PagePersist(), "Persist", "component-persist"},
	}},
}

// componentIcon returns the icon of the [ComponentGroups] link to path.
func componentIcon(path string) string {
	for _, g := range ComponentGroups {
		for _, l := range g.Links {
			if l.Path == path {
				return l.Icon
			}
		}
	}
	return ""
}

// cmdkRow is one baked entry in the Mod+K command palette, a site page
// plus the section it lives under (shown as a muted tag).
type cmdkRow struct {
	NavLink
	Group string
}

// commandPaletteRows flattens every navigable page into the palette's static row list,
// preserving sidebar grouping/order. Baked into light DOM at render time;
// the browser-side <site-command-palette> only filters and ranks.
func commandPaletteRows() []cmdkRow {
	var rows []cmdkRow
	for _, l := range DocLinks {
		rows = append(rows, cmdkRow{NavLink: l, Group: "Documentation"})
	}
	for _, l := range ToolLinks {
		rows = append(rows, cmdkRow{NavLink: l, Group: "Tool"})
	}
	for _, g := range ComponentGroups {
		for _, l := range g.Links {
			rows = append(rows, cmdkRow{NavLink: l, Group: g.Name + " Component"})
		}
	}
	return rows
}

// pageBreadcrumb maps currentPath to its breadcrumb trail:
//
//	index               -> Morpheus
//	/components/        -> Morpheus > Components
//	ComponentGroups     -> Morpheus > Components > <title>
//	DocLinks / etc      -> Morpheus > <title>
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
