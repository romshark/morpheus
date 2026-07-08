// Author writes the full trail in light DOM; the component redistributes
// those nodes at runtime, collapsing middle items into an overflow popover
// at narrow widths. Menu items are clones with aria-current stripped so the
// active-page styling stays on the still-visible item.

import "../neo-button";
import "../neo-icon";
import "../neo-navgroup";
import "../neo-popover";

const POPOVER_ATTRS = [
	"placement",
	"screen-offset",
	"follow-scroll",
	"clamp-placement",
	"min-fit-height",
	"min-fit-width",
	"min-open-height",
	"min-open-width",
] as const;

type PopoverAttr = (typeof POPOVER_ATTRS)[number];

const BOOLEAN_POPOVER_ATTRS = new Set<PopoverAttr>(["clamp-placement"]);

export class NeoBreadcrumb extends HTMLElement {
	static readonly observedAttributes = [...POPOVER_ATTRS];

	// All authored children in source order; the adapter hides/shows them.
	#trailNodes: HTMLElement[] = [];
	// Items only, used for menu cloning and the index math deciding
	// which separators sit between hidden items.
	#itemNodes: HTMLElement[] = [];
	#resizeObserver: ResizeObserver | null = null;
	#hostObserver: MutationObserver | null = null;
	#rebuilding = false;
	#overflowPopover: HTMLElement | null = null;
	// Cached navgroup inside overflowPopover.
	#overflowNavgroup: HTMLElement | null = null;
	// Signature of currently-rendered hidden items. Lets us reuse the
	// popover across adapt() / morph cycles when the set is unchanged;
	// otherwise open/focus/scroll state is lost on every cycle.
	#overflowItemsKey: string | null = null;
	// Cloned boundary separators inserted around the overflow popover.
	#overflowSeparators: HTMLElement[] = [];
	// Boundary-separator clones keyed by their source separator. A fresh
	// cloneNode drops the source's shadow DOM, so a separator's <neo-icon>
	// re-renders async (one blank frame); recreating clones on every resize
	// tick leaves the boundary chevrons perpetually blank mid-drag. Reusing
	// the cached clone keeps its rendered icon. Cleared on re-capture, when
	// the authored separators (the clone sources) may be new nodes.
	#overflowSepClones = new Map<HTMLElement, HTMLElement>();
	#renderedSnapshot: Node[] = [];
	#lastPartition: string | null = null;
	// True while the generated overflow trigger holds focus. A fat morph
	// strips the popover (no SSR counterpart), blurring it to <body>;
	// checkForReset re-inserts the cached instance and hands focus back.
	#overflowHadFocus = false;

