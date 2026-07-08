package neo

import "github.com/a-h/templ"

// FlexDirection sets <neo-layout> flex-direction. Rendered as a boolean
// attribute whose name is the CSS value. Zero value renders row (the CSS
// default) and emits no attribute.
type FlexDirection string

const (
	DirectionDefault FlexDirection = ""
	Row              FlexDirection = "row"
	RowReverse       FlexDirection = "row-reverse"
	Column           FlexDirection = "column"
	ColumnReverse    FlexDirection = "column-reverse"
)

// FlexWrap sets <neo-layout> flex-wrap, also as a boolean attribute.
// Zero value renders nowrap (the CSS default) and emits no attribute.
type FlexWrap string

const (
	WrapDefault FlexWrap = ""
	Nowrap      FlexWrap = "nowrap"
	Wrap        FlexWrap = "wrap"
	WrapReverse FlexWrap = "wrap-reverse"
)

// AlignItems sets <neo-layout> align-items (cross-axis alignment).
// Values are the literal CSS keywords; zero value emits no attribute.
type AlignItems string

const (
	AlignItemsDefault   AlignItems = ""
	AlignItemsFlexStart AlignItems = "flex-start"
	AlignItemsFlexEnd   AlignItems = "flex-end"
	AlignItemsCenter    AlignItems = "center"
	AlignItemsStretch   AlignItems = "stretch"
	AlignItemsBaseline  AlignItems = "baseline"
)

// JustifyContent sets <neo-layout> justify-content (main-axis
// distribution). Zero value emits no attribute.
type JustifyContent string

const (
	JustifyContentDefault      JustifyContent = ""
	JustifyContentFlexStart    JustifyContent = "flex-start"
	JustifyContentFlexEnd      JustifyContent = "flex-end"
	JustifyContentCenter       JustifyContent = "center"
	JustifyContentSpaceBetween JustifyContent = "space-between"
	JustifyContentSpaceAround  JustifyContent = "space-around"
	JustifyContentSpaceEvenly  JustifyContent = "space-evenly"
)

// AlignContent sets <neo-layout> align-content (distribution of wrapped
// lines). Takes effect only with Wrap. Zero value emits no attribute.
type AlignContent string

const (
	AlignContentDefault      AlignContent = ""
	AlignContentFlexStart    AlignContent = "flex-start"
	AlignContentFlexEnd      AlignContent = "flex-end"
	AlignContentCenter       AlignContent = "center"
	AlignContentSpaceBetween AlignContent = "space-between"
	AlignContentSpaceAround  AlignContent = "space-around"
	AlignContentSpaceEvenly  AlignContent = "space-evenly"
	AlignContentStretch      AlignContent = "stretch"
)

// AlignSelf overrides the parent's cross-axis alignment for one child
// (neo-align-self). Zero value emits no attribute.
type AlignSelf string

const (
	AlignSelfDefault   AlignSelf = ""
	AlignSelfFlexStart AlignSelf = "flex-start"
	AlignSelfFlexEnd   AlignSelf = "flex-end"
	AlignSelfCenter    AlignSelf = "center"
	AlignSelfStretch   AlignSelf = "stretch"
	AlignSelfBaseline  AlignSelf = "baseline"
)

// Gap is a spacing-scale token for gap / column-gap / row-gap. Zero
// value emits no attribute. For an arbitrary length set --neo-gap via
// style instead.
type Gap string

const (
	GapDefault Gap = ""
	GapNone    Gap = "none"
	GapXs      Gap = "xs"
	GapSm      Gap = "sm"
	GapMd      Gap = "md"
	GapLg      Gap = "lg"
	GapXl      Gap = "xl"
	Gap2xl     Gap = "2xl"
)

// MinHeight is a <neo-layout> min-height preset; values are literal CSS.
type MinHeight string

const (
	MinHeightDefault MinHeight = ""
	MinHeightScreen  MinHeight = "100vh"
	MinHeightFull    MinHeight = "100%"
)

// Collapse folds a row to a single column below a viewport tier. A Neo
// extension with no CSS equivalent. Zero value never collapses.
type Collapse string

const (
	CollapseDefault Collapse = ""
	CollapseSm      Collapse = "sm" // < 40rem
	CollapseMd      Collapse = "md" // < 48rem
	CollapseLg      Collapse = "lg" // < 64rem
)

// FlexBasis is a literal flex-basis for a layout child (neo-flex-basis):
// only the CSS keywords 0, auto, and 100%. For a fixed width set
// flex-basis via style, e.g. style="flex-basis: var(--neo-size-sidebar)"
// (the --neo-size-* vars are themeable presets) or a plain length;
// arbitrary lengths stay out of the attribute surface.
type FlexBasis string

