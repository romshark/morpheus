// Value grid of <neo-slider> and <neo-slider-range>: the points min + k * step,
// plus stops at the interactive marks. A mark at 25 on a step-10 slider is a
// stop between 20 and 30 for the keys, the rail and the typed value.

type Stop = { readonly value: number };

export function decimalDigits(step: number): number {
	if (!Number.isFinite(step) || step <= 0) return 0;
	const s = String(step);
	const dot = s.indexOf(".");
	if (dot < 0) {
		// Handle scientific notation: "1e-3" -> 3 decimals.
		const exp = s.indexOf("e-");
		return exp < 0 ? 0 : Number(s.slice(exp + 2)) || 0;
	}
	return s.length - dot - 1;
}

// Clamp v to [lo, hi] and return the nearest grid point or stop.
// A grid point wins a tie.
export function snapToGrid(
	v: number,
	base: number,
	step: number,
	lo: number,
	hi: number,
	stops: readonly Stop[],
): number {
	const x = Math.min(hi, Math.max(lo, v));
	const k = Math.round((x - base) / step);
	const onGrid = Math.min(hi, Math.max(lo, base + k * step));
	// Round away the FP debris (0.1 + 0.2 -> 0.30000000000000004).
	let best = Number(onGrid.toFixed(decimalDigits(step)));
	for (const s of stops) {
		if (s.value >= lo && s.value <= hi && Math.abs(s.value - x) < Math.abs(best - x)) best = s.value;
	}
	return best;
}

// The next grid point or stop past v in direction dir, clamped to [lo, hi].
// From an off-grid v (a stop) it moves to the adjacent grid point,
// which takes 25 to 30 on a step-10 grid, not 25 + 10.
export function stepOnGrid(
	v: number,
	dir: 1 | -1,
	base: number,
	step: number,
	lo: number,
	hi: number,
	stops: readonly Stop[],
): number {
	// The tolerance keeps FP debris in v (2.9999999 on a 0.1 grid) from
	// counting as a point short of the one v sits on.
	const k = (v - base) / step;
	const g = dir > 0 ? Math.floor(k + 1e-9) + 1 : Math.ceil(k - 1e-9) - 1;
	let next = Number((base + g * step).toFixed(decimalDigits(step)));
	for (const s of stops) {
		if (dir > 0 ? s.value > v && s.value < next : s.value < v && s.value > next) next = s.value;
	}
	return Math.min(hi, Math.max(lo, next));
}
