// HSV <-> #rrggbb conversion shared by <neo-color-field> and <neo-slider-color>.
// Saturation and brightness are percentages, hue is degrees.

export interface HSV {
	h: number;
	s: number;
	v: number;
}

function clampPct(n: number): number {
	return Math.min(100, Math.max(0, n));
}

export function wrapHue(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return ((n % 360) + 360) % 360;
}

function hexByte(n: number): string {
	return Math.round(Math.min(255, Math.max(0, n)))
		.toString(16)
		.padStart(2, "0");
}

export function hsvToHex(h: number, sPct: number, vPct: number): string {
	const s = clampPct(sPct) / 100;
	const v = clampPct(vPct) / 100;
	const c = v * s;
	const hp = wrapHue(h) / 60;
	const x = c * (1 - Math.abs((hp % 2) - 1));
	let r = 0;
	let g = 0;
	let b = 0;

	if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
	else if (hp < 2) [r, g, b] = [x, c, 0];
	else if (hp < 3) [r, g, b] = [0, c, x];
	else if (hp < 4) [r, g, b] = [0, x, c];
	else if (hp < 5) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];

	const m = v - c;
	return `#${hexByte((r + m) * 255)}${hexByte((g + m) * 255)}${hexByte((b + m) * 255)}`;
}

// Normalizes #rgb or #rrggbb, with or without the #, to lowercase #rrggbb.
// Null for anything else.
export function parseHex(value: string | null): string | null {
	const m = value?.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (!m) return null;
	const raw = m[1].toLowerCase();
	return `#${raw.length === 3 ? raw.replace(/./g, (ch) => ch + ch) : raw}`;
}

// Parses what [parseHex] accepts. Null for anything else.
export function hexToHsv(value: string | null): HSV | null {
	const hex = parseHex(value);
	if (!hex) return null;
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	const max = Math.max(r, g, b);
	const d = max - Math.min(r, g, b);
	let h = 0;
	if (d !== 0) {
		if (max === r) h = 60 * (((g - b) / d) % 6);
		else if (max === g) h = 60 * ((b - r) / d + 2);
		else h = 60 * ((r - g) / d + 4);
	}
	return { h: wrapHue(h), s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}
