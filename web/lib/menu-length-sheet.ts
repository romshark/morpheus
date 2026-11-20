// The length attributes of <neo-menu>, <neo-submenu> and <neo-contextmenu>
// reach the positioning code as --neo-menu-* custom properties, which page CSS
// can also set and nested submenus inherit. A morph strips a value written to
// the host style. A document rule keyed on the attribute value survives it,
// because the server renders the attribute.

export const MENU_LENGTH_ATTRS = ["screen-offset", "min-fit-height", "min-fit-width"] as const;

export type MenuLengthAttr = (typeof MENU_LENGTH_ATTRS)[number];

const VARS: Record<MenuLengthAttr, string> = {
	"screen-offset": "--neo-menu-screen-offset",
	"min-fit-height": "--neo-menu-min-fit-height",
	"min-fit-width": "--neo-menu-min-fit-width",
};

const sheet = new CSSStyleSheet();
const keyed = new Set<string>();
// Parses each value alone and drops an invalid one. Never adopted.
const scratch = new CSSStyleSheet();
scratch.insertRule("x {}");
const decl = (scratch.cssRules[0] as CSSStyleRule).style;

export function isMenuLengthAttr(name: string): name is MenuLengthAttr {
	return (MENU_LENGTH_ATTRS as readonly string[]).includes(name);
}

// keyMenuLengths adds a rule for each length attribute value el carries.
// Rules are only added, never edited, which WebKit restyles.
export function keyMenuLengths(el: Element): void {
	let added = false;
	for (const attr of MENU_LENGTH_ATTRS) {
		const value = el.getAttribute(attr);
		if (value === null) continue;
		const key = `${attr}=${value}`;
		if (keyed.has(key)) continue;
		keyed.add(key);
		decl.cssText = "";
		decl.setProperty(VARS[attr], value);
		if (!decl.cssText) continue;
		const sel = `:is(neo-menu, neo-submenu, neo-contextmenu)[${attr}="${CSS.escape(value)}"]`;
		sheet.insertRule(`${sel} { ${decl.cssText} }`, sheet.cssRules.length);
		added = true;
	}
	if (added && !document.adoptedStyleSheets.includes(sheet)) {
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
	}
}
