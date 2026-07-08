// Shared numeric parsing/clamping helpers used across components.

// Parse an attribute string to a finite number, else the fallback.
export function num(s: string | null, fallback: number): number {
	if (s === null) return fallback;
	const n = Number(s);
	return Number.isFinite(n) ? n : fallback;
}

// Parse an attribute string to a finite integer clamped to [min, max], else the fallback.
export function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
	if (raw === null) return fallback;
	const n = Number(raw);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(n)));
}

// Clamp a number to [min, max].
export function clamp(v: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, v));
}
