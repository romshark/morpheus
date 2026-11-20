export interface HostStyle {
	setProperty(name: string, value: string, priority?: "" | "important"): void;
	removeProperty(name: string): void;
}

// attachHostStyle adopts a sheet with 1 :host rule into root and returns its
// writer, the shadow counterpart of the host's style attribute, which a morph
// can't strip. setProperty parses each value alone and drops an invalid one,
// unlike concatenated rule text, where an unclosed `calc(` eats the declarations
// after it.
//
// Page CSS on the host beats a normal :host declaration, and an "important"
// one beats even the page's `!important`. Set client state that must hold
// (a dragged size, a pinned height) "important", and leave a value mirrored
// from a configuration attribute normal, which page CSS may override.
export function attachHostStyle(root: ShadowRoot): HostStyle {
	const sheet = new CSSStyleSheet();
	root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
	// WebKit doesn't restyle a host without a style attribute when its :host
	// rule is edited in place, only when the rule is replaced. The values are
	// parsed in a declaration that is never adopted, and every change replaces
	// the adopted rule with its serialization.
	const scratch = new CSSStyleSheet();
	scratch.insertRule(":host {}");
	const decl = (scratch.cssRules[0] as CSSStyleRule).style;
	let committed = "";
	const commit = () => {
		const text = decl.cssText;
		if (text === committed) return;
		committed = text;
		sheet.replaceSync(`:host { ${text} }`);
	};
	return {
		setProperty(name, value, priority = "") {
			decl.setProperty(name, value, priority);
			commit();
		},
		removeProperty(name) {
			decl.removeProperty(name);
			commit();
		},
	};
}
