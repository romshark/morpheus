// Server handler for the "Autocomplete" example. The text field @posts
// here on every debounced keystroke; the handler filters a static city
// list by the bound `city_q` signal and morphs the matches as
// <neo-option> rows into the suggestions slot container. A query with no
// match morphs in a [data-neo-empty-results] status row (popover stays
// open); an empty query morphs the container empty (popover closes). The
// field keeps whatever the user typed either way.

import sim from "/static/datasim.js";

const esc = (s) =>
	String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const CITIES = [
	"Amsterdam", "Athens", "Barcelona", "Berlin", "Bogotá", "Boston",
	"Brussels", "Budapest", "Buenos Aires", "Cairo", "Cape Town",
	"Copenhagen", "Dublin", "Helsinki", "Istanbul", "Lisbon", "London",
	"Madrid", "Melbourne", "Mexico City", "Milan", "Montréal", "Mumbai",
	"Munich", "Nairobi", "Osaka", "Oslo", "Paris", "Porto", "Prague",
	"Reykjavík", "Rome", "San Francisco", "São Paulo", "Seoul", "Singapore",
	"Stockholm", "Sydney", "Tokyo", "Toronto", "Vienna", "Warsaw", "Zürich",
];

sim.post("/textinput/suggest/", async (ctx, sse) => {
	const raw = String(ctx.signals?.city_q ?? "");
	const q = raw.trim().toLowerCase();
	const matches = q ? CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 8) : [];
	let body = "";
	if (q && matches.length === 0) {
		body = `<div data-neo-empty-results>No cities match "${esc(raw.trim())}".</div>`;
	} else {
		body = matches.map((c) => `<neo-option value="${esc(c)}">${esc(c)}</neo-option>`).join("");
	}
	sse.patchElements(`<neo-datalist id="city-autocomplete-suggestions" slot="suggestions">${body}</neo-datalist>`);
});
