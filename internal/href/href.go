// Package href centralises URL paths used in href attributes: page
// paths as PageX() functions and an Asset(p) helper that prefixes
// "/static/". A path rename is then a one-file change.
package href

import "path"

// External returns url as-is. Kept as a function so call sites read
// the same as the rest of href, and to leave room for a runtime
// validation hook later.
func External(url string) string { return url }

// Asset returns the URL path for a static asset file
// (e.g. Asset("style.css") returns "/static/style.css").
func Asset(p string) string { return path.Join("/static/", p) }

func PageIndex() string          { return "/" }
func PageComponents() string     { return "/components/" }
func PageGettingStarted() string { return "/getting-started/" }
func PageFrameworks() string     { return "/frameworks/" }
func PageTheming() string        { return "/theming/" }
func PageServerDriven() string   { return "/server-driven/" }
func PageLayout() string         { return "/layout/" }
func PageProjectStatus() string  { return "/project-status/" }
func PageBundleBuilder() string  { return "/bundle-builder/" }
func PageAlert() string          { return "/alert/" }
func PageAvatar() string         { return "/avatar/" }
func PageAvatars() string        { return "/avatars/" }
func PageBadge() string          { return "/badge/" }
func PageBoundary() string       { return "/boundary/" }
func PageBreadcrumb() string     { return "/breadcrumb/" }
func PageButton() string         { return "/button/" }
func PageButtonGroup() string    { return "/button-group/" }
func PageCard() string           { return "/card/" }
func PageCarousel() string       { return "/carousel/" }
func PageCheckbox() string       { return "/checkbox/" }
func PageClipcopy() string       { return "/clipcopy/" }
func PageCombobox() string       { return "/combobox/" }
func PageCondition() string      { return "/condition/" }
func PageContextMenu() string    { return "/context-menu/" }
func PageColorField() string     { return "/color-field/" }
func PageDatalist() string       { return "/datalist/" }
func PageDialog() string         { return "/dialog/" }
func PageDrawer() string         { return "/drawer/" }
func PageElastic() string        { return "/elastic/" }
func PageIcon() string           { return "/icon/" }
func PageInputGroup() string     { return "/input-group/" }
func PageKbd() string            { return "/kbd/" }
func PageKeys() string           { return "/keys/" }
func PageLightbox() string       { return "/lightbox/" }
func PageLink() string           { return "/link/" }
func PageMenu() string           { return "/menu/" }
func PageNavgroup() string       { return "/navgroup/" }
func PageOptgroup() string       { return "/optgroup/" }
func PageOption() string         { return "/option/" }
func PagePagination() string     { return "/pagination/" }
func PagePersist() string        { return "/persist/" }
func PagePopover() string        { return "/popover/" }
func PageProgress() string       { return "/progress/" }
func PageRadioGroup() string     { return "/radio-group/" }
func PageRating() string         { return "/rating/" }
func PageResizable() string      { return "/resizable/" }
func PageRevealable() string     { return "/revealable/" }
func PageSelect() string         { return "/select/" }
func PageSidebar() string        { return "/sidebar/" }
func PageSkeleton() string       { return "/skeleton/" }
func PageSlider() string         { return "/slider/" }
func PageSliderRange() string    { return "/slider-range/" }
func PageSortable() string       { return "/sortable/" }
func PageSpinner() string        { return "/spinner/" }
func PageSwitch() string         { return "/switch/" }
func PageTabs() string           { return "/tabs/" }
func PageTextInput() string      { return "/text-input/" }
func PageTextarea() string       { return "/textarea/" }
func PageToaster() string        { return "/toaster/" }
func PageToggle() string         { return "/toggle/" }
func PageToggleGroup() string    { return "/toggle-group/" }
func PageTooltip() string        { return "/tooltip/" }
func PageTree() string           { return "/tree/" }
func PageDebug() string          { return "/debug/" }
func PageDebugBorders() string   { return "/debug-borders/" }
