// Server handler for the "Lazy load" example. One-shot datalist
// population — the kit's lazy-by-default mode caches options on
// subsequent opens, so this handler only ever runs the first time a
// given combobox is opened.

import sim from "/static/datasim.js";

sim.post("/combobox/lazy-once/", async (_ctx, sse) => {
	sse.patchElements(
		`<neo-datalist id="demo-lazy-once-combobox-options">` +
			`<neo-optgroup label="Open source">` +
			`<neo-option value="morpheus">romshark/morpheus</neo-option>` +
			`<neo-option value="datastar">starfederation/datastar</neo-option>` +
			`<neo-option value="templ">a-h/templ</neo-option>` +
			`<neo-option value="idiomorph">bigskysoftware/idiomorph</neo-option>` +
			`</neo-optgroup>` +
			`<neo-optgroup label="Internal">` +
			`<neo-option value="acme-api">acme/api</neo-option>` +
			`<neo-option value="acme-web">acme/web</neo-option>` +
			`<neo-option value="acme-infra">acme/infra</neo-option>` +
			`</neo-optgroup>` +
			`</neo-datalist>`,
	);
});
