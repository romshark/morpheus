package neo

// Side is the edge-anchor enum shared by side-anchored panels (drawer,
// sidebar). Zero value (SideDefault) defers to the host's default,
// which is "right" for <neo-drawer> and "left" for <neo-sidebar>.
//
// SideTop and SideBottom are only meaningful for <neo-drawer>;
// <neo-sidebar> ignores them. The single shared type avoids spawning
// per-component enums for what is otherwise the same edge choice.
type Side string

const (
	SideDefault Side = ""
	SideLeft    Side = "left"
	SideRight   Side = "right"
	SideTop     Side = "top"
	SideBottom  Side = "bottom"
)
