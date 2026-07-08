// Server handler for "Tree selection". State lives here (a real server
// keeps it in a DB); on every checkbox change the client @posts the
// (key, checked) pair, the handler applies the change — branch click
// cascades to descendant leaves; ancestor branches auto-resolve from
// their leaves on each render — re-renders the whole tree fragment,
// and ships one element patch keyed by `#checkbox-tree-example`.

import sim from "/static/datasim.js";

const BRANCHES = {
	repository: ["read", "write", "staging", "production", "invoices", "plan"],
	source: ["read", "write"],
	deploy: ["staging", "production"],
	billing: ["invoices", "plan"],
};

const state = {
	read: true, write: true, staging: true,
	production: false, invoices: false, plan: false,
};

function apply(key, checked) {
	if (key in BRANCHES) {
		for (const leaf of BRANCHES[key]) state[leaf] = checked;
	} else if (key in state) {
		state[key] = checked;
	}
}

function status(key) {
	if (key in BRANCHES) {
		const leaves = BRANCHES[key];
		const n = leaves.filter((l) => state[l]).length;
		if (n === 0) return "";
		if (n === leaves.length) return "checked";
		return "indeterminate";
	}
	return state[key] ? "checked" : "";
}

function cb(key, ariaLabel) {
	const s = status(key);
	const checked = s === "checked";
	const indeterminate = s === "indeterminate";
	// Explicit true/false on every render: an omitted boolean is "no command"
	// to the morph-resilient checkbox, which then keeps its prior intent. A
	// leaf the server unchecked would re-assert its stale checked intent and
	// stay checked. Spelling out both states makes each morph authoritative.
	const aria = indeterminate ? "mixed" : String(checked);
	return `<neo-checkbox role="checkbox" tabindex="0" aria-label="${ariaLabel}" ` +
		`checked="${checked}" indeterminate="${indeterminate}" aria-checked="${aria}" ` +
		`data-on:neo-checkbox-change="$checkbox_tree_key='${key}'; $checkbox_tree_checked=evt.detail.checked; ` +
		`@post('/checkbox/tree/morph', { requestCancellation: 'disabled' })"></neo-checkbox>`;
}

const leaf = (key, label, ariaLabel) =>
	`<neo-tree-item role="treeitem" tabindex="-1">` +
	`<div data-neo-tree-label>${cb(key, ariaLabel)}<span data-neo-tree-text>${label}</span></div>` +
	`</neo-tree-item>`;

// Nested items are direct children; <neo-tree-item> renders the chevron
// and the animation wrapper in its shadow root.
const branch = (key, label, ariaLabel, children) =>
	`<neo-tree-item role="treeitem" tabindex="-1" aria-expanded="true" expanded>` +
	`<div data-neo-tree-label>${cb(key, ariaLabel)}<span data-neo-tree-text>${label}</span></div>` +
	children +
	`</neo-tree-item>`;

const render = () =>
	`<div id="checkbox-tree-example" class="checkbox-tree-example">` +
	`<neo-tree role="tree" class="checkbox-tree" aria-label="Project permissions">` +
	branch("repository", "Repository", "Repository permissions",
		branch("source", "Source", "Source permissions",
			leaf("read", "Read", "Read source") +
			leaf("write", "Write", "Write source")) +
		branch("deploy", "Deploy", "Deploy permissions",
			leaf("staging", "Staging", "Deploy staging") +
			leaf("production", "Production", "Deploy production")) +
		branch("billing", "Billing", "Billing permissions",
			leaf("invoices", "Invoices", "View invoices") +
			leaf("plan", "Plan", "Manage plan")),
	) +
	`</neo-tree>` +
	`</div>`;

sim.post("/checkbox/tree/morph", async (ctx, sse) => {
	const s = ctx.signals || {};
	const key = String(s.checkbox_tree_key || "");
	const checked = s.checkbox_tree_checked === true || s.checkbox_tree_checked === "true";
	apply(key, checked);
	sse.patchElements(render());
});
