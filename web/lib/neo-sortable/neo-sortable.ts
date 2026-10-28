// Items stay in light DOM (the morph reconciles them); the live-region announcer lives
// in shadow so a morph can't strip it. The drag placeholder is light-DOM because
// it must occupy a flow slot, but it's transient (pointerdown to drop).
// External patch animations require prepareReorderPatch() pre-morph.

import { boolAttr } from "../command";
import { setState } from "../internal-state";
import { setAttrIfChanged } from "../neo-morph-resilient";

type Orientation = "vertical" | "horizontal" | "grid";

// How much external light-DOM change an in-flight drag survives. Each
// level is a superset of the one before it.
type MorphTolerance = "none" | "reorder" | "content" | "all";

// Who owns a completed drop. "local": the drop is final at once, and a
// later patch may reorder it away. "server": the drop is an intent, held
// against patches until the server's own markup agrees with it.
type CommitMode = "local" | "server";

// A drop this host is holding against incoming patches, keyed by item id.
interface HeldDrop {
	// Index in this host the item is kept at.
	index: number;
	// Where the drag started, for rollbackDrop.
	fromHost: NeoSortable;
	fromIndex: number;
}

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

const TOLERANCES: readonly MorphTolerance[] = ["none", "reorder", "content", "all"] as const;

const DRAG_THRESHOLD = 4;

// Backstop for dropping the move marks when no transitionend arrives:
// a transition of no duration never fires one, and a mark left behind
// would go on transitioning the author's own transforms. Comfortably
// past any reorder glide a theme would ask for.
const MOVE_MARK_MAX_MS = 1500;

// The host that received the current gesture, or null. A grouped drag
// carries the item into peer hosts, so a peer can't find the drag on
// its own #pointer / #keyboard field and reaches it through here.
// One gesture at a time: #onPointerDown and #keyboardPick both bail
// while this is set by another host.
let dragOwner: NeoSortable | null = null;

// Set while a host re-asserts held drops. Re-inserting an item mutates
// children, which re-enters the child observer; without this the hold
// answers its own mutations forever. One flag for every host, not one
// per host: the hold moves items between group members, so a sibling's
// observer would recurse where this host's would not.
let holdingOrder = false;

// Whole-item grips must not steal native control gestures.
const INTERACTIVE =
	"a[href], button, input, select, textarea, label," + " [contenteditable], [data-neo-sortable-nodrag]";

interface PointerDrag {
	pointerId: number;
	item: HTMLElement;
	// Group member the item currently sits in. Starts as the host that
	// received the gesture and follows the pointer across the group.
	host: NeoSortable;
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
	// Snapshot of d.host, re-taken on every migration: the morph
	// reconcile compares the live list against the host the item is in
	// now, not against the one the gesture started in.
	hostOrder: readonly string[];
	// id -> trimmed textContent, same scope as hostOrder. Compared against
	// the post-morph state to decide keep-dragging vs abort.
	hostContent: ReadonlyMap<string, string>;
	active: boolean;
}

interface KeyboardDrag {
	item: HTMLElement;
	host: NeoSortable;
	startIndex: number;
	lastIndex: number;
	startOrderEls: HTMLElement[];
	startOrder: string[];
	hostOrder: readonly string[];
	hostContent: ReadonlyMap<string, string>;
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

function isPointerDrag(drag: PointerDrag | KeyboardDrag): drag is PointerDrag {
	return "pointerId" in drag;
}

export class NeoSortable extends HTMLElement {
	static readonly observedAttributes = ["orientation", "disabled"];

	#pointer: PointerDrag | null = null;
	#autoScrollRaf: number | null = null;
	#keyboard: KeyboardDrag | null = null;
	#live: HTMLElement;
	#childObserver: MutationObserver | null = null;
	// Separate from #childObserver. childList triggers the FLIP/drag-
	// reconcile path; attribute strips just need #syncItems to re-stamp
	// grip flags.
	#attrObserver: MutationObserver | null = null;
	#flipRaf: number | null = null;
	#pendingPatchLayout: LayoutSnapshot | null = null;
	// Drops this host holds against patches, by item id. Only ever
	// non-empty under commit="server".
	#held = new Map<string, HeldDrop>();
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

	#internals: ElementInternals;

	constructor() {
		super();
		this.#internals = this.attachInternals();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(SHADOW_TEMPLATE.content.cloneNode(true));
		this.#live = root.querySelector<HTMLElement>("[data-neo-sortable-live]")!;
	}

	// A drag in flight, and whether it is a pointer drag. The grabbing
	// cursor belongs to a pointer reorder only; a keyboard reorder has no
	// pointer to re-cursor.
	#setDragState(kind: "pointer" | "keyboard" | null): void {
		setState(this.#internals, "active", kind !== null);
		setState(this.#internals, "pointer", kind === "pointer");
	}

	#claimDrag(): void {
		dragOwner = this;
	}

	// Idempotent: only the owner clears, and only once both its gesture
	// fields are back to null.
	#releaseDrag(): void {
		if (dragOwner === this && !this.#pointer && !this.#keyboard) dragOwner = null;
	}

