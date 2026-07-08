import React, { useCallback, useState } from "https://esm.sh/react@19.2.7";
import { createRoot } from "https://esm.sh/react-dom@19.2.7/client";

// Ref callback that wires a Morpheus custom event to the node it lands
// on. React 19 calls the returned cleanup on unmount, so no useEffect /
// useRef: the listener's lifetime is the element's lifetime.
function useNeoEventRef(name, handle) {
	return useCallback(
		(node) => {
			if (!node) return;
			const listener = (event) => handle(event.detail);
			node.addEventListener(name, listener);
			return () => node.removeEventListener(name, listener);
		},
		[name, handle],
	);
}

// Named swatches the select offers. Any color the field lands on that
// isn't one of these resolves to "custom".
const NAMED = {
	red: "#ef4444",
	green: "#22c55e",
	blue: "#3b82f6",
};

function optionForColor(hex) {
	const lower = hex.toLowerCase();
	const name = Object.keys(NAMED).find((key) => NAMED[key] === lower);
	return name ?? "custom";
}

function ColorPicker() {
	const [color, setColor] = useState(NAMED.blue);
	const [option, setOption] = useState("blue");

	const pickOption = useCallback(({ value }) => {
		setOption(value);
		// Named options drive the field; "custom" leaves the color as is.
		if (value in NAMED) setColor(NAMED[value]);
	}, []);

	const pickColor = useCallback(({ value }) => {
		setColor(value);
		setOption(optionForColor(value));
	}, []);

	const select = useNeoEventRef("neo-select-change", pickOption);
	const field = useNeoEventRef("neo-color-field-input", pickColor);
	const hex = useNeoEventRef("neo-textinput-input", pickColor);

	return React.createElement(
		"neo-card",
		{ className: "framework-demo-card" },
		React.createElement(
			"div",
			{ "data-neo-card-inner": "" },
			React.createElement(
				"neo-layout",
				{ column: "", gap: "md", "align-items": "center" },
				React.createElement("h3", null, "Accent color"),
				React.createElement(
					"neo-layout",
					{ column: "", gap: "md", "align-items": "center" },
					React.createElement(
						"neo-select",
						{
							ref: select,
							value: option,
							"aria-label": "Named color",
							placeholder: "Pick a color",
						},
						React.createElement(
							"neo-navgroup",
							{
								orientation: "vertical",
								wrap: "",
								typeahead: "",
							},
							React.createElement("neo-option", { value: "red" }, "Red"),
							React.createElement("neo-option", { value: "green" }, "Green"),
							React.createElement("neo-option", { value: "blue" }, "Blue"),
							React.createElement("neo-option", { value: "custom" }, "Custom"),
						),
					),
					React.createElement("neo-color-field", {
						ref: field,
						value: color,
						className: "framework-demo-field",
						"aria-label": "Custom color",
					}),
				),
				React.createElement(
					"neo-layout",
					{
						inline: "",
						gap: "sm",
						"align-items": "stretch",
						className: "framework-demo-readout",
					},
					React.createElement("span", {
						className: "framework-demo-swatch",
						style: { background: color },
						"aria-hidden": "true",
					}),
					React.createElement("neo-textinput", {
						ref: hex,
						value: color,
						mask: "aaaaaa",
						prefix: "#",
						"aria-label": "Hex color",
					}),
				),
			),
		),
	);
}

const root = document.getElementById("framework-demo-root");
if (root) createRoot(root).render(React.createElement(ColorPicker));
