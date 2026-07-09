// Helpers for components that own a shadow root. Centralises the
// shadow-DOM-aware event/focus checks and a small CSS scope-rewriter
// so each component file doesn't reinvent them.

// Set an element's text without orphaning its text node. Mutates the single
// existing Text child in place (`.data`) instead of `textContent =`, which
// detaches the old text node and allocates a new one. Callers that rewrite
// text every animation frame (slider readout, tooltip bubble during a drag)
// avoid a per-frame text-node allocation; falls back to textContent when the
// element isn't a lone text node.
export function setTextInPlace(el: HTMLElement, text: string): void {
	const first = el.firstChild;
	if (first !== null && first.nodeType === Node.TEXT_NODE && first.nextSibling === null) {
		if ((first as Text).data !== text) (first as Text).data = text;
		return;
	}
	if (el.textContent !== text) el.textContent = text;
}

// Does the event's composed path enter (or originate at) `target`?
// Equivalent to `target.contains(e.target)` for light DOM, but also
// crosses shadow boundaries: a click inside a shadow root reports
// the host as `e.target`, which `.contains()` would miss for a node
// living inside that same shadow root.
export function eventEnters(e: Event, target: Node): boolean {
	for (const n of e.composedPath()) {
		if (n === target) return true;
	}
	return false;
}

// The facets a <neo-boundary> scopes when it has no `scope` attribute.
// Stacking isn't a default and isn't queried here: it's pure CSS (isolation:
// isolate in _boundary.css contains the panels).
const BOUNDARY_DEFAULT_SCOPE = "dismiss positioning";

// The nearest <neo-boundary> ancestor that scopes `facet`, or null. Facets are
// a space-separated token list in the `scope` attribute ("dismiss" |
// "positioning" | "scroll" | "stacking"). Setting the attribute replaces the
// default ("dismiss positioning"), so `scope="dismiss positioning scroll"`
// adds scroll, `scope="positioning"` drops dismiss, and `scope=""` scopes
// nothing. Rules come from the nearest boundary only; they are not inherited,
// so a closer boundary that omits a facet falls back to the document /
// viewport default for it, not to an outer boundary.
//
// Climbs out of shadow roots: neo-select / neo-combobox anchor positioning
// on a trigger inside their own shadow DOM, and closest() stops at the
// shadow boundary, so it would miss a light-DOM boundary wrapping the host.
// Hop to the shadow host and keep searching.
export function scopingBoundary(el: Element, facet: string): Element | null {
	let b: Element | null = null;
	for (let cur: Element | null = el; cur; ) {
		b = cur.closest("neo-boundary");
		if (b) break;
		const root = cur.getRootNode();
		cur = root instanceof ShadowRoot ? root.host : null;
	}
	if (!b) return null;
	const raw = b.getAttribute("scope");
	const tokens = (raw === null ? BOUNDARY_DEFAULT_SCOPE : raw).toLowerCase().split(/\s+/);
	return tokens.includes(facet) ? b : null;
}

// Whether a scroll event target is independent of a scroll-scoped boundary.
// Sibling / unrelated scrollers outside the boundary may be ignored or
// followed. Scrollers inside the boundary, and ancestor scrollers that carry
// the boundary itself, should keep the default dismiss behavior.
export function isIndependentBoundaryScroll(boundary: Element | null, target: EventTarget | null): boolean {
	return !!boundary && target instanceof Node && !boundary.contains(target) && !target.contains(boundary);
}

// The geometric rect of a boundary's contents. <neo-boundary> is
// display:contents and owns no box, so this is the union of its laid-out
// descendants: the region overlays clamp their panels into. Display-contents
// wrappers (including neo-menu/neo-contextmenu hosts) are transparent for
// measurement. Generated overlay panels are skipped so an open panel doesn't
// expand its own containment region. Null when it has no laid-out children.
export function boundaryRect(boundary: Element): DOMRect | null {
	const acc = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
	for (const child of Array.from(boundary.children)) {
		collectBoundaryRect(child, acc);
	}
	if (acc.r <= acc.l || acc.b <= acc.t) return null;
	return new DOMRect(acc.l, acc.t, acc.r - acc.l, acc.b - acc.t);
}

function collectBoundaryRect(el: Element, acc: { l: number; t: number; r: number; b: number }): void {
	if (isGeneratedOverlayPanel(el)) return;

	const rect = el.getBoundingClientRect();
	const hasBox = rect.width !== 0 || rect.height !== 0;
	if (hasBox) {
		acc.l = Math.min(acc.l, rect.left);
		acc.t = Math.min(acc.t, rect.top);
		acc.r = Math.max(acc.r, rect.right);
		acc.b = Math.max(acc.b, rect.bottom);
		return;
	}

	for (const child of Array.from(el.children)) {
		collectBoundaryRect(child, acc);
	}
}

function isGeneratedOverlayPanel(el: Element): boolean {
	return (
		el.hasAttribute("data-neo-menu-panel") ||
		el.hasAttribute("data-neo-submenu-panel") ||
		el.hasAttribute("data-neo-contextmenu-panel")
	);
}

// Walk through nested shadow roots to find the actual focused element.
// `document.activeElement` is retargeted at every shadow boundary; for
// focus inside a shadow root it reports the host. `target.contains(
// document.activeElement)` therefore falsely reports "outside" when
// the target lives inside that same shadow root.
export function deepActiveElement(): Element | null {
	let el: Element | null = document.activeElement;
	while (el?.shadowRoot?.activeElement) {
		el = el.shadowRoot.activeElement;
	}
	return el;
}

// Rewrite a CSS module's `tagName` selectors to `:host` so the same
// rules apply inside a shadow root whose host is that tag. Mechanical
// regex pass: handles bare tag, tag[attr], tag:pseudo, tag.class,
// `tag > X`, `tag X`. @starting-style / @media wrappers pass through
// unchanged because their inner selectors get the same treatment.
//
// The selector boundary class includes `{` and `}` so a minified module
// (`}neo-x{`, `@media(...){neo-x{`) scopes the same as a pretty-printed
// one; the build minifies these modules before inlining them.
//
// Inputs:
//   css:      original CSS module text.
//   hostTag:  the element name that maps to `:host` (e.g. "neo-popover").
export function scopeCssToHost(css: string, hostTag: string): string {
	const escaped = hostTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	// Compound selectors: tag followed by [attr] / :pseudo / .class run.
	// Wrap the whole run in :host(...).
	const compound = new RegExp(`(^|[\\s,>~+({}])${escaped}((?:[\\[:.][^\\s,>~+{]*)+)`, "g");
	// Bare tag selector (not followed by an identifier or one of the
	// compound suffixes above).
	const bare = new RegExp(`(^|[\\s,>~+({}])${escaped}(?![\\w\\-\\[:.])`, "g");
	return css.replace(compound, "$1:host($2)").replace(bare, "$1:host");
}

// On every connect (or after a morph re-emits new children) make sure
// the children we care about carry the `slot` attribute so the shadow
// projects them into the right slot. Marker selectors map to slot
// names; first match wins per selector.
export function assignSlotsToLightChildren(host: Element, map: Record<string, string>) {
	for (const [selector, slotName] of Object.entries(map)) {
		const el = host.querySelector(selector);
		if (!el) continue;
		if (el.getAttribute("slot") === slotName) continue;
		el.setAttribute("slot", slotName);
	}
}
