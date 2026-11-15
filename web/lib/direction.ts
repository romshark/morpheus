// Read the direction when needed, never at connect, because `dir` can change
// on any ancestor. Nothing observes that change, which leaves JS-set positions
// (slider thumbs and marks, carousel scroll) stale until their next update.

export function isRTL(el: Element): boolean {
	return getComputedStyle(el).direction === "rtl";
}

// Maps ArrowLeft and ArrowRight to the key with the same meaning in DOM order.
// In a right-to-left context ArrowLeft moves to the next item,
// as ArrowRight does left to right. Other keys pass through.
export function logicalArrow(el: Element, key: string): string {
	if ((key !== "ArrowLeft" && key !== "ArrowRight") || !isRTL(el)) return key;
	return key === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
}
