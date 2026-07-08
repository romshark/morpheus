// Server handler waits one second so the [data-neo-async-placeholder] slot stays
// visible, then streams a fixed options fragment into the listbox.

import sim from "/static/datasim.js";

sim.post("/serverdriven/asyncload/", async (_ctx, sse) => {
	await sse.delay(1000);
	sse.patchElements(
		`<neo-datalist id="serverDrivenAsyncLoad-options">
			<neo-option value="alice_larsson">Alice Larsson</neo-option>
			<neo-option value="diego_vega">Diego Vega</neo-option>
			<neo-option value="theo_becker">Theo Becker</neo-option>
		</neo-datalist>`,
	);
});
