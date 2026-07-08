// Server handler for the "Async load with failure swap" sidebar example.
// Each open/retry @posts here. The handler always returns success; failures
// are injected globally by the server-error controls above the demo. On a
// reachable response it morphs the loaded account panel into
// #sidebarAsyncDemo-body (match-by-id), replacing the skeleton placeholder.
// SidebarAsync swaps the failure template in once Datastar exhausts its retry
// budget; the retry button re-posts here without closing the sidebar.

import sim from "/static/datasim.js";

const item = (icon, label) =>
	`<neo-button data-neo-navgroup-item>` +
		`<neo-icon name="${icon}"></neo-icon> ${label}` +
	`</neo-button>`;

const CONTENT =
	`<div id="sidebarAsyncDemo-body" data-neo-sidebar-content>` +
		`<neo-navgroup orientation="vertical" wrap role="menu" style="width:100%">` +
			item("user", "Profile") +
			item("bell", "Notifications") +
			item("mail", "Messages") +
			item("star", "Starred") +
			item("settings", "Settings") +
		`</neo-navgroup>` +
	`</div>`;

sim.post("/sidebar/asyncload/", async (_ctx, sse) => {
	sse.patchElements(CONTENT);
});
