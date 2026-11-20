// attachSlotRoot gives a host whose content stays in the light DOM a shadow root,
// which holds state and per-instance CSS out of a morph's reach. The children render
// through 1 manually assigned <slot>: a child with a `slot` attribute would match no
// named slot and stop rendering. `html` is the shadow markup and must contain the <slot>.
export function attachSlotRoot(host: HTMLElement, html = "<slot></slot>"): HTMLSlotElement {
	const root = host.attachShadow({ mode: "open", slotAssignment: "manual" });
	root.innerHTML = html;
	return root.querySelector("slot")!;
}

// assignChildren renders the host's child elements and text through slot,
// in tree order, except the ones in hidden, which then render nowhere and leave
// the accessibility tree. Call it on connect and from a childList observer callback,
// which runs before the next paint: until then a new child is unassigned and invisible.
export function assignChildren(host: HTMLElement, slot: HTMLSlotElement, hidden?: ReadonlySet<Node>): void {
	const nodes: (Element | Text)[] = [];
	for (const n of host.childNodes) {
		if (hidden?.has(n)) continue;
		if (n instanceof Element || n instanceof Text) nodes.push(n);
	}
	slot.assign(...nodes);
}