	connectedCallback() {
		this.#ready = true;
		this.#ownsRole = !this.hasAttribute("role") || this.getAttribute("role") === "list";
		if (this.#ownsRole) this.setAttribute("role", "list");
		this.#syncItems();
		// subtree:true: morph can replace the unkey'd grip span; without it,
		// the new grip never re-runs #syncItems. External FLIP still
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
		this.#releaseDrag();
		// A sortable disconnected mid-drag must not leave overflow-anchor
		// pinned globally or an auto-scroll frame queued.
		while (this.#scrollAnchorLockDepth > 0) this.#unlockScrollAnchor();
		this.#stopAutoScroll();
		// Nothing left to hold anything against.
		this.#held.clear();
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

	get order(): string[] {
		return this.#logicalEls().map((el) => this.#idOf(el));
	}

	// Call immediately before a server morph that may reorder children.
	prepareReorderPatch() {
		this.#pendingPatchLayout = this.#snapshotOf(this.#items());
	}

	// Item ids this host is holding at their dropped position, waiting for
	// the server to agree. Empty unless commit="server".
	get heldDrops(): string[] {
		return [...this.#held.keys()];
	}

	// Stop holding: whatever the next patch says about these items wins.
	// For a command that succeeded but whose result differs from what the
	// user asked for, and which the hold would otherwise fight forever.
	// No id clears every held drop on this host.
	commitDrop(id?: string): void {
		if (id === undefined) this.#held.clear();
		else this.#held.delete(id);
	}

	// Stop holding and put the item back where its drag started.
	//
	// For a command that failed. A patch would repair the list on its own,
	// but the case that needs this most is the one where no patch arrives:
	// a command that never reached the server left the server's state, and
	// so every patch it sends, unaware the item ever moved.
	rollbackDrop(id?: string): void {
		for (const key of id === undefined ? [...this.#held.keys()] : [id]) {
			const held = this.#held.get(key);
			if (!held) continue;
			this.#held.delete(key);
			const el = document.getElementById(key);
			// Never yank an item out from under a hand that has it again.
			if (!el || el.hasAttribute("data-neo-sortable-dragging")) continue;
			// Animated: the user put the item here and is about to see it
			// leave, which is a fact worth showing rather than a jump.
			this.#relocate(held.fromHost, el as HTMLElement, held.fromIndex);
			held.fromHost.#syncItems();
		}
		this.#syncItems();
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

	// morph-tolerance: how much external light-DOM change an in-flight
	// drag survives. Levels nest: "reorder" allows an order-only morph,
	// "content" additionally allows per-item content to change, "all"
	// aborts only when the dragged item itself disappears.
	get #morphTolerance(): MorphTolerance {
		const v = this.getAttribute("morph-tolerance");
		return (TOLERANCES as readonly string[]).includes(v ?? "") ? (v as MorphTolerance) : "none";
	}

	// commit: who owns a completed drop. Config attribute, so absent falls
	// back to the default rather than keeping a previous value.
	get #commitMode(): CommitMode {
		return this.getAttribute("commit")?.trim().toLowerCase() === "server" ? "server" : "local";
	}

	// group: non-empty names a set of hosts that exchange items.
	get #groupName(): string {
		return this.getAttribute("group")?.trim() ?? "";
	}

	// Connected hosts, in document order, that can send and receive
	// items: same group name, not disabled. Ungrouped hosts are alone.
	#groupMembers(): NeoSortable[] {
		const name = this.#groupName;
		if (!name) return [this];
		const out: NeoSortable[] = [];
		for (const el of document.querySelectorAll("neo-sortable")) {
			if (!(el instanceof NeoSortable)) continue;
			if (el.#groupName !== name) continue;
			if (el !== this && el.#isDisabled) continue;
			out.push(el);
		}
		return out.length > 0 ? out : [this];
	}

	// The drag whose item currently sits in this host, own or adopted
	// from a group peer. Bookkeeping that describes the list the item is
	// in (item filtering, grip stamping, FLIP) reads this, not #pointer.
	get #pointerHere(): PointerDrag | null {
		const d = dragOwner ? dragOwner.#pointer : null;
		return d?.host === this ? d : null;
	}

	get #keyboardHere(): KeyboardDrag | null {
		const k = dragOwner ? dragOwner.#keyboard : null;
		return k?.host === this ? k : null;
	}

	// Name for announcements: the accessible name if the author gave one,
	// else the id.
	get #listLabel(): string {
		return this.getAttribute("aria-label")?.trim() || this.id || "list";
	}

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
		const d = this.#pointerHere;
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

	// Whitespace-normalised textContent, the cross-morph "value"
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
		// Item patched out. Focus is gone for good; drop the target so a
		// later patch re-adding the same id can't resurrect focus onto it.
		if (!item || item.parentElement !== this) {
			this.#focusedItemId = "";
			return;
		}
		this.#gripOf(item).focus?.();
	}

