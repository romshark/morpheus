// Roving-tabindex keyboard engine shared by <neo-navgroup> and the listbox
// controls (<neo-select>, <neo-combobox>). It owns arrow/Home/End movement,
// grid column math, wrap, RTL, and typeahead over a host-supplied item list,
// and reads the same attributes off whichever host drives it: `orientation`,
// `columns`, `wrap`, `typeahead`, `typeahead-timeout`, `typeahead-match`.
//
// The host owns lifecycle and change detection (observers); it calls
// refresh() when its item set changes and supplies the current items via
// getItems(). Disabled items must be excluded by getItems, matching the
// roving set.

import { boolAttr } from "./command";

type Orientation = "horizontal" | "vertical" | "grid";

export interface NavEngineConfig {
	// Listener target, attribute source, and RTL/columns measurement root.
	host: HTMLElement;
	// Current navigable items in DOM order, disabled excluded.
	getItems(): HTMLElement[];
	// Called after focus moves to an item (host dispatches its event / scrolls).
	onMove?(item: HTMLElement, index: number): void;
	// Whether typeahead is active. Defaults to the `typeahead` attribute
	// (opt-in, for <neo-navgroup>); the listbox controls pass their own
	// opt-out semantics.
	typeaheadEnabled?(): boolean;
}

const DEFAULT_TYPEAHEAD_TIMEOUT_MS = 500;

export class NavEngine {
	#cfg: NavEngineConfig;
	#host: HTMLElement;
	#items: HTMLElement[] = [];
	#layoutColumns = 1;
	#typeaheadBuffer = "";
	#typeaheadTimer: ReturnType<typeof setTimeout> | null = null;
	// Identity + position of the item that last held focus, so refresh() can
	// reseat focus after a morph re-creates the items and blurs to <body>.
	#focusedKey = "";
	#focusedIndex = -1;

	constructor(cfg: NavEngineConfig) {
		this.#cfg = cfg;
		this.#host = cfg.host;
	}

	attach(): void {
		this.#host.addEventListener("keydown", this.#onKeyDown);
		this.#host.addEventListener("focusin", this.#onFocusIn);
		this.#host.addEventListener("focusout", this.#onFocusOut);
	}

	detach(): void {
		this.#host.removeEventListener("keydown", this.#onKeyDown);
		this.#host.removeEventListener("focusin", this.#onFocusIn);
		this.#host.removeEventListener("focusout", this.#onFocusOut);
		this.resetTypeahead();
	}

	get items(): HTMLElement[] {
		return this.#items;
	}

	/** Programmatically focus the item at `index`. */
	focusItem(index: number): void {
		const item = this.#items[index];
		if (item) this.#moveFocusTo(item);
	}

	resetTypeahead(): void {
		if (this.#typeaheadTimer !== null) {
			clearTimeout(this.#typeaheadTimer);
			this.#typeaheadTimer = null;
		}
		this.#typeaheadBuffer = "";
	}

	// Recompute the item set, assign roving tabindex, and reseat focus if a
	// morph dropped it.
	refresh(): void {
		const items = this.#cfg.getItems();
		this.#items = items;
		if (items.length === 0) return;

		this.#layoutColumns = this.#measureColumns(items);

		// Roving tabindex priority: live focus, then existing tabindex=0, then
		// first item. Focus-first protects keyboard position across a morph,
		// which reverts JS-set tabindex back to the source's first.
		const active = document.activeElement as HTMLElement | null;
		const focused = active ? items.find((el) => el === active || el.contains(active)) : undefined;
		const current = focused ?? items.find((el) => el.tabIndex === 0) ?? items[0];
		for (const el of items) {
			el.tabIndex = el === current ? 0 : -1;
		}
		this.#restoreFocusIfLost();
	}

	#itemKey(el: HTMLElement): string {
		return el.id || el.getAttribute("data-neo-value") || el.getAttribute("value") || "";
	}

