// The chevron and animation-wrapper markup lives in shadow so a fat morph
// reaching the host can't strip it; manual slot assignment projects the
// label and nested items, and slot= is never written to light DOM so a
// morph can't reconcile it away either.

import { boolCommand } from "../command";

const TREE_TEMPLATE = document.createElement("template");
TREE_TEMPLATE.innerHTML = `<slot></slot>`;

const ITEM_TEMPLATE = document.createElement("template");
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - :host([expanded]) [data-neo-tree-chevron]:not(.has-user-icon): default
//   chevron rotates 90deg on expand. Skipped when the author slots a custom
//   icon; rotating a folder/file icon looks wrong. Authors who want their
//   icon to swap on expand can target
//   :host([expanded]) ::slotted([slot="icon"]) themselves.
// - The chevron span + animation wrapper are hidden via inline style on the
//   shadow elements; #assignSlots toggles them.
// - [data-neo-tree-children]: animation wrapper, the grid 0fr -> 1fr trick.
ITEM_TEMPLATE.innerHTML = `
<style>
  :host { display: block; outline: none; }
  [data-neo-tree-row] {
    display: flex;
    align-items: center;
    gap: var(--neo-tree-row-gap, 0.5rem);
    padding: var(--neo-tree-row-padding, 0.3rem 0.5rem);
    cursor: pointer;
    border-radius: var(--neo-tree-row-radius, 0.25rem);
    user-select: none;
    -webkit-user-select: none;
    color: var(--page-fg);
    transition: background-color
      var(--neo-duration-hover, calc(120ms * var(--neo-duration-scale, 1)))
      var(--neo-easing, ease);
  }
  [data-neo-tree-row]:hover {
    background: var(--neo-tree-row-hover-bg, rgba(127, 127, 127, 0.12));
  }
  :host(:focus-visible) [data-neo-tree-row] {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  [data-neo-tree-chevron] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: var(--neo-tree-chevron-size, 0.85rem);
    height: var(--neo-tree-chevron-size, 0.85rem);
    color: var(--muted);
    transition: transform
      var(--neo-tree-duration, calc(200ms * var(--neo-duration-scale, 1)))
      var(--neo-easing, ease);
  }
  [data-neo-tree-chevron] neo-icon {
    --neo-icon-size: var(--neo-tree-chevron-size, 0.85rem);
    display: inline-flex;
    width: 100%;
    height: 100%;
  }
  :host([expanded]) [data-neo-tree-chevron]:not(.has-user-icon) {
    transform: rotate(90deg);
  }
  [data-neo-tree-children] {
    display: grid;
    grid-template-rows: 0fr;
    padding-left: var(--neo-tree-indent, 1.25rem);
    transition: grid-template-rows
      var(--neo-tree-duration, calc(200ms * var(--neo-duration-scale, 1)))
      var(--neo-easing, ease);
  }
  :host([expanded]) [data-neo-tree-children] {
    grid-template-rows: 1fr;
  }
  [data-neo-tree-children-inner] {
    overflow: hidden;
    min-height: 0;
  }
  @media print {
    [data-neo-tree-children] {
      display: block;
      grid-template-rows: none;
      transition: none;
    }
    :host(:not([expanded])) [data-neo-tree-children] {
      display: none;
    }
    [data-neo-tree-children-inner] {
      overflow: visible;
      min-height: auto;
    }
  }
</style>
<div data-neo-tree-row part="row">
  <span data-neo-tree-chevron aria-hidden="true">
    <slot name="icon">
      <neo-icon name="chevron-right"></neo-icon>
    </slot>
  </span>
  <slot name="label"></slot>
</div>
<div data-neo-tree-children role="group" part="children">
  <div data-neo-tree-children-inner>
    <slot name="children"></slot>
  </div>
</div>
`;