	// Idempotent at the attribute level. Writes go through
	// setAttrIfChanged so #attrObserver settles after 1 no-op pass.
	// Same contract as observeManagedAttrs in neo-morph-resilient.ts.
	#syncItems() {
		// Morph strips role="list" from the source on each pass.
		if (this.#ownsRole) setAttrIfChanged(this, "role", "list");
		const disabled = this.#isDisabled;
		if (disabled) setAttrIfChanged(this, "aria-disabled", "true");
		else this.removeAttribute("aria-disabled");

		const items = this.#items();
		const grips = new Set<HTMLElement>();
		const listSemantics = this.getAttribute("role") === "list";
		for (const item of items) {
			if (item === this.#pointerHere?.placeholder) continue;
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
				stale.removeAttribute("data-neo-sortable-grip");
				stale.removeAttribute("data-neo-sortable-tabindex");
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

		// Mid-drag morph: a change within this host's morph-tolerance
		// keeps the drag alive by re-linking refs; anything beyond it
		// aborts. Drag-internal mutations land here too and slip through
		// as no-ops. A grouped drag reconciles against the host holding
		// the item, so the tolerance that applies is the receiving list's.
		const ptr = this.#pointerHere;
		const drag: PointerDrag | KeyboardDrag | null = ptr?.active ? ptr : (this.#keyboardHere ?? null);
		if (drag) {
			this.#reconcileDragAgainstMutation(drag, items);
			return;
		}

		// Before measuring: the hold is part of what this patch leaves on
		// screen, so the glide below has to animate to the held order and
		// not to the one the patch asked for.
		const settled = holdingOrder || !this.#reassertHeld() ? items : this.#items();

		if (!first) return;
		const changedIds = this.#externalChangedIds(first.order, settled);
		if (changedIds === null || changedIds.size === 0) {
			return;
		}
		this.#animateFromSnapshot(first, settled, changedIds);
	};

	// Put every held item back at the index it was dropped at. Returns
	// whether anything was moved.
	//
	// Runs over the whole group rather than this host alone: a patch that
	// has not caught up puts the item back in the list it came from, so
	// the host whose children changed is not the host doing the holding.
	//
	// Nothing is released here. Releasing on "the markup already agrees"
	// looks right and is not: the drop's own DOM change agrees with itself,
	// and it reaches this observer as an ordinary mutation batch, so the
	// hold would end before the first patch ever arrived. Telling our
	// mutations from a patch's needs the observer to attribute records it
	// is not given, so a held drop ends only when the author says how it
	// ended.
	#reassertHeld(): boolean {
		let moved = false;
		holdingOrder = true;
		try {
			for (const host of this.#groupMembers()) {
				for (const [id, held] of host.#held) {
					const el = document.getElementById(id);
					if (!el) continue;
					// The user picked it up again; their hand outranks both
					// the patch and the hold.
					if (el.hasAttribute("data-neo-sortable-dragging")) continue;
					const items = host.#items();
					if (el.parentElement === host && items.indexOf(el) === held.index) continue;
					const rest = items.filter((x) => x !== el);
					host.insertBefore(el, rest[held.index] ?? null);
					moved = true;
				}
			}
		} finally {
			holdingOrder = false;
		}
		if (moved) for (const host of this.#groupMembers()) host.#syncItems();
		return moved;
	}

	// Record a drop the server has not confirmed. No id means nothing can
	// be matched against a later patch, so there is nothing to hold.
	#holdDrop(id: string, index: number, fromHost: NeoSortable, fromIndex: number): void {
		if (!id || this.#commitMode !== "server") return;
		this.#held.set(id, { index, fromHost, fromIndex });
	}

	// Whether the live list is still within this host's morph-tolerance
	// of the snapshot taken when the drag entered it. Levels nest:
	//   - none (default): same id order, same content; dragged item free
	//     to roam.
	//   - reorder: same id set, same per-id content, order ignored.
	//   - content: same id set, per-id content free to change.
	//   - all: only the dragged item's survival matters.
	#semanticsUnchanged(drag: PointerDrag | KeyboardDrag, items: HTMLElement[], dragId: string): boolean {
		// Losing the dragged item ends the drag at every level: there is
		// nothing left to carry.
		const liveDragEl = items.find((el) => this.#idOf(el) === dragId);
		if (!liveDragEl) return false;
		const tolerance = this.#morphTolerance;
		if (tolerance === "all") return true;

		if (items.length !== drag.hostContent.size) return false;
		if (tolerance === "reorder" || tolerance === "content") {
			const compareContent = tolerance === "reorder";
			const seen = new Set<string>();
			for (const el of items) {
				const id = this.#idOf(el);
				if (!id) return false;
				if (seen.has(id)) return false;
				seen.add(id);
				if (!drag.hostContent.has(id)) return false;
				if (compareContent && drag.hostContent.get(id) !== this.#contentOf(el)) return false;
			}
			// Set-equality holds here: same length + every live id in
			// hostContent + no duplicates -> every hostContent id in live.
			return true;
		}
		// none: compare ordered ids with the dragged slot dropped on
		// both sides (the user is moving it).
		const startNoDrag = drag.hostOrder.filter((id) => id !== dragId);
		const liveNoDrag = items.filter((el) => el !== liveDragEl).map((el) => this.#idOf(el));
		if (!arraysEqual(liveNoDrag, startNoDrag)) return false;
		for (const el of items) {
			const id = this.#idOf(el);
			if (drag.hostContent.get(id) !== this.#contentOf(el)) return false;
		}
		return true;
	}

	#reconcileDragAgainstMutation(drag: PointerDrag | KeyboardDrag, items: HTMLElement[]): void {
		const dragId = this.#idOf(drag.item);
		// No stable id -> can't distinguish node-recreate from content-swap.
		// Ignore; ids on every <neo-sortable-item> are the authoring contract.
		if (!dragId) return;
		if (!this.#semanticsUnchanged(drag, items, dragId)) {
			this.#abortDragForExternalChange(drag);
			return;
		}
		// On a no-op morph, re-link the dragged ref by id so future
		// pointer/key events act on the live node.
		const liveDragEl = items.find((el) => this.#idOf(el) === dragId)!;
		const keyboard = isPointerDrag(drag) ? null : drag;
		drag.item.removeAttribute("data-neo-sortable-dragging");
		liveDragEl.setAttribute("data-neo-sortable-dragging", "");
		if (keyboard && liveDragEl !== drag.item) {
			drag.item.removeAttribute("aria-grabbed");
			liveDragEl.setAttribute("aria-grabbed", "true");
		}
		drag.item = liveDragEl;
		// Re-stamp the role stripped by morph when the component owns it.
		// The drag states are custom states, out of a morph's reach.
		if (this.#ownsRole) setAttrIfChanged(this, "role", "list");
		if (keyboard) {
			drag.item.setAttribute("aria-grabbed", "true");
			// Morph stripped tabindex (or replaced the grip span) and the
			// browser blurred synchronously. #onFocusOut deferred its drop;
			// this refocus runs first.
			this.#gripOf(drag.item).focus?.();
		}
		// A tolerated morph can have reordered or replaced the items this
		// host holds, so the baseline the next mutation is judged against
		// is the list as it stands now, not as it stood at pick-up.
		drag.hostOrder = this.order;
		drag.hostContent = this.#snapshotContent(items);
		const ptr = isPointerDrag(drag) ? drag : null;
		if (ptr) {
			// Morph reconciled d.item's inline style to source; the
			// position:fixed block is gone. Re-apply to keep it floating.
			this.#applyPointerFloatStyles(ptr);
			// The placeholder is light-DOM with no id in the morph source.
			// Morph either strips it or position-pairs it into a real
			// item. In the second case d.placeholder is still connected but
			// masquerading; trust the marker, not identity, and rebuild if gone.
			const phStale = !ptr.placeholder.isConnected || !ptr.placeholder.hasAttribute("data-neo-sortable-placeholder");
			if (phStale) {
				ptr.placeholder = this.#rebuildPlaceholder(ptr);
			}
			// Re-attach at the current drop slot (d.lastIndex), not the
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

	// Tear down the drag because slot data changed under it. Don't restore
	// because the morph owns the new state. Emit neo-sortable-end with aborted:
	// true so hosts can distinguish from cancel / clean drop.
	#abortDragForExternalChange(drag: PointerDrag | KeyboardDrag): void {
		// Gesture state lives on the host that received it; the DOM to
		// clean up lives in the host the item ended up in. For an
		// ungrouped drag the two are the same element.
		const owner = dragOwner ?? this;
		const host = drag.host;
		if (isPointerDrag(drag)) {
			const d = drag;
			// Latch before clearing #pointer. The document listeners stay attached
			// but switch to absorb-only until pointerup. This stops the browser from
			// growing a native text-selection drag from the original mousedown anchor.
			owner.#abortedPointerId = d.pointerId;
			owner.#pointer = null;
			owner.#releaseDrag();
			owner.#clearFlip();
			host.#clearFlip();
			d.proxy?.remove();
			// Morph can position-pair our unkey'd placeholder into a real item,
			// and d.placeholder by identity may then be a live entry.
			// Only strip nodes that still carry the marker.
			if (d.placeholder.isConnected && d.placeholder.hasAttribute("data-neo-sortable-placeholder")) {
				d.placeholder.remove();
			}
			// Sweep stray placeholder-marked nodes
			// (re-emitted by morph, nested-sortable leakage).
			for (const stray of host.querySelectorAll<HTMLElement>(":scope > [data-neo-sortable-placeholder]")) {
				stray.remove();
			}
			// d.item may have been removed by morph; touch only if attached.
			if (d.item.isConnected) {
				d.item.style.cssText = d.savedCss;
				d.item.removeAttribute("data-neo-sortable-dragging");
			}
			host.#setDragState(null);
			owner.#setDragState(null);
			// Drop any text selection the browser grew between mousedown
			// and now (pre-threshold move, or a selection inside the item).
			const sel = document.getSelection();
			sel?.removeAllRanges?.();
			owner.#emit("neo-sortable-end", d.item, {
				id: this.#idOf(d.item),
				from: d.startIndex,
				to: -1,
				changed: false,
				aborted: true,
				fromList: owner.id,
				toList: host.id,
			});
		} else {
			const k = drag;
			owner.#keyboard = null;
			owner.#releaseDrag();
			owner.#clearFlip();
			host.#clearFlip();
			if (k.item.isConnected) {
				k.item.removeAttribute("data-neo-sortable-dragging");
				k.item.removeAttribute("aria-grabbed");
			}
			host.#setDragState(null);
			owner.#setDragState(null);
			owner.#unlockScrollAnchor();
			host.#announce("Reordering cancelled. List updated by another source.");
			owner.#emit("neo-sortable-end", k.item, {
				id: this.#idOf(k.item),
				from: k.startIndex,
				to: -1,
				changed: false,
				aborted: true,
				fromList: owner.id,
				toList: host.id,
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
		const d = this.#pointerHere;
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

	// moving names the node the mutation relocates, for the migration
	// case where it isn't in this host's drag state yet.
	#flipReorder(mutate: () => void, moving: HTMLElement | null = null) {
		const d = this.#pointerHere;
		const dragged = moving ?? (d?.active ? d.item : null);
		const els = this.#items().filter((el) => el !== dragged && el !== d?.placeholder);
		const first = this.#snapshotOf(els);
		mutate();
		this.#animateFromSnapshot(first, els);
	}

	#animateFromSnapshot(first: LayoutSnapshot, els: HTMLElement[], onlyIds: ReadonlySet<string> | null = null) {
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
			for (const [el] of invert) this.#startMove(el, false);
		});
	}

	// Hand the element to the stylesheet. The mark is what selects the
	// transition rule, clearing the inline `transition: none` lets it
	// apply, and clearing the transform is the change it animates. Nothing
	// about the timing is decided here, which is what lets a theme, a
	// media query, or a per-item rule reach it.
	#startMove(el: HTMLElement, docking: boolean): void {
		el.setAttribute("data-neo-sortable-moving", "");
		if (docking) el.setAttribute("data-neo-sortable-docking", "");
		el.style.transition = "";
		el.style.transform = "";
		el.addEventListener("transitionend", this.#onFlipEnd);
		// A transition of no duration (reduced motion, or an author rule
		// that turns it off) never fires transitionend, and a mark left
		// behind would go on transitioning the author's own transforms.
		el.removeEventListener("transitioncancel", this.#onFlipEnd);
		el.addEventListener("transitioncancel", this.#onFlipEnd);
		window.setTimeout(() => this.#endMove(el), MOVE_MARK_MAX_MS);
	}

	#endMove(el: HTMLElement): void {
		el.removeEventListener("transitionend", this.#onFlipEnd);
		el.removeEventListener("transitioncancel", this.#onFlipEnd);
		el.removeAttribute("data-neo-sortable-moving");
		el.removeAttribute("data-neo-sortable-docking");
		el.style.transition = "";
		el.style.transform = "";
	}

	// Glide one item from where it was to where it now is. FLIP, but for a
	// single node whose "before" is a rect rather than a snapshot: the
	// dragged item has been following the pointer instead of sitting in a
	// slot, so there is no earlier layout pass to read it from.
	//
	// Both rects are viewport-relative and measured within the same frame,
	// so no scroll can happen between them.
	#dock(item: HTMLElement, from: DOMRectReadOnly): void {
		const to = item.getBoundingClientRect();
		const dx = from.left - to.left;
		const dy = from.top - to.top;
		if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
		item.removeEventListener("transitionend", this.#onFlipEnd);
		item.style.transition = "none";
		item.style.transform = `translate(${dx}px, ${dy}px)`;
		requestAnimationFrame(() => this.#startMove(item, true));
	}

	// Move an item to a slot and animate everything the move disturbs: the
	// item travels with #dock, the lists it leaves and joins glide their
	// own rows. For a relocation nobody is dragging, which is why the item
	// is animated at all: no pointer is already showing where it went.
	#relocate(toHost: NeoSortable, item: HTMLElement, index: number): void {
		const fromHost = item.parentElement instanceof NeoSortable ? item.parentElement : null;
		const itemFrom = item.getBoundingClientRect();
		const crossed = fromHost !== null && fromHost !== toHost ? fromHost : null;
		const fromFirst = crossed ? crossed.#snapshotOf(crossed.#items().filter((x) => x !== item)) : null;
		toHost.#flipReorder(() => {
			const rest = toHost.#items().filter((x) => x !== item);
			toHost.insertBefore(item, rest[index] ?? null);
		}, item);
		if (crossed && fromFirst) crossed.#animateFromSnapshot(fromFirst, crossed.#items());
		toHost.#dock(item, itemFrom);
	}

	#snapshotRectFor(snapshot: LayoutSnapshot, el: HTMLElement): DOMRectReadOnly | undefined {
		const id = this.#idOf(el);
		const byEl = snapshot.byEl.get(el);
		if (byEl && byEl.id === id) return byEl.rect;
		return id ? snapshot.byId.get(id) : byEl?.rect;
	}

	#onFlipEnd = (e: TransitionEvent) => {
		if (e.propertyName !== "transform") return;
		this.#endMove(e.currentTarget as HTMLElement);
	};

	#clearFlip() {
		if (this.#flipRaf !== null) {
			cancelAnimationFrame(this.#flipRaf);
			this.#flipRaf = null;
		}
		for (const el of this.#items()) {
			if (el.style.transition || el.style.transform || el.hasAttribute("data-neo-sortable-moving")) {
				this.#endMove(el);
			}
		}
	}

	// Group member under the point, innermost first so a nested sortable
	// wins over its container. Off every member (the gap between columns,
	// outside the board) keeps the current host, so travel between two
	// lists never drops the item back home mid-flight.
	#groupHostAt(d: PointerDrag, clientX: number, clientY: number, members: NeoSortable[]): NeoSortable {
		let best: NeoSortable | null = null;
		let bestArea = Number.POSITIVE_INFINITY;
		for (const member of members) {
			const r = member.getBoundingClientRect();
			if (clientX < r.left || clientX > r.right) continue;
			if (clientY < r.top || clientY > r.bottom) continue;
			const area = r.width * r.height;
			if (area < bestArea) {
				best = member;
				bestArea = area;
			}
		}
		return best ?? d.host;
	}

	// Viewport box the floating element is clamped to: the host for a
	// lone sortable, the union of the group for connected ones, so an
	// item can be carried between lists without escaping the board.
	// Null when unbounded.
	#dragBounds(members: NeoSortable[]): { left: number; top: number; right: number; bottom: number } | null {
		if (this.#isUnbounded) return null;
		let left = Number.POSITIVE_INFINITY;
		let top = Number.POSITIVE_INFINITY;
		let right = Number.NEGATIVE_INFINITY;
		let bottom = Number.NEGATIVE_INFINITY;
		for (const member of members) {
			const r = member.getBoundingClientRect();
			left = Math.min(left, r.left);
			top = Math.min(top, r.top);
			right = Math.max(right, r.right);
			bottom = Math.max(bottom, r.bottom);
		}
		return Number.isFinite(left) ? { left, top, right, bottom } : null;
	}

	// Hand the item to another group member: reparent inside a FLIP on
	// both lists so the vacated slot closes as the new one opens, then
	// re-baseline the morph snapshot against the receiving list.
	#migrate(d: PointerDrag | KeyboardDrag, target: NeoSortable, ref: HTMLElement | null, moving: HTMLElement): void {
		const from = d.host;
		const fromEls = from.#items().filter((el) => el !== moving);
		const fromFirst = from.#snapshotOf(fromEls);
		target.#flipReorder(() => {
			target.insertBefore(moving, ref);
		}, moving);
		from.#animateFromSnapshot(fromFirst, fromEls);
		d.host = target;
		// `this` is the gesture owner, which keeps its drag state for the
		// whole gesture (selection stays suppressed in the list the item
		// came from). A peer only carries it while it holds the item.
		// To style just the receiving list, match
		// neo-sortable:has([data-neo-sortable-dragging]).
		if (from !== this) from.#setDragState(null);
		target.#setDragState(isPointerDrag(d) ? "pointer" : "keyboard");
		from.#syncItems();
		target.#syncItems();
		d.hostOrder = target.order;
		d.hostContent = target.#snapshotContent(target.#items());
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

	// Dispatched on the item the gesture concerns, and bubbling, so a
	// listener on the host still sees every event while a listener on an
	// item sees only its own. Per-item delivery is what lets an author
	// bind state to the thing that moved (a request indicator, a pending
	// marker) instead of demultiplexing one host-level event by id.
	//
	// The host is the fallback for a detached item: the external-change
	// abort runs because a morph took the item out of the tree, and an
	// event fired on a parentless node reaches nobody, least of all the
	// host that has to hear the drag ended.
	#emit(
		type: "neo-sortable-start" | "neo-sortable-move" | "neo-sortable-end",
		item: HTMLElement,
		detail: Record<string, unknown>,
	) {
		const target = item.isConnected ? item : this;
		target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
	}