	// Reseat focus on the previously-focused item (by key, then index) if a
	// morph blurred it to <body>. No-op while focus is still inside, so it
	// never fights normal navigation; a consumer that restores first wins via
	// its own already-focused guard.
	#restoreFocusIfLost(): void {
		if (this.#focusedIndex < 0 && this.#focusedKey === "") return;
		if (this.#host.contains(document.activeElement)) return;
		const ae = document.activeElement;
		if (ae && ae !== document.body) return;
		let target: HTMLElement | undefined;
		if (this.#focusedKey !== "") target = this.#items.find((el) => this.#itemKey(el) === this.#focusedKey);
		if (!target && this.#focusedIndex >= 0) target = this.#items[this.#focusedIndex];
		if (!target) {
			this.#focusedKey = "";
			this.#focusedIndex = -1;
			return;
		}
		for (const el of this.#items) el.tabIndex = el === target ? 0 : -1;
		target.focus();
	}

	#onKeyDown = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		const current = this.#currentItem();
		if (!current) return;

		const orientation = this.#getOrientation();
		if (orientation === "grid") {
			this.#layoutColumns = this.#measureColumns(this.#items);
		}
		const columns = this.#getColumns();
		const rtl = this.#isRTL();
		const horizStep = (d: -1 | 1) => (rtl ? -d : d) as -1 | 1;

		let next: HTMLElement | null = null;
		switch (e.key) {
			case "ArrowLeft":
				if (orientation === "horizontal" || orientation === "grid") {
					next = this.#sibling(current, horizStep(-1));
				}
				break;
			case "ArrowRight":
				if (orientation === "horizontal" || orientation === "grid") {
					next = this.#sibling(current, horizStep(+1));
				}
				break;
			case "ArrowUp":
				if (orientation === "vertical") next = this.#sibling(current, -1);
				else if (orientation === "grid") next = this.#sibling(current, -columns);
				break;
			case "ArrowDown":
				if (orientation === "vertical") next = this.#sibling(current, +1);
				else if (orientation === "grid") next = this.#sibling(current, +columns);
				break;
			case "Home":
				next = this.#items[0] ?? null;
				break;
			case "End":
				next = this.#items[this.#items.length - 1] ?? null;
				break;
			default:
				this.#handleTypeahead(e);
				return;
		}

		if (next && next !== current) {
			e.preventDefault();
			this.#moveFocusTo(next);
		}
	};

	#onFocusIn = (e: FocusEvent) => {
		const t = e.target as HTMLElement | null;
		if (!t) return;
		const item = this.#items.find((el) => el === t || el.contains(t));
		if (!item) return;
		this.#focusedKey = this.#itemKey(item);
		this.#focusedIndex = this.#items.indexOf(item);
		for (const el of this.#items) {
			el.tabIndex = el === item ? 0 : -1;
		}
	};

	#onFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.#host.contains(next)) return;
		this.resetTypeahead();
		if (next) {
			this.#focusedKey = "";
			this.#focusedIndex = -1;
			return;
		}
		// Blur to nothing: a morph (refresh reseats first) or click-away.
		queueMicrotask(() => {
			if (this.#host.contains(document.activeElement)) return;
			this.#focusedKey = "";
			this.#focusedIndex = -1;
		});
	};

	#currentItem(): HTMLElement | null {
		const active = document.activeElement as HTMLElement | null;
		if (!active) return null;
		return this.#items.find((el) => el === active || el.contains(active)) ?? null;
	}

	#sibling(current: HTMLElement, delta: number): HTMLElement | null {
		const i = this.#items.indexOf(current);
		if (i === -1) return null;
		const n = this.#items.length;
		let j = i + delta;
		if (j < 0 || j >= n) {
			if (!boolAttr(this.#host, "wrap", false)) return null;
			j = ((j % n) + n) % n;
		}
		return this.#items[j] ?? null;
	}

	#moveFocusTo(item: HTMLElement): void {
		for (const el of this.#items) {
			el.tabIndex = el === item ? 0 : -1;
		}
		item.focus();
		this.#cfg.onMove?.(item, this.#items.indexOf(item));
	}

	#getOrientation(): Orientation {
		const v = this.#host.getAttribute("orientation");
		if (v === "vertical" || v === "grid") return v;
		return "horizontal";
	}

	#getColumns(): number {
		return this.#getExplicitColumns() ?? this.#layoutColumns;
	}

	#getExplicitColumns(): number | null {
		const n = parseInt(this.#host.getAttribute("columns") ?? "", 10);
		return Number.isFinite(n) && n > 0 ? n : null;
	}

	#measureColumns(items: HTMLElement[]): number {
		const explicit = this.#getExplicitColumns();
		if (explicit || this.#getOrientation() !== "grid") return explicit ?? 1;

		const firstRect = items[0]?.getClientRects()[0];
		if (!firstRect) return this.#layoutColumns;

		let columns = 0;
		for (const item of items) {
			const rect = item.getClientRects()[0];
			if (!rect || Math.abs(rect.top - firstRect.top) > 1) break;
			columns++;
		}
		return Math.max(1, columns);
	}

	#handleTypeahead(e: KeyboardEvent): boolean {
		const on = this.#cfg.typeaheadEnabled ? this.#cfg.typeaheadEnabled() : boolAttr(this.#host, "typeahead", false);
		if (!on) return false;
		if (e.altKey || e.ctrlKey || e.metaKey) return false;
		if (this.#isEditableTarget(e.target)) return false;

		if (e.key === "Backspace") {
			if (this.#typeaheadBuffer.length === 0) return false;
			e.preventDefault();
			this.#typeaheadBuffer = this.#typeaheadBuffer.slice(0, -1);
			this.#scheduleTypeaheadReset();
			this.#focusTypeaheadMatch();
			return true;
		}
		if (e.key.length !== 1) return false;
		if (e.key === " " && this.#typeaheadBuffer.length === 0) {
			e.preventDefault();
			return true;
		}

		e.preventDefault();
		this.#typeaheadBuffer += e.key;
		this.#scheduleTypeaheadReset();
		this.#focusTypeaheadMatch();
		return true;
	}

	#scheduleTypeaheadReset(): void {
		if (this.#typeaheadTimer !== null) clearTimeout(this.#typeaheadTimer);
		const raw = this.#host.getAttribute("typeahead-timeout");
		const ms = raw !== null ? Number(raw) : NaN;
		const timeout = Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_TYPEAHEAD_TIMEOUT_MS;
		this.#typeaheadTimer = setTimeout(() => {
			this.#typeaheadBuffer = "";
			this.#typeaheadTimer = null;
		}, timeout);
	}

	#focusTypeaheadMatch(): void {
		if (this.#typeaheadBuffer.length === 0) return;
		const needle = this.#typeaheadBuffer.toLowerCase();
		const prefix = this.#host.getAttribute("typeahead-match") === "prefix";
		const match = this.#items.find((el) => {
			const label = this.#typeaheadLabel(el).toLowerCase();
			return prefix ? label.startsWith(needle) : label.includes(needle);
		});
		if (!match) return;
		this.#moveFocusTo(match);
		match.scrollIntoView({ block: "nearest", inline: "nearest" });
	}

	#typeaheadLabel(el: HTMLElement): string {
		return (
			el.getAttribute("data-neo-navgroup-label") ??
			el.getAttribute("aria-label") ??
			el.getAttribute("label") ??
			el.textContent ??
			""
		).trim();
	}

	#isEditableTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName.toLowerCase();
		return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
	}

	#isRTL(): boolean {
		return getComputedStyle(this.#host).direction === "rtl";
	}
}
