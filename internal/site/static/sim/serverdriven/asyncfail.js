
import sim from "/static/datasim.js";

sim.post("/serverdriven/asyncfail/", async (ctx, sse) => {
	// Simulate a server endpoint that always returns a 500 Internal Server Error
	// response so the datastar.ComboboxAsync swaps in its Failed template once
	// Datastar exhausts the configured retry budget.
	throw new Error("simulated 500 Internal Server Error");
});
