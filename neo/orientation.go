package neo

// Orientation is the layout-axis enum for group components that can also
// lay out as a grid (nav group, sortable). Zero value (OrientationDefault)
// defers to the host's own default and emits no `orientation` attribute.
//
// Components that only ever flip between horizontal and vertical use [Axis]
// instead, so `grid` is unrepresentable where it has no effect.
type Orientation string

const (
	OrientationDefault    Orientation = ""
	OrientationHorizontal Orientation = "horizontal"
	OrientationVertical   Orientation = "vertical"
	OrientationGrid       Orientation = "grid"
)

// Axis is the two-value layout choice for components that only flip
// between horizontal and vertical. Zero value (AxisDefault) defers to the
// host's own default and emits no `orientation` attribute. Use
// [Orientation] instead for components that also lay out as a grid.
type Axis string

const (
	AxisDefault    Axis = ""
	AxisHorizontal Axis = "horizontal"
	AxisVertical   Axis = "vertical"
)
