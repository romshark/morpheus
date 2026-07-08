// "Reduced motion" is the OS media query OR the doc-app's simulated
// `:root[data-pref-reduced-motion]`; both must fire onChange so a
// simulated preference behaves identically to a real one.
const reducedMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");

export function prefersReducedMotion(): boolean {
	return reducedMotionMQ.matches || document.documentElement.hasAttribute("data-pref-reduced-motion");
}

export function watchReducedMotion(onChange: () => void): () => void {
	reducedMotionMQ.addEventListener("change", onChange);
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-pref-reduced-motion"],
	});
	return () => {
		reducedMotionMQ.removeEventListener("change", onChange);
		observer.disconnect();
	};
}
