// Server handlers for "Patch — replace all". Two endpoints:
//   - /pin/     appends a single pinned toast (mode: "append").
//   - /replace/ replaces every toast with a fresh batch by morphing
//               the host's inner HTML (mode: "inner"). The toaster's
//               MutationObserver fires on each removal, running each
//               outgoing toast's leave animation, and animates the
//               newcomers in.

import sim from "/static/datasim.js";

const STACK_SELECTOR = "#demo-toaster-replace";

sim.post("/toaster/patch-replace/pin/", async (_ctx, sse) => {
	sse.patchElements(
		`<neo-toast variant="info">` +
		`<span slot="title">Pinned</span>` +
		`</neo-toast>`,
		{ selector: STACK_SELECTOR, mode: "append" },
	);
});

const batchToast = (title) =>
	`<neo-toast variant="warning">` +
	`<span slot="title">${title}</span>` +
	`</neo-toast>`;

sim.post("/toaster/patch-replace/replace/", async (_ctx, sse) => {
	sse.patchElements(
		batchToast("Fresh batch — A") + batchToast("Fresh batch — B"),
		{ selector: STACK_SELECTOR, mode: "inner" },
	);
});
