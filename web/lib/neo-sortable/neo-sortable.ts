// Items stay in light DOM (the morph reconciles them); the live-region
// announcer lives in shadow so a morph can't strip it. The drag placeholder
// is light-DOM because it must occupy a flow slot, but it's transient
// (pointerdown to drop). External patch animations require
// prepareReorderPatch() pre-morph.

import { boolAttr } from "../command";
import { removeAttrIfPresent, setAttrIfChanged } from "../neo-morph-resilient";

type Orientation = "vertical" | "horizontal" | "grid";

const SHADOW_TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - [data-neo-sortable-live]: visually-hidden keyboard-reorder announcer.
//   Not aria-hidden, AT must read it. In shadow so morph can't strip it.
SHADOW_TEMPLATE.innerHTML = `
<style>
  :host { display: block; }
  :host([hidden]) { display: none; }
  [data-neo-sortable-live] {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
<slot></slot>
<div data-neo-sortable-live aria-live="assertive" aria-atomic="true"></div>
`;

const ORIENTATIONS: readonly Orientation[] = ["vertical", "horizontal", "grid"] as const;

const DRAG_THRESHOLD = 4;

// Whole-item grips must not steal native control gestures.
const INTERACTIVE =
	"a[href], button, input, select, textarea, label," + " [contenteditable], [data-neo-sortable-nodrag]";

interface PointerDrag {
	pointerId: number;
	item: HTMLElement;
	placeholder: HTMLElement;
	proxy: HTMLElement | null;
	pressX: number;
	pressY: number;
	grabX: number;
	grabY: number;
	homeLeft: number;
	homeTop: number;
	// Floating-element size captured at promote; the bounds-clamp uses it.
	w: number;
	h: number;
	savedCss: string;
	// Last float position from #onPointerMove. Re-applied by the
	// reconcile path after a no-op morph strips d.item's inline style.
	lastLeft: number;
	lastTop: number;
	// Latest pointer position. The auto-scroll tick re-runs the hit-test
	// with it after a programmatic scroll slides siblings under an
	// otherwise stationary pointer.
	lastClientX: number;
	lastClientY: number;
	// Scrollable ancestors captured at promote; edge auto-scroll pans
	// them so the lifted item can reach off-screen slots.
	scrollers: HTMLElement[];
	startIndex: number;
	lastIndex: number;
	startOrderEls: HTMLElement[];
	startOrder: string[];
	// id → trimmed textContent at drag start. Compared against the
	// post-morph state to decide keep-dragging vs abort.
	startContent: ReadonlyMap<string, string>;
	active: boolean;
}

interface KeyboardDrag {
	item: HTMLElement;
	startIndex: number;
	lastIndex: number;
	startOrderEls: HTMLElement[];
	startOrder: string[];
	startContent: ReadonlyMap<string, string>;
}

interface LayoutSnapshot {
	byEl: ReadonlyMap<HTMLElement, { id: string; rect: DOMRectReadOnly }>;
	byId: ReadonlyMap<string, DOMRectReadOnly>;
	order: readonly string[];
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

export class NeoSortable extends HTMLElement {
	static readonly observedAttributes = ["orientation", "disabled"];

	#pointer: PointerDrag | null = null;
	#autoScrollRaf: number | null = null;
	#keyboard: KeyboardDrag | null = null;
	#live: HTMLElement;
	#childObserver: MutationObserver | null = null;
	// Separate from #childObserver: childList drives the FLIP/drag-
	// reconcile path; attribute strips just need #syncItems to re-stamp
	// grip flags.
	#attrObserver: MutationObserver | null = null;
	#flipRaf: number | null = null;
	#pendingPatchLayout: LayoutSnapshot | null = null;
	#ownsRole = false;
	// Pointer id of an externally aborted drag. While the button is
	// still down, pointermove is absorbed (preventDefault) so the
	// browser can't grow a native text-selection drag until pointerup.
	#abortedPointerId: number | null = null;
	// overflow-anchor: none on <html>/<body> for the drag duration.
	// Otherwise a per-patch 1px content-height jitter scrolls the page
	// beneath the position:fixed dragged item; visually that reads as
	// the dragged element creeping though its rect never moves.
	#scrollAnchorLockDepth = 0;
	#savedHtmlAnchor = "";
	#savedBodyAnchor = "";
	// Item id whose grip last held focus. #restoreFocusIfLost re-focuses
	// the grip after morph blurs it to <body>.
	#focusedItemId = "";
	#ready = false;

	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(SHADOW_TEMPLATE.content.cloneNode(true));
		this.#live = root.querySelector<HTMLElement>("[data-neo-sortable-live]")!;
	}

	connectedCallback() {
		this.#ready = true;
		this.#ownsRole = !this.hasAttribute("role") || this.getAttribute("role") === "list";
		if (this.#ownsRole) this.setAttribute("role", "list");
		this.#syncItems();
		// subtree:true: morph can replace the unkey'd grip span; without
		// it, the new grip never re-runs #syncItems. External FLIP still
		// needs prepareReorderPatch(); post-morph is too late.
		this.#childObserver = new MutationObserver(this.#onChildrenMutated);
		this.#childObserver.observe(this, { childList: true, subtree: true });
		// Morph reconciles JS-set attributes back to source, stripping
		// grip/tabindex/role on each pass. Re-stamp via #syncItems;
		// idempotent writes (setAttrIfChanged) settle the observer.
		this.#attrObserver = new MutationObserver(this.#onManagedAttrChanged);
		this.#attrObserver.observe(this, {
			subtree: true,
			attributes: true,
			attributeFilter: [
				"data-neo-sortable-grip",
				"tabindex",
				"role",
				"aria-roledescription",
				"aria-keyshortcuts",
				"aria-disabled",
			],
		});
		this.addEventListener("pointerdown", this.#onPointerDown);
		this.addEventListener("keydown", this.#onKeyDown);
		this.addEventListener("focusin", this.#onFocusIn);
		this.addEventListener("focusout", this.#onFocusOut);
	}

	disconnectedCallback() {
		this.#ready = false;
		this.#cancelPointer();
		this.#keyboard = null;
		// A sortable disconnected mid-drag must not leave overflow-anchor
		// pinned globally or an auto-scroll frame queued.
		while (this.#scrollAnchorLockDepth > 0) this.#unlockScrollAnchor();
		this.#stopAutoScroll();
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		this.#attrObserver?.disconnect();
		this.#attrObserver = null;
		this.#pendingPatchLayout = null;
		this.removeEventListener("pointerdown", this.#onPointerDown);
		this.removeEventListener("keydown", this.#onKeyDown);
		this.removeEventListener("focusin", this.#onFocusIn);
		this.removeEventListener("focusout", this.#onFocusOut);
	}

	attributeChangedCallback() {
		if (!this.#ready) return;
		this.#syncItems();
	}

	// --- public API -----------------------------------------------------

	get order(): string[] {
		return this.#logicalEls().map((el) => this.#idOf(el));
	}

	// Call immediately before a server morph that may reorder children.
	prepareReorderPatch() {
		this.#pendingPatchLayout = this.#snapshotOf(this.#items());
	}

	get #orientation(): Orientation {
		const v = this.getAttribute("orientation");
		return (ORIENTATIONS as readonly string[]).includes(v ?? "") ? (v as Orientation) : "vertical";
	}

	get #isDisabled(): boolean {
		return boolAttr(this, "disabled", false);
	}

	// unbounded: floating element follows the pointer past the host box.
	get #isUnbounded(): boolean {
		return boolAttr(this, "unbounded", false);
	}

	// tolerate-reorder: an order-only morph (same id set, same per-id
	// content) doesn't abort an in-flight drag.
	get #tolerateReorder(): boolean {
		return boolAttr(this, "tolerate-reorder", false);
	}

	// --- item / grip bookkeeping ---------------------------------------

	#items(): HTMLElement[] {
		const out: HTMLElement[] = [];
		for (const el of Array.from(this.children)) {
			if (!(el instanceof HTMLElement)) continue;
			if (el instanceof HTMLTemplateElement) continue;
			// data-neo-sortable-ignore: drag placeholder and author-marked
			// siblings opt out of reorder.
			if (el.hasAttribute("data-neo-sortable-ignore")) continue;
			out.push(el);
		}
		return out;
	}

	#logicalEls(): HTMLElement[] {
		const d = this.#pointer;
		if (!d?.active) return this.#items();
		if (d.proxy) return this.#items();
		const out: HTMLElement[] = [];
		for (const el of Array.from(this.children)) {
			if (!(el instanceof HTMLElement)) continue;
			if (el === d.item) continue;
			if (el instanceof HTMLTemplateElement) continue;
			if (el === d.placeholder) {
				out.push(d.item);
				continue;
			}
			if (el.hasAttribute("data-neo-sortable-ignore")) continue;
			out.push(el);
		}
		return out;
	}

	#logicalIndex(el: HTMLElement): number {
		return this.#logicalEls().indexOf(el);
	}

	#idOf(el: HTMLElement): string {
		return el.id || el.dataset.neoSortableId || "";
	}

	// Whitespace-normalised textContent: the cross-morph "value"
	// identity for an item even if its DOM node was recreated.
	#contentOf(el: HTMLElement): string {
		return (el.textContent ?? "").replace(/\s+/g, " ").trim();
	}

