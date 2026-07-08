// Server handler for the "Patch — update one toast" example. The
// toaster ships an SSR'd toast whose title carries an id
// (`#patch-update-toast-title`); on click, the host @posts here and we
// stream an SSE patch-elements event with the same id. Datastar
// morphs the title's text in place — the toast element keeps its
// identity (and its dismissal timer), only the inner text changes.

import sim from "/static/datasim.js";

sim.post("/toaster/patch-update/", async (_ctx, sse) => {
	const title = `Updated at ${new Date().toLocaleTimeString()}`;
	sse.patchElements(
		`<span id="patch-update-toast-title" slot="title">${title}</span>`,
	);
});
