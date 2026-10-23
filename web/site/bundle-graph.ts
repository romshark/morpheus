// <bundle-graph> draws a D3 ring of the graph its light DOM declares.
// Each child with an id is a node labeled by its text, and depends-on="id,..."
// lists its edges. Children are data, not slotted. Site-only entry for
// min/bundle_graph.js on the landing page.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import css from "./bundle-graph.css";

const SVG_SIZE = 1100;
const RING_RADIUS = 350;

interface GNode {
	id: string;
	name: string;
	disabled: boolean;
	deps: GNode[];
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
		// The children exist at upgrade because the module is deferred.
		// A re-insert rebuilds.
		this.#render();
		// Re-renders when the children change, at most 1 time per frame.
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

	// A depends-on id that names no node is dropped.
	#readGraph(): GNode[] {
		const els = Array.from(this.children).filter((el) => el.id);
		const nodes = els.map(
			(el): GNode => ({
				id: el.id,
				name: (el.textContent || "").trim(),
				disabled: el.hasAttribute("disabled") && el.getAttribute("disabled") !== "false",
				deps: [],
				x: 0,
				y: 0,
				ang: 0,
			}),
		);
		const byId = new Map(nodes.map((node) => [node.id, node]));
		els.forEach((el, i) => {
			nodes[i].deps = (el.getAttribute("depends-on") || "").split(",").flatMap((id) => byId.get(id.trim()) ?? []);
		});
		return nodes;
	}

	#render(): void {
		const nodes = this.#readGraph();
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
		style.textContent = css;
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

		const links: GLink[] = nodes.flatMap((s) => s.deps.map((t) => ({ s, t })));

		// Pulls the control point toward the center, which curves the edges inward.
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
			.attr("class", (d: GLink) => (d.s.disabled || d.t.disabled ? "link is-disabled" : "link"))
			.attr("d", (d: GLink) => linkPath(d.s, d.t));

		const nodeSel = nodeLayer
			.selectAll("g")
			.data(nodes)
			.join("g")
			.attr("class", (d: GNode) => (d.disabled ? "node is-disabled" : "node"))
			.attr("tabindex", (d: GNode) => (d.disabled ? -1 : 0))
			.attr("role", "img")
			.attr("aria-disabled", (d: GNode) => (d.disabled ? "true" : null))
			.attr("aria-label", (d: GNode) => {
				const base = d.deps.length
					? `${d.name}, depends on ${d.deps.map((t) => t.name).join(", ")}`
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
				// Radial labels; the left half flips to stay upright.
				const onRight = Math.cos(d.ang) >= 0;
				const deg = (d.ang * 180) / Math.PI + (onRight ? 0 : 180);
				d3.select(this)
					.attr("x", onRight ? 12 : -12)
					.attr("text-anchor", onRight ? "start" : "end")
					.attr("transform", `rotate(${deg})`);
			});

		// Drawn last, on top. Decorative because the page states the count.
		// pointer-events: none keeps hover working through it.
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

		// Highlights edges in both directions. A leaf such as neo-toast still
		// shows its neo-toaster link.
		const activate = (node: GNode): void => {
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

		// Touch has no hover. A touch on the ring highlights the node nearest
		// its angle from the center, without hitting the small label.
		// Lifting resets.
		const norm = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
		const nodeAtTouch = (touch: Touch): GNode | null => {
			const [px, py] = d3.pointer(touch, svg.node());
			// A tap near the dead center has no stable bearing.
			if (Math.hypot(px - c, py - c) < 40) return null;
			const ang = Math.atan2(py - c, px - c);
			let best: GNode | null = null;
			let bestD = Infinity;
			for (const nd of nodes) {
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
			// Blocks scroll, zoom and emulated mouse events,
			// which would interfere with touch selection.
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
}

if (!customElements.get("bundle-graph")) {
	customElements.define("bundle-graph", BundleGraph);
}