	#onPointerDown = (e: PointerEvent) => {
		if (this.#isDisabled || dragOwner) return;
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
		this.#claimDrag();
		this.#pointer = {
			pointerId: e.pointerId,
			item,
			host: this,
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
			hostOrder: this.order,
			hostContent: this.#snapshotContent(items),
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

		// Proxy mode: a body-level clone floats while the real item stays
		// in flow as its own gap. Grid needs it because a 2-D reorder has
		// no single stable axis; a group needs it because the item has to
		// cross into a host that would otherwise clip it, and because
		// moving one node (rather than item plus detached placeholder)
		// keeps the hand-off atomic.
		if (this.#orientation === "grid" || this.#groupName !== "") {
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

		this.#setDragState("pointer");
		d.item.setAttribute("data-neo-sortable-dragging", "");
		this.setPointerCapture?.(e.pointerId);
		this.#lockScrollAnchor();
		// Every group member's scrollers, so edge auto-scroll still pans
		// the list the item is being carried into.
		d.scrollers = [...new Set(this.#groupMembers().flatMap((m) => m.#scrollers()))];
		this.#autoScrollRaf ??= requestAnimationFrame(this.#autoScrollTick);
		this.#emit("neo-sortable-start", d.item, {
			id: this.#idOf(d.item),
			index: d.startIndex,
			list: this.id,
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
		// One membership read per move: both the hit-test and the clamp
		// need it, and a pointer move is a per-frame path.
		const members = this.#groupMembers();
		const target = this.#groupHostAt(d, clientX, clientY, members);
		const o = target.#orientation;
		const dragEl = d.proxy ?? d.item;
		// Natural (unclamped) position the floating element would take.
		// A grouped list never locks an axis: the peer lists sit off the
		// reorder axis, so locking would make them unreachable.
		const grouped = this.#groupName !== "";
		const rawLeft = !grouped && o === "vertical" ? d.homeLeft : clientX - d.grabX;
		const rawTop = !grouped && o === "horizontal" ? d.homeTop : clientY - d.grabY;
		let left = rawLeft;
		let top = rawTop;
		// Clamp only the visual position (fixed = viewport coords);
		// the hit-test stays on unclamped coords so clamping can't block the
		// last slot. The lower bound takes precedence for over-sized items.
		const bounds = this.#dragBounds(members);
		if (bounds) {
			left = Math.min(Math.max(left, bounds.left), Math.max(bounds.left, bounds.right - d.w));
			top = Math.min(Math.max(top, bounds.top), Math.max(bounds.top, bounds.bottom - d.h));
		}
		dragEl.style.left = `${left}px`;
		dragEl.style.top = `${top}px`;
		// Cached for the reconcile path, which re-applies them after a
		// no-op morph strips d.item's inline style.
		d.lastLeft = left;
		d.lastTop = top;

		const migrating = target !== d.host;
		const siblings = target.#items().filter((el) => el !== d.item && el !== d.placeholder);
		let targetX = clientX;
		let targetY = clientY;
		if (o === "grid") {
			// Tile center from the unclamped position;
			// `bounded` must not shrink the reachable target area.
			targetX = rawLeft + d.w / 2;
			targetY = rawTop + d.h / 2;
		}
		const idx = target.#targetIndexIn(siblings, targetX, targetY);
		if (!migrating && target.#logicalIndex(d.item) === idx) return;
		const ref = siblings[idx] ?? null;
		const from = d.host;
		// Proxy mode moves the real item (it is its own gap); otherwise
		// the placeholder holds the slot and the item floats detached.
		const moving = d.proxy ? d.item : d.placeholder;

		if (migrating) {
			this.#migrate(d, target, ref, moving);
		} else {
			target.#flipReorder(() => {
				target.insertBefore(moving, ref);
			}, moving);
		}
		const to = target.#logicalIndex(d.item);
		this.#emit("neo-sortable-move", d.item, {
			id: this.#idOf(d.item),
			from: d.lastIndex,
			to,
			fromList: from.id,
			toList: target.id,
		});
		d.lastIndex = to;
	}

