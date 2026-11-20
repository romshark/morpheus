import { setAttrIfChanged } from "./neo-morph-resilient";

export type AriaRef = "aria-controls" | "aria-labelledby" | "aria-describedby" | "aria-activedescendant";

const PROPS: Record<AriaRef, string> = {
	"aria-controls": "ariaControlsElements",
	"aria-labelledby": "ariaLabelledByElements",
	"aria-describedby": "ariaDescribedByElements",
	"aria-activedescendant": "ariaActiveDescendantElement",
};

// setAriaRef points the IDREF attribute `name` of el at targets, and removes it
// for none. The server owns id, so a target without one, or one in another tree
// (an IDREF resolves only in el's own document or shadow root), is linked
// through ARIA element reflection. Chrome 125-134 and Firefox 129-135 lack it
// and get no reference. Reflection writes the attribute as "", which a morph
// strips: call this from an observeManagedAttrs resync watching `name`. A call
// that changes nothing writes nothing, which lets that observer settle.
export function setAriaRef(el: Element, name: AriaRef, targets: readonly Element[]): void {
	if (targets.length === 0) {
		el.removeAttribute(name);
		return;
	}
	const root = el.getRootNode();
	if (targets.every((t) => t.id !== "" && t.getRootNode() === root)) {
		setAttrIfChanged(el, name, targets.map((t) => t.id).join(" "));
		return;
	}
	const prop = PROPS[name];
	if (!(prop in el)) return;
	const reflected = el as unknown as Record<string, unknown>;
	const single = name === "aria-activedescendant";
	const cur = reflected[prop] as Element | readonly Element[] | null;
	const curList = cur === null ? [] : single ? [cur as Element] : (cur as readonly Element[]);
	if (el.getAttribute(name) === "" && curList.length === targets.length && curList.every((c, i) => c === targets[i])) {
		return;
	}
	reflected[prop] = single ? targets[0] : [...targets];
}
