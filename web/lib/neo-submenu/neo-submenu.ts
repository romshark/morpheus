import { boolAttr, openCommand } from "../command";
import { type Placement, positionPanel, resolveCssLengthPx, resolveCssLengthPxOrContent } from "../neo-position";
import { eventEnters, scopingBoundary } from "../shadow-utils";

let nextId = 0;

const ITEM_SELECTOR = "neo-menuitem, neo-submenu";

export class NeoSubmenu extends HTMLElement {
	static readonly observedAttributes = [
		"open",
		"label",
		"disabled",
		"placement",
		"screen-offset",
		"clamp-placement",
		"min-fit-height",
		"min-fit-width",
	];

	#triggerRow: HTMLElement | null = null;
	#labelSpan: HTMLElement | null = null;
	#backRow: HTMLElement | null = null;
	#backLabelSpan: HTMLElement | null = null;
	#panel: HTMLElement | null = null;
	#items: HTMLElement[] = [];
	#childObserver: MutationObserver | null = null;
	#hostObserver: MutationObserver | null = null;
	#ready = false;
	#rebuilding = false;
	// Rendered open state; `open` is its reflection. Survives a morph strip
	// so checkForReset can re-open + reposition + refocus.
	#openIntent = false;
	#reflectingOpen = false;
	// Value of the panel row that last held focus, for morph restoration.
	#focusedItemValue: string | null = null;

