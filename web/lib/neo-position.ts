// Shared positioning helpers for <neo-popover> and <neo-tooltip>:
// anchor a fixed-position panel to a trigger and clamp to the viewport.

import { boolAttr } from "./command";
import { boundaryRect, scopingBoundary } from "./shadow-utils";

export type Placement =
	| "bottom-start"
	| "bottom-end"
	| "bottom"
	| "top-start"
	| "top-end"
	| "top"
	| "left-start"
	| "left-end"
	| "left"
	| "right-start"
	| "right-end"
	| "right";

type MinFitValue = number | "content";

export interface PositionResult {
	placement: Placement;
	fitsFitSize: boolean;
	fitsOpenSize: boolean;
	availableWidth: number;
	availableHeight: number;
	minOpenWidth: number;
	minOpenHeight: number;
}

export function scrollAnchorIntoOpenView(anchor: HTMLElement): void {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	anchor.scrollIntoView({ block: "center", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
}

export function applyOpenSizeDuringScroll(panel: HTMLElement, result: PositionResult): void {
	if (result.minOpenWidth > 0 && result.availableWidth < result.minOpenWidth) {
		panel.style.maxWidth = `${result.minOpenWidth}px`;
	}
	if (result.minOpenHeight > 0 && result.availableHeight < result.minOpenHeight) {
		panel.style.maxHeight = `${result.minOpenHeight}px`;
	}
}

interface PositionOptions {
	/** Re-anchor inside the viewport instead of strict placement; inline
	 *  max-* cleared, auto-flip skipped. Default false. */
	clamp?: boolean;
	/** Element used to find the nearest <neo-boundary>. Defaults to anchor.
	 *  Useful for point-anchored overlays whose synthetic anchor lives in
	 *  document.body while the overlay host is inside a boundary. */
	boundaryContext?: Element;
	/** Ignore a positioning-scoped <neo-boundary> and size against the viewport. */
	ignorePositioningBoundary?: boolean;
	/** Keep the configured primary side even when the opposite side has more room. */
	noFlip?: boolean;
	/** Auto-flip threshold (px) on the primary axis: when the configured
	 *  slot is shorter, flip if the opposite side has more room. */
	minFitHeight?: MinFitValue;
	/** Same as minFitHeight for the width axis. */
	minFitWidth?: MinFitValue;
	/** Caps (px) applied to the inline max-* in strict placement. Without
	 *  these the slot-sized inline overrides the CSS rule's
	 *  `min(var(--…-max-width), …)` so a host-set cap has no effect. */
	maxWidth?: number;
	maxHeight?: number;
	/** Minimum usable slot before callers should close instead. */
	minOpenHeight?: number;
	minOpenWidth?: number;
}

/**
 * Place `panel` relative to `anchor` per `placement`. `panel` must
 * already have `position: fixed`; this writes inline `top` / `left`.
 *
 * Strict (default): inline `max-width` / `max-height` get the slot
 * between trigger and viewport (less `edgeOffset`), so overflow
 * scrolls inside the panel. `minFit*` flips the primary axis when
 * the configured slot is too short and the opposite side has more
 * room; `"content"` resolves from the panel's scroll size each pass.
 *
 * Clamp: re-anchor inside the viewport, inline max-* cleared,
 * auto-flip skipped.
 */
export function positionPanel(
	anchor: HTMLElement,
	panel: HTMLElement,
	placement: Placement,
	edgeOffset: number,
	triggerGap: number,
	opts: PositionOptions = {},
): Placement {
	return positionPanelResult(anchor, panel, placement, edgeOffset, triggerGap, opts).placement;
}

export function positionPanelResult(
	anchor: HTMLElement,
	panel: HTMLElement,
	placement: Placement,
	edgeOffset: number,
	triggerGap: number,
	opts: PositionOptions = {},
): PositionResult {
	const clamp = !!opts.clamp;
	const minOpenHeight = Math.max(0, opts.minOpenHeight ?? 0);
	const minOpenWidth = Math.max(0, opts.minOpenWidth ?? 0);

	const tRaw = anchor.getBoundingClientRect();
	panel.style.maxWidth = "";
	panel.style.maxHeight = "";
	const c = panel.getBoundingClientRect();
	const contentSize =
		opts.minFitHeight === "content" || opts.minFitWidth === "content" ? panelContentSize(panel) : null;
	const minFitHeight = resolveMinFit(opts.minFitHeight, contentSize?.height);
	const minFitWidth = resolveMinFit(opts.minFitWidth, contentSize?.width);

	// Use the visual viewport: iOS shrinks it for the on-screen
	// keyboard without resizing the layout viewport, so the panel
	// would otherwise render behind the keyboard.
	const visualViewport = window.visualViewport;
	const vLeft = visualViewport?.offsetLeft ?? 0;
	const vTop = visualViewport?.offsetTop ?? 0;
	const vw = visualViewport?.width ?? document.documentElement.clientWidth;
	const vh = visualViewport?.height ?? document.documentElement.clientHeight;

	// Trigger rect in visual-viewport coords for the math; converted
	// back to layout coords before writing (`position: fixed` is
	// layout-viewport-relative).
	const t = new DOMRect(tRaw.left - vLeft, tRaw.top - vTop, tRaw.width, tRaw.height);

	// Containment window in visual-viewport coords. Defaults to the whole
	// viewport; a <neo-boundary> ancestor of the anchor that scopes
	// positioning shrinks it to the intersection of the viewport and the
	// boundary's rect, so the flip/clamp/max-size math below keeps the panel
	// inside the region instead of inside the viewport.
	let wL = 0;
	let wT = 0;
	let wR = vw;
	let wB = vh;
	const positioningBoundary = opts.ignorePositioningBoundary
		? null
		: scopingBoundary(opts.boundaryContext ?? anchor, "positioning");
	const bRect = positioningBoundary ? boundaryRect(positioningBoundary) : null;
	if (bRect) {
		wL = Math.max(0, bRect.left - vLeft);
		wT = Math.max(0, bRect.top - vTop);
		wR = Math.min(vw, bRect.right - vLeft);
		wB = Math.min(vh, bRect.bottom - vTop);
		// Off-screen or inverted boundary: ignore it, keep the viewport.
		if (wR <= wL || wB <= wT) {
			wL = 0;
			wT = 0;
			wR = vw;
			wB = vh;
		}
	}

	// Auto-flip: if strict placement's slot is below the requested
	// minimum on the primary axis, try the opposite side. Skipped when
	// clamping (clamp re-anchors anyway).
	let effectivePlacement = placement;
	if (!clamp && !opts.noFlip && (minFitHeight > 0 || minFitWidth > 0)) {
		const [w0, h0] = strictMaxSize(t, placement, edgeOffset, triggerGap, wL, wT, wR, wB);
		const isVertical = placement.startsWith("bottom") || placement.startsWith("top");
		const tooShort = isVertical ? h0 < minFitHeight : w0 < minFitWidth;
		if (tooShort) {
			const flipped = flipPrimaryAxis(placement);
			const [w1, h1] = strictMaxSize(t, flipped, edgeOffset, triggerGap, wL, wT, wR, wB);
			const flipBetter = isVertical ? h1 > h0 : w1 > w0;
			if (flipBetter) effectivePlacement = flipped;
		}
	}

	let { top, left } = placementCoords(t, c, effectivePlacement, triggerGap);
	// strictMaxSize below must size against the chosen (possibly
	// flipped) side.
	placement = effectivePlacement;
	let availableWidth: number;
	let availableHeight: number;

	if (clamp) {
		// Reset any inline caps left over from a previous strict pass and
		// re-anchor the position to keep the rendered box inside the
		// viewport.
		panel.style.maxWidth = "";
		panel.style.maxHeight = "";
		availableWidth = Math.max(0, wR - wL - edgeOffset * 2);
		availableHeight = Math.max(0, wB - wT - edgeOffset * 2);
		left = clampToWindow(left, c.width, edgeOffset, wL, wR);
		top = clampToWindow(top, c.height, edgeOffset, wT, wB);
	} else {
		// Default: anchor at the exact placement, then bound the rendered
		// box by the viewport edge offset if the trigger has scrolled out.
		const [slotW, slotH] = strictMaxSize(t, placement, edgeOffset, triggerGap, wL, wT, wR, wB);
		const maxW = opts.maxWidth !== undefined ? Math.min(slotW, opts.maxWidth) : slotW;
		const maxH = opts.maxHeight !== undefined ? Math.min(slotH, opts.maxHeight) : slotH;
		availableWidth = Math.max(0, maxW);
		availableHeight = Math.max(0, maxH);
		panel.style.maxWidth = `${Math.max(0, maxW)}px`;
		panel.style.maxHeight = `${Math.max(0, maxH)}px`;
		const rendered = panel.getBoundingClientRect();
		const width = rendered.width;
		const height = rendered.height;
		left = clampToWindow(left, width, edgeOffset, wL, wR);
		top = clampToWindow(top, height, edgeOffset, wT, wB);
	}

	// Back to layout-viewport coords before any offsetParent shift.
	top += vTop;
	left += vLeft;

	// A transformed ancestor (transform/filter/contain:paint/perspective/
	// will-change, e.g. <neo-sidebar>'s translateX) becomes the fixed
	// containing block, so inline top/left are then relative to it.
	const cb = panel.offsetParent;
	if (cb instanceof HTMLElement) {
		// Containing block is the padding edge; getBoundingClientRect
		// returns the border edge, so add clientLeft/Top to bridge.
		const cbRect = cb.getBoundingClientRect();
		left -= cbRect.left + cb.clientLeft;
		top -= cbRect.top + cb.clientTop;
	}

	panel.style.top = `${top}px`;
	panel.style.left = `${left}px`;
	const isVertical = placement.startsWith("bottom") || placement.startsWith("top");
	return {
		placement,
		fitsFitSize: isVertical
			? minFitHeight === 0 || availableHeight >= minFitHeight
			: minFitWidth === 0 || availableWidth >= minFitWidth,
		fitsOpenSize:
			(minOpenWidth === 0 || availableWidth >= minOpenWidth) &&
			(minOpenHeight === 0 || availableHeight >= minOpenHeight),
		availableWidth,
		availableHeight,
		minOpenWidth,
		minOpenHeight,
	};
}

function clampToWindow(value: number, size: number, edgeOffset: number, wMin: number, wMax: number): number {
	const min = wMin + edgeOffset;
	const max = Math.max(min, wMax - size - edgeOffset);
	return Math.max(min, Math.min(value, max));
}

/** Compute the inline top/left for a given placement using the
 *  trigger and panel boxes. Pure function: no clamping, no max-*
 *  side-effects. */
function placementCoords(
	t: DOMRect,
	c: DOMRect,
	placement: Placement,
	triggerGap: number,
): { top: number; left: number } {
	let top = 0;
	let left = 0;
	switch (placement) {
		case "bottom-start":
			top = t.bottom + triggerGap;
			left = t.left;
			break;
		case "bottom-end":
			top = t.bottom + triggerGap;
			left = t.right - c.width;
			break;
		case "bottom":
			top = t.bottom + triggerGap;
			left = t.left + (t.width - c.width) / 2;
			break;
		case "top-start":
			top = t.top - c.height - triggerGap;
			left = t.left;
			break;
		case "top-end":
			top = t.top - c.height - triggerGap;
			left = t.right - c.width;
			break;
		case "top":
			top = t.top - c.height - triggerGap;
			left = t.left + (t.width - c.width) / 2;
			break;
		case "right-start":
			top = t.top;
			left = t.right + triggerGap;
			break;
		case "right-end":
			top = t.bottom - c.height;
			left = t.right + triggerGap;
			break;
		case "right":
			top = t.top + (t.height - c.height) / 2;
			left = t.right + triggerGap;
			break;
		case "left-start":
			top = t.top;
			left = t.left - c.width - triggerGap;
			break;
		case "left-end":
			top = t.bottom - c.height;
			left = t.left - c.width - triggerGap;
			break;
		case "left":
			top = t.top + (t.height - c.height) / 2;
			left = t.left - c.width - triggerGap;
			break;
	}
	return { top, left };
}

/** Flip the primary axis of a placement: bottom↔top, left↔right.
 *  Cross-axis suffix (-start, -end, or none) is preserved. */
function flipPrimaryAxis(p: Placement): Placement {
	if (p.startsWith("bottom")) {
		return p.replace("bottom", "top") as Placement;
	}
	if (p.startsWith("top")) {
		return p.replace("top", "bottom") as Placement;
	}
	if (p.startsWith("left")) {
		return p.replace("left", "right") as Placement;
	}
	return p.replace("right", "left") as Placement;
}

/** Compute (max-width, max-height) for strict placement. The primary axis
 *  uses the slot between the trigger and containment edge; the cross axis
 *  can use the full containment span because clampToWindow may shift the
 *  panel along that axis without changing the requested side. */
function strictMaxSize(
	t: DOMRect,
	placement: Placement,
	edgeOffset: number,
	triggerGap: number,
	wL: number,
	wT: number,
	wR: number,
	wB: number,
): [number, number] {
	let maxW: number;
	let maxH: number;

	// Primary axis: the side the panel sits on relative to the trigger.
	if (placement.startsWith("bottom")) {
		maxH = wB - t.bottom - triggerGap - edgeOffset;
	} else if (placement.startsWith("top")) {
		maxH = t.top - wT - triggerGap - edgeOffset;
	} else if (placement.startsWith("right")) {
		maxW = wR - t.right - triggerGap - edgeOffset;
	} else {
		// left
		maxW = t.left - wL - triggerGap - edgeOffset;
	}

	// Cross axis: the alignment edge along the perpendicular direction.
	const horizontal = placement.startsWith("bottom") || placement.startsWith("top");
	if (horizontal) {
		maxW = wR - wL - edgeOffset * 2;
	} else {
		maxH = wB - wT - edgeOffset * 2;
	}

	return [
		Math.min(maxW!, Math.max(0, wR - wL - edgeOffset * 2)),
		Math.min(maxH!, Math.max(0, wB - wT - edgeOffset * 2)),
	];
}

/** Resolves a CSS custom property on `host` (or inherited) to pixels via
 *  a throwaway probe. Accepts any CSS length (rem, vh, calc(), etc.). */
export function resolveCssLengthPx(host: HTMLElement, varName: string, fallback = "8px"): number {
	const probe = document.createElement("div");
	probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(${varName},${fallback});`;
	const probeRoot = host.shadowRoot ?? host;
	probeRoot.appendChild(probe);
	const px = probe.getBoundingClientRect().height;
	probe.remove();
	return px;
}

export function resolveCssLengthPxOrContent(host: HTMLElement, varName: string, fallback = "8px"): MinFitValue {
	const raw = getComputedStyle(host).getPropertyValue(varName).trim();
	if (raw.toLowerCase() === "content") return "content";
	if (raw === "" && fallback.toLowerCase() === "content") return "content";
	return resolveCssLengthPx(host, varName, fallback);
}

export function resolveOptionalCssLengthPx(host: HTMLElement, varName: string, fallback = "2rem"): number {
	return resolveCssLengthPx(host, varName, fallback);
}

// Popover-placement attributes <neo-select>, <neo-combobox>, and
// <neo-textinput> suggestions forward to anchorPopover. Each observes
// them so a change re-anchors an open panel.
export const POPOVER_ATTRS = [
	"placement",
	"screen-offset",
	"follow-scroll",
	"clamp-placement",
	"min-fit-height",
	"min-fit-width",
	"min-open-height",
	"min-open-width",
] as const;

// Single source of popover anchoring: place fixed-position `panel`
// against `anchor`, reading the shared placement / --neo-popover-* /
// clamp / min-fit inputs every popover-bearing kit element honors. Sizes
// the panel to the anchor width and returns the effective placement, so
// <neo-select>, <neo-combobox>, and <neo-textinput> stay pixel-identical.
export function anchorPopover(host: HTMLElement, anchor: HTMLElement, panel: HTMLElement): Placement {
	return anchorPopoverResult(host, anchor, panel).placement;
}

export function anchorPopoverResult(
	host: HTMLElement,
	anchor: HTMLElement,
	panel: HTMLElement,
	opts: { ignorePositioningBoundary?: boolean } = {},
): PositionResult {
	const placement = (host.getAttribute("placement") as Placement | null) ?? "bottom-start";
	// `screen-offset` attr mirrors into the CSS var so either drives it.
	const screenOffset = host.getAttribute("screen-offset");
	if (screenOffset) host.style.setProperty("--neo-popover-screen-offset", screenOffset);
	const minFitHeightAttr = host.getAttribute("min-fit-height");
	if (minFitHeightAttr !== null) host.style.setProperty("--neo-popover-min-fit-height", minFitHeightAttr);
	const minFitWidthAttr = host.getAttribute("min-fit-width");
	if (minFitWidthAttr !== null) host.style.setProperty("--neo-popover-min-fit-width", minFitWidthAttr);
	const minOpenHeightAttr = host.getAttribute("min-open-height");
	if (minOpenHeightAttr !== null) host.style.setProperty("--neo-popover-min-open-height", minOpenHeightAttr);
	const minOpenWidthAttr = host.getAttribute("min-open-width");
	if (minOpenWidthAttr !== null) host.style.setProperty("--neo-popover-min-open-width", minOpenWidthAttr);
	const edgeOffset = resolveCssLengthPx(host, "--neo-popover-screen-offset", "8px");
	const minFitHeight = resolveCssLengthPxOrContent(host, "--neo-popover-min-fit-height", "content");
	const minFitWidth = resolveCssLengthPxOrContent(host, "--neo-popover-min-fit-width", "content");
	const minOpenHeight = resolveOptionalCssLengthPx(host, "--neo-popover-min-open-height");
	const minOpenWidth = resolveOptionalCssLengthPx(host, "--neo-popover-min-open-width");
	panel.style.boxSizing = "border-box";
	// popover-fit-content sizes to its own content (CSS width:max-content,
	// capped by max-width); an inline trigger width here would floor it, so
	// leave width unset. Every other popover matches the trigger width.
	panel.style.width = boolAttr(host, "popover-fit-content", false) ? "" : `${anchor.getBoundingClientRect().width}px`;
	return positionPanelResult(anchor, panel, placement, edgeOffset, 8, {
		clamp: boolAttr(host, "clamp-placement", false),
		minFitHeight,
		minFitWidth,
		minOpenHeight,
		minOpenWidth,
		maxWidth: undefined,
		ignorePositioningBoundary: opts.ignorePositioningBoundary,
		noFlip: !boolAttr(host, "flip", true),
	});
}

function resolveMinFit(value: MinFitValue | undefined, contentPx = 0): number {
	if (value === "content") return Math.max(0, contentPx);
	return Math.max(0, value ?? 0);
}

function panelContentSize(panel: HTMLElement): { width: number; height: number } {
	const styles = getComputedStyle(panel);
	const borderX = parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth);
	const borderY = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
	let width = panel.scrollWidth;
	let height = panel.scrollHeight;

	// <neo-elastic> inside a closed popover starts at wrapper height 0
	// and animates open. Measure its target content; otherwise placement
	// chosen from the in-flight wrapper size flips one frame later when
	// ResizeObserver catches up.
	for (const elastic of panel.querySelectorAll<HTMLElement>("neo-elastic")) {
		const inner = elastic.querySelector<HTMLElement>(":scope > [data-neo-elastic-content]");
		if (!inner) continue;
		const rendered = elastic.getBoundingClientRect();
		const naturalWidth = inner.scrollWidth;
		const naturalHeight = inner.scrollHeight;
		width = Math.max(width, panel.scrollWidth + Math.max(0, naturalWidth - rendered.width));
		height += Math.max(0, naturalHeight - rendered.height);
	}

	return {
		width: width + borderX,
		height: height + borderY,
	};
}
