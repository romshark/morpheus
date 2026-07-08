// Server handler for the "Async loading" sidebar example. Each open @posts
// here; after a delay the simulator morphs the account panel into
// #sidebar-async-content, replacing the skeleton placeholder (match-by-id).
// No reset route: neo-sidebar owns the [data-neo-async-placeholder] slot and
// reinstates the skeleton on close, so the next open loads fresh. The close
// handler aborts any in-flight request so a late response can't overwrite the
// restored placeholder.

import sim from "/static/datasim.js";

const item = (icon, label) =>
	`<neo-button data-neo-navgroup-item>` +
		`<neo-icon name="${icon}"></neo-icon> ${label}` +
	`</neo-button>`;

const CONTENT =
	`<div id="sidebar-async-content" data-neo-sidebar-content class="sb-async-body">` +
		`<neo-navgroup orientation="vertical" wrap role="menu" style="width:100%">` +
			item("user", "Profile") +
			item("bell", "Notifications") +
			item("mail", "Messages") +
			item("star", "Starred") +
			item("settings", "Settings") +
		`</neo-navgroup>` +
	`</div>`;

sim.post("/sidebar/async-load/", async (_ctx, sse) => {
	sse.patchElements(CONTENT);
});
