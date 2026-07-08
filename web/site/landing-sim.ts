// In-browser simulator handlers for the landing page. Pins the
// simulator to no-friction so the landing never inherits the
// docs-site latency / error settings.

import simDefault from "/static/datasim.js";

// Minimal shape of the subset of the datasim API this page uses. The
// module itself is kept external by the build (see web/build.mjs) and
// served separately at /static/datasim.js.
interface SimContext {
	params: Record<string, string>;
	// Datastar signals sent with the request (e.g. the bound query field).
	signals?: Record<string, unknown>;
}
interface SimSSE {
	patchSignals(signals: Record<string, number>): void;
	patchElements(html: string): void;
	delay(ms: number): Promise<void>;
}
interface Sim {
	setLatency(minMs: number, maxMs?: number): void;
	setHandlerDelay(ms: number): void;
	setUnreachable(unreachable: boolean): void;
	setErrorResponse(html: string): void;
	post(path: string, handler: (ctx: SimContext, sse: SimSSE) => void | Promise<void>): void;
}

const sim = simDefault as Sim;

sim.setLatency(0, 0);
sim.setHandlerDelay(0);
sim.setUnreachable(false);
sim.setErrorResponse("");

const EQ_PRESETS: Record<string, Record<string, number>> = {
	flat: {
		_lf_eq_60: 0,
		_lf_eq_170: 0,
		_lf_eq_310: 0,
		_lf_eq_600: 0,
		_lf_eq_1k: 0,
		_lf_eq_3k: 0,
		_lf_eq_6k: 0,
		_lf_eq_12k: 0,
		_lf_eq_14k: 0,
		_lf_eq_16k: 0,
	},
	bass: {
		_lf_eq_60: 9,
		_lf_eq_170: 7,
		_lf_eq_310: 4,
		_lf_eq_600: 1,
		_lf_eq_1k: -1,
		_lf_eq_3k: -2,
		_lf_eq_6k: -2,
		_lf_eq_12k: -3,
		_lf_eq_14k: -4,
		_lf_eq_16k: -5,
	},
	studio: {
		_lf_eq_60: 4,
		_lf_eq_170: 2,
		_lf_eq_310: -1,
		_lf_eq_600: 0,
		_lf_eq_1k: 1,
		_lf_eq_3k: 3,
		_lf_eq_6k: 5,
		_lf_eq_12k: 4,
		_lf_eq_14k: 2,
		_lf_eq_16k: -2,
	},
};

sim.post("/lf-eq/preset/:name/", async (ctx, sse) => {
	const preset = ctx.params.name || "studio";
	sse.patchSignals(EQ_PRESETS[preset] || EQ_PRESETS.studio);
});

// Fat-morph demo: replay the templ-baked
// <template id="lf-how-section-stage-{2,3}"> payloads. Idiomorph
// matches by id, so the live <section id="lf-how-section"> rebuilds
// in place.
const stageHTML = (id: string): string => {
	const tpl = document.getElementById(id);
	return tpl ? tpl.innerHTML.trim() : "";
};

sim.post("/lf-select/options/", async (_ctx, sse) => {
	await sse.delay(500);
	sse.patchElements(stageHTML("lf-how-section-stage-2"));
});

sim.post("/lf-select/reset/", async (_ctx, sse) => {
	sse.patchElements(stageHTML("lf-how-section-stage-3"));
});

// Collapse-all: clone #lf-tree with `expanded` stripped and patch it
// back. Morph-by-id preserves per-item state; only the toggled
// `expanded` changes, which the component animates.
sim.post("/lf-tree/collapse/", async (_ctx, sse) => {
	const tree = document.getElementById("lf-tree");
	if (!tree) return;
	const clone = tree.cloneNode(true) as HTMLElement;
	for (const item of clone.querySelectorAll("neo-tree-item[expanded]")) {
		item.removeAttribute("expanded");
		if (item.hasAttribute("aria-expanded")) {
			item.setAttribute("aria-expanded", "false");
		}
	}
	sse.patchElements(clone.outerHTML);
});

// Server-driven suggestions for the search field above the release list.
// Filters a small release-themed list by the bound lf_search_q signal and
// morphs matches as <neo-option> rows into the suggestions slot (matched by
// id). No query → empty container (popover closes); no match → a status row.
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const RELEASE_SUGGESTIONS = [
	"Open Release Notes",
	"release-2026.05.txt",
	"Release pipeline settings",
	"Changelog 2026.05",
	"Tag version v2026.06",
	"#releases channel",
	"Draft release v2026.06",
	"Pipeline status",
	"Rollback last release",
];

sim.post("/lf-search/suggest/", async (ctx, sse) => {
	const raw = String(ctx.signals?.lf_search_q ?? "");
	const q = raw.trim().toLowerCase();
	const matches = q ? RELEASE_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q)).slice(0, 6) : [];
	let body: string;
	if (q && matches.length === 0) {
		body = `<div data-neo-empty-results>No matches for "${esc(raw.trim())}". Try release, changelog, tag, pipeline, or channel.</div>`;
	} else {
		body = matches.map((s) => `<neo-option value="${esc(s)}">${esc(s)}</neo-option>`).join("");
	}
	sse.patchElements(`<neo-datalist id="lf-search-suggestions" slot="suggestions">${body}</neo-datalist>`);
});