const (
	FlexBasisDefault FlexBasis = ""
	FlexBasis0       FlexBasis = "0"
	FlexBasisAuto    FlexBasis = "auto"
	FlexBasisFull    FlexBasis = "100%"
)

// Overflow sets a layout child's overflow (neo-overflow).
type Overflow string

const (
	OverflowDefault Overflow = ""
	OverflowVisible Overflow = "visible"
	OverflowHidden  Overflow = "hidden"
	OverflowScroll  Overflow = "scroll"
	OverflowAuto    Overflow = "auto"
)

// ItemSize is a predefined width / height for a layout child.
type ItemSize string

const (
	ItemSizeDefault ItemSize = ""
	ItemSizeFull    ItemSize = "100%"
)

// LayoutOpts is the typed attribute surface for <neo-layout>. Every
// field maps 1:1 to the CSS flex container property of the same name.
type LayoutOpts struct {
	Direction      Attr[FlexDirection] // row (default) | row-reverse | column | column-reverse
	Wrap           Attr[FlexWrap]      // nowrap (default) | wrap | wrap-reverse
	AlignItems     Attr[AlignItems]
	JustifyContent Attr[JustifyContent]
	AlignContent   Attr[AlignContent] // wrapped-line distribution; needs Wrap
	Gap            Attr[Gap]
	ColumnGap      Attr[Gap]
	RowGap         Attr[Gap]
	MinHeight      Attr[MinHeight]
	Inline         Attr[bool]     // display: inline-flex
	Container      Attr[bool]     // container-type: inline-size, a query container for Collapse
	Collapse       Attr[Collapse] // fold a row to a column below a container-width tier
}

// ItemOpts is the typed child-layout surface: flex-item behaviour that
// belongs to the child rather than the container. Item turns it into the
// neo-* attributes to spread onto any flex child, usually a semantic
// element instead of a wrapper.
type ItemOpts struct {
	Grow       Attr[bool]      // neo-flex-grow="1"
	NoShrink   Attr[bool]      // neo-flex-shrink="0"
	Basis      Attr[FlexBasis] // neo-flex-basis
	AlignSelf  Attr[AlignSelf] // neo-align-self
	Width      Attr[ItemSize]  // neo-width
	Height     Attr[ItemSize]  // neo-height
	MinWidth0  Attr[bool]      // neo-min-width="0" (the flex min-size fix, in a row)
	MinHeight0 Attr[bool]      // neo-min-height="0" (in a column)
	Overflow   Attr[Overflow]  // neo-overflow
	Truncate   Attr[bool]      // neo-truncate (single-line ellipsis)
	HideBelow  Attr[Collapse]  // neo-hide-below: hide while the nearest container is below this tier
	ShowBelow  Attr[Collapse]  // neo-show-below: show only while the container is below this tier
}

// Item builds the neo-* child-layout attributes for a flex child. Spread
// the result onto the element inside a Layout:
//
//	<aside style="flex-basis: var(--neo-size-sidebar)" { neo.Item(neo.ItemOpts{NoShrink: true})... }>
//	<main { neo.Item(neo.ItemOpts{Grow: true, MinWidth0: true})... }>
func Item(opts ItemOpts) templ.Attributes {
	a := templ.Attributes{}
	if opts.Grow.Or(false) {
		a["neo-flex-grow"] = "1"
	}
	if opts.NoShrink.Or(false) {
		a["neo-flex-shrink"] = "0"
	}
	if basis := opts.Basis.Or(""); basis != "" {
		a["neo-flex-basis"] = string(basis)
	}
	if alignSelf := opts.AlignSelf.Or(""); alignSelf != "" {
		a["neo-align-self"] = string(alignSelf)
	}
	if width := opts.Width.Or(""); width != "" {
		a["neo-width"] = string(width)
	}
	if height := opts.Height.Or(""); height != "" {
		a["neo-height"] = string(height)
	}
	if opts.MinWidth0.Or(false) {
		a["neo-min-width"] = "0"
	}
	if opts.MinHeight0.Or(false) {
		a["neo-min-height"] = "0"
	}
	if overflow := opts.Overflow.Or(""); overflow != "" {
		a["neo-overflow"] = string(overflow)
	}
	if opts.Truncate.Or(false) {
		a["neo-truncate"] = true
	}
	if hideBelow := opts.HideBelow.Or(""); hideBelow != "" {
		a["neo-hide-below"] = string(hideBelow)
	}
	if showBelow := opts.ShowBelow.Or(""); showBelow != "" {
		a["neo-show-below"] = string(showBelow)
	}
	return a
}