	connectedCallback() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "navigation");
		if (!this.hasAttribute("aria-label")) {
			this.setAttribute("aria-label", "Breadcrumb");
		}

		this.#captureChildren();
		this.#adapt();

		// Self catches shrinking; an ancestor catches growing. When
		// collapsed, our own width doesn't change as the container gains
		// room. The ancestor must generate a box: a `display:contents`
		// wrapper produces none, so a ResizeObserver on it never fires;
		// climb past them.
		this.#resizeObserver = new ResizeObserver(() => this.#adapt());
		this.#resizeObserver.observe(this);
		const growthAncestor = this.#growthAncestor();
		if (growthAncestor) {
			this.#resizeObserver.observe(growthAncestor);
		}

		// Detect a Datastar fat-morph reinstating authored items fresh.
		this.#hostObserver = new MutationObserver(() => this.#checkForReset());
		this.#hostObserver.observe(this, { childList: true });

		this.addEventListener("focusin", this.#onOverflowFocusIn);
		this.addEventListener("focusout", this.#onOverflowFocusOut);
	}

	disconnectedCallback() {
		this.#resizeObserver?.disconnect();
		this.#resizeObserver = null;
		this.#hostObserver?.disconnect();
		this.#hostObserver = null;
		this.removeEventListener("focusin", this.#onOverflowFocusIn);
		this.removeEventListener("focusout", this.#onOverflowFocusOut);
	}

	attributeChangedCallback(name: PopoverAttr) {
		if (!this.#overflowPopover) return;
		this.#syncOverflowPopoverAttr(this.#overflowPopover, name);
	}

	// Nearest ancestor that generates a layout box. `display:contents`
	// ancestors produce no box (a ResizeObserver on them never fires),
	// so they can't report the available width growing, so skip them.
	#growthAncestor(): Element | null {
		let el = this.parentElement;
		while (el && getComputedStyle(el).display === "contents") {
			el = el.parentElement;
		}
		return el;
	}

	#checkForReset() {
		if (this.#rebuilding) return;
		if (!this.#divergedFromSnapshot()) return;
		this.#rebuilding = true;
		try {
			this.#captureChildren();
			this.#adapt();
			this.#restoreOverflowFocusIfLost();
		} finally {
			this.#rebuilding = false;
		}
	}

	#overflowTrigger(): HTMLElement | null {
		return this.#overflowPopover?.querySelector<HTMLElement>("[data-neo-popover-trigger]") ?? null;
	}

	// After adapt() re-inserts the overflow popover, hand focus back to the
	// trigger if the morph blurred it to <body>. No-op when the trail no
	// longer collapses (popover detached) or the user moved focus away.
	#restoreOverflowFocusIfLost() {
		if (!this.#overflowHadFocus) return;
		const ae = document.activeElement;
		if (ae && ae !== document.body) return;
		const trigger = this.#overflowTrigger();
		if (trigger && this.contains(trigger)) trigger.focus();
	}

	#onOverflowFocusIn = (e: FocusEvent) => {
		this.#overflowHadFocus = this.#overflowPopover?.contains(e.target as Node | null) ?? false;
	};

	#onOverflowFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.#overflowPopover?.contains(next)) return;
		if (next) {
			this.#overflowHadFocus = false;
			return;
		}
		// Blur to nothing: a morph stripping the popover (checkForReset
		// refocuses first, same microtask checkpoint) or a real click-away /
		// Escape. If focus stays gone after that, it was the user.
		queueMicrotask(() => {
			if (this.#overflowPopover?.contains(document.activeElement)) return;
			this.#overflowHadFocus = false;
		});
	};

	#divergedFromSnapshot(): boolean {
		const live = this.children;
		if (live.length !== this.#renderedSnapshot.length) return true;
		for (let i = 0; i < live.length; i++) {
			if (live[i] !== this.#renderedSnapshot[i]) return true;
		}
		return false;
	}

	// Snapshot authored children, ignoring our generated popover/seps so
	// re-capture rebuilds against freshly authored nodes only.
	#captureChildren() {
		// Drop stale clones: a re-capture means the authored separators they
		// were cloned from may be new nodes (e.g. after a fat morph).
		this.#overflowSepClones.clear();
		this.#trailNodes = Array.from(this.children).filter((c) => {
			const el = c as HTMLElement;
			return !el.hasAttribute("data-neo-breadcrumb-menu") && !el.hasAttribute("data-neo-breadcrumb-generated-sep");
		}) as HTMLElement[];
		this.#itemNodes = this.#trailNodes.filter((el) => !el.hasAttribute("data-neo-breadcrumb-sep"));
	}

	#setHidden(node: HTMLElement, hidden: boolean) {
		if (hidden) node.setAttribute("data-neo-breadcrumb-hidden", "");
		else node.removeAttribute("data-neo-breadcrumb-hidden");
	}

	// Idempotent: build once, reuse across adapt / morph cycles so
	// open/focus/scroll state survives. syncOverflowItems replaces the
	// menu rows in place.
	#ensureOverflowMenu(): HTMLElement {
		if (this.#overflowPopover) return this.#overflowPopover;
		const popover = document.createElement("neo-popover");
		popover.setAttribute("data-neo-breadcrumb-menu", "");
		for (const attr of POPOVER_ATTRS) {
			this.#syncOverflowPopoverAttr(popover, attr);
		}

		const trigger = document.createElement("neo-button");
		trigger.setAttribute("data-neo-popover-trigger", "");
		trigger.setAttribute("aria-label", "Show hidden breadcrumbs");
		const icon = document.createElement("neo-icon");
		icon.setAttribute("name", "more-horizontal");
		trigger.appendChild(icon);
		popover.appendChild(trigger);

		const content = document.createElement("div");
		content.setAttribute("data-neo-popover-content", "");

		const navgroup = document.createElement("neo-navgroup");
		navgroup.setAttribute("orientation", "vertical");
		navgroup.setAttribute("wrap", "");
		navgroup.setAttribute("role", "menu");

		content.appendChild(navgroup);
		popover.appendChild(content);

		this.#overflowPopover = popover;
		this.#overflowNavgroup = navgroup;
		return popover;
	}

	// Skips the rebuild when the hidden set is unchanged (key match)
	// so the existing menu DOM and its focus survive.
	#syncOverflowItems(items: readonly HTMLElement[], key: string) {
		if (this.#overflowItemsKey === key && this.#overflowNavgroup) return;
		if (!this.#overflowNavgroup) return;
		this.#overflowItemsKey = key;
		const navgroup = this.#overflowNavgroup;
		navgroup.replaceChildren();
		for (const item of items) {
			const clone = item.cloneNode(true) as HTMLElement;
			clone.setAttribute("data-neo-navgroup-item", "");
			clone.removeAttribute("aria-current");
			navgroup.appendChild(clone);
		}
	}

	#syncOverflowPopoverAttr(popover: HTMLElement, attr: PopoverAttr) {
		if (BOOLEAN_POPOVER_ATTRS.has(attr)) {
			if (this.hasAttribute(attr)) popover.setAttribute(attr, "");
			else popover.removeAttribute(attr);
			return;
		}
		const value = this.getAttribute(attr);
		if (value === null) popover.removeAttribute(attr);
		else popover.setAttribute(attr, value);
	}

	#renderFull() {
		// Detach but keep the JS reference: every adaptInternal() pass
		// calls renderFull, and dropping the instance would lose open /
		// focus / scroll state on each cycle. renderHidden re-attaches it.
		if (this.#overflowPopover) this.#overflowPopover.remove();
		for (const sep of this.#overflowSeparators) sep.remove();
		this.#overflowSeparators = [];
		for (const node of this.#trailNodes) this.#setHidden(node, false);
	}

	#separatorBeforeItem(itemIndex: number): HTMLElement | null {
		const item = this.#itemNodes[itemIndex];
		const idx = this.#trailNodes.indexOf(item);
		if (idx > 0) {
			const prev = this.#trailNodes[idx - 1];
			if (prev.hasAttribute("data-neo-breadcrumb-sep")) return prev;
		}
		return null;
	}

	#separatorAfterItem(itemIndex: number): HTMLElement | null {
		const item = this.#itemNodes[itemIndex];
		const idx = this.#trailNodes.indexOf(item);
		if (idx >= 0 && idx < this.#trailNodes.length - 1) {
			const next = this.#trailNodes[idx + 1];
			if (next.hasAttribute("data-neo-breadcrumb-sep")) return next;
		}
		return null;
	}

	#cloneSeparator(source: HTMLElement | null): HTMLElement | null {
		if (!source) return null;
		let clone = this.#overflowSepClones.get(source);
		if (!clone) {
			clone = source.cloneNode(true) as HTMLElement;
			clone.removeAttribute("data-neo-breadcrumb-hidden");
			clone.setAttribute("data-neo-breadcrumb-generated-sep", "");
			this.#overflowSepClones.set(source, clone);
		}
		return clone;
	}

	// Hide items[hiddenStart..hiddenEnd) and the separators touching
	// that run; insert the overflow popover with cloned boundary
	// separators at the run's original position.
	#renderHidden(hiddenStart: number, hiddenEnd: number) {
		const items = this.#itemNodes;
		const n = items.length;
		if (hiddenStart >= hiddenEnd) {
			this.#renderFull();
			return;
		}
		const itemHidden = new Array(n).fill(false);
		for (let i = hiddenStart; i < hiddenEnd; i++) itemHidden[i] = true;

		let curItem = 0;
		let prevItem = -1;
		for (const node of this.#trailNodes) {
			if (node.hasAttribute("data-neo-breadcrumb-sep")) {
				const next = curItem;
				const touchesHidden = (prevItem >= 0 && itemHidden[prevItem]) || (next < n && itemHidden[next]);
				this.#setHidden(node, touchesHidden);
			} else {
				this.#setHidden(node, itemHidden[curItem]);
				prevItem = curItem;
				curItem++;
			}
		}

		const hiddenItems = items.slice(hiddenStart, hiddenEnd);
		const newKey = hiddenItems.map((it) => breadcrumbId(it) ?? it.outerHTML).join("");
		for (const sep of this.#overflowSeparators) sep.remove();
		this.#overflowSeparators = [];

		// One popover for the host's lifetime; may be detached (renderFull
		// ran, or a morph stripped it), and insertBefore below re-attaches it.
		const popover = this.#ensureOverflowMenu();
		this.#syncOverflowItems(hiddenItems, newKey);
		if (this.contains(popover)) popover.remove();
		const before = this.#cloneSeparator(hiddenStart > 0 ? this.#separatorAfterItem(hiddenStart - 1) : null);
		const after = this.#cloneSeparator(hiddenEnd < n ? this.#separatorBeforeItem(hiddenEnd) : null);
		this.#overflowSeparators = [before, after].filter((sep): sep is HTMLElement => sep !== null);

		const anchor = items[hiddenStart];
		if (before) this.insertBefore(before, anchor);
		if (this.#overflowPopover) this.insertBefore(this.#overflowPopover, anchor);
		if (after) this.insertBefore(after, anchor);
	}

	#adapt() {
		try {
			this.#adaptInternal();
		} finally {
			this.#renderedSnapshot = Array.from(this.children);
		}
		this.#emitChange();
	}

	// adapt() runs on every resize/mutation; dedupe so listeners get an
	// event only when the visible/collapsed split actually changed.
	#emitChange() {
		const shown: string[] = [];
		const hidden: string[] = [];
		for (const item of this.#itemNodes) {
			const id = breadcrumbId(item);
			if (id === null) continue;
			const collapsed = item.hasAttribute("data-neo-breadcrumb-hidden");
			(collapsed ? hidden : shown).push(id);
		}
		const signature = JSON.stringify([shown, hidden]);
		if (signature === this.#lastPartition) return;
		this.#lastPartition = signature;
		this.dispatchEvent(
			new CustomEvent("neo-breadcrumb-change", {
				bubbles: true,
				detail: { shown, hidden },
			}),
		);
	}

	// Pick the densest layout that fits in clientWidth. Start full so
	// flex reveals the parent's true available width (a collapsed
	// host's clientWidth is tied to its tiny content), then iterate
	// toward "menu + last", stopping at the first config that fits.
	#adaptInternal() {
		const n = this.#itemNodes.length;
		if (n <= 1) {
			this.#renderFull();
			return;
		}

		this.#renderFull();
		if (!this.clientWidth) return;
		if (this.scrollWidth <= this.clientWidth) return;

		// Collapsed configs (head + popover + tail), preferring more tail
		// visible. Need n ≥ 3 for a non-trivial menu.
		if (n >= 3) {
			for (let tail = n - 2; tail >= 1; tail--) {
				this.#renderHidden(1, n - tail);
				if (this.scrollWidth <= this.clientWidth) return;
			}
		}

		this.#renderHidden(0, n - 1);
	}
}

// null ⇒ untrackable, so omitted from the change event.
function breadcrumbId(item: HTMLElement): string | null {
	return item.id || null;
}

if (!customElements.get("neo-breadcrumb")) {
	customElements.define("neo-breadcrumb", NeoBreadcrumb);
}
