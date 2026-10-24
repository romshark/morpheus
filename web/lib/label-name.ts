// A wrapping <label> names a native <input>, not a custom element. Copy the
// label's text to aria-label unless the author names the host. Writes only when
// aria-label is absent, which lets a resync watching aria-label settle in 1 pass.
export function nameFromLabel(host: Element): void {
	if (host.hasAttribute("aria-label") || host.hasAttribute("aria-labelledby")) return;
	const text = host.closest("label")?.textContent?.replace(/\s+/g, " ").trim();
	if (text) host.setAttribute("aria-label", text);
}
