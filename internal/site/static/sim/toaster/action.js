// Server handlers for the "Action toast (undo)" example. The Archive
// button @posts here; the handler appends a warning toast carrying an
// in-toast Undo button (slot="action") whose own @post URL is the
// toast's id. The undo handler removes the original toast and replaces
// it with a success confirmation. Missing `duration` keeps the warning
// visible until the user reacts.

import sim from "/static/datasim.js";

const STACK_SELECTOR = "#demo-toaster-action";

let counter = 0;

sim.post("/toaster/action/archive", async (_ctx, sse) => {
	const toastId = "notif-archived-" + (++counter);
	sse.patchElements([
		`<neo-toast id="${toastId}" variant="warning">`,
		`<span slot="title">Project archived</span>`,
		`<span slot="description">Files moved to the archive.</span>`,
		`<neo-button variant="secondary" slot="action" data-on:click="@post('/toaster/action/undo/${toastId}', { requestCancellation: 'disabled' })">Undo</neo-button>`,
		`</neo-toast>`,
	].join(""), { selector: STACK_SELECTOR, mode: "append" });
});

sim.post("/toaster/action/undo/:id", async (ctx, sse) => {
	const toastId = ctx.params.id;
	sse.removeElements("#" + toastId);
	sse.patchElements([
		`<neo-toast id="${toastId}-undone" variant="success" duration="3000">`,
		`<span slot="title">Archive undone</span>`,
		`<span slot="description">Project files are active again.</span>`,
		`</neo-toast>`,
	].join(""), { selector: STACK_SELECTOR, mode: "append" });
});
