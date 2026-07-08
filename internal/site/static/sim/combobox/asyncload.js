// Server handler for the "Async load with failure swap" example,
// driven by datastar.ComboboxAsync. The host id is `comboboxAsyncDemo`
// (the wrapper's default morph target); the live-search bind on the
// host stamps the current query onto `comboboxAsyncDemo_query`, which
// this handler filters by. The simulator's `_sim_unreachable` /
// `_sim_server_error` signals drive the failure path without any
// extra wiring here — datasim intercepts the request based on them.

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

sim.post("/combobox/asyncload/", async (ctx, sse) => {
	const q = String(ctx.signals?.comboboxAsyncDemo_query ?? "")
		.trim()
		.toLowerCase();
	const rows = ASSIGNEES
		.filter(([, label]) => q === "" || label.toLowerCase().includes(q))
		.map(([value, label]) =>
			`<neo-option value="${escAttr(value)}">${escAttr(label)}</neo-option>`,
		)
		.join("");
	const body = rows === ""
		? `<div data-neo-empty-results>No results.</div>`
		: rows;
	sse.patchElements(
		`<neo-datalist id="comboboxAsyncDemo-options">` +
			body +
			`</neo-datalist>`,
	);
});
