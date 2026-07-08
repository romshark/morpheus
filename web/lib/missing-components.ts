// A <neo-*> component used in markup but missing from the loaded bundle
// (trimmed, or never imported) must warn the developer by name instead of
// failing silently. The two component kinds need two signals:
//
// - Behavioral components register a custom element. A BEHAVIORAL_TAGS entry
//   customElements.get cannot resolve is missing. The manifest survives
//   trimming (this module is always bundled), so the absence stays detectable.
// - CSS-only components register nothing and are always :not(:defined), so
//   customElements cannot tell a present one from a trimmed one. Each ships a
//   `--neo-loaded: <tag>` sentinel in its stylesheet, read back here once the
//   stylesheets have loaded; an absent sentinel means trimmed styles.
//
// Keep both sets in sync with the customElements.define calls and the CSS-only
// stylesheets; a missing entry weakens the warning but doesn't break anything.
const BEHAVIORAL_TAGS = new Set<string>([
	"neo-avatars",
	"neo-breadcrumb",
	"neo-button",
	"neo-buttongroup",
	"neo-carousel",
	"neo-carousel-slide",
	"neo-carousel-track",
	"neo-checkbox",
	"neo-clipcopy",
	"neo-color-field",
	"neo-combobox",
	"neo-condition",
	"neo-contextmenu",
	"neo-datalist",
	"neo-dialog",
	"neo-drawer",
	"neo-elastic",
	"neo-icon",
	"neo-input-group",
	"neo-kbd",
	"neo-keys",
	"neo-lightbox",
	"neo-menu",
	"neo-menuitem",
	"neo-navgroup",
	"neo-optgroup",
	"neo-option",
	"neo-pagination",
	"neo-persist",
	"neo-popover",
	"neo-progress",
	"neo-radio",
	"neo-radio-group",
	"neo-rating",
	"neo-resizable",
	"neo-revealable",
	"neo-select",
	"neo-sidebar",
	"neo-slider",
	"neo-slider-range",
	"neo-sortable",
	"neo-spinner",
	"neo-submenu",
	"neo-switch",
	"neo-tab",
	"neo-tablist",
	"neo-tabpanel",
	"neo-tabs",
	"neo-textarea",
	"neo-textinput",
	"neo-toast",
	"neo-toaster",
	"neo-toggle",
	"neo-toggle-group",
	"neo-tooltip",
	"neo-tree",
	"neo-tree-item",
]);

// Tags styled by CSS only (no custom element). Tags whose styles ride a
// behavioral parent's stylesheet (neo-kbd-group, neo-sortable-item) are left
// out: that parent's behavioral warning already covers the trim.
const CSS_ONLY_TAGS = new Set<string>([
	"neo-alert",
	"neo-avatar",
	"neo-badge",
	"neo-boundary",
	"neo-card",
	"neo-layout",
	"neo-skeleton",
]);

const warned = new Set<string>();
const cssConfirmed = new Set<string>();
// CSS sentinels only read true after stylesheets apply; gate the CSS branch.
let stylesReady = false;

// Warn once per tag.
function reportIfMissing(el: Element): void {
	const tag = el.localName;
	if (warned.has(tag)) return;
	if (BEHAVIORAL_TAGS.has(tag)) {
		// A manifest tag customElements.get cannot resolve was never registered.
		if (customElements.get(tag)) return;
		warned.add(tag);
		console.warn(`<${tag}> is used in the DOM but missing from the loaded bundle; it is not registered.`);
	} else if (stylesReady && CSS_ONLY_TAGS.has(tag) && !cssConfirmed.has(tag)) {
		// The sentinel resolves to the tag only when its stylesheet loaded.
		if (getComputedStyle(el).getPropertyValue("--neo-loaded").trim() === tag) {
			cssConfirmed.add(tag);
			return;
		}
		warned.add(tag);
		console.warn(`<${tag}> is used in the DOM but its styles are missing from the loaded bundle.`);
	}
}

// :not(:defined) narrows to un-upgraded custom elements (unregistered
// behavioral ones, and every CSS-only element); reportIfMissing decides.
function scan(root: ParentNode): void {
	for (const el of root.querySelectorAll(":not(:defined)")) reportIfMissing(el);
}

export function watchMissingComponents(): void {
	// Behavioral tags resolve as soon as the DOM is parsed.
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => scan(document), { once: true });
	} else {
		scan(document);
	}
	// CSS sentinels are only reliable after stylesheets load.
	const onLoad = () => {
		stylesReady = true;
		scan(document);
	};
	if (document.readyState === "complete") onLoad();
	else window.addEventListener("load", onLoad, { once: true });
	// A fat morph can insert a missing component after load.
	new MutationObserver((records) => {
		for (const rec of records) {
			for (const node of rec.addedNodes) {
				if (!(node instanceof Element)) continue;
				reportIfMissing(node);
				scan(node);
			}
		}
	}).observe(document.documentElement, { childList: true, subtree: true });
}
