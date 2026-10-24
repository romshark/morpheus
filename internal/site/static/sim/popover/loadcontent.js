// Server handler for the "Lazy-loaded content" example. On open, the
// popover @posts here; the server (or simulator) renders the body and
// streams it back as an element patch. Closing the popover aborts the
// request. Neither the simulator nor a real handler sees the abort; it
// short-circuits at the transport layer.
//
// In production, do the work, then `sse.patchElements(body)` with the
// rendered HTML. The DOM target is keyed by id. The response only needs
// to wrap the body in an element carrying that id.

import sim from "/static/datasim.js";

const templateHTML = (id) =>
	document.getElementById(id).innerHTML.trim();

sim.post("/popover/loadcontent/", async (_ctx, sse) => {
	sse.patchElements(templateHTML("popoverLazyDemo-template"));
});
