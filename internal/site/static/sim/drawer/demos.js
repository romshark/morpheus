import sim from "/static/datasim.js";

const templateHTML = (id) =>
	document.getElementById(id).innerHTML.trim();

// Async-loading demo. Each drawer open POSTs here. The
// simulator reads the response payload off the
// `drawer_async_html` signal (seeded on the host) and morphs
// it into the drawer body slot.
// Datastar matches by id on `#drawer-async-body` and updates
// the existing wrapper element in place, keeping the host's
// saved slot reference valid for restoration on close.
sim.post("/drawer/async-load", async (ctx, sse) => {
	const s = ctx.signals || {};
	const html = s.drawer_async_html == null
		? ""
		: String(s.drawer_async_html);
	sse.patchElements(
		`<div id="drawer-async-body" class="drawer-async-slot drawer-async-loaded">` +
			html +
			`</div>`,
	);
});

sim.post("/drawer/asyncload/", async (_ctx, sse) => {
	sse.patchElements(templateHTML("drawerAsyncDemo-success-template"));
});
