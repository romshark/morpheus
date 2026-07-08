package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

// skeletonMorphStates seeds the "Morphing during interaction" playground.
// Autoplay alternates the two states, fat-morphing the same profile card:
// the Loading state's skeletons reconcile into real content and back. The
// shared <div class="skel-card"> root is what lets idiomorph keep the card
// mounted while only its inner nodes swap.
func skeletonMorphStates() []PlaygroundState {
	return []PlaygroundState{
		{Label: "Loading", HTML: skeletonMorphLoadingHTML},
		{Label: "Content loaded", HTML: skeletonMorphLoadedHTML},
	}
}

//go:embed examples/skeleton_morph_loading.html
var skeletonMorphLoadingHTML string

//go:embed examples/skeleton_morph_loaded.html
var skeletonMorphLoadedHTML string

// Per-example demos for the Skeleton page's "Examples" section. Each
// example is a single templ function under examples/: its render
// drives the live preview and the HTML source tab, and the embedded
// .templ file supplies the Templ source tab.

var skeletonVariantsHTML = renderExampleHTML(examples.SkeletonVariants())

//go:embed examples/skeleton_variants.templ
var skeletonVariantsTempl string

//go:embed examples/skeleton_variants.css
var skeletonVariantsCSS string

var skeletonCardHTML = renderExampleHTML(examples.SkeletonCard())

//go:embed examples/skeleton_card.templ
var skeletonCardTempl string

//go:embed examples/skeleton_card.css
var skeletonCardCSS string

var skeletonInlineHTML = renderExampleHTML(examples.SkeletonInline())

//go:embed examples/skeleton_inline.templ
var skeletonInlineTempl string

//go:embed examples/skeleton_inline.css
var skeletonInlineCSS string

var skeletonAvatarRowHTML = renderExampleHTML(examples.SkeletonAvatarRow())

//go:embed examples/skeleton_avatar_row.templ
var skeletonAvatarRowTempl string

//go:embed examples/skeleton_avatar_row.css
var skeletonAvatarRowCSS string
