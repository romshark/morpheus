// Self-targeted MutationObserver for components whose ARIA / role /
// tabindex are set post-connect. An in-place light-DOM morph (Datastar et al.)
// strips any live-only attribute not present in the source HTML while keeping
// the same custom element instance. connectedCallback never re-fires
// and the stripped attrs stay gone. observeManagedAttrs catches the strip
// and re-runs the caller's resync.
//
// The resync must be idempotent at the attribute level, because per spec
// setAttribute always queues a mutation record (even on a same-value write),
// which would re-fire the observer and loop.
// Use setAttrIfChanged for any write the resync performs so a no-op pass
// produces no records and the observer settles. removeAttribute takes
// no such wrapper, because on an absent attribute it queues no record.

export function setAttrIfChanged(el: Element, name: string, value: string): void {
	if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

export function observeManagedAttrs(el: Element, attrs: readonly string[], resync: () => void): MutationObserver {
	const observer = new MutationObserver(resync);
	observer.observe(el, {
		attributes: true,
		attributeFilter: [...attrs],
	});
	return observer;
}
