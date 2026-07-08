// Server handler for "Patch — append a toast". The button @posts here;
// the simulator streams an SSE patch-elements event targeting the
// toaster host with `mode: "append"`, dropping a freshly-rendered
// <neo-toast> into the stack. Datastar's morph preserves existing
// toasts; the toaster's MutationObserver picks up the new card and
// animates it in. Auto-dismisses after 3 s per its own `duration`.

import sim from "/static/datasim.js";

const STACK_SELECTOR = "#demo-toaster-append";

sim.post("/toaster/patch-append/", async (_ctx, sse) => {
	sse.patchElements(
		`<neo-toast variant="success" duration="3000">` +
		`<span slot="title">Patched in</span>` +
		`<span slot="description">Inserted via DOM mutation.</span>` +
		`</neo-toast>`,
		{ selector: STACK_SELECTOR, mode: "append" },
	);
});