	// The host and its scrollable element ancestors (nearest first),
	// excluding the document root. Edge auto-scroll pans these so a
	// lifted item can reach slots scrolled out of view. The page itself
	// is left alone; the drag holds overflow-anchor:none and must not
	// move it.
	//
	// The walk starts at the host, not above it: a list that scrolls its
	// own overflow is the ordinary way to cap one, and skipping it left
	// exactly the list the item is being dragged through unable to
	// scroll.
	#scrollers(): HTMLElement[] {
		const out: HTMLElement[] = [];
		let el: HTMLElement | null = this;
		while (el && el !== document.body && el !== document.documentElement) {
			const s = getComputedStyle(el);
			const y = (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight;
			const x = (s.overflowX === "auto" || s.overflowX === "scroll") && el.scrollWidth > el.clientWidth;
			if (y || x) out.push(el);
			el = el.parentElement;
		}
		return out;
	}

	// Keep a keyboard-moved item visible by panning its scrollable ancestors.
	// Uses the settled layout rect (#layoutRect) so an in-flight FLIP transform
	// can't aim the scroll at the vacated slot.
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
			// A held arrow key retargets instead of stacking because scrollBy
			// recomputes from the live (possibly mid-animation) position.
			if (dx || dy) sc.scrollBy({ top: dy, left: dx, behavior });
		}
	}

	// Pan a scrollable ancestor while the pointer rests in its edge band,
	// then re-run the hit-test so the placeholder chases the newly revealed slots.
	// Runs for the whole pointer drag; a frame with no edge contact is a cheap no-op.
	#autoScrollTick = () => {
		const d = this.#pointer;
		if (!d?.active) {
			this.#autoScrollRaf = null;
			return;
		}
		const EDGE = 48;
		const MAX = 16;
		// The lifted element's own edges drive the pan, not the pointer.
		// The item reaches the boundary first, and where it was grabbed
		// should not decide when the list moves: held near its top, a
		// pointer-driven band would make the item overhang the edge long
		// before anything scrolled.
		const box = (d.proxy ?? d.item).getBoundingClientRect();
		let scrolled = false;
		for (const sc of d.scrollers) {
			if (!sc.isConnected) continue;
			const r = sc.getBoundingClientRect();
			let dy = 0;
			if (sc.scrollHeight > sc.clientHeight) {
				// How far each edge has pushed into its band. An item
				// taller than the band leaves both positive, so the deeper
				// one wins rather than whichever is tested first.
				const above = r.top + EDGE - box.top;
				const below = box.bottom - (r.bottom - EDGE);
				if (above > below && above > 0 && sc.scrollTop > 0) {
					dy = -MAX * Math.min(1, above / EDGE);
				} else if (below > 0 && sc.scrollTop < sc.scrollHeight - sc.clientHeight) {
					dy = MAX * Math.min(1, below / EDGE);
				}
			}
			let dx = 0;
			if (sc.scrollWidth > sc.clientWidth) {
				const before = r.left + EDGE - box.left;
				const after = box.right - (r.right - EDGE);
				if (before > after && before > 0 && sc.scrollLeft > 0) {
					dx = -MAX * Math.min(1, before / EDGE);
				} else if (after > 0 && sc.scrollLeft < sc.scrollWidth - sc.clientWidth) {
					dx = MAX * Math.min(1, after / EDGE);
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
		this.#releaseDrag();
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
		this.#releaseDrag();
		this.#stopAutoScroll();

		// A click, not a drag, never promoted and never locked the anchor.
		if (!d.active) return;
		this.#unlockScrollAnchor();

		const host = d.host;
		// Where the item was left, measured before teardown puts it back in
		// flow. In proxy mode the item itself never moved and the proxy is
		// what the user was carrying.
		const releasedAt = (d.proxy ?? d.item).getBoundingClientRect();
		this.#clearFlip();
		host.#clearFlip();
		d.proxy?.remove();
		if (d.proxy) d.placeholder.remove();
		d.item.style.cssText = d.savedCss;
		d.item.removeAttribute("data-neo-sortable-dragging");
		host.#setDragState(null);
		this.#setDragState(null);

		if (cancelled) {
			if (!d.proxy) d.placeholder.remove();
			// startOrderEls belong to the origin, so this pulls a migrated
			// item back out of whichever host it reached.
			this.#restore(d.startOrderEls);
			d.host = this;
			host.#syncItems();
			this.#syncItems();
		} else {
			if (!d.proxy) d.placeholder.replaceWith(d.item);
		}

		const dropHost = cancelled ? this : host;
		// Close the gap the release opened: the pointer let go somewhere
		// between slots, and the item would otherwise appear in its slot on
		// the next frame with nothing connecting the two positions.
		dropHost.#dock(d.item, releasedAt);
		// A cross-list drop changed the board even when the origin's own
		// order came back identical.
		const changed = !cancelled && (dropHost !== this || !arraysEqual(d.startOrder, this.order));
		const to = dropHost.#items().indexOf(d.item);
		// Held before the event, so a handler that commits or rolls back
		// synchronously acts on a drop that is already recorded.
		if (changed) dropHost.#holdDrop(this.#idOf(d.item), to, this, d.startIndex);
		this.#emit("neo-sortable-end", d.item, {
			id: this.#idOf(d.item),
			from: d.startIndex,
			to,
			changed,
			fromList: this.id,
			toList: dropHost.id,
		});
	}

	#cancelPointer() {
		if (this.#pointer) this.#finishPointer(true);
	}

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
		// Same exemption the pointer path applies: with no handle the
		// whole item is the grip, so a field inside it would otherwise
		// lose Enter, Space, and the arrows to the reorder gesture.
		if (!item.querySelector("[data-neo-sortable-handle]")) {
			const hit = target.closest(INTERACTIVE);
			if (hit && item.contains(hit)) return;
		}

		// A held item carries focus into the host it was moved to, so the
		// keydown lands on a peer that holds no gesture state. Drive the
		// owner throughout; for a lone sortable it is this element.
		const owner = dragOwner ?? this;
		const key = e.key;
		// Space/Enter picks the focused item up, or drops the held one.
		if (key === " " || key === "Enter") {
			e.preventDefault();
			if (owner.#keyboard) owner.#keyboardDrop();
			else if (!dragOwner) this.#keyboardPick(item);
			return;
		}
		if (key === "Escape") {
			if (!owner.#keyboard) return;
			e.preventDefault();
			owner.#keyboardCancel();
			return;
		}

		// Reorder keys move the held item only; pick it up with Space/Enter first.
		// Without a pickup, defer to the browser so the focused grip
		// scrolls/navigates normally. Tab/blur drops, Escape reverts.
		const k = owner.#keyboard;
		if (!k) return;
		const isHome = key === "Home";
		const isEnd = key === "End";
		// Grouped lists spend the cross-axis arrows on list-to-list
		// travel, so check that before the in-list step.
		const listStep = owner.#keyListStep(key);
		if (listStep !== 0) {
			e.preventDefault();
			owner.#keyboardMoveToList(listStep);
			return;
		}
		const step = owner.#keyStep(key);
		if (!isHome && !isEnd && step === 0) return;
		e.preventDefault();
		if (isHome) owner.#keyboardMoveTo(0);
		else if (isEnd) owner.#keyboardMoveTo(k.host.#items().length - 1);
		else owner.#keyboardMove(step);
	};

	#keyStep(key: string): number {
		const k = this.#keyboard;
		const o = k ? k.host.#orientation : this.#orientation;
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

	// Cross-list step for a grouped drag: the arrows the reorder axis
	// leaves free. A grid host uses all four, so it has no keyboard
	// hand-off.
	#keyListStep(key: string): number {
		const k = this.#keyboard;
		if (!k || this.#groupName === "") return 0;
		const o = k.host.#orientation;
		if (o === "vertical") {
			if (key === "ArrowLeft") return -1;
			if (key === "ArrowRight") return 1;
		} else if (o === "horizontal") {
			if (key === "ArrowUp") return -1;
			if (key === "ArrowDown") return 1;
		}
		return 0;
	}

	// Carry the held item to the adjacent group member, keeping its
	// index so it lands beside where it left.
	#keyboardMoveToList(step: number) {
		const k = this.#keyboard;
		if (!k) return;
		const members = this.#groupMembers();
		const at = members.indexOf(k.host);
		const next = members[at + step];
		if (at < 0 || !next) return;
		const from = k.host;
		const index = from.#items().indexOf(k.item);
		const siblings = next.#items();
		const ref = siblings[Math.min(Math.max(index, 0), siblings.length)] ?? null;
		this.#migrate(k, next, ref, k.item);
		k.lastIndex = next.#items().indexOf(k.item);
		this.#emit("neo-sortable-move", k.item, {
			id: this.#idOf(k.item),
			from: index,
			to: k.lastIndex,
			fromList: from.id,
			toList: next.id,
		});
		this.#gripOf(k.item).focus?.({ preventScroll: true });
		next.#scrollItemIntoView(k.item);
		next.#announce(`${next.#listLabel}. Position ${k.lastIndex + 1} of ${next.#items().length}.`);
	}

	#keyboardPick(item: HTMLElement) {
		const items = this.#items();
		const startIndex = items.indexOf(item);
		this.#claimDrag();
		this.#keyboard = {
			item,
			host: this,
			startIndex,
			lastIndex: startIndex,
			startOrderEls: items.slice(),
			startOrder: this.order,
			hostOrder: this.order,
			hostContent: this.#snapshotContent(items),
		};
		this.#setDragState("keyboard");
		item.setAttribute("data-neo-sortable-dragging", "");
		item.setAttribute("aria-grabbed", "true");
		this.#lockScrollAnchor();
		this.#emit("neo-sortable-start", item, {
			id: this.#idOf(item),
			index: startIndex,
			list: this.id,
		});
		const across = this.#groupName !== "" && this.#orientation !== "grid";
		this.#announce(
			`Moving. Position ${startIndex + 1} of ${items.length}. ` +
				`Arrow keys or home and end to move, ` +
				(across ? `${this.#orientation === "vertical" ? "left and right" : "up and down"} to change list, ` : "") +
				`tab away to drop, escape to cancel.`,
		);
	}

	#keyboardMove(step: number) {
		const k = this.#keyboard;
		if (!k) return;
		const cur = k.host.#items().indexOf(k.item);
		this.#keyboardMoveTo(cur + step);
	}

	#keyboardMoveTo(index: number) {
		const k = this.#keyboard;
		if (!k) return;
		const host = k.host;
		const items = host.#items();
		const cur = items.indexOf(k.item);
		const next = Math.max(0, Math.min(items.length - 1, index));
		if (next === cur) return;
		let changed = false;
		host.#flipReorder(() => {
			changed = host.#placeItemAt(k.item, next);
		}, k.item);
		if (!changed) return;
		const to = host.#items().indexOf(k.item);
		this.#emit("neo-sortable-move", k.item, {
			id: this.#idOf(k.item),
			from: k.lastIndex,
			to,
			fromList: host.id,
			toList: host.id,
		});
		k.lastIndex = to;
		// ATs may drop focus on reparenting. preventScroll because the
		// default focus scroll targets the in-flight FLIP box;
		// our own scroll uses the settled layout rect.
		this.#gripOf(k.item).focus?.({ preventScroll: true });
		host.#scrollItemIntoView(k.item);
		host.#announce(`Position ${to + 1} of ${items.length}.`);
	}

	#keyboardDrop() {
		const k = this.#keyboard;
		if (!k) return;
		const host = k.host;
		this.#keyboard = null;
		this.#releaseDrag();
		k.item.removeAttribute("data-neo-sortable-dragging");
		k.item.removeAttribute("aria-grabbed");
		host.#setDragState(null);
		this.#setDragState(null);
		this.#unlockScrollAnchor();
		const items = host.#items();
		const count = items.length;
		const to = items.indexOf(k.item);
		const changed = host !== this || !arraysEqual(k.startOrder, this.order);
		if (changed) host.#holdDrop(this.#idOf(k.item), to, this, k.startIndex);
		this.#emit("neo-sortable-end", k.item, {
			id: this.#idOf(k.item),
			from: k.startIndex,
			to,
			changed,
			fromList: this.id,
			toList: host.id,
		});
		host.#announce(
			changed
				? host === this
					? `Dropped at position ${to + 1} of ${count}.`
					: `Dropped in ${host.#listLabel} at position ${to + 1} of ${count}.`
				: `Dropped. Order unchanged.`,
		);
	}

	#keyboardCancel() {
		const k = this.#keyboard;
		if (!k) return;
		const host = k.host;
		this.#keyboard = null;
		this.#releaseDrag();
		this.#clearFlip();
		host.#clearFlip();
		// startOrderEls belong to the origin, so a held item that
		// travelled comes back with them.
		this.#restore(k.startOrderEls);
		k.host = this;
		if (host !== this) {
			host.#syncItems();
			this.#syncItems();
		}
		k.item.removeAttribute("data-neo-sortable-dragging");
		k.item.removeAttribute("aria-grabbed");
		host.#setDragState(null);
		this.#setDragState(null);
		this.#unlockScrollAnchor();
		this.#gripOf(k.item).focus?.();
		this.#emit("neo-sortable-end", k.item, {
			id: this.#idOf(k.item),
			from: k.startIndex,
			to: k.startIndex,
			changed: false,
			fromList: this.id,
			toList: this.id,
		});
		this.#announce("Reordering cancelled.");
	}

	// Track the grip's item id for #restoreFocusIfLost after a morph strips tabindex.
	#onFocusIn = (e: FocusEvent) => {
		const item = this.#itemContaining(e.target as Element | null);
		this.#focusedItemId = item ? this.#idOf(item) : "";
	};

	// 1. A non-null relatedTarget outside this sortable means real
	//    tab-out -> clear #focusedItemId so #restoreFocusIfLost won't fight the user.
	//    Null relatedTarget (morph strip, click on non-focusable)
	//    leaves it set for observer-path restoration.
	// 2. Keyboard-drag drop is microtask-deferred. A morph that strips
	//    tabindex triggers this focusout synchronously, but MO records
	//    drain first; reconcile refocuses, the deferred check sees
	//    focus inside, drop is suppressed. A real tab-out has focus
	//    already off the sortable by then and still drops.
	#onFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		// A held item carries focus into the host it travelled to; that
		// is still inside the gesture, not a tab-out.
		const held = this.#keyboard?.host;
		if (held && held !== this && next && held.contains(next)) return;
		if (next) {
			this.#focusedItemId = "";
		} else {
			// On a blur to nothing, either a morph stripped the grip
			// (the observer restore runs first, in the same microtask checkpoint, and
			// refocuses) or the user clicked empty space / pressed Escape.
			// If focus is still gone once that restore has had its turn,
			// it was the user. Drop the target so the next morph won't fight them.
			queueMicrotask(() => {
				if (this.contains(document.activeElement)) return;
				this.#focusedItemId = "";
			});
		}
		if (!this.#keyboard) return;
		queueMicrotask(() => {
			const k = this.#keyboard;
			if (!k) return;
			if (this.contains(document.activeElement)) return;
			if (k.host !== this && k.host.contains(document.activeElement)) return;
			this.#keyboardDrop();
		});
	};
}

if (!customElements.get("neo-sortable")) {
	customElements.define("neo-sortable", NeoSortable);
}
