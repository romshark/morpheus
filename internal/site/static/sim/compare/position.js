// Server handler for the "Server-set position" example. It renders the whole
// element with the chosen `value`. The morph changes only that attribute, and
// the divider eases to it. The image ids pair the images across the morph,
// which keeps the loaded nodes.

import sim from "/static/datasim.js";

const VALUES = { print: 100, split: 50, colored: 0 };

sim.post("/compare/position/:preset/", async (ctx, sse) => {
	const value = VALUES[ctx.params.preset] ?? 50;
	sse.patchElements(`<neo-compare id="compare-server" value="${value}">
	<img id="compare-server-before" slot="before" src="/static/cheshire_cat.webp" alt="Cheshire cat illustration, black and white print" style="filter: grayscale(1)">
	<img id="compare-server-after" slot="after" src="/static/cheshire_cat.webp" alt="Cheshire cat illustration, hand-colored">
</neo-compare>`);
});