	#snapshotContent(items: HTMLElement[]): Map<string, string> {
		const out = new Map<string, string>();
		for (const el of items) {
			const id = this.#idOf(el);
			if (id) out.set(id, this.#contentOf(el));
		}
		return out;
	}

	#gripOf(item: HTMLElement): HTMLElement {
		return item.querySelector<HTMLElement>("[data-neo-sortable-handle]") ?? item;
	}

	// Closest direct child of this sortable, or null.
	#itemContaining(el: Element | null): HTMLElement | null {
		let cur = el as HTMLElement | null;
		while (cur && cur.parentElement !== this) cur = cur.parentElement;
		return cur;
	}

	// Re-focus the grip whose item id matches #focusedItemId if a morph
	// (grip-span replace or tabindex strip) blurred to <body>. Called
	// from both observer callbacks; no-op when focus is still inside.
	#restoreFocusIfLost() {
		if (!this.#focusedItemId) return;
		if (this.contains(document.activeElement)) return;
		const ae = document.activeElement;
		if (ae && ae !== document.body) return;
		const item = this.querySelector<HTMLElement>(`#${CSS.escape(this.#focusedItemId)}`);
		// Item patched out: focus is gone for good, so drop the target so a
		// later patch re-adding the same id can't resurrect focus onto it.
		if (!item || item.parentElement !== this) {
			this.#focusedItemId = "";
			return;
		}
		this.#gripOf(item).focus?.();
	}

	// Idempotent at the attribute level: writes go through
	// setAttrIfChanged so #attrObserver settles after one no-op pass.
	// Same contract as observeManagedAttrs in neo-morph-resilient.ts.
	#syncItems() {
		// Morph strips role="list" from the source on each pass.
		if (this.#ownsRole) setAttrIfChanged(this, "role", "list");
		const disabled = this.#isDisabled;
		if (disabled) setAttrIfChanged(this, "aria-disabled", "true");
		else removeAttrIfPresent(this, "aria-disabled");

		const items = this.#items();
		const grips = new Set<HTMLElement>();
		const listSemantics = this.getAttribute("role") === "list";
		for (const item of items) {
			if (item === this.#pointer?.placeholder) continue;
			if (listSemantics && !item.hasAttribute("role")) {
				setAttrIfChanged(item, "role", "listitem");
			}
			const grip = this.#gripOf(item);
			grips.add(grip);
			setAttrIfChanged(grip, "data-neo-sortable-grip", "");
			if (!grip.hasAttribute("aria-roledescription")) {
				setAttrIfChanged(grip, "aria-roledescription", "sortable item");
			}
			// Expose the pick-up shortcut so AT can announce it pre-drag.
			if (!grip.hasAttribute("aria-keyshortcuts")) {
				setAttrIfChanged(grip, "aria-keyshortcuts", "Space Enter");
			}
			// Preserve author tabindex across disabled toggles.
			if (grip.dataset.neoSortableTabindex === undefined) {
				const authored = grip.getAttribute("tabindex");
				grip.dataset.neoSortableTabindex = authored ?? "";
			}
			const authored = grip.dataset.neoSortableTabindex;
			if (disabled) setAttrIfChanged(grip, "tabindex", "-1");
			else if (authored) setAttrIfChanged(grip, "tabindex", authored);
			else setAttrIfChanged(grip, "tabindex", "0");
		}
		for (const stale of this.querySelectorAll<HTMLElement>("[data-neo-sortable-grip]")) {
			if (!grips.has(stale)) {
				removeAttrIfPresent(stale, "data-neo-sortable-grip");
				removeAttrIfPresent(stale, "data-neo-sortable-tabindex");
			}
		}
	}

	#announce(msg: string) {
		this.#live.textContent = msg;
	}

	// overflow-anchor: none for the drag duration. Refcounted so the
	// pointer-abort handoff keeps it locked until pointerup.
	#lockScrollAnchor(): void {
		if (this.#scrollAnchorLockDepth++ > 0) return;
		const html = document.documentElement;
		const body = document.body;
		this.#savedHtmlAnchor = html.style.overflowAnchor;
		this.#savedBodyAnchor = body.style.overflowAnchor;
		html.style.overflowAnchor = "none";
		body.style.overflowAnchor = "none";
	}

	#unlockScrollAnchor(): void {
		if (this.#scrollAnchorLockDepth === 0) return;
		if (--this.#scrollAnchorLockDepth > 0) return;
		document.documentElement.style.overflowAnchor = this.#savedHtmlAnchor;
		document.body.style.overflowAnchor = this.#savedBodyAnchor;
	}

	#snapshotOf(items: HTMLElement[], settled = false): LayoutSnapshot {
		const byEl = new Map<HTMLElement, { id: string; rect: DOMRectReadOnly }>();
		const byId = new Map<string, DOMRectReadOnly>();
		const order: string[] = [];
		for (const el of items) {
			const rect = this.#pageRect(settled ? this.#layoutRect(el) : el.getBoundingClientRect());
			const id = this.#idOf(el);
			order.push(id);
			byEl.set(el, { id, rect });
			if (id) byId.set(id, rect);
		}
		return { byEl, byId, order };
	}

	#pageRect(r: DOMRectReadOnly): DOMRectReadOnly {
		return new DOMRectReadOnly(r.left + window.scrollX, r.top + window.scrollY, r.width, r.height);
	}

	#onManagedAttrChanged = () => {
		if (!this.#ready) return;
		this.#syncItems();
		this.#restoreFocusIfLost();
	};

	#onChildrenMutated = () => {
		if (!this.#ready) return;

		const first = this.#pendingPatchLayout;
		this.#pendingPatchLayout = null;

		this.#syncItems();
		this.#restoreFocusIfLost();
		const items = this.#items();

		// Mid-drag morph: a semantic no-op (same ids/order/content) keeps
		// the drag alive by re-linking refs; a real change aborts. Drag-
		// internal mutations land here too and slip through as no-ops.
		const drag: PointerDrag | KeyboardDrag | null = this.#pointer?.active ? this.#pointer : (this.#keyboard ?? null);
		if (drag) {
			this.#reconcileDragAgainstMutation(drag, items);
			return;
		}

		if (!first) return;
		const changedIds = this.#externalChangedIds(first.order, items);
		if (changedIds === null || changedIds.size === 0) {
			return;
		}
		this.#animateFromSnapshot(first, items, changedIds);
	};

	// Same per-id content as the drag-start snapshot, plus:
	//   - strict (default): same id order, dragged item free to roam.
	//   - tolerate-reorder: same id SET, order ignored.
	// Any added/removed id or per-id content swap counts as a change.
	#semanticsUnchanged(drag: PointerDrag | KeyboardDrag, items: HTMLElement[], dragId: string): boolean {
		if (items.length !== drag.startContent.size) return false;
		const liveDragEl = items.find((el) => this.#idOf(el) === dragId);
		if (!liveDragEl) return false;
		if (this.#tolerateReorder) {
			const seen = new Set<string>();
			for (const el of items) {
				const id = this.#idOf(el);
				if (!id) return false;
				if (seen.has(id)) return false;
				seen.add(id);
				if (!drag.startContent.has(id)) return false;
				if (drag.startContent.get(id) !== this.#contentOf(el)) return false;
			}
			// Set-equality holds here: same length + every live id in
			// startContent + no duplicates → every startContent id in live.
			return true;
		}
		// Strict: compare ordered ids with the dragged slot dropped on
		// both sides (the user is moving it).
		const startNoDrag = drag.startOrder.filter((id) => id !== dragId);
		const liveNoDrag = items.filter((el) => el !== liveDragEl).map((el) => this.#idOf(el));
		if (!arraysEqual(liveNoDrag, startNoDrag)) return false;
		for (const el of items) {
			const id = this.#idOf(el);
			if (drag.startContent.get(id) !== this.#contentOf(el)) return false;
		}
		return true;
	}

	#reconcileDragAgainstMutation(drag: PointerDrag | KeyboardDrag, items: HTMLElement[]): void {
		const dragId = this.#idOf(drag.item);
		// No stable id → can't distinguish node-recreate from content-swap.
		// Ignore; ids on every <neo-sortable-item> are the authoring contract.
		if (!dragId) return;
		if (!this.#semanticsUnchanged(drag, items, dragId)) {
			this.#abortDragForExternalChange(drag);
			return;
		}
		// No-op morph: re-link the dragged ref by id so future pointer/key
		// events drive the live node.
		const liveDragEl = items.find((el) => this.#idOf(el) === dragId)!;
		drag.item.removeAttribute("data-neo-sortable-dragging");
		liveDragEl.setAttribute("data-neo-sortable-dragging", "");
		if (drag === this.#keyboard && liveDragEl !== drag.item) {
			drag.item.removeAttribute("aria-grabbed");
			liveDragEl.setAttribute("aria-grabbed", "true");
		}
		drag.item = liveDragEl;
		// Re-stamp host state stripped by morph: role="list" when the
		// component owns it, and data-neo-sortable-active (drives grabbing
		// cursor + drag-in-flight signal).
		if (this.#ownsRole) setAttrIfChanged(this, "role", "list");
		setAttrIfChanged(this, "data-neo-sortable-active", drag === this.#pointer ? "pointer" : "keyboard");
		if (drag === this.#keyboard) {
			drag.item.setAttribute("aria-grabbed", "true");
			// Morph stripped tabindex (or replaced the grip span) and the
			// browser blurred synchronously. #onFocusOut deferred its drop;
			// this refocus runs first.
			this.#gripOf(drag.item).focus?.();
		}
		const ptr = drag === this.#pointer ? this.#pointer : null;
		if (ptr) {
			// Morph reconciled d.item's inline style to source; the
			// position:fixed block is gone. Re-apply to keep it floating.
			this.#applyPointerFloatStyles(ptr);
			// The placeholder is light-DOM with no id in the morph source,
			// so morph either strips it or position-pairs it into a real
			// item. In the second case d.placeholder is still connected but
			// masquerading; trust the marker, not identity, and rebuild if gone.
			const phStale = !ptr.placeholder.isConnected || !ptr.placeholder.hasAttribute("data-neo-sortable-placeholder");
			if (phStale) {
				ptr.placeholder = this.#rebuildPlaceholder(ptr);
			}
			// Re-attach at the *current* drop slot (d.lastIndex), not the
			// drag-start anchor; proxy mode parents the placeholder to d.item.
			if (ptr.proxy) {
				if (!ptr.placeholder.isConnected) ptr.item.appendChild(ptr.placeholder);
			} else if (!ptr.placeholder.isConnected) {
				const siblings = this.#items().filter((el) => el !== ptr.item);
				const ref = siblings[ptr.lastIndex] ?? null;
				this.insertBefore(ptr.placeholder, ref);
			}
		}
	}

	// Fresh placeholder mirroring #promote's inline styles. Used when
	// morph repurposed the original into a real item.
	#rebuildPlaceholder(d: PointerDrag): HTMLElement {
		const ph = document.createElement("div");
		ph.setAttribute("data-neo-sortable-placeholder", "");
		ph.setAttribute("data-neo-sortable-ignore", "");
		ph.setAttribute("aria-hidden", "true");
		ph.style.boxSizing = "border-box";
		const tpl = this.querySelector<HTMLTemplateElement>(":scope > template[data-neo-sortable-placeholder]");
		if (tpl) {
			ph.appendChild(tpl.content.cloneNode(true));
			ph.setAttribute("data-neo-sortable-custom-placeholder", "");
		}
		if (d.proxy) {
			ph.style.position = "absolute";
			ph.style.inset = "0";
			ph.style.margin = "0";
			ph.style.pointerEvents = "none";
			ph.style.visibility = "visible";
		} else {
			ph.style.width = `${d.w}px`;
			ph.style.height = `${d.h}px`;
			ph.style.flex = "0 0 auto";
		}
		return ph;
	}

	// Re-apply the inline-style block #promote / #onPointerMove wrote
	// after a no-op morph stripped it.
	#applyPointerFloatStyles(d: PointerDrag): void {
		if (d.proxy) {
			// Proxy mode: d.item hides in place; the body-resident proxy
			// does the floating, untouched by this host's morphs.
			d.item.style.position = "relative";
			d.item.style.visibility = "hidden";
			return;
		}
		d.item.style.position = "fixed";
		d.item.style.margin = "0";
		d.item.style.boxSizing = "border-box";
		d.item.style.width = `${d.w}px`;
		d.item.style.height = `${d.h}px`;
		d.item.style.left = `${d.lastLeft}px`;
		d.item.style.top = `${d.lastTop}px`;
		d.item.style.zIndex = "9999";
		d.item.style.pointerEvents = "none";
		d.item.style.transition = "none";
	}

	// Tear down the drag because slot data changed under it. The morph
	// owns the new state, so don't restore. Emit neo-sortable-end with
	// aborted: true so hosts can distinguish from cancel / clean drop.
	#abortDragForExternalChange(drag: PointerDrag | KeyboardDrag): void {
		if (drag === this.#pointer) {
			const d = this.#pointer;
			// Latch before clearing #pointer: the document listeners stay
			// attached but switch to absorb-only until pointerup, so the
			// browser can't grow a native text-selection drag from the
			// original mousedown anchor.
			this.#abortedPointerId = d.pointerId;
			this.#pointer = null;
			this.#clearFlip();
			d.proxy?.remove();
			// Morph can position-pair our unkey'd placeholder into a real
			// item, so d.placeholder by identity may now be a live entry.
			// Only strip nodes that still carry the marker.
			if (d.placeholder.isConnected && d.placeholder.hasAttribute("data-neo-sortable-placeholder")) {
				d.placeholder.remove();
			}
			// Sweep stray placeholder-marked nodes (re-emitted by morph,
			// nested-sortable leakage).
			for (const stray of this.querySelectorAll<HTMLElement>(":scope > [data-neo-sortable-placeholder]")) {
				stray.remove();
			}
			// d.item may have been removed by morph; touch only if attached.
			if (d.item.isConnected) {
				d.item.style.cssText = d.savedCss;
				d.item.removeAttribute("data-neo-sortable-dragging");
			}
			this.removeAttribute("data-neo-sortable-active");
			// Drop any text selection the browser grew between mousedown
			// and now (pre-threshold move, or a selection inside the item).
			const sel = document.getSelection();
			sel?.removeAllRanges?.();
			this.#emit("neo-sortable-end", {
				id: this.#idOf(d.item),
				from: d.startIndex,
				to: -1,
				changed: false,
				aborted: true,
			});
		} else if (drag === this.#keyboard) {
			const k = this.#keyboard;
			this.#keyboard = null;
			this.#clearFlip();
			if (k.item.isConnected) {
				k.item.removeAttribute("data-neo-sortable-dragging");
				k.item.removeAttribute("aria-grabbed");
			}
			this.removeAttribute("data-neo-sortable-active");
			this.#unlockScrollAnchor();
			this.#announce("Reordering cancelled. List updated by another source.");
			this.#emit("neo-sortable-end", {
				id: this.#idOf(k.item),
				from: k.startIndex,
				to: -1,
				changed: false,
				aborted: true,
			});
		}
	}

	#externalChangedIds(before: readonly string[], afterItems: readonly HTMLElement[]): Set<string> | null {
		const after = afterItems.map((el) => this.#idOf(el));
		if (before.length !== after.length) return null;
		if (before.some((id) => !id) || after.some((id) => !id)) return null;

		const counts = new Map<string, number>();
		for (const id of before) counts.set(id, (counts.get(id) ?? 0) + 1);
		for (const id of after) {
			const n = counts.get(id);
			if (!n) return null;
			if (n === 1) counts.delete(id);
			else counts.set(id, n - 1);
		}
		if (counts.size > 0) return null;

		const changed = new Set<string>();
		for (let i = 0; i < after.length; i++) {
			if (before[i] !== after[i]) changed.add(after[i]);
		}
		return changed;
	}

	// --- reorder core ---------------------------------------------------

	// Same easing grammar as carousel: unset, "", duration, duration+fn.
	#resolveTransition(): string {
		const themed = getComputedStyle(this).getPropertyValue("--neo-easing").trim();
		const raw = this.getAttribute("easing");
		if (raw === null) {
			return `var(--neo-sortable-move-duration, 180ms) ${themed || "ease"}`;
		}
		const t = raw.trim();
		if (t === "") return "";
		const m = t.match(/^(\d+(?:\.\d+)?(?:ms|s))\b\s*(.*)$/);
		if (!m) return "";
		const fn = m[2].trim() || themed || "ease";
		return `${m[1]} ${fn}`;
	}

	// Hit-test settled layout, not in-flight FLIP boxes.
	#layoutRect(el: HTMLElement): DOMRectReadOnly {
		const r = el.getBoundingClientRect();
		const ownsTransform = el.style.transform.startsWith("translate(") || /\btransform\b/.test(el.style.transition);
		if (!ownsTransform) return r;

		const transform = getComputedStyle(el).transform;
		if (!transform || transform === "none") return r;

		let tx = 0;
		let ty = 0;
		const matrix = transform.match(/^matrix\((.+)\)$/);
		if (matrix) {
			const parts = matrix[1].split(",").map((v) => Number.parseFloat(v));
			tx = parts[4] || 0;
			ty = parts[5] || 0;
		} else {
			const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
			if (matrix3d) {
				const parts = matrix3d[1].split(",").map((v) => Number.parseFloat(v));
				tx = parts[12] || 0;
				ty = parts[13] || 0;
			}
		}
		if (tx === 0 && ty === 0) return r;
		return new DOMRectReadOnly(r.left - tx, r.top - ty, r.width, r.height);
	}

	#targetIndexIn(list: HTMLElement[], px: number, py: number): number {
		const o = this.#orientation;
		if (o === "vertical") {
			let i = 0;
			for (; i < list.length; i++) {
				const r = this.#layoutRect(list[i]);
				if (py < r.top + r.height / 2) break;
			}
			return i;
		}
		if (o === "horizontal") {
			let i = 0;
			for (; i < list.length; i++) {
				const r = this.#layoutRect(list[i]);
				if (px < r.left + r.width / 2) break;
			}
			return i;
		}
		return this.#gridTargetIndex(px, py, list.length + 1);
	}

	#gridTargetIndex(px: number, py: number, slots: number): number {
		if (slots <= 1) return 0;
		const rows = this.#gridRows();
		if (rows.length === 0) return 0;
		if (py < rows[0].top) return 0;
		if (py > rows[rows.length - 1].bottom) return slots - 1;

		const cols = this.#gridColumnCount();
		const col = this.#gridColumnIndex(px, cols);
		const row = this.#gridRowIndex(py, rows);
		return Math.max(0, Math.min(slots - 1, row * cols + col));
	}

	#gridColumnCount(): number {
		const cols = getComputedStyle(this)
			.gridTemplateColumns.trim()
			.split(/\s+/)
			.filter((v) => v !== "" && v !== "none").length;
		return Math.max(1, cols || this.#columns(this.#items()));
	}

	#gridColumnIndex(px: number, cols: number): number {
		if (cols <= 1) return 0;
		const host = this.getBoundingClientRect();
		const style = getComputedStyle(this);
		const gap = this.#cssPx(style.columnGap);
		const tracks = style.gridTemplateColumns
			.trim()
			.split(/\s+/)
			.map((v) => Number.parseFloat(v))
			.filter((n) => Number.isFinite(n) && n > 0);

		if (tracks.length === cols) {
			let left = host.left;
			for (let i = 0; i < tracks.length; i++) {
				const right = left + tracks[i];
				if (px < right + gap / 2) return i;
				left = right + gap;
			}
			return cols - 1;
		}

		const x = px - host.left;
		const col = Math.floor((x / Math.max(1, host.width)) * cols);
		return Math.max(0, Math.min(cols - 1, col));
	}

	#gridRowIndex(py: number, rows: readonly { top: number; bottom: number }[]): number {
		let target = 0;
		let bestD = Infinity;
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const dy = py < row.top ? row.top - py : py > row.bottom ? py - row.bottom : 0;
			if (dy < bestD) {
				bestD = dy;
				target = i;
			}
		}
		return target;
	}

	#gridRows(): { top: number; bottom: number }[] {
		const rows: { top: number; bottom: number }[] = [];
		for (const el of this.#gridFlowEls()) {
			const r = this.#layoutRect(el);
			const row = rows[rows.length - 1];
			const tol = Math.max(1, r.height / 2);
			if (!row || Math.abs(r.top - row.top) > tol) {
				rows.push({ top: r.top, bottom: r.bottom });
			} else {
				row.top = Math.min(row.top, r.top);
				row.bottom = Math.max(row.bottom, r.bottom);
			}
		}
		return rows;
	}

	#gridFlowEls(): HTMLElement[] {
		const d = this.#pointer;
		const out: HTMLElement[] = [];
		for (const el of Array.from(this.children)) {
			if (!(el instanceof HTMLElement)) continue;
			if (!d?.proxy && el === d?.item) continue;
			if (el instanceof HTMLTemplateElement) continue;
			if (el.hasAttribute("data-neo-sortable-ignore") && el !== d?.placeholder) {
				continue;
			}
			out.push(el);
		}
		return out;
	}

	#cssPx(value: string): number {
		const n = Number.parseFloat(value);
		return Number.isFinite(n) ? n : 0;
	}

	#flipReorder(mutate: () => void) {
		const dragged = this.#pointer?.active ? this.#pointer.item : null;
		const els = this.#items().filter((el) => el !== dragged && el !== this.#pointer?.placeholder);
		const first = this.#snapshotOf(els);
		mutate();
		this.#animateFromSnapshot(first, els);
	}

	#animateFromSnapshot(first: LayoutSnapshot, els: HTMLElement[], onlyIds: ReadonlySet<string> | null = null) {
		const trans = this.#resolveTransition();
		if (!trans) {
			return;
		}
		if (this.#flipRaf !== null) cancelAnimationFrame(this.#flipRaf);
		// Clear in-flight FLIP before measuring final boxes.
		for (const el of els) {
			if (onlyIds && !onlyIds.has(this.#idOf(el))) continue;
			if (!this.#snapshotRectFor(first, el)) continue;
			el.removeEventListener("transitionend", this.#onFlipEnd);
			el.style.transition = "none";
			el.style.transform = "";
		}
		const invert: [HTMLElement, number, number][] = [];
		for (const el of els) {
			if (onlyIds && !onlyIds.has(this.#idOf(el))) continue;
			const f = this.#snapshotRectFor(first, el);
			if (!f) continue;
			const l = this.#pageRect(el.getBoundingClientRect());
			const dx = f.left - l.left;
			const dy = f.top - l.top;
			if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
			el.style.transform = `translate(${dx}px, ${dy}px)`;
			invert.push([el, dx, dy]);
		}
		if (invert.length === 0) return;
		this.#flipRaf = requestAnimationFrame(() => {
			this.#flipRaf = null;
			for (const [el] of invert) {
				el.style.transition = `transform ${trans}`;
				el.style.transform = "";
				el.addEventListener("transitionend", this.#onFlipEnd);
			}
		});
	}

	#snapshotRectFor(snapshot: LayoutSnapshot, el: HTMLElement): DOMRectReadOnly | undefined {
		const id = this.#idOf(el);
		const byEl = snapshot.byEl.get(el);
		if (byEl && byEl.id === id) return byEl.rect;
		return id ? snapshot.byId.get(id) : byEl?.rect;
	}

	#onFlipEnd = (e: TransitionEvent) => {
		if (e.propertyName !== "transform") return;
		const el = e.currentTarget as HTMLElement;
		el.style.transition = "";
		el.style.transform = "";
		el.removeEventListener("transitionend", this.#onFlipEnd);
	};

	#clearFlip() {
		if (this.#flipRaf !== null) {
			cancelAnimationFrame(this.#flipRaf);
			this.#flipRaf = null;
		}
		for (const el of this.#items()) {
			if (el.style.transition || el.style.transform) {
				el.removeEventListener("transitionend", this.#onFlipEnd);
				el.style.transition = "";
				el.style.transform = "";
			}
		}
	}

	#placeItemAt(item: HTMLElement, index: number): boolean {
		const others = this.#items().filter((el) => el !== item);
		const ref = others[index] ?? null;
		if (ref === item) return false;
		const before = this.#items().indexOf(item);
		this.insertBefore(item, ref);
		return this.#items().indexOf(item) !== before;
	}

	#restore(els: HTMLElement[]) {
		for (const el of els) this.appendChild(el);
	}

	#emit(type: "neo-sortable-start" | "neo-sortable-move" | "neo-sortable-end", detail: Record<string, unknown>) {
		this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
	}

	// --- pointer drag ---------------------------------------------------

	#onPointerDown = (e: PointerEvent) => {
		if (this.#isDisabled || this.#pointer || this.#keyboard) return;
		if (e.pointerType === "mouse" && e.button !== 0) return;
		const target = e.target as Element | null;
		if (!target) return;

		const items = this.#items();
		const item = items.find((it) => it.contains(target)) ?? null;
		if (!item) return;
		const handle = item.querySelector<HTMLElement>("[data-neo-sortable-handle]");
		if (handle) {
			if (!handle.contains(target)) return;
		} else {
			const hit = target.closest(INTERACTIVE);
			if (hit && item.contains(hit)) return;
		}

		const startIndex = items.indexOf(item);
		this.#pointer = {
			pointerId: e.pointerId,
			item,
			placeholder: document.createElement("div"),
			proxy: null,
			pressX: e.clientX,
			pressY: e.clientY,
			grabX: 0,
			grabY: 0,
			homeLeft: 0,
			homeTop: 0,
			w: 0,
			h: 0,
			savedCss: "",
			lastLeft: 0,
			lastTop: 0,
			lastClientX: e.clientX,
			lastClientY: e.clientY,
			scrollers: [],
			startIndex,
			lastIndex: startIndex,
			startOrderEls: items.slice(),
			startOrder: this.order,
			startContent: this.#snapshotContent(items),
			active: false,
		};
		document.addEventListener("pointermove", this.#onPointerMove);
		document.addEventListener("pointerup", this.#onPointerUp);
		document.addEventListener("pointercancel", this.#onPointerCancel);
	};

	// Avoid reflow between measuring and drag-layer setup.
	#promote(d: PointerDrag, e: PointerEvent) {
		d.active = true;
		// Drop the stray selection the pre-threshold mousedown grew on a
		// whole-item grip; user-select:none only stops it from here on.
		document.getSelection()?.removeAllRanges?.();
		const r = d.item.getBoundingClientRect();
		d.grabX = e.clientX - r.left;
		d.grabY = e.clientY - r.top;
		d.homeLeft = r.left;
		d.homeTop = r.top;
		d.lastLeft = r.left;
		d.lastTop = r.top;
		d.w = r.width;
		d.h = r.height;
		d.savedCss = d.item.style.cssText;

		const ph = d.placeholder;
		ph.setAttribute("data-neo-sortable-placeholder", "");
		ph.setAttribute("data-neo-sortable-ignore", "");
		ph.setAttribute("aria-hidden", "true");
		ph.style.boxSizing = "border-box";
		ph.replaceChildren();
		const tpl = this.querySelector<HTMLTemplateElement>(":scope > template[data-neo-sortable-placeholder]");
		if (tpl) {
			ph.appendChild(tpl.content.cloneNode(true));
			ph.setAttribute("data-neo-sortable-custom-placeholder", "");
		}

		if (this.#orientation === "grid") {
			const proxy = d.item.cloneNode(true) as HTMLElement;
			proxy.removeAttribute("id");
			for (const el of proxy.querySelectorAll<HTMLElement>("[id]")) {
				el.removeAttribute("id");
			}
			proxy.setAttribute("aria-hidden", "true");
			proxy.setAttribute("inert", "");
			proxy.setAttribute("data-neo-sortable-ignore", "");
			proxy.setAttribute("data-neo-sortable-dragging", "");
			proxy.style.position = "fixed";
			proxy.style.margin = "0";
			proxy.style.boxSizing = "border-box";
			proxy.style.width = `${r.width}px`;
			proxy.style.height = `${r.height}px`;
			proxy.style.left = `${r.left}px`;
			proxy.style.top = `${r.top}px`;
			proxy.style.zIndex = "9999";
			proxy.style.pointerEvents = "none";
			proxy.style.transition = "none";
			document.body.appendChild(proxy);
			d.proxy = proxy;
			ph.style.position = "absolute";
			ph.style.inset = "0";
			ph.style.margin = "0";
			ph.style.pointerEvents = "none";
			ph.style.visibility = "visible";
			d.item.appendChild(ph);
			d.item.style.position = "relative";
			d.item.style.visibility = "hidden";
		} else {
			ph.style.width = `${r.width}px`;
			ph.style.height = `${r.height}px`;
			ph.style.flex = "0 0 auto";
			ph.style.margin = getComputedStyle(d.item).margin;

			d.item.style.position = "fixed";
			d.item.style.margin = "0";
			d.item.style.boxSizing = "border-box";
			d.item.style.width = `${r.width}px`;
			d.item.style.height = `${r.height}px`;
			d.item.style.left = `${r.left}px`;
			d.item.style.top = `${r.top}px`;
			d.item.style.zIndex = "9999";
			d.item.style.pointerEvents = "none";
			d.item.style.transition = "none";
			this.insertBefore(ph, d.item);
		}

		this.setAttribute("data-neo-sortable-active", "pointer");
		d.item.setAttribute("data-neo-sortable-dragging", "");
		this.setPointerCapture?.(e.pointerId);
		this.#lockScrollAnchor();
		d.scrollers = this.#scrollers();
		if (this.#autoScrollRaf === null) {
			this.#autoScrollRaf = requestAnimationFrame(this.#autoScrollTick);
		}
		this.#emit("neo-sortable-start", {
			id: this.#idOf(d.item),
			index: d.startIndex,
		});
	}

	#onPointerMove = (e: PointerEvent) => {
		// Drag was externally aborted but the button is still down. Eat
		// the move so the browser can't grow a text-selection drag.
		if (this.#abortedPointerId !== null && e.pointerId === this.#abortedPointerId) {
			e.preventDefault();
			return;
		}
		const d = this.#pointer;
		if (!d || e.pointerId !== d.pointerId) return;
		if (!d.active) {
			if (Math.hypot(e.clientX - d.pressX, e.clientY - d.pressY) < DRAG_THRESHOLD) {
				return;
			}
			this.#promote(d, e);
		}
		e.preventDefault();
		d.lastClientX = e.clientX;
		d.lastClientY = e.clientY;
		this.#dragMoveTo(d, e.clientX, e.clientY);
	};

	// Position the floating element at (clientX, clientY) and reorder to
	// the slot under it. Shared by the pointer move and the auto-scroll
	// tick, which calls it with the last pointer position after a scroll.
	#dragMoveTo(d: PointerDrag, clientX: number, clientY: number) {
		const o = this.#orientation;
		const dragEl = d.proxy ?? d.item;
		// Natural (unclamped) position the floating element would take.
		const rawLeft = o === "vertical" ? d.homeLeft : clientX - d.grabX;
		const rawTop = o === "horizontal" ? d.homeTop : clientY - d.grabY;
		let left = rawLeft;
		let top = rawTop;
		if (!this.#isUnbounded) {
			// Clamp only the visual position (fixed = viewport coords); the
			// hit-test below stays on unclamped coords so clamping can't
			// block the last slot. Lower-bound wins for over-sized items.
			const host = this.getBoundingClientRect();
			left = Math.min(Math.max(left, host.left), Math.max(host.left, host.right - d.w));
			top = Math.min(Math.max(top, host.top), Math.max(host.top, host.bottom - d.h));
		}
		dragEl.style.left = `${left}px`;
		dragEl.style.top = `${top}px`;
		// Cached for the reconcile path: a no-op morph strips d.item's
		// inline style, we re-apply from these.
		d.lastLeft = left;
		d.lastTop = top;

		const siblings = this.#items().filter((el) => el !== d.item && el !== d.placeholder);
		let targetX = clientX;
		let targetY = clientY;
		if (o === "grid") {
			// Tile center from the unclamped position; `bounded` must not
			// shrink the reachable target area.
			targetX = rawLeft + d.w / 2;
			targetY = rawTop + d.h / 2;
		}
		const idx = this.#targetIndexIn(siblings, targetX, targetY);
		if (this.#logicalIndex(d.item) === idx) return;
		const ref = siblings[idx] ?? null;

		this.#flipReorder(() => {
			this.insertBefore(d.proxy ? d.item : d.placeholder, ref);
		});
		const to = this.#logicalIndex(d.item);
		this.#emit("neo-sortable-move", {
			id: this.#idOf(d.item),
			from: d.lastIndex,
			to,
		});
		d.lastIndex = to;
	}

	// Scrollable element ancestors of the host (nearest first), excluding
	// the document root. Edge auto-scroll pans these so a lifted item can
	// reach slots scrolled out of view. The page itself is left alone;
	// the drag holds overflow-anchor:none and must not move it.
	#scrollers(): HTMLElement[] {
		const out: HTMLElement[] = [];
		let el = this.parentElement;
		while (el && el !== document.body && el !== document.documentElement) {
			const s = getComputedStyle(el);
			const y = (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight;
			const x = (s.overflowX === "auto" || s.overflowX === "scroll") && el.scrollWidth > el.clientWidth;
			if (y || x) out.push(el);
			el = el.parentElement;
		}
		return out;
	}

	// Keep a keyboard-moved item visible by panning its scrollable
	// ancestors. Uses the settled layout rect (#layoutRect) so an
	// in-flight FLIP transform can't aim the scroll at the vacated slot.
	#scrollItemIntoView(item: HTMLElement) {
		const MARGIN = 8;
		const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
		for (const sc of this.#scrollers()) {
			if (!sc.isConnected) continue;
			const ir = this.#layoutRect(item);
			const sr = sc.getBoundingClientRect();
			let dy = 0;
			let dx = 0;
			if (sc.scrollHeight > sc.clientHeight) {
				if (ir.top < sr.top + MARGIN) dy = ir.top - (sr.top + MARGIN);
				else if (ir.bottom > sr.bottom - MARGIN) dy = ir.bottom - (sr.bottom - MARGIN);
			}
			if (sc.scrollWidth > sc.clientWidth) {
				if (ir.left < sr.left + MARGIN) dx = ir.left - (sr.left + MARGIN);
				else if (ir.right > sr.right - MARGIN) dx = ir.right - (sr.right - MARGIN);
			}
			// scrollBy recomputes from the live (possibly mid-animation)
			// position, so a held arrow key retargets instead of stacking.
			if (dx || dy) sc.scrollBy({ top: dy, left: dx, behavior });
		}
	}

	// Pan a scrollable ancestor while the pointer rests in its edge band,
	// then re-run the hit-test so the placeholder chases the newly
	// revealed slots. Runs for the whole pointer drag; a frame with no
	// edge contact is a cheap no-op.
	#autoScrollTick = () => {
		const d = this.#pointer;
		if (!d?.active) {
			this.#autoScrollRaf = null;
			return;
		}
		const EDGE = 48;
		const MAX = 16;
		let scrolled = false;
		for (const sc of d.scrollers) {
			if (!sc.isConnected) continue;
			const r = sc.getBoundingClientRect();
			let dy = 0;
			if (sc.scrollHeight > sc.clientHeight) {
				if (d.lastClientY < r.top + EDGE && sc.scrollTop > 0) {
					dy = -MAX * Math.min(1, (r.top + EDGE - d.lastClientY) / EDGE);
				} else if (d.lastClientY > r.bottom - EDGE && sc.scrollTop < sc.scrollHeight - sc.clientHeight) {
					dy = MAX * Math.min(1, (d.lastClientY - (r.bottom - EDGE)) / EDGE);
				}
			}
			let dx = 0;
			if (sc.scrollWidth > sc.clientWidth) {
				if (d.lastClientX < r.left + EDGE && sc.scrollLeft > 0) {
					dx = -MAX * Math.min(1, (r.left + EDGE - d.lastClientX) / EDGE);
				} else if (d.lastClientX > r.right - EDGE && sc.scrollLeft < sc.scrollWidth - sc.clientWidth) {
					dx = MAX * Math.min(1, (d.lastClientX - (r.right - EDGE)) / EDGE);
				}
			}
			if (dx !== 0 || dy !== 0) {
				sc.scrollTop += dy;
				sc.scrollLeft += dx;
				scrolled = true;
			}
		}
		// Siblings moved under a stationary pointer; re-place to the slot.
		if (scrolled) this.#dragMoveTo(d, d.lastClientX, d.lastClientY);
		this.#autoScrollRaf = requestAnimationFrame(this.#autoScrollTick);
	};

	#stopAutoScroll() {
		if (this.#autoScrollRaf === null) return;
		cancelAnimationFrame(this.#autoScrollRaf);
		this.#autoScrollRaf = null;
	}

	#onPointerUp = (e: PointerEvent) => {
		if (this.#abortedPointerId !== null && e.pointerId === this.#abortedPointerId) {
			this.#releaseAbortedPointer();
			return;
		}
		const d = this.#pointer;
		if (!d || e.pointerId !== d.pointerId) return;
		this.#finishPointer(false);
	};

	#onPointerCancel = (e: PointerEvent) => {
		if (this.#abortedPointerId !== null && e.pointerId === this.#abortedPointerId) {
			this.#releaseAbortedPointer();
			return;
		}
		const d = this.#pointer;
		if (!d || e.pointerId !== d.pointerId) return;
		this.#finishPointer(true);
	};

	// Tear down absorb-mode after the button finally lifted.
	#releaseAbortedPointer(): void {
		this.#abortedPointerId = null;
		document.removeEventListener("pointermove", this.#onPointerMove);
		document.removeEventListener("pointerup", this.#onPointerUp);
		document.removeEventListener("pointercancel", this.#onPointerCancel);
		this.#stopAutoScroll();
		this.#unlockScrollAnchor();
	}

	#finishPointer(cancelled: boolean) {
		const d = this.#pointer;
		if (!d) return;
		document.removeEventListener("pointermove", this.#onPointerMove);
		document.removeEventListener("pointerup", this.#onPointerUp);
		document.removeEventListener("pointercancel", this.#onPointerCancel);
		this.#pointer = null;
		this.#stopAutoScroll();

		// Click, not drag: never promoted, never locked the anchor.
		if (!d.active) return;
		this.#unlockScrollAnchor();

		this.#clearFlip();
		d.proxy?.remove();
		if (d.proxy) d.placeholder.remove();
		d.item.style.cssText = d.savedCss;
		d.item.removeAttribute("data-neo-sortable-dragging");
		this.removeAttribute("data-neo-sortable-active");

		if (cancelled) {
			if (!d.proxy) d.placeholder.remove();
			this.#restore(d.startOrderEls);
		} else {
			if (!d.proxy) d.placeholder.replaceWith(d.item);
		}

		const changed = !cancelled && !arraysEqual(d.startOrder, this.order);
		this.#emit("neo-sortable-end", {
			id: this.#idOf(d.item),
			from: d.startIndex,
			to: this.#items().indexOf(d.item),
			changed,
		});
	}

	#cancelPointer() {
		if (this.#pointer) this.#finishPointer(true);
	}

	// --- keyboard drag --------------------------------------------------

	// First visual row width; fallback keeps Up/Down useful.
	#columns(items: HTMLElement[]): number {
		if (items.length === 0) return 1;
		const top = items[0].offsetTop;
		let n = 0;
		for (const it of items) {
			if (it.offsetTop !== top) break;
			n++;
		}
		return Math.max(1, n);
	}

	#onKeyDown = (e: KeyboardEvent) => {
		if (this.#isDisabled) return;
		const target = e.target as Element | null;
		if (!target) return;
		const grip = target.closest<HTMLElement>("[data-neo-sortable-grip]");
		if (!grip || !this.contains(grip)) return;
		const item = this.#items().find((it) => it === grip || it.contains(grip));
		if (!item) return;

		const key = e.key;
		// Space/Enter picks the focused item up, or drops the held one.
		if (key === " " || key === "Enter") {
			e.preventDefault();
			if (this.#keyboard) this.#keyboardDrop();
			else this.#keyboardPick(item);
			return;
		}
		if (key === "Escape") {
			if (!this.#keyboard) return;
			e.preventDefault();
			this.#keyboardCancel();
			return;
		}

		// Reorder keys move the held item only; pick it up with
		// Space/Enter first. Without a pickup, defer to the browser so
		// the focused grip scrolls/navigates normally. Tab/blur drops,
		// Escape reverts.
		if (!this.#keyboard) return;
		const isHome = key === "Home";
		const isEnd = key === "End";
		const step = this.#keyStep(key);
		if (!isHome && !isEnd && step === 0) return;
		e.preventDefault();
		if (isHome) this.#keyboardMoveTo(0);
		else if (isEnd) this.#keyboardMoveTo(this.#items().length - 1);
		else this.#keyboardMove(step);
	};

	#keyStep(key: string): number {
		const o = this.#orientation;
		if (o === "vertical") {
			if (key === "ArrowUp") return -1;
			if (key === "ArrowDown") return 1;
			return 0;
		}
		if (o === "horizontal") {
			if (key === "ArrowLeft") return -1;
			if (key === "ArrowRight") return 1;
			return 0;
		}
		const cols = this.#gridColumnCount();
		if (key === "ArrowLeft") return -1;
		if (key === "ArrowRight") return 1;
		if (key === "ArrowUp") return -cols;
		if (key === "ArrowDown") return cols;
		return 0;
	}

	#keyboardPick(item: HTMLElement) {
		const items = this.#items();
		const startIndex = items.indexOf(item);
		this.#keyboard = {
			item,
			startIndex,
			lastIndex: startIndex,
			startOrderEls: items.slice(),
			startOrder: this.order,
			startContent: this.#snapshotContent(items),
		};
		this.setAttribute("data-neo-sortable-active", "keyboard");
		item.setAttribute("data-neo-sortable-dragging", "");
		item.setAttribute("aria-grabbed", "true");
		this.#lockScrollAnchor();
		this.#emit("neo-sortable-start", {
			id: this.#idOf(item),
			index: startIndex,
		});
		this.#announce(
			`Moving. Position ${startIndex + 1} of ${items.length}. ` +
				`Arrow keys or home and end to move, ` +
				`tab away to drop, escape to cancel.`,
		);
	}

	#keyboardMove(step: number) {
		const k = this.#keyboard;
		if (!k) return;
		const cur = this.#items().indexOf(k.item);
		this.#keyboardMoveTo(cur + step);
	}

	#keyboardMoveTo(index: number) {
		const k = this.#keyboard;
		if (!k) return;
		const items = this.#items();
		const cur = items.indexOf(k.item);
		const next = Math.max(0, Math.min(items.length - 1, index));
		if (next === cur) return;
		let changed = false;
		this.#flipReorder(() => {
			changed = this.#placeItemAt(k.item, next);
		});
		if (!changed) return;
		const to = this.#items().indexOf(k.item);
		this.#emit("neo-sortable-move", {
			id: this.#idOf(k.item),
			from: k.lastIndex,
			to,
		});
		k.lastIndex = to;
		// ATs may drop focus on reparenting. preventScroll because the
		// default focus scroll targets the in-flight FLIP box; our own
		// scroll uses the settled layout rect.
		this.#gripOf(k.item).focus?.({ preventScroll: true });
		this.#scrollItemIntoView(k.item);
		this.#announce(`Position ${to + 1} of ${items.length}.`);
	}

	#keyboardDrop() {
		const k = this.#keyboard;
		if (!k) return;
		this.#keyboard = null;
		k.item.removeAttribute("data-neo-sortable-dragging");
		k.item.removeAttribute("aria-grabbed");
		this.removeAttribute("data-neo-sortable-active");
		this.#unlockScrollAnchor();
		const count = this.#items().length;
		const to = this.#items().indexOf(k.item);
		const changed = !arraysEqual(k.startOrder, this.order);
		this.#emit("neo-sortable-end", {
			id: this.#idOf(k.item),
			from: k.startIndex,
			to,
			changed,
		});
		this.#announce(changed ? `Dropped at position ${to + 1} of ${count}.` : `Dropped. Order unchanged.`);
	}

	#keyboardCancel() {
		const k = this.#keyboard;
		if (!k) return;
		this.#keyboard = null;
		this.#clearFlip();
		this.#restore(k.startOrderEls);
		k.item.removeAttribute("data-neo-sortable-dragging");
		k.item.removeAttribute("aria-grabbed");
		this.removeAttribute("data-neo-sortable-active");
		this.#unlockScrollAnchor();
		this.#gripOf(k.item).focus?.();
		this.#emit("neo-sortable-end", {
			id: this.#idOf(k.item),
			from: k.startIndex,
			to: k.startIndex,
			changed: false,
		});
		this.#announce("Reordering cancelled.");
	}

	// Track the grip's item id for #restoreFocusIfLost after a morph
	// strips tabindex.
	#onFocusIn = (e: FocusEvent) => {
		const item = this.#itemContaining(e.target as Element | null);
		this.#focusedItemId = item ? this.#idOf(item) : "";
	};

	// Two responsibilities:
	//   1. A non-null relatedTarget outside this sortable means real
	//      tab-out → clear #focusedItemId so #restoreFocusIfLost won't
	//      fight the user. Null relatedTarget (morph strip, click on
	//      non-focusable) leaves it set for observer-path restoration.
	//   2. Keyboard-drag drop is microtask-deferred: a morph that strips
	//      tabindex triggers this focusout synchronously, but MO records
	//      drain first; reconcile refocuses, the deferred check sees
	//      focus inside, drop is suppressed. A real tab-out has focus
	//      already off the sortable by then, so it still drops.
	#onFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		if (next) {
			this.#focusedItemId = "";
		} else {
			// Blur to nothing: either a morph stripped the grip (the observer
			// restore runs first, in the same microtask checkpoint, and
			// refocuses) or the user clicked empty space / pressed Escape. If
			// focus is still gone once that restore has had its turn, it was
			// the user, so drop the target so the next morph won't fight them.
			queueMicrotask(() => {
				if (this.contains(document.activeElement)) return;
				this.#focusedItemId = "";
			});
		}
		if (!this.#keyboard) return;
		queueMicrotask(() => {
			if (!this.#keyboard) return;
			if (this.contains(document.activeElement)) return;
			this.#keyboardDrop();
		});
	};
}

if (!customElements.get("neo-sortable")) {
	customElements.define("neo-sortable", NeoSortable);
}
