// Server handler for the "Async lazy load" tree example. On expand of
// a `[data-tree-async]` branch, the host @posts here with the focused
// branch id on `$tree_async_node`; the handler looks up the node in
// the seeded JSON, renders its children as a fresh `<neo-tree-item>`
// subtree, and ships it as an element patch. The kit's tree observer
// rewires the new descendants into the focus / expansion model.
//
// Authoring is post-shadow-DOM: a tree-item's structure (chevron +
// animation wrapper) lives in shadow. The HTML emitted here only
// carries the author's content — a `[data-neo-tree-label]` div and
// nested `<neo-tree-item>`s as direct children.

import sim from "/static/datasim.js";

const TREE_DATA = JSON.parse(
	document.getElementById("lazy-tree-data").textContent,
);
const TREE_BY_ID = new Map();

function nodeID(prefix, path) {
	return prefix + "-" + String(path).replace(/[^A-Za-z0-9]+/g, "-");
}

function indexNode(node) {
	TREE_BY_ID.set(nodeID("lazy-tree-node", node.path), node);
	for (const child of node.children || []) indexNode(child);
}
for (const node of TREE_DATA) indexNode(node);

function esc(s) {
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function placeholder() {
	return `<neo-tree-item aria-disabled="true">` +
		`<div data-neo-tree-label style="cursor: default;">` +
		`<neo-skeleton shape="line" style="width: 8em;"></neo-skeleton>` +
		`</div></neo-tree-item>`;
}

function renderNode(node, loaded = false) {
	const id = nodeID("lazy-tree-node", node.path);
	const label = `<div data-neo-tree-label>${esc(node.label)}</div>`;
	if (!node.children || node.children.length === 0) {
		return `<neo-tree-item id="${esc(id)}" ` +
			`data-tree-path="${esc(node.path)}">${label}</neo-tree-item>`;
	}
	if (loaded) {
		let children = "";
		for (const c of node.children) children += renderNode(c);
		return `<neo-tree-item expanded id="${esc(id)}" ` +
			`data-tree-path="${esc(node.path)}">${label}${children}` +
			`</neo-tree-item>`;
	}
	return `<neo-tree-item id="${esc(id)}" ` +
		`data-tree-path="${esc(node.path)}" data-tree-async>` +
		`${label}${placeholder()}</neo-tree-item>`;
}

sim.post("/tree/loadnode/", async (ctx, sse) => {
	const id = String((ctx.signals || {}).tree_async_node || "");
	const node = TREE_BY_ID.get(id);
	if (!node) return;
	sse.patchElements(renderNode(node, true));
});
