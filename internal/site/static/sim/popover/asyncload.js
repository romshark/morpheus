// Server handler for the "Async load with failure swap" example
// (PopoverAsync). Same shape as loadcontent.js — produce body markup
// and stream as an element patch. The Datastar action wired by
// PopoverAsync handles the retry / failure swap purely client-side
// from `datastar-fetch` events; the server doesn't need to know.

import sim from "/static/datasim.js";

const templateHTML = (id) =>
	document.getElementById(id).innerHTML.trim();

sim.post("/popover/asyncload/", async (_ctx, sse) => {
	sse.patchElements(templateHTML("popoverAsyncDemo-success-template"));
});