export class NeoTree extends HTMLElement {
	#observer: MutationObserver | null = null;
	// Id of the item that last held focus, for restoration after a morph.
	#focusedItemId = "";

	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(TREE_TEMPLATE.content.cloneNode(true));
	}

	connectedCallback() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "tree");
		this.addEventListener("keydown", this.#onKeyDown);
		this.addEventListener("focusin", this.#onFocusIn);
		this.addEventListener("focusout", this.#onFocusOut);
		queueMicrotask(() => this.#ensureEntry());
		// The roving tabindex is kit-set, absent from SSR, so a fat morph
		// strips it (leaving no tab stop) and blurs a focused item to
		// <body>. connectedCallback runs once; re-establish a tab stop and
		// reseat focus after every morph. Callbacks are idempotent, so the
		// observer settles even though they write tabindex themselves.
		this.#observer = new MutationObserver(() => {
			this.#ensureEntry();
			this.#restoreFocusIfLost();
		});
		this.#observer.observe(this, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["tabindex"],
		});
	}

	disconnectedCallback() {
		this.removeEventListener("keydown", this.#onKeyDown);
		this.removeEventListener("focusin", this.#onFocusIn);
		this.removeEventListener("focusout", this.#onFocusOut);
		this.#observer?.disconnect();
		this.#observer = null;
	}

	// Make the first visible item the tab-stop unless one already is.
	#ensureEntry() {
		const items = this.#allItems();
		if (items.length === 0) return;
		if (items.some((it) => it.tabIndex === 0)) return;
		const first = visibleItems(this)[0] ?? items[0];
		first.tabIndex = 0;
	}

	// Reseat focus on the item whose id matches #focusedItemId if a morph
	// stripped its tabindex (blurring it to <body>). Drops the target when
	// the item is gone so a later patch re-adding the id can't grab focus.
	#restoreFocusIfLost() {
		if (!this.#focusedItemId) return;
		if (this.contains(document.activeElement)) return;
		const ae = document.activeElement;
		if (ae && ae !== document.body) return;
		const item = this.querySelector<HTMLElement>(`neo-tree-item[id="${CSS.escape(this.#focusedItemId)}"]`);
		if (!item || !this.contains(item)) {
			this.#focusedItemId = "";
			return;
		}
		item.tabIndex = 0;
		item.focus();
	}

	#allItems(): HTMLElement[] {
		return Array.from(this.querySelectorAll<HTMLElement>("neo-tree-item"));
	}

	#onFocusIn = (e: FocusEvent) => {
		const target = e.target as HTMLElement | null;
		if (!target) return;
		const item = target.closest<HTMLElement>("neo-tree-item");
		if (!item || !this.contains(item)) return;
		this.#focusedItemId = item.id || "";
		for (const it of this.#allItems()) {
			it.tabIndex = it === item ? 0 : -1;
		}
	};

	#onFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		if (next) {
			this.#focusedItemId = "";
			return;
		}
		// Blur to nothing: a morph strip (the observer reseats focus first,
		// same microtask checkpoint) or a real click-away. Drop the target
		// only if focus is still gone after the observer ran.
		queueMicrotask(() => {
			if (this.contains(document.activeElement)) return;
			this.#focusedItemId = "";
		});
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		const active = document.activeElement;
		if (!(active instanceof HTMLElement)) return;
		if (active.tagName !== "NEO-TREE-ITEM") return;
		if (!this.contains(active)) return;
		const item = active;

		let target: HTMLElement | null = null;

		switch (e.key) {
			case "ArrowDown":
				target = nextVisible(item, this);
				break;
			case "ArrowUp":
				target = prevVisible(item, this);
				break;
			case "ArrowRight":
				if (!hasSubtree(item)) return;
				if (!item.hasAttribute("expanded")) {
					e.preventDefault();
					setExpanded(item, true);
					return;
				}
				target = firstChildItem(item);
				break;
			case "ArrowLeft":
				if (item.hasAttribute("expanded")) {
					e.preventDefault();
					setExpanded(item, false);
					return;
				}
				target = parentItem(item, this);
				break;
			case "Home":
				target = visibleItems(this)[0] ?? null;
				break;
			case "End": {
				const all = visibleItems(this);
				target = all[all.length - 1] ?? null;
				break;
			}
			default:
				return;
		}

		if (target && target !== item) {
			e.preventDefault();
			target.focus();
		}
	};
}

export class NeoTreeItem extends HTMLElement {
	static readonly observedAttributes = ["expanded"];

	#labelSlot: HTMLSlotElement;
	#iconSlot: HTMLSlotElement;
	#childrenSlot: HTMLSlotElement;
	#childrenWrapper: HTMLElement;
	#chevron: HTMLElement;
	#row: HTMLElement;
	#childObserver: MutationObserver | null = null;
	#branch = false;
	// Expanded intent; `expanded` reflects it (see command). Survives a morph
	// that strips the attribute so a fat morph omitting `expanded` can't
	// collapse an open node.
	#expandedIntent = false;
	#reflectingExpanded = false;

	constructor() {
		super();
		const root = this.attachShadow({ mode: "open", slotAssignment: "manual" });
		root.appendChild(ITEM_TEMPLATE.content.cloneNode(true));
		this.#labelSlot = root.querySelector<HTMLSlotElement>('slot[name="label"]')!;
		this.#iconSlot = root.querySelector<HTMLSlotElement>('slot[name="icon"]')!;
		this.#childrenSlot = root.querySelector<HTMLSlotElement>('slot[name="children"]')!;
		this.#childrenWrapper = root.querySelector<HTMLElement>("[data-neo-tree-children]")!;
		this.#chevron = root.querySelector<HTMLElement>("[data-neo-tree-chevron]")!;
		this.#row = root.querySelector<HTMLElement>("[data-neo-tree-row]")!;
	}

