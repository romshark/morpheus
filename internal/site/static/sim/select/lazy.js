import sim from "/static/datasim.js";

sim.post("/select/lazy-once/", async (_ctx, sse) => {
	sse.patchElements(`
		<neo-datalist id="demo-lazy-once-select-options">
			<neo-optgroup label="Americas">
				<neo-option value="America/Los_Angeles" label="Los Angeles">Los Angeles<small style="margin-left: auto; color: var(--muted);">UTC−08:00</small></neo-option>
				<neo-option value="America/New_York" label="New York">New York<small style="margin-left: auto; color: var(--muted);">UTC−05:00</small></neo-option>
				<neo-option value="America/Sao_Paulo" label="São Paulo">São Paulo<small style="margin-left: auto; color: var(--muted);">UTC−03:00</small></neo-option>
			</neo-optgroup>
			<neo-optgroup label="Europe &amp; Africa">
				<neo-option value="Europe/London" label="London">London<small style="margin-left: auto; color: var(--muted);">UTC+00:00</small></neo-option>
				<neo-option value="Europe/Berlin" label="Berlin">Berlin<small style="margin-left: auto; color: var(--muted);">UTC+01:00</small></neo-option>
				<neo-option value="Africa/Cairo" label="Cairo">Cairo<small style="margin-left: auto; color: var(--muted);">UTC+02:00</small></neo-option>
			</neo-optgroup>
			<neo-optgroup label="Asia &amp; Pacific">
				<neo-option value="Asia/Dubai" label="Dubai">Dubai<small style="margin-left: auto; color: var(--muted);">UTC+04:00</small></neo-option>
				<neo-option value="Asia/Tokyo" label="Tokyo">Tokyo<small style="margin-left: auto; color: var(--muted);">UTC+09:00</small></neo-option>
				<neo-option value="Australia/Sydney" label="Sydney">Sydney<small style="margin-left: auto; color: var(--muted);">UTC+11:00</small></neo-option>
			</neo-optgroup>
		</neo-datalist>
	`);
});
