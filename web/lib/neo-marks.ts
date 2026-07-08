// Shared anchor-mark rail for <neo-slider> and <neo-progress>.
//
// The rail/fill is component-specific (the slider is interactive with a
// thumb + tooltip; progress is read-only), but mark collection,
// prerender reconstruction, dot + label rendering (edge flushing,
// vertical layout, empty-row hiding) and active-state sync are
// identical and must not drift. This is the canonical implementation,
// lifted from neo-slider; both components call it.
//
// `data-neo-mark-value`, `data-neo-mark-edge` and `data-neo-active` are
// the same literal names on both components; only the prefixed inputs /
// markup attributes differ, so the per-component names come from cfg.

export interface MarkSpec {
	value: number;
	labelHtml: string;
}

export interface MarkRailConfig {
	// Local attribute names (no value), e.g. "data-neo-slider-mark".
	markAttr: string; // slot input the author writes on the host
	anchorAttr: string; // rendered dot inside the track
	markLabelAttr: string; // rendered label inside the marks row
}

export type ActiveMarkLabelPolicy = "highest" | "extremes";

export interface ActiveMarkLabelPreference {
	extreme: "lowest" | "highest";
	range?: { min: number; max: number };
}

const ATTR_OVERLAPPING = "data-neo-mark-overlapping";
const ATTR_OVERLAP_GROUP = "data-neo-mark-overlap-group";
const ATTR_HOVERED = "data-neo-mark-hovered";
const ATTR_HOVER_SUPPRESSED = "data-neo-mark-hover-suppressed";
const ATTR_VISIBLE = "data-neo-mark-visible";
const collisionPeers = new WeakMap<HTMLElement, Set<HTMLElement>>();

// Parse the author's [data-neo-*-mark] children into sorted specs.
// Non-finite values are skipped; innerHTML becomes the label.
export function collectMarks(host: Element, cfg: MarkRailConfig): MarkSpec[] {
	const marks: MarkSpec[] = [];
	for (const el of Array.from(host.querySelectorAll<HTMLElement>(`:scope > [${cfg.markAttr}]`))) {
		const raw = el.getAttribute(cfg.markAttr);
		if (raw === null) continue;
		const v = Number(raw);
		if (!Number.isFinite(v)) continue;
		marks.push({ value: v, labelHtml: el.innerHTML.trim() });
	}
	marks.sort((a, b) => a.value - b.value);
	return marks;
}

// Reconstruct specs from prerendered markup when templ emitted no slot
// inputs (the common SSR case), so a later min/max/vertical change has
// the full list to re-render. Returns [] when nothing prerendered.
export function reconstructMarks(trackEl: Element | null, marksEl: Element | null, cfg: MarkRailConfig): MarkSpec[] {
	if (!trackEl) return [];
	const marks: MarkSpec[] = [];
	const dots = trackEl.querySelectorAll<HTMLElement>(`:scope > [${cfg.anchorAttr}][data-neo-mark-value]`);
	for (const dot of Array.from(dots)) {
		const raw = dot.getAttribute("data-neo-mark-value");
		if (raw === null) continue;
		const v = Number(raw);
		if (!Number.isFinite(v)) continue;
		const lbl = marksEl?.querySelector<HTMLElement>(`:scope > [${cfg.markLabelAttr}][data-neo-mark-value="${raw}"]`);
		marks.push({ value: v, labelHtml: lbl ? lbl.innerHTML.trim() : "" });
	}
	marks.sort((a, b) => a.value - b.value);
	return marks;
}

export interface RenderMarksOptions {
	min: number;
	max: number;
	vertical: boolean;
	cfg: MarkRailConfig;
	// Where the dot lands in the track. The slider inserts before the
	// thumb host so the thumb paints on top; progress appends.
	insertDot: (track: HTMLElement, dot: HTMLElement) => void;
	// Slider clones a custom <template data-neo-slider-anchor> into each
	// dot; progress has no anchor template.
	anchorTemplate?: DocumentFragment | null;
}

