// Server handler for the "Async placeholder" example. Each open @posts
// here; after a delay the simulator morphs the loaded panel into
// #elastic-async-content, replacing the skeleton placeholder (match-by-id).
// No reset route: neo-elastic owns the <template data-neo-async-placeholder>
// slot and reinstates the skeleton after the collapse transition, so the
// next open loads fresh. Closing aborts any in-flight request so a late
// response can't overwrite the restored placeholder.

import sim from "/static/datasim.js";

const CONTENT =
	`<div id="elastic-async-content" style="padding-top: 0.75rem;">` +
		`<p style="margin: 0 0 0.5rem;">Build #4821 finished in 3m 12s. All 248 checks passed.</p>` +
		`<ul style="margin: 0; padding-left: 1.25rem; color: var(--muted);">` +
			`<li>frontend: bundled 1.2 MB, 0 type errors</li>` +
			`<li>backend: 96% coverage across 1,043 tests</li>` +
			`<li>deploy: promoted to staging at 14:07 UTC</li>` +
		`</ul>` +
	`</div>`;

sim.post("/elastic/async-load/", async (_ctx, sse) => {
	await sse.delay(900);
	sse.patchElements(CONTENT);
});
