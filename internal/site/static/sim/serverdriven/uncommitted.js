// Server for the uncommitted-state example. It refuses every move and
// streams its own order back on a loop.
//
// The loop is the point. A projection cannot omit order the way it omits
// an attribute, so every patch restates where every item belongs. This
// server never accepts a move, so every patch describes the order the
// user just dragged away from.

import sim from "/static/datasim.js";

const ITEMS = [
	["sd-a", "1. First"],
	["sd-b", "2. Second"],
	["sd-c", "3. Third"],
	["sd-d", "4. Fourth"],
];

// How long the server takes to answer, and how often it re-sends its
// order. Several patches land while the command is still in flight.
const WORK_MS = 1500;
const WAKE_MS = 900;

const renderItems = () =>
	ITEMS.map(([id, label]) => `<div id="${id}" class="sd-uncommitted-item">${label}</div>`).join("");

// mode "inner" replaces the list's children and leaves the host alone, so
// the commit / morph-tolerance attributes stay authored in the template
// rather than being restated by every patch.
sim.get("/serverdriven/uncommitted/stream", async (ctx, sse) => {
	streamOpened = true;
	while (!ctx.signal.aborted) {
		sse.patchElements(renderItems(), { selector: "#sd-uncommitted-list", mode: "inner" });
		try {
			await sse.delay(WAKE_MS);
		} catch {
			return;
		}
	}
});

// The command reports its own outcome. A refusal is not an error, so the
// client cannot read it off the status code, and the projection cannot
// carry it either: nothing about the board changed.
sim.post("/serverdriven/uncommitted/move", async (ctx, sse) => {
	await sse.delay(WORK_MS);
	sse.patchSignals({ sd_refused: true });
});

// datastar.js is a module in <head> and runs before this one, so a stream
// opened from data-init would reach the real origin instead of the
// simulator. The list waits for this event. It repeats until the stream
// request arrives, which is proof the listener was there rather than a
// guess about when it would be.
let streamOpened = false;

function announceReady() {
	document.getElementById("sd-uncommitted-list")?.dispatchEvent(new CustomEvent("sd-uncommitted-ready"));
}
const readyTimer = setInterval(() => {
	if (streamOpened) clearInterval(readyTimer);
	else announceReady();
}, 150);
announceReady();
