// Shared parser for the `touch-dismiss` attribute across neo-drawer,
// neo-sidebar, and neo-toaster. One grammar, one fallback vocabulary.

// Resolve a `touch-dismiss` attribute value to a pixel threshold, or
// null when the gesture is explicitly disabled. `raw` is the raw
// attribute (null when absent). `reference` is the dimension a bare
// number or `%` resolves against (the panel/toast width or size).
// `fallback` is returned for a missing, bare, or unparseable value.
// `container` is an in-document element the CSS-unit probe is appended
// into, so `em`/`rem`/viewport units measure in the caller's own font
// and layout context.
export function resolveTouchDismiss(
	raw: string | null,
	reference: number,
	fallback: number,
	container: Element,
): number | null {
	if (raw === null) return fallback;
	const v = raw.trim().toLowerCase();
	if (v === "off" || v === "false" || v === "no" || v === "none") return null;
	if (!v) return fallback;
	const n = Number(v);
	if (Number.isFinite(n) && n >= 0) return n;
	if (v.endsWith("%")) {
		const pct = Number(v.slice(0, -1));
		if (Number.isFinite(pct) && pct >= 0) return (reference * pct) / 100;
		return fallback;
	}
	if (v.endsWith("px")) {
		const px = Number(v.slice(0, -2));
		if (Number.isFinite(px) && px >= 0) return px;
		return fallback;
	}
	if (typeof CSS === "undefined" || typeof CSS.supports !== "function" || !CSS.supports("width", v)) {
		return fallback;
	}
	// Measurement is synchronous (append, read, remove within this call),
	// so the probe never spans a morph window.
	const probeBox = document.createElement("div");
	const probe = document.createElement("div");
	probeBox.style.cssText = [
		"position:absolute",
		"visibility:hidden",
		"pointer-events:none",
		`width:${reference}px`,
		"height:0",
	].join(";");
	probe.style.width = v;
	probeBox.appendChild(probe);
	container.appendChild(probeBox);
	const px = probe.getBoundingClientRect().width;
	probeBox.remove();
	return Number.isFinite(px) && px >= 0 ? px : fallback;
}
