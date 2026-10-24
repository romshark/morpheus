package neo

// Dismissible is the tri-state for the shared `dismissible` attribute
// used by the overlay components (dialog, drawer, lightbox) and toast.
// The zero value ([DismissibleDefault]) emits no attribute and the component's own
// default applies (dismissible). [DismissibleOff] emits dismissible="false"
// (dialog/drawer/lightbox lock open; toast drops its close button);
// [DismissibleOn] emits dismissible="true" as an explicit opt-in.
type Dismissible int8

const (
	DismissibleDefault Dismissible = iota
	DismissibleOn
	DismissibleOff
)
