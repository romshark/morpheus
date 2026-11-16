// A wrapping <label> names a native <input>, not a custom element. Copy the
// label's text to aria-label unless the author names the host. Writes only when
// aria-label is absent, which lets a resync watching aria-label settle in 1 pass.
export function nameFromLabel(host: Element): void {
	if (host.hasAttribute("aria-label") || host.hasAttribute("aria-labelledby")) return;
	const text = host.closest("label")?.textContent?.replace(/\s+/g, " ").trim();
	if (text) host.setAttribute("aria-label", text);
}

// The text of a generated control's label: the host's `name` attribute, which
// lets a page translate it, else the English default. An empty value counts as
// absent, because an empty aria-label names nothing. {n} stands for n.
export function labelAttr(host: Element, name: string, dflt: string, n?: number): string {
	const v = host.getAttribute(name);
	const text = v === null || v === "" ? dflt : v;
	return n === undefined ? text : text.replaceAll("{n}", String(n));
}
