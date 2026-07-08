// Server handler for the "Lazy-loaded content" example. On open, the
// popover @posts here; the server (or simulator) renders the body and
// streams it back as an element patch. Closing the popover aborts the
// request — neither the simulator nor a real handler ever sees the
// abort; it short-circuits at the transport layer.
//
// Real production: do the work, then `sse.patchElements(body)` with the
// rendered HTML. The DOM target is keyed by id, so the response only
// needs to wrap the body in an element carrying that id.

import sim from "/static/datasim.js";

const templateHTML = (id) =>
	document.getElementById(id).innerHTML.trim();

sim.post("/popover/loadcontent/", async (_ctx, sse) => {
	sse.patchElements(templateHTML("popoverLazyDemo-template"));
});
