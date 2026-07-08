import "../neo-button";
import "../neo-icon";
import { boolAttr } from "../command";
import { clampInt } from "../num";

const ATTR_PAGE = "page";
const ATTR_PAGES = "pages";
const ATTR_SIBLING_COUNT = "sibling-count";
const ATTR_BOUNDARY_COUNT = "boundary-count";
const ATTR_DISABLED = "disabled";

const DEFAULT_PREV_HTML = `<neo-icon name="chevron-left"></neo-icon>`;
const DEFAULT_NEXT_HTML = `<neo-icon name="chevron-right"></neo-icon>`;

export class NeoPagination extends HTMLElement {
	static readonly observedAttributes = [ATTR_PAGE, ATTR_PAGES, ATTR_SIBLING_COUNT, ATTR_BOUNDARY_COUNT, ATTR_DISABLED];

	#resizeObserver: ResizeObserver | null = null;
	#hostObserver: MutationObserver | null = null;
	// Current page; `page` reflects it (see command). Survives a morph that
	// strips the attribute so a fat morph omitting `page` can't reset to 1.
	#pageValue = 1;
	// setPage()/reflect write `page` via setAttribute, which would otherwise
	// re-enter render() through attributeChangedCallback.
	#suppressAttrRender = false;
	#prevSlotHTML = DEFAULT_PREV_HTML;
	#nextSlotHTML = DEFAULT_NEXT_HTML;
	// Cached fit. Re-used across page / disabled changes so chip count
	// (and host width) stay constant during navigation; cleared by
	// resize or attribute changes that affect layout shape.
	#appliedSibling: number | null = null;
	#appliedBoundary: number | null = null;
	// Identity of the chip that last held focus ("prev" | "next" |
	// "page:N"), so a rebuild (innerHTML) / morph can reseat it.
	#focusedKey: string | null = null;

