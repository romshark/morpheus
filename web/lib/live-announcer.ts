// A live region inside a component host is a child of the host's role,
// and a role such as list allows no such child (axe aria-required-children).
// The region therefore sits outside every host, 1 per container. A modal <dialog>
// inerts the rest of the document, which is why the container is the open
// modal that holds the caller and the body otherwise.
// The undefined custom tag keeps a morph from matching the region to an
// author <div>; the shadow root keeps its attributes out of the morph's reach.

const TAG = "neo-announcer";

// A region inserted in the same task as its text change is not announced:
// it must be in the accessibility tree first. 100ms matches React Aria.
const INSERT_DELAY_MS = 100;

const SHADOW_TEMPLATE = document.createElement("template");
SHADOW_TEMPLATE.innerHTML = `
<style>
  :host {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
<div aria-live="assertive" aria-atomic="true"></div>
`;

const hosts = new WeakMap<Node, HTMLElement>();
// Text held back until a just-inserted region is in the accessibility tree.
const pending = new WeakMap<HTMLElement, string>();

// Walks the flat tree, which inertness follows: slotted content is inside the
// slot's dialog, shadow content inside its host's.
function modalAncestor(el: Element): Element | null {
	let n: Node | null = el;
	while (n) {
		if (n instanceof HTMLDialogElement && n.matches(":modal")) return n;
		if (n instanceof Element && n.assignedSlot) n = n.assignedSlot;
		else if (n.parentNode instanceof ShadowRoot) n = n.parentNode.host;
		else n = n.parentNode;
	}
	return null;
}

function write(host: HTMLElement, message: string): void {
	host.shadowRoot!.querySelector("div")!.textContent = message;
}

// announce reads message to assistive tech from the modal context of from.
export function announce(from: Element, message: string): void {
	const doc = from.ownerDocument;
	const container = modalAncestor(from) ?? doc.body ?? doc.documentElement;
	let host = hosts.get(container);
	if (host?.parentNode === container) {
		if (pending.has(host)) pending.set(host, message);
		else write(host, message);
		return;
	}
	// First use, or a morph of the container removed the region.
	host = doc.createElement(TAG);
	host.attachShadow({ mode: "open" }).appendChild(SHADOW_TEMPLATE.content.cloneNode(true));
	container.append(host);
	hosts.set(container, host);
	pending.set(host, message);
	const inserted = host;
	setTimeout(() => {
		const text = pending.get(inserted);
		pending.delete(inserted);
		if (text !== undefined) write(inserted, text);
	}, INSERT_DELAY_MS);
}
