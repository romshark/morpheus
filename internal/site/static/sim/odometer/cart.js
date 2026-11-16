// Server handler for the "Server-rendered total" example. It keeps the pass count,
// formats the total in its own locale and morphs the new text into <neo-odometer>.

import sim from "/static/datasim.js";

const PRICE = 249;
const MAX = 9;
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

sim.post("/odometer/cart/:dir/", async (ctx, sse) => {
	const s = ctx.signals || {};
	let count = Number(s.odometer_cart_count) || 0;
	if (ctx.params.dir === "add") count = Math.min(MAX, count + 1);
	else if (ctx.params.dir === "remove") count = Math.max(0, count - 1);
	sse.patchSignals({ odometer_cart_count: count });
	sse.patchElements(`<neo-odometer id="odometer-cart-total">${usd.format(count * PRICE)}</neo-odometer>`);
});