	connectedCallback() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "navigation");
		if (!this.hasAttribute("aria-label")) {
			this.setAttribute("aria-label", "Pagination");
		}
		// Explicit page commands the value; absent keeps the prior value.
		const raw = this.getAttribute(ATTR_PAGE);
		if (raw !== null) {
			const n = Number(raw);
			if (Number.isFinite(n)) this.#pageValue = Math.max(1, Math.floor(n));
		}
		this.#captureSlots();
		this.addEventListener("click", this.#onClick);
		this.addEventListener("focusin", this.#onFocusIn);
		this.addEventListener("focusout", this.#onFocusOut);
		this.#appliedSibling = null;
		this.#appliedBoundary = null;
		this.#render();

		// Self catches shrink, container catches grow. A collapsed host
		// tracks content width, not parent slack. Skip `display:contents`
		// ancestors: they generate no box so ResizeObserver never fires.
		this.#resizeObserver = new ResizeObserver(() => {
			this.#appliedSibling = null;
			this.#appliedBoundary = null;
			this.#adapt();
		});
		this.#resizeObserver.observe(this);
		const container = effectiveContainer(this);
		if (container) this.#resizeObserver.observe(container);

		// Morph can rewrite our markup with the host still connected
		// (no reconnect lifecycle). Recapture and re-render; our own
		// writes drain via takeRecords() in renderWith.
		this.#hostObserver = new MutationObserver(this.#onChildrenChanged);
		this.#hostObserver.observe(this, { childList: true });
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("focusin", this.#onFocusIn);
		this.removeEventListener("focusout", this.#onFocusOut);
		this.#resizeObserver?.disconnect();
		this.#resizeObserver = null;
		this.#hostObserver?.disconnect();
		this.#hostObserver = null;
	}

	// Reseat focus on the chip that had it (rebuild via innerHTML, or a
	// morph, blurs it to <body>). preventScroll so the refocus can't
	// perturb the adapt() fit measurement. Drops the target if the chip
	// vanished or is now disabled.
	#restoreFocusIfLost() {
		if (this.#focusedKey === null) return;
		if (this.contains(document.activeElement)) return;
		const ae = document.activeElement;
		if (ae && ae !== document.body) return;
		let sel: string;
		if (this.#focusedKey === "prev") sel = "[data-neo-pagination-prev]";
		else if (this.#focusedKey === "next") sel = "[data-neo-pagination-next]";
		else sel = `[data-neo-pagination-page="${this.#focusedKey.slice(5)}"]`;
		const el = this.querySelector<HTMLElement>(sel);
		if (!el || el.hasAttribute("disabled")) {
			this.#focusedKey = null;
			return;
		}
		el.focus({ preventScroll: true });
	}

	#onFocusIn = (e: FocusEvent) => {
		const chip = (e.target as Element | null)?.closest<HTMLElement>(
			"[data-neo-pagination-page], [data-neo-pagination-prev], [data-neo-pagination-next]",
		);
		if (!chip || !this.contains(chip)) {
			this.#focusedKey = null;
			return;
		}
		if (chip.hasAttribute("data-neo-pagination-prev")) this.#focusedKey = "prev";
		else if (chip.hasAttribute("data-neo-pagination-next")) this.#focusedKey = "next";
		else this.#focusedKey = `page:${chip.dataset.neoPaginationPage}`;
	};

	#onFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		if (next) {
			this.#focusedKey = null;
			return;
		}
		queueMicrotask(() => {
			if (this.contains(document.activeElement)) return;
			this.#focusedKey = null;
		});
	};

	#onChildrenChanged = () => {
		this.#captureSlots();
		this.#appliedSibling = null;
		this.#appliedBoundary = null;
		this.#render();
	};

	attributeChangedCallback(name: string, _old: string | null, newValue: string | null) {
		if (!this.isConnected || this.#suppressAttrRender) return;
		if (name === ATTR_PAGE) {
			// Absent: no command, keep the current page; re-reflect so the
			// active chip survives a morph that stripped `page`.
			if (newValue === null) {
				this.#reflectPage();
			} else {
				const n = Number(newValue);
				if (Number.isFinite(n)) this.#pageValue = Math.max(1, Math.floor(n));
			}
			this.#render();
			return;
		}
		if (name === ATTR_PAGES || name === ATTR_SIBLING_COUNT || name === ATTR_BOUNDARY_COUNT) {
			this.#appliedSibling = null;
			this.#appliedBoundary = null;
		}
		this.#render();
	}

	get page(): number {
		return Math.min(this.pages, Math.max(1, this.#pageValue));
	}
	set page(v: number) {
		this.#pageValue = Math.max(1, Math.floor(v));
		this.#reflectPage();
		this.#render();
	}

	// State → attribute, guarded so it isn't read back as a command.
	#reflectPage() {
		this.#suppressAttrRender = true;
		try {
			this.setAttribute(ATTR_PAGE, String(this.page));
		} finally {
			this.#suppressAttrRender = false;
		}
	}
	get pages(): number {
		return clampInt(this.getAttribute(ATTR_PAGES), 1, Number.MAX_SAFE_INTEGER, 1);
	}
	get siblingCount(): number {
		return clampInt(this.getAttribute(ATTR_SIBLING_COUNT), 0, 99, 1);
	}
	get boundaryCount(): number {
		return clampInt(this.getAttribute(ATTR_BOUNDARY_COUNT), 0, 99, 1);
	}
	get disabled(): boolean {
		return boolAttr(this, ATTR_DISABLED, false);
	}

	#captureSlots() {
		const prev = this.querySelector<HTMLTemplateElement>(":scope > template[data-neo-pagination-prev]");
		const next = this.querySelector<HTMLTemplateElement>(":scope > template[data-neo-pagination-next]");
		this.#prevSlotHTML = serializeTemplate(prev) ?? DEFAULT_PREV_HTML;
		this.#nextSlotHTML = serializeTemplate(next) ?? DEFAULT_NEXT_HTML;
	}

	setPage(p: number) {
		const next = Math.min(this.pages, Math.max(1, Math.floor(p)));
		if (next === this.page) return;
		this.#pageValue = next;
		this.#reflectPage();
		this.#render();
		this.dispatchEvent(
			new CustomEvent("neo-pagination-change", {
				bubbles: true,
				detail: { page: next },
			}),
		);
	}

	#onClick = (e: MouseEvent) => {
		if (this.disabled) return;
		const target = e.target as HTMLElement | null;
		if (!target) return;
		const chip = target.closest<HTMLElement>("[data-neo-pagination-page]");
		if (chip) {
			const v = Number(chip.dataset.neoPaginationPage);
			if (Number.isFinite(v)) this.setPage(v);
			return;
		}
		if (target.closest("[data-neo-pagination-prev]")) {
			this.setPage(this.page - 1);
			return;
		}
		if (target.closest("[data-neo-pagination-next]")) {
			this.setPage(this.page + 1);
		}
	};

	// Constant-slot-count windowing: while
	// `pages >= 2*siblingCount + 2*boundaryCount + 3`, the row holds
	// the same number of items regardless of `page`, so navigating
	// doesn't shift chip positions. At edges the sibling window
	// slides outward to fill what an ellipsis would vacate.
	// Algorithm: MUI's `usePagination`.
	#slots(siblingCount: number, boundaryCount: number): (number | "ellipsis")[] {
		const count = this.pages;
		const page = this.page;

		const range = (start: number, end: number): number[] => {
			if (start > end) return [];
			return Array.from({ length: end - start + 1 }, (_, i) => start + i);
		};

		const startPages = range(1, Math.min(boundaryCount, count));
		const endPages = range(Math.max(count - boundaryCount + 1, boundaryCount + 1), count);

		const siblingsStart = Math.max(
			Math.min(page - siblingCount, count - boundaryCount - siblingCount * 2 - 1),
			boundaryCount + 2,
		);
		const siblingsEnd = Math.min(
			Math.max(page + siblingCount, boundaryCount + siblingCount * 2 + 2),
			endPages.length > 0 ? endPages[0] - 2 : count - 1,
		);

		const items: (number | "ellipsis")[] = [];
		for (const p of startPages) items.push(p);

		if (siblingsStart > boundaryCount + 2) {
			items.push("ellipsis");
		} else if (boundaryCount + 1 < count - boundaryCount) {
			items.push(boundaryCount + 1);
		}

		for (const p of range(siblingsStart, siblingsEnd)) items.push(p);

		if (siblingsEnd < count - boundaryCount - 1) {
			items.push("ellipsis");
		} else if (count - boundaryCount > boundaryCount) {
			items.push(count - boundaryCount);
		}

		for (const p of endPages) items.push(p);
		return items;
	}

	#renderWith(siblingCount: number, boundaryCount: number) {
		const slots = this.#slots(siblingCount, boundaryCount);
		const { page, pages, disabled } = this;
		const html: string[] = [];

		if (this.#prevSlotHTML !== "") {
			const prevDisabled = disabled || page <= 1;
			html.push(`<neo-button variant="ghost" data-neo-pagination-prev`);
			if (prevDisabled) html.push(` disabled`);
			html.push(` aria-label="Previous page">`);
			html.push(this.#prevSlotHTML);
			html.push(`</neo-button>`);
		}

		for (const s of slots) {
			if (s === "ellipsis") {
				html.push(`<span data-neo-pagination-ellipsis aria-hidden="true">…</span>`);
				continue;
			}
			const active = s === page;
			html.push(`<neo-button variant="ghost" data-neo-pagination-page="${s}" aria-label="Page ${s}"`);
			if (disabled) html.push(` disabled`);
			if (active) html.push(` aria-current="page"`);
			html.push(`>${s}</neo-button>`);
		}

		if (this.#nextSlotHTML !== "") {
			const nextDisabled = disabled || page >= pages;
			html.push(`<neo-button variant="ghost" data-neo-pagination-next`);
			if (nextDisabled) html.push(` disabled`);
			html.push(` aria-label="Next page">`);
			html.push(this.#nextSlotHTML);
			html.push(`</neo-button>`);
		}

		this.innerHTML = html.join("");
		// Drop the records for our own write so onChildrenChanged only
		// runs for external (morph) mutations, preventing a render loop.
		this.#hostObserver?.takeRecords();
		// innerHTML destroyed the focused chip; reseat focus on its rebuilt
		// counterpart (also covers a morph that wiped the row).
		this.#restoreFocusIfLost();
	}

	#render() {
		if (this.#appliedSibling !== null && this.#appliedBoundary !== null) {
			this.#renderWith(this.#appliedSibling, this.#appliedBoundary);
			return;
		}
		this.#renderWith(this.siblingCount, this.boundaryCount);
		queueMicrotask(() => this.#adapt());
	}

	#adapt() {
		if (!this.isConnected || !this.clientWidth) return;
		const sc0 = this.siblingCount;
		const bc0 = this.boundaryCount;

		const fits = () => this.scrollWidth <= this.clientWidth;
		const apply = (sc: number, bc: number) => {
			this.#appliedSibling = sc;
			this.#appliedBoundary = bc;
		};

		this.#renderWith(sc0, bc0);
		if (fits()) return apply(sc0, bc0);

		for (let sc = sc0 - 1; sc >= 0; sc--) {
			this.#renderWith(sc, bc0);
			if (fits()) return apply(sc, bc0);
		}

		for (let bc = bc0 - 1; bc >= 0; bc--) {
			this.#renderWith(0, bc);
			if (fits()) return apply(0, bc);
		}

		this.#renderWith(0, 0);
		apply(0, 0);
	}
}

// First ancestor that generates a layout box. `display:contents`
// passes its children through to its parent's flex/grid layout but
// has no box of its own, so ResizeObserver never fires for it.
function effectiveContainer(el: Element): Element | null {
	let p = el.parentElement;
	while (p) {
		if (getComputedStyle(p).display !== "contents") return p;
		p = p.parentElement;
	}
	return null;
}

// `<template>`'s children live in its DocumentFragment `.content`, so
// `template.innerHTML` is always "". Round-trip through a `<div>`.
function serializeTemplate(tpl: HTMLTemplateElement | null): string | null {
	if (!tpl) return null;
	const div = document.createElement("div");
	div.appendChild(tpl.content.cloneNode(true));
	return div.innerHTML;
}

if (!customElements.get("neo-pagination")) {
	customElements.define("neo-pagination", NeoPagination);
}