	connectedCallback() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "treeitem");
		if (!this.hasAttribute("tabindex")) this.tabIndex = -1;
		// Explicit expanded / expanded="false" commands intent; absent keeps it.
		const cmd = boolCommand(this, "expanded");
		if (cmd !== null) this.#expandedIntent = cmd;
		this.#reflectExpanded();
		if (!this.#childObserver) {
			// Morph may replace direct children wholesale; re-run slot
			// assignment on every childList change.
			this.#childObserver = new MutationObserver(() => this.#assignSlots());
			this.#childObserver.observe(this, { childList: true });
			// Click delegation lives on the shadow row, not the host. A
			// click on the chevron (in shadow) would be retargeted to the
			// host at the shadow boundary, so a host-level listener can't
			// tell it apart from a click outside the row; binding to the
			// row makes the chevron + padding + slotted label one click
			// surface and lets us use composedPath() to gate on author
			// controls.
			this.#row.addEventListener("click", this.#onClick);
			this.addEventListener("keydown", this.#onKeyDown);
		}
		this.#assignSlots();
	}

	disconnectedCallback() {
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		this.#row.removeEventListener("click", this.#onClick);
		this.removeEventListener("keydown", this.#onKeyDown);
	}

	attributeChangedCallback() {
		if (this.#reflectingExpanded) return;
		const cmd = boolCommand(this, "expanded");
		if (cmd !== null) this.#expandedIntent = cmd;
		// Absent re-asserts intent for the [expanded] CSS; explicit normalizes
		// the "true"/"false" form to bare / removed.
		this.#reflectExpanded();
	}

	// Expand or collapse this item. Idempotent; fires the toggle event.
	setExpanded(value: boolean): void {
		if (this.#expandedIntent === value) return;
		this.#expandedIntent = value;
		this.#reflectExpanded();
		this.dispatchEvent(
			new CustomEvent("neo-tree-item-toggle", {
				bubbles: true,
				detail: { expanded: value, id: this.id, item: this },
			}),
		);
	}

	// State → attribute, guarded so it isn't read back as a command. The bare
	// `expanded` attribute stays in sync with intent, so the keyboard-nav and
	// visibility helpers can keep reading hasAttribute("expanded").
	#reflectExpanded() {
		this.#reflectingExpanded = true;
		try {
			if (this.#expandedIntent) {
				if (this.getAttribute("expanded") !== "") this.setAttribute("expanded", "");
			} else if (this.hasAttribute("expanded")) {
				this.removeAttribute("expanded");
			}
		} finally {
			this.#reflectingExpanded = false;
		}
		this.#syncAria();
	}

	// True when at least one child <neo-tree-item> is assigned.
	hasSubtree(): boolean {
		return this.#branch;
	}

	// Sort light-DOM children into the label / icon / children slots
	// and refresh branch-derived state.
	#assignSlots() {
		let label: HTMLElement | null = null;
		let icon: HTMLElement | null = null;
		const items: HTMLElement[] = [];
		for (const child of Array.from(this.children)) {
			if (!(child instanceof HTMLElement)) continue;
			if (child.tagName === "NEO-TREE-ITEM") {
				items.push(child);
				continue;
			}
			if (!icon && child.getAttribute("slot") === "icon") {
				icon = child;
				continue;
			}
			if (!label && child.matches("[data-neo-tree-label]")) {
				label = child;
			}
		}
		this.#labelSlot.assign(...(label ? [label] : []));
		this.#iconSlot.assign(...(icon ? [icon] : []));
		this.#childrenSlot.assign(...items);
		this.#branch = items.length > 0;
		const hasUserIcon = icon !== null;
		// Show the chevron span when there's anything to show: a branch
		// (default chevron) or an author-supplied icon (even on leaves).
		// Inline style on shadow elements: host attributes get stripped
		// by morph (source HTML doesn't carry them) and a `hidden`
		// attribute is outranked by our `display:inline-flex` rule.
		this.#chevron.style.display = this.#branch || hasUserIcon ? "" : "none";
		this.#childrenWrapper.style.display = this.#branch ? "" : "none";
		// Custom icon → suppress the 90° rotation on expand; the class
		// gates the shadow CSS rule.
		this.#chevron.classList.toggle("has-user-icon", hasUserIcon);
		this.#syncAria();
	}

	#syncAria() {
		if (this.#branch) {
			this.setAttribute("aria-expanded", String(this.hasAttribute("expanded")));
		} else {
			this.removeAttribute("aria-expanded");
		}
		this.#childrenWrapper.toggleAttribute("inert", this.#branch && !this.hasAttribute("expanded"));
	}

	#onClick = (e: MouseEvent) => {
		if (e.defaultPrevented) return;
		// Walk composedPath from the click target up to the shadow row.
		// Any author-supplied interactive control between them claims the
		// click: buttons / links / form fields inside the slotted label.
		// Once we cross the row we stop; ancestors above the row aren't
		// part of it.
		const path = e.composedPath();
		for (const node of path) {
			if (node === this.#row) break;
			if (!(node instanceof Element)) continue;
			if (
				node.matches(
					"button, a, [role='button'], input, select, textarea, " + "neo-button, neo-checkbox, [role='checkbox']",
				)
			)
				return;
		}
		if (this.#branch) this.setExpanded(!this.hasAttribute("expanded"));
		this.focus();
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (e.target !== this) return;
		if (e.key === "Enter" || e.key === " ") {
			if (!this.#branch) return;
			e.preventDefault();
			this.setExpanded(!this.hasAttribute("expanded"));
		}
	};
}

function visibleItems(root: HTMLElement): HTMLElement[] {
	const result: HTMLElement[] = [];
	const walk = (parent: Element) => {
		for (const item of childItems(parent)) {
			result.push(item);
			if (item.hasAttribute("expanded")) walk(item);
		}
	};
	walk(root);
	return result;
}

function nextVisible(item: HTMLElement, root: HTMLElement): HTMLElement | null {
	if (item.hasAttribute("expanded")) {
		const first = firstChildItem(item);
		if (first) return first;
	}
	let node: HTMLElement | null = item;
	while (node) {
		const sib = nextSiblingItem(node);
		if (sib) return sib;
		node = parentItem(node, root);
	}
	return null;
}

function prevVisible(item: HTMLElement, root: HTMLElement): HTMLElement | null {
	const sib = prevSiblingItem(item);
	if (sib) {
		let node = sib;
		while (node.hasAttribute("expanded")) {
			const last = lastChildItem(node);
			if (!last) break;
			node = last;
		}
		return node;
	}
	return parentItem(item, root);
}

// Direct child <neo-tree-item>s. Nested items are direct light-DOM
// children of their parent <neo-tree-item>; the grouping wrapper lives
// in the shadow root, not in light DOM between them.
function childItems(parent: Element): HTMLElement[] {
	const out: HTMLElement[] = [];
	for (const c of Array.from(parent.children)) {
		if (c.tagName === "NEO-TREE-ITEM") out.push(c as HTMLElement);
	}
	return out;
}

function firstChildItem(item: HTMLElement): HTMLElement | null {
	return childItems(item)[0] ?? null;
}

function lastChildItem(item: HTMLElement): HTMLElement | null {
	const list = childItems(item);
	return list[list.length - 1] ?? null;
}

function nextSiblingItem(item: HTMLElement): HTMLElement | null {
	let n: Element | null = item.nextElementSibling;
	while (n) {
		if (n.tagName === "NEO-TREE-ITEM") return n as HTMLElement;
		n = n.nextElementSibling;
	}
	return null;
}

function prevSiblingItem(item: HTMLElement): HTMLElement | null {
	let n: Element | null = item.previousElementSibling;
	while (n) {
		if (n.tagName === "NEO-TREE-ITEM") return n as HTMLElement;
		n = n.previousElementSibling;
	}
	return null;
}

function parentItem(item: HTMLElement, stopAt?: HTMLElement): HTMLElement | null {
	let p: Element | null = item.parentElement;
	while (p) {
		if (stopAt && p === stopAt) return null;
		if (p.tagName === "NEO-TREE-ITEM") return p as HTMLElement;
		p = p.parentElement;
	}
	return null;
}

function hasSubtree(item: HTMLElement): boolean {
	const x = item as { hasSubtree?: () => boolean };
	if (typeof x.hasSubtree === "function") return x.hasSubtree();
	return firstChildItem(item) !== null;
}

function setExpanded(item: HTMLElement, value: boolean): void {
	const x = item as { setExpanded?: (v: boolean) => void };
	if (typeof x.setExpanded === "function") x.setExpanded(value);
	else item.toggleAttribute("expanded", value);
}

if (!customElements.get("neo-tree")) {
	customElements.define("neo-tree", NeoTree);
}
if (!customElements.get("neo-tree-item")) {
	customElements.define("neo-tree-item", NeoTreeItem);
}
