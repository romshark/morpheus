import sim from "/static/datasim.js";

const NAMED = { red: "#ef4444", green: "#22c55e", blue: "#3b82f6" };

function optionForColor(hex) {
	const lower = String(hex).toLowerCase();
	return Object.keys(NAMED).find((k) => NAMED[k] === lower) ?? "custom";
}

// Single source of truth for the picker markup. Every morph renders through here.
// The page's initial server render mirrors render("#3b82f6", "blue").
function render(color, option) {
	return `<div id="fw-accent" style="display:contents" data-signals="{fw_color: '${color}', fw_option: '${option}', fw_src: 'option'}">
  <neo-card class="framework-demo-card">
    <div data-neo-card-inner>
      <neo-layout column gap="md" align-items="center">
        <h3>Accent color</h3>
        <neo-layout column gap="md" align-items="center">
          <neo-select
            value="${option}"
            aria-label="Named color"
            placeholder="Pick a color"
            data-on:neo-select-change="$fw_option = evt.detail.value; $fw_src = 'option'; @post('/frameworks/accent/')"
          >
            <neo-option value="red">Red</neo-option>
            <neo-option value="green">Green</neo-option>
            <neo-option value="blue">Blue</neo-option>
            <neo-option value="custom">Custom</neo-option>
          </neo-select>
          <neo-color-field
            value="${color}"
            class="framework-demo-field"
            aria-label="Custom color"
            data-on:neo-color-field-change="$fw_color = evt.detail.value; $fw_src = 'color'; @post('/frameworks/accent/')"
          ></neo-color-field>
        </neo-layout>
        <neo-layout inline gap="sm" align-items="stretch" class="framework-demo-readout">
          <span class="framework-demo-swatch" style="background: ${color}" aria-hidden="true"></span>
          <neo-textinput
            mask="aaaaaa"
            prefix="#"
            value="${color}"
            aria-label="Hex color"
            data-on:neo-textinput-change="$fw_color = evt.detail.value; $fw_src = 'color'; @post('/frameworks/accent/')"
          ></neo-textinput>
        </neo-layout>
      </neo-layout>
    </div>
  </neo-card>
</div>`;
}

sim.post("/frameworks/accent/", async (ctx, sse) => {
	const s = ctx.signals || {};
	let color = String(s.fw_color ?? "#3b82f6");
	let option = String(s.fw_option ?? "blue");

	if (s.fw_src === "color") {
		// The field moved: its color is authoritative, the option follows.
		option = optionForColor(color);
	} else if (option in NAMED) {
		// A named option drives the field; "custom" keeps the color as is.
		color = NAMED[option];
	}

	sse.patchElements(render(color, option));
});
