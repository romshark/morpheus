import { stillParsing } from "./document-parsing";
import { setAttrIfChanged } from "./neo-morph-resilient";

// A wrapping <label> names a native <input>, not a custom element. Copy the
// label's text to aria-label unless the author names the host. Writes only when
// aria-label is absent, which lets a resync watching aria-label settle in 1 pass.
export function nameFromLabel(host: Element): void {
	if (host.hasAttribute("aria-label") || host.hasAttribute("aria-labelledby")) return;
	const text = host.closest("label")?.textContent?.replace(/\s+/g, " ").trim();
	if (text) host.setAttribute("aria-label", text);
}

// Light-DOM ids and <label> elements don't resolve inside a shadow root. A
// component whose focusable control is in its shadow root observes these
// attributes and copies the text they reference to that control.
export const NAME_ATTRS = ["aria-label", "aria-labelledby", "aria-describedby"];

// The name the author gives the host: aria-label, then aria-labelledby, then
// its <label>s. `labels` is ElementInternals.labels of a form-associated host.
// Without it, a wrapping <label> and <label for> are found by hand.
export function hostName(host: Element, labels?: NodeList): string | null {
	return (
		host.getAttribute("aria-label") ??
		idrefText(host, "aria-labelledby") ??
		labelsText(host, labels ? Array.from(labels) : labelsOf(host))
	);
}

// The text of the elements aria-describedby references, or "".
export function hostDescription(host: Element): string {
	return idrefText(host, "aria-describedby") ?? "";
}

// Puts `text` in `description`, a hidden element with an id in the shadow
// root, and points `fields` at it.
export function describe(fields: Element[], description: Element, text: string): void {
	if (description.textContent !== text) description.textContent = text;
	for (const field of fields) {
		if (text) setAttrIfChanged(field, "aria-describedby", description.id);
		else field.removeAttribute("aria-describedby");
	}
}

// Names and describes `fields` from the host.
export function mirrorName(host: Element, labels: NodeList | undefined, fields: Element[], description: Element): void {
	const name = hostName(host, labels);
	for (const field of fields) {
		if (name) setAttrIfChanged(field, "aria-label", name);
		else field.removeAttribute("aria-label");
	}
	describe(fields, description, hostDescription(host));
}

const queued = new WeakSet<Element>();
const afterParse = new WeakSet<Element>();

// Runs `sync` once after the current task, because a morph that changes
// aria-describedby may patch the referenced text after the host. While the
// document parses, it runs again after DOMContentLoaded, because referenced
// elements may follow the host.
export function queueNameSync(host: Element, sync: () => void): void {
	if (!queued.has(host)) {
		queued.add(host);
		queueMicrotask(() => {
			queued.delete(host);
			sync();
		});
	}
	if (stillParsing() && !afterParse.has(host)) {
		afterParse.add(host);
		document.addEventListener(
			"DOMContentLoaded",
			() => {
				afterParse.delete(host);
				if (host.isConnected) sync();
			},
			{ once: true },
		);
	}
}

function idrefText(host: Element, attr: string): string | null {
	const ids = host.getAttribute(attr)?.trim();
	if (!ids) return null;
	const root = host.getRootNode() as Document | ShadowRoot;
	const text = ids
		.split(/\s+/)
		.map((id) => root.getElementById?.(id)?.textContent ?? "")
		.join(" ");
	return normalizeSpace(text) || null;
}

function labelsOf(host: Element): Element[] {
	const wrapping = host.closest("label");
	const out: Element[] = wrapping ? [wrapping] : [];
	if (host.id) {
		const root = host.getRootNode() as Document | ShadowRoot;
		for (const label of root.querySelectorAll(`label[for="${CSS.escape(host.id)}"]`)) {
			if (label !== wrapping) out.push(label);
		}
	}
	return out;
}

// Skips the host's own text, such as slider marks or suggestion options in a
// wrapping label.
function labelsText(host: Element, labels: Node[]): string | null {
	let text = "";
	for (const label of labels) {
		const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
		for (let n = walker.nextNode(); n; n = walker.nextNode()) {
			if (!host.contains(n)) text += ` ${n.textContent}`;
		}
	}
	return normalizeSpace(text) || null;
}

function normalizeSpace(s: string): string {
	return s.replace(/\s+/g, " ").trim();
}