	connectedCallback() {
		if (this.#ready) return;
		this.#bindStructure();

		this.addEventListener("keydown", this.#onHostKeyDown);
		this.addEventListener("focusin", this.#onItemFocusIn);
		document.addEventListener("pointerdown", this.#onDocPointerDown, true);
		window.addEventListener("resize", this.#reposition);
		window.addEventListener("scroll", this.#reposition, true);

		// Detect a Datastar fat-morph wiping our generated trigger row +
		// panel: server emits authored children directly under the host,
		// morph deletes our scaffolding. Re-run bindStructure in place.
		this.#hostObserver = new MutationObserver(() => this.#checkForReset());
		this.#hostObserver.observe(this, { childList: true });

		this.#syncCssBackedAttrs();
		// Reads the `open` command on connect; absent keeps prior intent.
		const cmd = openCommand(this);
		if (cmd === "open") this.#openIntent = true;
		else if (cmd === "close") this.#openIntent = false;
		this.#ready = true;
	}

	// Bind (or re-bind) trigger row + panel + back row. Two paths:
	//   - Reuse: prior scaffolding still in place (e.g. after an
	//     element-move from an ancestor's bindStructure). Re-acquire
	//     refs and re-wire listeners.
	//   - Build: scaffolding missing/detached (initial connect, or
	//     fat-morph wiped it). Build row/panel/back and move authored
	//     items into the panel.
	#bindStructure(): void {
		this.#unbindStructure();

		let row = this.querySelector<HTMLButtonElement>(":scope > [data-neo-submenu-trigger]");
		let panel = this.querySelector<HTMLElement>(":scope > [data-neo-submenu-panel]");
		let back: HTMLElement | null = null;
		let label: HTMLElement | null = null;
		let backLabel: HTMLElement | null = null;

		if (row && panel) {
			// Reuse intact scaffolding.
			label = row.querySelector(":scope > [data-neo-submenu-label]");
			back = panel.querySelector(":scope > [data-neo-submenu-back]");
			if (back) {
				backLabel = back.querySelector(":scope > [data-neo-submenu-back-label]");
			}
		} else {
			// Build fresh.
			row = document.createElement("button");
			row.type = "button";
			row.setAttribute("data-neo-submenu-trigger", "");
			row.setAttribute("role", "menuitem");
			row.setAttribute("aria-haspopup", "menu");
			row.setAttribute("aria-expanded", String(this.hasAttribute("open")));
			row.setAttribute("tabindex", "-1");

			label = document.createElement("span");
			label.setAttribute("data-neo-submenu-label", "");
			label.textContent = this.getAttribute("label") ?? "";
			row.appendChild(label);

			const chevron = document.createElement("span");
			chevron.setAttribute("data-neo-submenu-chevron", "");
			chevron.setAttribute("aria-hidden", "true");
			chevron.textContent = "›";
			row.appendChild(chevron);

			panel = document.createElement("div");
			panel.setAttribute("data-neo-submenu-panel", "");
			panel.setAttribute("role", "menu");
			panel.setAttribute("tabindex", "-1");
			panel.id = `neo-submenu-${++nextId}`;

			// Back row: hidden by CSS in cascade mode, shown in push mode.
			const backBtn = document.createElement("button");
			backBtn.type = "button";
			back = backBtn;
			back.setAttribute("data-neo-submenu-back", "");
			back.setAttribute("aria-label", "Back");
			back.setAttribute("tabindex", "-1");
			const backChevron = document.createElement("span");
			backChevron.setAttribute("aria-hidden", "true");
			backChevron.setAttribute("data-neo-submenu-back-chevron", "");
			backChevron.textContent = "‹";
			backLabel = document.createElement("span");
			backLabel.setAttribute("data-neo-submenu-back-label", "");
			backLabel.textContent = this.getAttribute("label") ?? "";
			back.appendChild(backChevron);
			back.appendChild(backLabel);
			panel.appendChild(back);

			// Move authored items (currently direct children) into the panel.
			let next: ChildNode | null = this.firstChild;
			while (next) {
				const after = next.nextSibling;
				panel.appendChild(next);
				next = after;
			}

			this.appendChild(row);
			this.appendChild(panel);
		}

		row.setAttribute("aria-controls", panel.id);

		this.#triggerRow = row;
		this.#labelSpan = label;
		this.#panel = panel;
		this.#backRow = back;
		this.#backLabelSpan = backLabel;

		row.addEventListener("click", this.#onTriggerClick);
		row.addEventListener("mouseenter", this.#onTriggerHover);
		panel.addEventListener("keydown", this.#onPanelKeyDown);
		panel.addEventListener("mouseover", this.#onPanelMouseOver);
		back?.addEventListener("click", this.#onBackClick);

		this.#childObserver = new MutationObserver(() => this.#refreshItems());
		this.#childObserver.observe(panel, { childList: true });
		this.#refreshItems();
		this.#syncDisabled();
	}

	#unbindStructure(): void {
		this.#triggerRow?.removeEventListener("click", this.#onTriggerClick);
		this.#triggerRow?.removeEventListener("mouseenter", this.#onTriggerHover);
		this.#panel?.removeEventListener("keydown", this.#onPanelKeyDown);
		this.#panel?.removeEventListener("mouseover", this.#onPanelMouseOver);
		this.#backRow?.removeEventListener("click", this.#onBackClick);
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		// Drop refs only; never .remove() the row/panel here.
		// disconnectedCallback runs during element-move (ancestor's
		// panel.appendChild) while our scaffolding is still connected
		// with items inside; removing it would orphan them. The morph
		// already removes any scaffolding it wiped; a checkForReset
		// re-bind only sees detached refs.
		this.#triggerRow = null;
		this.#labelSpan = null;
		this.#backRow = null;
		this.#backLabelSpan = null;
		this.#panel = null;
		this.#items = [];
	}

	#checkForReset(): void {
		if (this.#rebuilding) return;
		if (
			this.#triggerRow &&
			this.#triggerRow.parentElement === this &&
			this.#panel &&
			this.#panel.parentElement === this
		) {
			return;
		}
		this.#rebuilding = true;
		try {
			this.#bindStructure();
			// The morph stripped `open` and destroyed the focused row; drive
			// off intent (not the attribute) to re-open and reseat focus.
			if (this.#openIntent) {
				this.#reflectOpen();
				this.#triggerRow?.setAttribute("aria-expanded", "true");
				this.#position();
				this.#restoreFocusOrFirst();
			}
		} finally {
			this.#rebuilding = false;
		}
	}

	// State → attribute, guarded so it isn't read back as a command.
	#reflectOpen(): void {
		if (this.hasAttribute("open")) return;
		this.#reflectingOpen = true;
		try {
			this.setAttribute("open", "");
		} finally {
			this.#reflectingOpen = false;
		}
	}

	#reflectClose(): void {
		if (!this.hasAttribute("open")) return;
		this.#reflectingOpen = true;
		try {
			this.removeAttribute("open");
		} finally {
			this.#reflectingOpen = false;
		}
	}

	#applyOpen(opts: { silent?: boolean } = {}): void {
		if (boolAttr(this, "disabled", false)) return;
		const wasOpen = this.#openIntent;
		this.#openIntent = true;
		this.#reflectOpen();
		this.#triggerRow?.setAttribute("aria-expanded", "true");
		this.#position();
		this.#focusFirst();
		if (!wasOpen && !opts.silent) {
			this.dispatchEvent(new CustomEvent("neo-submenu-open", { bubbles: true }));
		}
	}

	#applyClose(opts: { silent?: boolean } = {}): void {
		const wasOpen = this.#openIntent;
		this.#openIntent = false;
		this.#reflectClose();
		this.#triggerRow?.setAttribute("aria-expanded", "false");
		this.querySelectorAll<HTMLElement>("neo-submenu[open]").forEach((s) => {
			const hide = (s as NeoSubmenuLike).hide;
			if (typeof hide === "function") hide.call(s);
		});
		if (wasOpen && !opts.silent) {
			this.dispatchEvent(new CustomEvent("neo-submenu-close", { bubbles: true }));
		}
	}

	disconnectedCallback() {
		this.#unbindStructure();
		this.removeEventListener("keydown", this.#onHostKeyDown);
		this.removeEventListener("focusin", this.#onItemFocusIn);
		document.removeEventListener("pointerdown", this.#onDocPointerDown, true);
		window.removeEventListener("resize", this.#reposition);
		window.removeEventListener("scroll", this.#reposition, true);
		this.#hostObserver?.disconnect();
		this.#hostObserver = null;
		this.#ready = false;
	}

	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (!this.#ready) return;
		if (name === "open") {
			if (this.#reflectingOpen) {
				this.#triggerRow?.setAttribute("aria-expanded", String(this.hasAttribute("open")));
				return;
			}
			const cmd = openCommand(this);
			if (cmd === null) {
				// Absent (e.g. morph strip): keep state; re-assert for CSS.
				if (this.#openIntent) this.#reflectOpen();
				return;
			}
			if (cmd === "open") this.#applyOpen();
			else this.#applyClose();
		} else if (name === "label") {
			const text = value ?? "";
			if (this.#labelSpan) this.#labelSpan.textContent = text;
			if (this.#backLabelSpan) this.#backLabelSpan.textContent = text;
		} else if (name === "disabled") {
			this.#syncDisabled();
		} else if (
			name === "placement" ||
			name === "screen-offset" ||
			name === "clamp-placement" ||
			name === "min-fit-height" ||
			name === "min-fit-width"
		) {
			if (name === "screen-offset" || name === "min-fit-height" || name === "min-fit-width") {
				this.#syncCssBackedAttr(name, value);
			}
			if (this.hasAttribute("open")) this.#position();
		}
	}

	/** Public: focusable target a parent menu treats as the row. */
	get focusTarget(): HTMLElement | null {
		return this.#triggerRow;
	}

	show(): void {
		this.#applyOpen();
	}

	hide(): void {
		this.#applyClose();
	}

	toggle(): void {
		if (this.#openIntent) this.#applyClose();
		else this.#applyOpen();
	}

	override focus(options?: FocusOptions): void {
		this.#triggerRow?.focus(options);
	}

	#syncDisabled(): void {
		if (!this.#triggerRow) return;
		if (boolAttr(this, "disabled", false)) {
			this.#triggerRow.setAttribute("aria-disabled", "true");
		} else {
			this.#triggerRow.removeAttribute("aria-disabled");
		}
	}

	#syncCssBackedAttrs(): void {
		for (const attr of CSS_BACKED_MENU_ATTRS) {
			this.#syncCssBackedAttr(attr, this.getAttribute(attr));
		}
	}

	#syncCssBackedAttr(attr: CssBackedMenuAttr, value: string | null): void {
		const cssVar = menuCssVar(attr);
		if (value === null) this.style.removeProperty(cssVar);
		else this.style.setProperty(cssVar, value);
	}

	#refreshItems(): void {
		if (!this.#panel) return;
		this.#items = Array.from(this.#panel.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
			.filter((el) => el.parentElement === this.#panel)
			.filter((el) => !el.hasAttribute("disabled"));
		this.#items.forEach((el, i) => {
			el.tabIndex = i === 0 ? 0 : -1;
		});
		if (this.#backRow) this.#backRow.tabIndex = -1;
	}

	/** Items navigable by arrow keys. Push mode includes the back row in
	 *  the cycle; cascade mode excludes it (hidden by CSS). */
	#currentItems(): HTMLElement[] {
		const root = this.#parentMenu();
		const push = root?.dataset.modeEffective === "push";
		return push && this.#backRow ? [this.#backRow, ...this.#items] : this.#items;
	}

	#focusFirst(): void {
		const items = this.#currentItems();
		if (items.length === 0) return;
		// APG menu pattern lands initial focus on the first menuitem, not
		// the back row; skip past it on open.
		const first = items.find((el) => el !== this.#backRow) ?? items[0];
		// Push mode swaps this panel in over the parent's rows, so the pointer
		// may already rest on one. Land focus there (the single highlight) so
		// it tracks the mouse instead of snapping to the first row.
		requestAnimationFrame(() => (this.#rowUnderPointer() ?? first)?.focus());
	}

	// The row the pointer currently sits on, or null. `:hover` is recomputed
	// when rows appear under a stationary cursor, so this is accurate inside
	// the post-open rAF without tracking pointer coordinates.
	#rowUnderPointer(): HTMLElement | null {
		if (!this.#panel) return null;
		const hovered = this.#panel.querySelectorAll<HTMLElement>(":hover");
		let el: HTMLElement | null = hovered[hovered.length - 1] ?? null;
		const rows = this.#currentItems();
		while (el && el !== this.#panel) {
			if (rows.includes(el)) return el;
			el = el.parentElement;
		}
		return null;
	}

	// Morph recovery: re-focus the row whose value matches the pre-morph
	// focus, else the first item.
	#restoreFocusOrFirst(): void {
		const items = this.#currentItems();
		if (items.length === 0) return;
		const matched =
			this.#focusedItemValue !== null
				? items.find((it) => it.getAttribute("value") === this.#focusedItemValue)
				: undefined;
		const target = matched ?? items.find((el) => el !== this.#backRow) ?? items[0];
		requestAnimationFrame(() => target?.focus());
	}

	#onItemFocusIn = (e: FocusEvent) => {
		const t = e.target as Element | null;
		const item = this.#items.find((it) => it === t || it.contains(t));
		this.#focusedItemValue = item ? item.getAttribute("value") : null;
	};

	#moveFocus(delta: number): void {
		const items = this.#currentItems();
		if (items.length === 0) return;
		const active = document.activeElement as HTMLElement | null;
		if (!active) return;
		const i = items.findIndex((it) => it === active || it.contains(active));
		if (i < 0) return;
		const len = items.length;
		const next = items[(i + delta + len) % len];
		items.forEach((el) => {
			el.tabIndex = el === next ? 0 : -1;
		});
		next.focus();
	}

	#onTriggerClick = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (boolAttr(this, "disabled", false)) return;
		this.show();
	};

	#onTriggerHover = () => {
		if (boolAttr(this, "disabled", false)) return;
		// Push mode: hover would replace the panel, so open via click/ArrowRight only.
		const root = this.#parentMenu();
		if (root?.dataset.modeEffective === "push") return;
		this.show();
	};

	#onHostKeyDown = (e: KeyboardEvent) => {
		if (e.target !== this.#triggerRow) return;
		if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			this.show();
		}
	};

	#onPanelKeyDown = (e: KeyboardEvent) => {
		const active = document.activeElement;
		if (!active || !this.#panel?.contains(active)) return;
		const deepestPanel = active.closest("[data-neo-menu-panel], [data-neo-submenu-panel]");
		if (deepestPanel !== this.#panel) return;

		let handled = false;
		switch (e.key) {
			case "ArrowDown":
				this.#moveFocus(+1);
				handled = true;
				break;
			case "ArrowUp":
				this.#moveFocus(-1);
				handled = true;
				break;
			case "Home":
				if (this.#items[0]) this.#items[0].focus();
				handled = true;
				break;
			case "End":
				if (this.#items.length > 0) {
					this.#items[this.#items.length - 1].focus();
				}
				handled = true;
				break;
			case "ArrowLeft":
			case "Escape":
				this.hide();
				this.#triggerRow?.focus();
				handled = true;
				break;
		}
		if (handled) {
			// Each level handles only its own focus traversal.
			e.preventDefault();
			e.stopPropagation();
		}
	};

	#onPanelMouseOver = (e: MouseEvent) => {
		const target = e.target instanceof Element ? e.target : null;
		const eventPanel = target?.closest("[data-neo-menu-panel], [data-neo-submenu-panel]");
		if (eventPanel !== this.#panel) return;

		let item: Element | null = target;
		while (item && item.parentElement !== this.#panel) item = item.parentElement;
		if (!(item instanceof HTMLElement)) return;
		// The back row is a focus target too (push mode), so it highlights on
		// hover via the same focus-driven rule as the menu rows.
		if (this.#items.includes(item)) {
			if (this.#parentMenu()?.dataset.modeEffective === "push") {
				// Push opens nested submenus on click; skip an already-open one
				// so its pushed panel keeps its own hover focus.
				if (item.tagName === "NEO-SUBMENU" && item.hasAttribute("open")) return;
			} else {
				for (const it of this.#items) {
					if (it !== item && it.tagName === "NEO-SUBMENU" && it.hasAttribute("open")) {
						(it as NeoSubmenuLike).hide?.();
					}
				}
				if (item.tagName === "NEO-SUBMENU" && !item.hasAttribute("open")) {
					(item as NeoSubmenuLike).show?.();
				}
			}
		} else if (item !== this.#backRow) {
			return;
		}
		// Roving focus follows the pointer so the visual focus doesn't strand
		// on the previously focused row.
		if (document.activeElement !== item && this.contains(item)) {
			item.focus({ preventScroll: true });
		}
	};

	#onDocPointerDown = (e: PointerEvent) => {
		if (!this.hasAttribute("open")) return;
		if (this.contains(e.target as Node)) return;
		// Scoped light-dismiss: inside a <neo-boundary>, a press outside the
		// region doesn't collapse the fly-out, matching the parent <neo-menu>.
		const boundary = scopingBoundary(this, "dismiss");
		if (boundary && !eventEnters(e, boundary)) return;
		this.hide();
	};

	#reposition = () => {
		if (this.hasAttribute("open")) this.#position();
	};

	#position(): void {
		if (!this.#triggerRow || !this.#panel) return;
		// Push mode: CSS overlays the parent panel, so skip inline top/left
		// so CSS wins without an !important fight.
		const root = this.#parentMenu();
		if (root?.dataset.modeEffective === "push") {
			this.#panel.style.removeProperty("top");
			this.#panel.style.removeProperty("left");
			this.#panel.style.removeProperty("z-index");
			return;
		}
		this.#panel.style.zIndex = `calc(var(--neo-menu-z-index) + ${this.#cascadeDepth()})`;
		const placement = (this.getAttribute("placement") as Placement | null) ?? "right-start";
		const parent = this.#parentMenu();
		const clamp =
			boolAttr(this, "clamp-placement", false) || (parent ? boolAttr(parent, "clamp-placement", false) : false);
		// Inherits the ancestor <neo-menu>'s --neo-menu-min-fit-*
		// through the cascade; submenus typically share the root's
		// policy without setting their own.
		const minFitHeight = resolveCssLengthPxOrContent(this, "--neo-menu-min-fit-height", "content");
		const minFitWidth = resolveCssLengthPxOrContent(this, "--neo-menu-min-fit-width", "content");
		const edgeOffset = resolveCssLengthPx(this, "--neo-menu-screen-offset");
		positionPanel(this.#triggerRow, this.#panel, placement, edgeOffset, 4, {
			clamp,
			minFitHeight,
			minFitWidth,
		});
	}

	#parentMenu(): HTMLElement | null {
		return this.closest("neo-menu, neo-contextmenu");
	}

	#cascadeDepth(): number {
		let depth = 0;
		let el: Element | null = this;
		while (el instanceof HTMLElement && el.localName === "neo-submenu") {
			depth++;
			el = el.parentElement?.closest("neo-submenu") ?? null;
		}
		return depth;
	}

	#onBackClick = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		this.hide();
		this.#triggerRow?.focus();
	};
}

interface NeoSubmenuLike extends HTMLElement {
	show?: () => void;
	hide?: () => void;
}

const CSS_BACKED_MENU_ATTRS = ["screen-offset", "min-fit-height", "min-fit-width"] as const;

type CssBackedMenuAttr = (typeof CSS_BACKED_MENU_ATTRS)[number];

function menuCssVar(attr: CssBackedMenuAttr) {
	if (attr === "screen-offset") return "--neo-menu-screen-offset";
	return attr === "min-fit-height" ? "--neo-menu-min-fit-height" : "--neo-menu-min-fit-width";
}

if (!customElements.get("neo-submenu")) {
	customElements.define("neo-submenu", NeoSubmenu);
}
