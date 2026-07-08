// Server handler for the "Async load" example. On every popover open,
// the combobox @posts here; the server streams a fresh datalist of
// options keyed by the host's `<id>-options`. The kit detects the
// morph and swaps the [data-neo-async-placeholder] slot for the
// rendered listbox.

import sim from "/static/datasim.js";

const escAttr = (str) =>
	String(str)
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;");

const ASSIGNEES = [
	["alice_larsson", "Alice Larsson"],
	["diego_vega", "Diego Vega"],
	["evelyn_kone", "Evelyn Kone"],
	["jan_osullivan", "Jan O'Sullivan"],
	["samira_khalil", "Samira Khalil"],
	["theo_becker", "Theo Becker"],
];

sim.post("/combobox/async-load/", async (_ctx, sse) => {
	const rows = ASSIGNEES
		.map(([value, label]) =>
			`<neo-option value="${escAttr(value)}">${escAttr(label)}</neo-option>`,
		)
		.join("");
	sse.patchElements(
		`<neo-datalist id="demo-async-combobox-options">` +
			rows +
			`</neo-datalist>`,
	);
});
