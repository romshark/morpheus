import sim from "/static/datasim.js";

sim.post("/select/loadassigneesalt/", async (_ctx, sse) => {
	const tpl = document.getElementById("demo-assignee-select-alt-options-template");
	sse.patchElements(tpl.innerHTML.trim());
});
