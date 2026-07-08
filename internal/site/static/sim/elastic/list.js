// Server handler for the "Growing list" example. Reads the current
// `$elastic_count` signal, clamps the new value to [0, 8], and emits
// both the updated signal and a morph patch for the `<ul>` body. Real
// production would do the same: tweak server state, send the new
// signal value and the re-rendered HTML fragment.

import sim from "/static/datasim.js";

const labels = [
	"First item", "Second item", "Third item", "Fourth item",
	"Fifth item", "Sixth item", "Seventh item", "Eighth item",
];

const escText = (str) =>
	String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

function renderList(count) {
	const items = labels.slice(0, count)
		.map(l => `<li>${escText(l)}</li>`)
		.join("");
	const baseStyle = "margin: 0.75rem 0 0; padding-left: 1.25rem;";
	const style = count === 0
		? `${baseStyle} display: none;`
		: baseStyle;
	return `<ul id="elastic-list" style="${style}">${items}</ul>`;
}

sim.post("/elastic/list/:dir/", async (ctx, sse) => {
	const dir = ctx.params.dir;
	const s = ctx.signals || {};
	let count = Number(s.elastic_count) || 0;
	if (dir === "inc") count = Math.min(8, count + 1);
	else if (dir === "dec") count = Math.max(0, count - 1);
	sse.patchSignals({ elastic_count: count });
	sse.patchElements(renderList(count));
});