// Clear and re-render every dot (into the track) and label (into the
// marks row). Marks outside [min, max] are skipped.
export function renderMarks(
	marks: MarkSpec[],
	trackEl: HTMLElement,
	marksEl: HTMLElement,
	opts: RenderMarksOptions,
): void {
	const { min, max, vertical, cfg } = opts;
	for (const el of Array.from(trackEl.querySelectorAll(`:scope > [${cfg.anchorAttr}]`))) {
		el.remove();
	}
	marksEl.replaceChildren();

	const span = max - min;
	if (span <= 0) return;

	let hasAnyLabel = false;
	for (const mark of marks) {
		if (mark.value < min || mark.value > max) continue;
		const pct = ((mark.value - min) / span) * 100;

		const dot = document.createElement("span");
		dot.setAttribute(cfg.anchorAttr, "");
		dot.setAttribute("data-neo-mark-value", String(mark.value));
		// Tag at-min/at-max dots so CSS can flush them inward; otherwise
		// the centering transform leaves half the dot outside the rail.
		if (mark.value === min) dot.setAttribute("data-neo-mark-edge", "start");
		else if (mark.value === max) dot.setAttribute("data-neo-mark-edge", "end");
		if (vertical) dot.style.bottom = `${pct}%`;
		else dot.style.left = `${pct}%`;
		if (opts.anchorTemplate) {
			dot.appendChild(opts.anchorTemplate.cloneNode(true));
		}
		opts.insertDot(trackEl, dot);

		if (mark.labelHtml !== "") {
			hasAnyLabel = true;
			const label = document.createElement("span");
			label.setAttribute(cfg.markLabelAttr, "");
			label.setAttribute("data-neo-mark-value", String(mark.value));
			if (vertical) label.style.top = `${100 - pct}%`;
			else label.style.left = `${pct}%`;
			// Tag at-min/at-max labels so CSS can flush them to the
			// start/end of the rail; otherwise half the label clips
			// outside the component's bounding box.
			if (mark.value === min) label.setAttribute("data-neo-mark-edge", "start");
			else if (mark.value === max) label.setAttribute("data-neo-mark-edge", "end");
			label.innerHTML = mark.labelHtml;
			marksEl.appendChild(label);
		}
	}

	// Hide the marks row when no mark has a label so the component
	// doesn't reserve space for an empty strip.
	marksEl.style.display = hasAnyLabel ? "" : "none";
}

// Toggle [data-neo-active] on every dot/label at or below `v`.
export function syncMarkActive(trackEl: Element | null, marksEl: Element | null, v: number, cfg: MarkRailConfig): void {
	if (!trackEl || !marksEl) return;
	const mark = (el: Element) => {
		const raw = el.getAttribute("data-neo-mark-value");
		if (raw === null) return;
		const mv = Number(raw);
		if (!Number.isFinite(mv)) return;
		if (mv <= v) el.setAttribute("data-neo-active", "");
		else el.removeAttribute("data-neo-active");
	};
	trackEl.querySelectorAll(`:scope > [${cfg.anchorAttr}]`).forEach(mark);
	marksEl.querySelectorAll(`:scope > [${cfg.markLabelAttr}]`).forEach(mark);
}

// Tag connected labels whose rendered boxes are less than 1ch apart.
// Opacity-based hiding keeps the boxes measurable on later passes.
export function measureMarkLabelOverlaps(marksEl: Element | null, cfg: MarkRailConfig, vertical: boolean): void {
	if (!marksEl) return;
	const labels = Array.from(marksEl.querySelectorAll<HTMLElement>(`:scope > [${cfg.markLabelAttr}]`));
	for (const label of labels) {
		label.removeAttribute(ATTR_OVERLAPPING);
		label.removeAttribute(ATTR_OVERLAP_GROUP);
		collisionPeers.set(label, new Set());
	}

	const gapProbe = document.createElement("span");
	gapProbe.style.cssText = "position:absolute;visibility:hidden;inline-size:1ch;block-size:0;pointer-events:none";
	marksEl.appendChild(gapProbe);
	const minimumGap = gapProbe.getBoundingClientRect().width;
	gapProbe.remove();

	const intervals = labels
		.map((label) => {
			const rect = label.getBoundingClientRect();
			return {
				label,
				start: vertical ? rect.top : rect.left,
				end: vertical ? rect.bottom : rect.right,
			};
		})
		.filter(({ start, end }) => end > start)
		.sort((a, b) => a.start - b.start);

	let run: typeof intervals = [];
	let runEnd = Number.NEGATIVE_INFINITY;
	let group = 0;
	const finishRun = () => {
		if (run.length > 1) {
			for (const item of run) {
				item.label.setAttribute(ATTR_OVERLAPPING, "");
				item.label.setAttribute(ATTR_OVERLAP_GROUP, String(group));
			}
			group++;
		}
		run = [];
		runEnd = Number.NEGATIVE_INFINITY;
	};

	for (const interval of intervals) {
		if (run.length === 0 || interval.start < runEnd + minimumGap) {
			for (const other of run) {
				if (interval.start >= other.end + minimumGap) continue;
				collisionPeers.get(interval.label)?.add(other.label);
				collisionPeers.get(other.label)?.add(interval.label);
			}
			run.push(interval);
			runEnd = Math.max(runEnd, interval.end);
			continue;
		}
		finishRun();
		run.push(interval);
		runEnd = interval.end;
	}
	finishRun();
}

