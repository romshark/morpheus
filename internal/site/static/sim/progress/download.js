import sim from "/static/datasim.js";

sim.post("/progress/download", async (_ctx, sse) => {
	sse.patchSignals({ dl_value: 0, dl_label: "Uploading…" });
	for (let pct = 25; pct <= 100; pct += 25) {
		await sse.delay(1000);
		sse.patchSignals({ dl_value: pct });
	}
	sse.patchSignals({ dl_label: "Done ✓", dl_running: false });
});
