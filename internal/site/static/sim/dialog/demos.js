import sim from "/static/datasim.js";

const escText = (str) =>
	String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

// Async-loading demo. Each dialog open POSTs here. The
// response payload is read from the `dialog_async_html`
// signal (seeded on the host).
sim.post("/dialog/async-load", async (ctx, sse) => {
	const s = ctx.signals || {};
	const html = s.dialog_async_html == null
		? ""
		: String(s.dialog_async_html);
	sse.patchElements(
		`<div id="dialog-async-body" class="dialog-async-slot dialog-async-loaded">` +
			html +
			`</div>`,
	);
});

// Failure-swap demo. Each retry/open POSTs here. The handler
// always returns success; failures are injected globally by the
// server-error controls. On a reachable response it morphs the
// retry-success template into the body.
const templateHTML = (id) =>
	document.getElementById(id).innerHTML.trim();

sim.post("/dialog/asyncload/", async (_ctx, sse) => {
	sse.patchElements(templateHTML("dialogAsyncDemo-success-template"));
});

// Continuous-patching demo. Each `await sse.delay(...)` is a
// cancellation point. Closing the dialog while the stream is
// in flight aborts the requestCancellation controller wired on
// the host; the next delay then rejects and no further patches
// land.
const patchingStep = (state, label) => {
	const glyph = state === "done"
		? `<neo-icon name="check"></neo-icon>`
		: `<neo-spinner></neo-spinner>`;
	return `<li data-state="${state}">${glyph}` +
		`<span>${escText(label)}</span></li>`;
};
const patchingState = (steps, footer) =>
	`<div id="dialog-patching-steps" class="dialog-patching-progress">` +
	`<ul class="dialog-patching-steplist">` +
	steps.map(([state, label]) => patchingStep(state, label)).join("") +
	`</ul>` +
	(footer || "") +
	`</div>`;

sim.post("/dialog/work-stream", async (_ctx, sse) => {
	const stages = [
		"Connecting to server",
		"Building artifacts",
		"Bundling assets",
		"Running tests",
		"Pushing release",
	];
	const doneLabel = (i) => [
		"Connected to server",
		"Built artifacts",
		"Bundled assets",
		"Tests passed",
		"Released v0.1.0",
	][i];

	await sse.delay(300);
	for (let i = 0; i < stages.length; i++) {
		const rows = [];
		for (let j = 0; j < i; j++) {
			rows.push(["done", doneLabel(j)]);
		}
		rows.push(["active", stages[i]]);
		sse.patchElements(patchingState(rows));
		await sse.delay(700);
	}

	const finalRows = stages.map((_, j) => ["done", doneLabel(j)]);
	const footer =
		`<div class="dialog-patching-result">` +
		`<neo-icon name="sparkles"></neo-icon>` +
		`<span>Deployment complete · 3.5s</span>` +
		`</div>` +
		`<div class="dialog-patching-actions">` +
		`<neo-button variant="primary" data-neo-dialog-close>Dismiss</neo-button>` +
		`</div>`;
	sse.patchElements(patchingState(finalRows, footer));
});