// Overlapping labels are normally hidden by CSS. Keep the active mark
// nearest the value visible, resolving colliding range extremes by preference.
export function syncActiveMarkLabelVisibility(
	marksEl: Element | null,
	cfg: MarkRailConfig,
	policy: ActiveMarkLabelPolicy,
	preference: ActiveMarkLabelPreference = { extreme: "highest" },
): void {
	if (!marksEl) return;
	const labels = Array.from(marksEl.querySelectorAll<HTMLElement>(`:scope > [${cfg.markLabelAttr}]`));
	for (const label of labels) label.removeAttribute(ATTR_VISIBLE);

	const active = labels
		.filter((label) => label.hasAttribute("data-neo-active"))
		.map((label) => ({ label, value: Number(label.getAttribute("data-neo-mark-value")) }))
		.filter((item) => Number.isFinite(item.value))
		.sort((a, b) => a.value - b.value);
	if (active.length === 0) return;

	const lowest = active[0].label;
	const highest = active[active.length - 1].label;
	if (policy === "highest" || lowest === highest) {
		highest.setAttribute(ATTR_VISIBLE, "");
		return;
	}

	const lowestGroup = lowest.getAttribute(ATTR_OVERLAP_GROUP);
	const highestGroup = highest.getAttribute(ATTR_OVERLAP_GROUP);
	if (lowestGroup !== null && lowestGroup === highestGroup && collisionPeers.get(lowest)?.has(highest)) {
		let winner = preference.extreme === "lowest" ? lowest : highest;
		if (preference.range) {
			const lowestDistance = Math.min(
				Math.abs(active[0].value - preference.range.min),
				Math.abs(active[0].value - preference.range.max),
			);
			const highestDistance = Math.min(
				Math.abs(active[active.length - 1].value - preference.range.min),
				Math.abs(active[active.length - 1].value - preference.range.max),
			);
			if (lowestDistance < highestDistance) winner = lowest;
			else if (highestDistance < lowestDistance) winner = highest;
		}
		winner.setAttribute(ATTR_VISIBLE, "");
		return;
	}

	lowest.setAttribute(ATTR_VISIBLE, "");
	highest.setAttribute(ATTR_VISIBLE, "");
}

export function syncHoveredMarkLabel(marksEl: Element | null, cfg: MarkRailConfig, value: string | null): void {
	if (!marksEl) return;
	const labels = Array.from(marksEl.querySelectorAll<HTMLElement>(`:scope > [${cfg.markLabelAttr}]`));
	const hovered = value === null ? null : labels.find((label) => label.getAttribute("data-neo-mark-value") === value);
	const hoveredGroup = hovered?.getAttribute(ATTR_OVERLAP_GROUP) ?? null;
	for (const label of labels) {
		label.toggleAttribute(ATTR_HOVERED, label === hovered);
		label.toggleAttribute(
			ATTR_HOVER_SUPPRESSED,
			hoveredGroup !== null && label !== hovered && label.getAttribute(ATTR_OVERLAP_GROUP) === hoveredGroup,
		);
	}
}

export function markValueNearPointer(
	trackEl: Element | null,
	cfg: MarkRailConfig,
	vertical: boolean,
	clientX: number,
	clientY: number,
): string | null {
	if (!trackEl) return null;
	const pointer = vertical ? clientY : clientX;
	let nearestValue: string | null = null;
	let nearestDistance = Number.POSITIVE_INFINITY;
	for (const anchor of trackEl.querySelectorAll<HTMLElement>(`:scope > [${cfg.anchorAttr}]`)) {
		const value = anchor.getAttribute("data-neo-mark-value");
		if (value === null) continue;
		const rect = anchor.getBoundingClientRect();
		const center = vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
		const distance = Math.abs(pointer - center);
		if (distance > nearestDistance) continue;
		nearestDistance = distance;
		nearestValue = value;
	}
	return nearestValue;
}
