package neo

// Placement is the popover-host anchor enum, shared by every component
// that opens a floating panel against an anchor (popover, tooltip,
// menu, submenu). Zero value (PlacementDefault) defers to the host's
// own default ("bottom-start") and emits no `placement` attribute, so
// a struct literal without the field still produces the correct
// pre-hydration markup.
type Placement string

const (
	PlacementDefault     Placement = ""
	PlacementBottomStart Placement = "bottom-start"
	PlacementBottom      Placement = "bottom"
	PlacementBottomEnd   Placement = "bottom-end"
	PlacementTopStart    Placement = "top-start"
	PlacementTop         Placement = "top"
	PlacementTopEnd      Placement = "top-end"
	PlacementLeftStart   Placement = "left-start"
	PlacementLeft        Placement = "left"
	PlacementLeftEnd     Placement = "left-end"
	PlacementRightStart  Placement = "right-start"
	PlacementRight       Placement = "right"
	PlacementRightEnd    Placement = "right-end"
)
