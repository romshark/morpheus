// Comma-separated `value` contract for the multi-value components
// (<neo-toggle-group>, <neo-combobox multiple>). A single `value` attribute
// mirrors the selection as a comma-separated list of child/option values.
//
// The separator is unescaped (this is not RFC 4180 CSV), so a value containing
// VALUE_SEP cannot round-trip: it re-splits into extra entries on parse.
// Commas in values are unsupported; [joinValues] warns when one is written so
// the corruption is diagnosable.

export const VALUE_SEP = ",";

// Parses the attribute into values, dropping surrounding whitespace and empty
// tokens (so `"a, b,"` yields `["a", "b"]`).
export function parseValues(raw: string | null): string[] {
	if (!raw) return [];
	return raw
		.split(VALUE_SEP)
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
}

// Warns once per offending value; a comma in the value cannot round-trip.
const warnedCommaValues = new Set<string>();

// Joins values into the attribute, warning for any value containing VALUE_SEP.
// `tag` names the owning element for the message.
export function joinValues(values: string[], tag: string): string {
	for (const v of values) {
		if (v.includes(VALUE_SEP) && !warnedCommaValues.has(v)) {
			warnedCommaValues.add(v);
			console.warn(
				`<${tag}> value "${v}" contains a comma; the comma-separated \`value\` cannot represent it and it will mis-split.`,
			);
		}
	}
	return values.join(VALUE_SEP);
}
