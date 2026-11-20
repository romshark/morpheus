// attachHostStyle adopts a sheet with 1 :host rule into root and returns the
// rule's declarations, the shadow counterpart of the host's style attribute,
// which a morph can't strip. setProperty parses each value alone and drops an
// invalid one, unlike concatenated rule text, where an unclosed `calc(` eats
// the declarations after it.
//
// Page CSS on the host beats a normal :host declaration, and an "important"
// one beats even the page's `!important`. Set client state that must hold
// (a dragged size, a pinned height) "important", and leave a value mirrored
// from a configuration attribute normal, which page CSS may override.
export function attachHostStyle(root: ShadowRoot): CSSStyleDeclaration {
	const sheet = new CSSStyleSheet();
	sheet.insertRule(":host {}");
	root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
	return (sheet.cssRules[0] as CSSStyleRule).style;
}
