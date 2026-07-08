// Server handlers for the app-shell toaster examples. `/show` appends a
// toast to the page-level toaster's stack and `/dismiss` clears it. The
// async trio (`/loading`, `/resolve`, `/reject`) is the promise-style
// flow — first a loading toast with duration 0 so it doesn't
// auto-dismiss, then the resolution swaps the same id to a terminal
// variant.

import sim from "/static/datasim.js";

const escAttr = (str) =>
	String(str)
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;");
const escText = (str) =>
	String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

// Append directly to the toaster host; <neo-toast> children project
// through the shadow stack via the host's <slot>.
const STACK_SELECTOR = "#app-toaster";

const toastHTML = ({ id, variant = "default", title, description = "", duration = "4000" }) => [
	`<neo-toast id="${escAttr(id)}" variant="${escAttr(variant)}" duration="${escAttr(duration)}">`,
	`<span slot="title">${escText(title)}</span>`,
	description ? `<span slot="description">${escText(description)}</span>` : "",
	`</neo-toast>`,
].join("");

sim.post("/toaster/app-shell/show", async (_ctx, sse) => {
	sse.patchElements(toastHTML({
		id: "app-shell-live-" + Date.now(),
		title: "Event has been created",
	}), { selector: STACK_SELECTOR, mode: "append" });
});

sim.post("/toaster/app-shell/dismiss", async (_ctx, sse) => {
	sse.executeScript(`document.getElementById("app-toaster")?.dismiss()`);
});

const patchAsyncToast = (sse, state) => {
	sse.patchElements(toastHTML({
		id: "app-shell-async-demo",
		duration: state.variant === "loading" ? "0" : "4000",
		...state,
	}), { selector: STACK_SELECTOR, mode: "append" });
};

sim.post("/toaster/app-shell/loading", async (_ctx, sse) => {
	patchAsyncToast(sse, {
		variant: "loading",
		title: "Saving...",
		description: "Waiting for the server.",
	});
});

sim.post("/toaster/app-shell/resolve", async (_ctx, sse) => {
	patchAsyncToast(sse, {
		variant: "loading",
		title: "Saving...",
		description: "Waiting for the server.",
	});
	sse.patchElements(toastHTML({
		id: "app-shell-async-demo",
		variant: "success",
		title: "Profile saved",
		description: "Server accepted the update.",
		duration: "4000",
	}), { selector: STACK_SELECTOR, mode: "append" });
});

sim.post("/toaster/app-shell/reject", async (_ctx, sse) => {
	patchAsyncToast(sse, {
		variant: "loading",
		title: "Saving...",
		description: "Waiting for the server.",
	});
	sse.patchElements(toastHTML({
		id: "app-shell-async-demo",
		variant: "error",
		title: "Save failed",
		description: "The server rejected the update.",
		duration: "6000",
	}), { selector: STACK_SELECTOR, mode: "append" });
});
