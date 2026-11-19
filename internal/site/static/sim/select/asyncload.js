import sim from "/static/datasim.js";

const templateHTML = (id) =>
	document.getElementById(id).innerHTML.trim();

sim.post("/select/asyncload/", async (_ctx, sse) => {
	sse.patchElements(templateHTML("selectAsyncDemo-options-template"));
});
