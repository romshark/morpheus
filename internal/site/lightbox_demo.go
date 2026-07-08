package site

import (
	_ "embed"

	"github.com/a-h/templ"
	"github.com/romshark/morpheus/internal/site/examples"
)

func lightboxPlaygroundStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Default", HTML: lightboxDefaultHTML, CSS: lightboxDefaultCSS},
		{Label: "Arbitrary content", HTML: lightboxContentHTML, CSS: lightboxContentCSS},
		{Label: "Scoped to container", HTML: lightboxContainerHTML},
		{Label: "Hover to open", HTML: lightboxHoverHTML, CSS: lightboxHoverCSS},
		{Label: "Image gallery", HTML: lightboxGalleryHTML, CSS: lightboxGalleryCSS},
	}
}

// One self-sufficient templ func per example, rendered to HTML for the
// playground state and the Examples-section preview, with the templ source
// embedded for the code tab. Each example keeps its styling in a sibling
// .css file, embedded for the CSS tab and applied scoped to the preview.

var lightboxDefaultHTML = renderExampleHTML(examples.LightboxDefault())

//go:embed examples/lightbox_default.templ
var lightboxDefaultTempl string

//go:embed examples/lightbox_default.css
var lightboxDefaultCSS string

var lightboxContentHTML = renderExampleHTML(examples.LightboxContent())

//go:embed examples/lightbox_content.templ
var lightboxContentTempl string

//go:embed examples/lightbox_content.css
var lightboxContentCSS string

var lightboxContainerHTML = renderExampleHTML(examples.LightboxContainer())

//go:embed examples/lightbox_container.templ
var lightboxContainerTempl string

var lightboxHoverHTML = renderExampleHTML(examples.LightboxHover())

//go:embed examples/lightbox_hover.templ
var lightboxHoverTempl string

//go:embed examples/lightbox_hover.css
var lightboxHoverCSS string

var lightboxGalleryHTML = renderExampleHTML(examples.LightboxGallery())

//go:embed examples/lightbox_gallery.templ
var lightboxGalleryTempl string

//go:embed examples/lightbox_gallery.css
var lightboxGalleryCSS string

var lightboxDoc = ComponentDoc{
	Attributes: []DocAttribute{
		{Name: "open", Type: "boolean", Default: "false", Reflected: true, Observed: true,
			Description: templ.Raw("Open state.")},
		{Name: "contained", Type: "boolean", Default: "false", Observed: true,
			Description: templ.Raw("Where the overlay renders. Default promotes it to the top layer covering the viewport; <code>contained</code> confines it to the host's own box, which becomes the positioned containing block.")},
		{Name: "hover", Type: "boolean", Default: "false",
			Description: templ.Raw("Open on trigger hover (mouse only). Click still opens, instantly, for touch and keyboard.")},
		{Name: "hover-open-delay", Type: "integer (ms)", Default: "100",
			Description: templ.Raw("Delay before a hover opens the overlay.")},
		{Name: "hover-close-delay", Type: "integer (ms)", Default: "200",
			Description: templ.Raw("Delay before a hover closes it after the pointer leaves both trigger and surface.")},
		{Name: "dismissible", Type: "boolean", Default: "true", Observed: true,
			Description: templ.Raw("Set <code>false</code> to disable backdrop-press and <neo-kbd>Esc</neo-kbd> dismissal.")},
		{Name: "transition", Type: `"zoom" | "fade" | "none"`, Default: `"zoom"`,
			Description: templ.Raw("Entry / exit style. <code>zoom</code> morphs the surface from the opening trigger's position and size (a FLIP) and back into it on close; <code>fade</code> is a centered scale + opacity; <code>none</code> is instant. The backdrop fades in every mode. Honors reduced motion. Read when the overlay opens, so a change while it is open applies on the next open.")},
	},
	Slots: []DocSlot{
		{Name: "[data-neo-lightbox-trigger]",
			Description: templ.Raw("Opens the overlay. Repeat on any number of children; all open the same surface.")},
		{Name: "[data-neo-lightbox-content]",
			Description: templ.Raw("Arbitrary HTML projected into the overlay surface.")},
		{Name: "[data-neo-lightbox-close]",
			Description: templ.Raw("Any descendant of the content; clicking it dismisses the overlay.")},
		{Name: "[data-neo-lightbox-title]",
			Description: templ.Raw("Names the dialog; the surface's <code>aria-labelledby</code> points at it.")},
	},
	Events: []DocEvent{
		{Name: "neo-lightbox-open", Detail: "{ trigger }", Bubbles: true,
			Description: templ.Raw("Fires when the overlay opens. <code>trigger</code> is the activating element.")},
		{Name: "neo-lightbox-close", Bubbles: true,
			Description: templ.Raw("Fires when the overlay closes.")},
	},
	Parts: []DocPart{
		{Name: "backdrop", Description: templ.Raw("The dimmed layer behind the surface.")},
		{Name: "surface", Description: templ.Raw("The centered dialog panel.")},
	},
	CSSProps: []DocCSSProp{
		{Name: "--neo-lightbox-overlay-bg", Default: "rgba(0, 0, 0, 0.72)",
			Description: templ.Raw("Backdrop color.")},
		{Name: "--neo-lightbox-overlay-blur", Default: "0px",
			Description: templ.Raw("Backdrop blur radius.")},
		{Name: "--neo-lightbox-surface-bg", Default: "transparent",
			Description: templ.Raw("Surface background.")},
		{Name: "--neo-lightbox-color", Default: "--page-fg",
			Description: templ.Raw("Surface text color.")},
		{Name: "--neo-lightbox-radius", Default: "0",
			Description: templ.Raw("Surface corner radius.")},
		{Name: "--neo-lightbox-surface-padding", Default: "0",
			Description: templ.Raw("Surface padding.")},
		{Name: "--neo-lightbox-shadow", Default: "none",
			Description: templ.Raw("Surface shadow.")},
		{Name: "--neo-lightbox-max-width", Default: "90vw",
			Description: templ.Raw("Surface width cap.")},
		{Name: "--neo-lightbox-max-height", Default: "90vh",
			Description: templ.Raw("Surface height cap.")},
		{Name: "--neo-lightbox-screen-offset", Default: "1rem",
			Description: templ.Raw("Gap kept around the overlay.")},
		{Name: "--neo-lightbox-enter-duration", Default: "200ms",
			Description: templ.Raw("Open / close animation duration.")},
		{Name: "--neo-lightbox-enter-scale", Default: "0.94",
			Description: templ.Raw("Start scale for the <code>fade</code> transition.")},
		{Name: "--neo-lightbox-z-index", Default: "50",
			Description: templ.Raw("Overlay stacking when <code>contained</code>.")},
	},
}
