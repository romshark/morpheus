// <bundle-graph>: site-only custom element (not the kit). Renders a
// D3 ring from a graph declared in light DOM: each child with an id
// is a node (label = its text), `depends-on="id,..."` its outgoing
// edges. Children are data only; the shadow root has no slot.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const SVG_SIZE = 1100;
const RING_RADIUS = 350;

interface GNode {
	id: string;
	name: string;
	disabled: boolean;
	deps: string[];
	x: number;
	y: number;
	ang: number;
}

interface GLink {
	s: GNode;
	t: GNode;
}

class BundleGraph extends HTMLElement {
	#root: ShadowRoot;
	#observer?: MutationObserver;
	#raf = 0;

	constructor() {
		super();
		this.#root = this.attachShadow({ mode: "open" });
	}

	connectedCallback(): void {
		// Module script is deferred, so children are parsed before
		// upgrade. Idempotent: a re-insert rebuilds from scratch.
		this.#render();
		// Stay reactive to declarative changes (e.g. a toggle panel
		// flipping `disabled` on a node), re-rendering once per frame.
		if (!this.#observer) {
			this.#observer = new MutationObserver(() => this.#scheduleRender());
		}
		this.#observer.observe(this, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["disabled", "depends-on", "id"],
		});
	}

	disconnectedCallback(): void {
		this.#observer?.disconnect();
		cancelAnimationFrame(this.#raf);
		this.#raf = 0;
	}

	#scheduleRender(): void {
		cancelAnimationFrame(this.#raf);
		this.#raf = requestAnimationFrame(() => {
			this.#raf = 0;
			this.#render();
		});
	}

	// Edges whose target id has no node are dropped.
	#readGraph(): { nodes: GNode[]; byId: Map<string, GNode> } {
		const nodes: GNode[] = [];
		const byId = new Map<string, GNode>();
		for (const el of Array.from(this.children)) {
			if (!el.id) continue;
			const node: GNode = {
				id: el.id,
				name: (el.textContent || "").trim(),
				// Boolean attr: present = disabled, unless an explicit ="false".
				disabled: el.hasAttribute("disabled") && el.getAttribute("disabled") !== "false",
				deps: (el.getAttribute("depends-on") || "")
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
				x: 0,
				y: 0,
				ang: 0,
			};
			nodes.push(node);
			byId.set(node.id, node);
		}
		for (const node of nodes) {
			node.deps = node.deps.filter((d) => byId.has(d));
		}
		return { nodes, byId };
	}

	#render(): void {
		const { nodes, byId } = this.#readGraph();
		this.#root.replaceChildren();
		if (nodes.length === 0) return;

		const c = SVG_SIZE / 2;
		const n = nodes.length;
		nodes.forEach((node, i) => {
			// Start at the top, go clockwise.
			const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
			node.x = c + RING_RADIUS * Math.cos(ang);
			node.y = c + RING_RADIUS * Math.sin(ang);
			node.ang = ang;
		});

		const style = document.createElement("style");
		style.textContent = BundleGraph.#css;
		this.#root.append(style);

		const svg = d3
			.select(this.#root)
			.append("svg")
			.attr("class", "bundle-svg")
			.attr("viewBox", `0 0 ${SVG_SIZE} ${SVG_SIZE}`)
			.attr("role", "img")
			.attr(
				"aria-label",
				"Morpheus component dependency graph. Each component " +
					"name connects by a curved line to the components it " +
					"depends on. Focus a name to highlight its dependencies.",
			);

		const linkLayer = svg.append("g").attr("class", "links");
		const nodeLayer = svg.append("g").attr("class", "nodes");

		const links: GLink[] = [];
		for (const s of nodes) {
			for (const tid of s.deps) {
				const t = byId.get(tid);
				if (t) links.push({ s, t });
			}
		}

		// Quadratic curve whose control point is pulled toward the
		// center, so edges bundle inward instead of cutting straight.
		const linkPath = (s: GNode, t: GNode): string => {
			const mx = (s.x + t.x) / 2;
			const my = (s.y + t.y) / 2;
			const k = 0.72;
			const cxp = mx + (c - mx) * k;
			const cyp = my + (c - my) * k;
			return `M${s.x},${s.y}Q${cxp},${cyp} ${t.x},${t.y}`;
		};

		const linkSel = linkLayer
			.selectAll("path")
			.data(links)
			.join("path")
			// Either endpoint disabled = a broken/excluded link.
			.attr("class", (d: GLink) => (d.s.disabled || d.t.disabled ? "link is-disabled" : "link"))
			.attr("d", (d: GLink) => linkPath(d.s, d.t));

		const nodeSel = nodeLayer
			.selectAll("g")
			.data(nodes)
			.join("g")
			.attr("class", (d: GNode) => (d.disabled ? "node is-disabled" : "node"))
			// Disabled host leaves the tab order (CLAUDE.md a11y rule).
			.attr("tabindex", (d: GNode) => (d.disabled ? -1 : 0))
			.attr("role", "img")
			.attr("aria-disabled", (d: GNode) => (d.disabled ? "true" : null))
			.attr("aria-label", (d: GNode) => {
				const base = d.deps.length
					? `${d.name}, depends on ${d.deps.map((id) => byId.get(id)?.name).join(", ")}`
					: `${d.name}, no component dependencies`;
				return d.disabled ? `${base}, disabled` : base;
			})
			.attr("transform", (d: GNode) => `translate(${d.x},${d.y})`);

		nodeSel.append("circle").attr("class", "node-dot").attr("r", 4);

		nodeSel
			.append("text")
			.attr("class", "node-label")
			.attr("dy", "0.32em")
			.text((d: GNode) => d.name)
			.each(function (this: SVGTextElement, d: GNode) {
				// Lay labels radially; flip the left half so text
				// stays upright and reads outward from the ring.
				const onRight = Math.cos(d.ang) >= 0;
				const deg = (d.ang * 180) / Math.PI + (onRight ? 0 : 180);
				d3.select(this)
					.attr("x", onRight ? 12 : -12)
					.attr("text-anchor", onRight ? "start" : "end")
					.attr("transform", `rotate(${deg})`);
			});

		// Optional focal label drawn last so it sits on top of the
		// ring. Decorative (aria-hidden): the count is stated in page
		// copy, and pointer-events:none keeps hover working through it.
		const centerLabel = this.getAttribute("center-label");
		if (centerLabel) {
			const [head, ...rest] = centerLabel.split(" ");
			const tail = rest.join(" ");
			const center = svg
				.append("g")
				.attr("class", "center")
				.attr("aria-hidden", "true")
				.attr("transform", `translate(${c},${c})`);
			center
				.append("text")
				.attr("class", "center-head")
				.attr("text-anchor", "middle")
				.attr("dy", tail ? "-0.05em" : "0.35em")
				.text(head);
			if (tail) {
				center.append("text").attr("class", "center-tail").attr("text-anchor", "middle").attr("dy", "1.5em").text(tail);
			}
		}

		// Light up every edge touching the node: outgoing (what it
		// depends on) and incoming (parents that depend on it), so a
		// leaf like [data-neo-toast] still shows its neo-toaster link.
		const activate = (node: GNode): void => {
			// Disabled items are inert: they never become the source.
			if (node.disabled) return;
			const related = new Set<string>([node.id]);
			for (const l of links) {
				if (l.s.id === node.id) related.add(l.t.id);
				else if (l.t.id === node.id) related.add(l.s.id);
			}
			svg.classed("is-hovering", true);
			nodeSel.classed("is-active", (d: GNode) => related.has(d.id)).classed("is-dim", (d: GNode) => !related.has(d.id));
			linkSel.classed("is-active", (d: GLink) => d.s.id === node.id || d.t.id === node.id);
		};
		const reset = (): void => {
			svg.classed("is-hovering", false);
			nodeSel.classed("is-active", false).classed("is-dim", false);
			linkSel.classed("is-active", false);
		};

		nodeSel
			.on("mouseenter", (_: Event, d: GNode) => activate(d))
			.on("mouseleave", reset)
			.on("focus", (_: Event, d: GNode) => activate(d))
			.on("blur", reset);

		// Touch dial: no hover on touch, so a finger dragged on the ring
		// scrubs selection by bearing from center: the angularly nearest
		// node lights up, no need to hit the small label. Lift resets.
		const norm = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
		const nodeAtTouch = (touch: Touch): GNode | null => {
			const [px, py] = d3.pointer(touch, svg.node());
			// A tap near the dead center has no stable bearing.
			if (Math.hypot(px - c, py - c) < 40) return null;
			const ang = Math.atan2(py - c, px - c);
			let best: GNode | null = null;
			let bestD = Infinity;
			for (const nd of nodes) {
				// Dial skips disabled slots, snapping to the next live one.
				if (nd.disabled) continue;
				const d = Math.abs(norm(ang - nd.ang));
				if (d < bestD) {
					bestD = d;
					best = nd;
				}
			}
			return best;
		};
		const scrub = (event: TouchEvent): void => {
			// Owns the gesture: block scroll/zoom and the emulated
			// mouse/hover events that would fight the touch state.
			event.preventDefault();
			const touch = event.touches[0] || event.changedTouches[0];
			if (!touch) return;
			const node = nodeAtTouch(touch);
			if (node) activate(node);
		};
		svg
			.on("touchstart", scrub)
			.on("touchmove", scrub)
			.on("touchend", (event: TouchEvent) => {
				event.preventDefault();
				reset();
			})
			.on("touchcancel", reset);
	}

	// Theme custom properties pierce the shadow boundary, so the
	// graph tracks the site palette without extra wiring.
	static #css = `
		:host {
			display: block;
			width: 100%;
			max-width: 56rem;
			margin: 0 auto;
		}
		.bundle-svg {
			width: 100%;
			height: auto;
			display: block;
			overflow: visible;
			/* The whole ring is a touch dial; don't let the browser
			 * hijack the drag for page scroll/zoom. */
			touch-action: none;
		}
		.link {
			fill: none;
			stroke: var(--muted);
			stroke-width: 1;
			opacity: 0.16;
			transition: opacity .15s, stroke .15s, stroke-width .15s;
		}
		.node-dot {
			fill: var(--muted);
			opacity: .55;
			transition: fill .15s, opacity .15s;
		}
		.node-label {
			fill: var(--page-fg);
			font-family: var(--page-font-family, ui-sans-serif, system-ui, sans-serif);
			font-size: 15px;
			font-weight: 600;
			cursor: default;
			transition: fill .15s, opacity .15s;
		}
		.center { pointer-events: none; }
		.center-head {
			fill: var(--page-fg);
			font-family: var(--page-font-family, ui-sans-serif, system-ui, sans-serif);
			font-weight: 800;
			font-size: 88px;
		}
		.center-tail {
			fill: var(--muted);
			font-family: var(--page-font-family, ui-sans-serif, system-ui, sans-serif);
			font-weight: 600;
			font-size: 30px;
			letter-spacing: .12em;
			text-transform: uppercase;
		}
		.node { outline: none; }
		.node:focus-visible .node-label {
			text-decoration: underline;
			text-underline-offset: 3px;
		}
		.bundle-svg.is-hovering .link { opacity: .04; }
		.bundle-svg .link.is-active {
			opacity: .9;
			stroke: var(--accent, var(--link));
			stroke-width: 1.6;
		}
		.bundle-svg.is-hovering .node.is-dim .node-label { opacity: .22; }
		.bundle-svg.is-hovering .node.is-dim .node-dot { opacity: .12; }
		.bundle-svg.is-hovering .node.is-active .node-label {
			fill: var(--accent, var(--link));
			opacity: 1;
		}
		.bundle-svg.is-hovering .node.is-active .node-dot {
			fill: var(--accent, var(--link));
			opacity: 1;
		}
		/* Disabled wins over is-active/is-dim: the extra .is-disabled
		 * class on the hovering selectors outranks the active rules
		 * above, and the base rule sits after them in source order. */
		.bundle-svg .node.is-disabled .node-label,
		.bundle-svg.is-hovering .node.is-disabled.is-active .node-label,
		.bundle-svg.is-hovering .node.is-disabled.is-dim .node-label {
			fill: var(--muted);
			opacity: .45;
			cursor: not-allowed;
			text-decoration: line-through;
			text-decoration-thickness: 1px;
		}
		.bundle-svg .node.is-disabled .node-dot,
		.bundle-svg.is-hovering .node.is-disabled.is-active .node-dot,
		.bundle-svg.is-hovering .node.is-disabled.is-dim .node-dot {
			fill: none;
			stroke: var(--muted);
			stroke-width: 1;
			opacity: .5;
		}
		.bundle-svg .link.is-disabled {
			stroke-dasharray: 4 4;
			opacity: .1;
		}
		.bundle-svg .link.is-disabled.is-active {
			stroke: var(--muted);
			stroke-width: 1.2;
			opacity: .45;
		}
		@media (prefers-reduced-motion: reduce) {
			.link, .node-label, .node-dot { transition: none; }
		}
		@media (forced-colors: active) {
			.node-label, .center-head { fill: CanvasText; }
			.center-tail { fill: GrayText; }
			.link { stroke: GrayText; }
			.bundle-svg .node.is-disabled .node-label,
			.bundle-svg.is-hovering .node.is-disabled.is-active .node-label {
				fill: GrayText;
			}
			.bundle-svg .node.is-disabled .node-dot { stroke: GrayText; }
			.bundle-svg .link.is-disabled { stroke: GrayText; }
			.bundle-svg .link.is-active,
			.bundle-svg.is-hovering .node.is-active .node-label,
			.bundle-svg.is-hovering .node.is-active .node-dot {
				stroke: Highlight;
				fill: Highlight;
			}
		}
	`;
}

if (!customElements.get("bundle-graph")) {
	customElements.define("bundle-graph", BundleGraph);
}
