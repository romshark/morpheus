// Server handler for the "Live search (server-driven)" example. The
// host's neo-combobox-search handler copies the event's detail.query
// onto $cmb_query; the host @posts here on every debounced keystroke
// (and on open). The handler filters a static list and ships either
// a templated optgroup or an inline `[data-neo-empty-results]` slot
// the kit recognises as the no-match state.

import sim from "/static/datasim.js";

const escAttr = (str) =>
	String(str)
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;");

const CITIES = [
	"Amsterdam", "Athens", "Barcelona", "Berlin", "Brussels",
	"Budapest", "Copenhagen", "Dublin", "Edinburgh", "Florence",
	"Geneva", "Hamburg", "Helsinki", "Istanbul", "Kraków",
	"Lisbon", "Ljubljana", "London", "Madrid", "Milan",
	"Munich", "Oslo", "Paris", "Porto", "Prague",
	"Reykjavík", "Riga", "Rome", "Sofia", "Stockholm",
	"Tallinn", "Valencia", "Vienna", "Vilnius", "Warsaw",
	"Zagreb", "Zürich",
];

sim.post("/combobox/search/", async (ctx, sse) => {
	const raw = String(ctx.signals?.cmb_query ?? "");
	const q = raw.trim().toLowerCase();
	const all = q.length === 0
		? CITIES
		: CITIES.filter((c) => c.toLowerCase().includes(q));
	const matches = all.slice(0, 10);
	const rows = matches.map((c) =>
		`<neo-option value="${escAttr(c.toLowerCase())}">${escAttr(c)}</neo-option>`,
	).join("");
	const groupLabel = raw.trim().length === 0
		? "All cities"
		: `Results for "${escAttr(raw)}"`;
	const body = matches.length === 0
		? `<div data-neo-empty-results>No results.</div>`
		: `<neo-optgroup label="${groupLabel}">${rows}</neo-optgroup>`;
	sse.patchElements(
		`<neo-datalist id="demo-search-combobox-options">` +
			body +
			`</neo-datalist>`,
	);
});
