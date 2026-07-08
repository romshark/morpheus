// Triggerless, keyboard-navigable menu panel; its direct children are the
// rows. A host opens and anchors it: a <neo-button> trigger, or a
// <neo-contextmenu> via openAtPoint. neo-menu owns all menu behavior so
// the hosts don't duplicate any of it.

import { boolAttr, openCommand } from "../command";
import { type Placement, positionPanel, resolveCssLengthPx, resolveCssLengthPxOrContent } from "../neo-position";
import { eventEnters, isIndependentBoundaryScroll, scopingBoundary } from "../shadow-utils";

let nextId = 0;

const ITEM_SELECTOR = "neo-menuitem, neo-submenu";

const PUSH_MEDIA_QUERY = "(hover: none) and (pointer: coarse), (max-width: 36rem)";

export class NeoMenu extends HTMLElement {
	static readonly observedAttributes = [
		"open",
		"mode",
		"placement",
		"screen-offset",
		"clamp-placement",
		"min-fit-height",
		"min-fit-width",
	];

	panel: HTMLElement | null = null;

	// trigger: the parent <neo-button>, or null when context-menu-hosted.
	// anchorEl: positionPanel's reference (the button, or pointAnchor).
	trigger: HTMLElement | null = null;
	returnFocusEl: HTMLElement | null = null;
	#hostEl: HTMLElement | null = null;
	#anchorEl: HTMLElement | null = null;
	#pointAnchor: HTMLElement | null = null;

	#items: HTMLElement[] = [];
	#childObserver: MutationObserver | null = null;
	#hostObserver: MutationObserver | null = null;
	#ready = false;
	#rebuilding = false;
	#pushMQL: MediaQueryList | null = null;
	// Rendered open state; `open` is its reflection (see command).
	// Survives a morph strip; cleared only by a genuine dismissal.
	#openIntent = false;
	// Guards reflective attribute writes so they aren't read as commands.
	#reflectingOpen = false;
	// Value of the row that last held focus, so a morph restores the user's
	// roving position instead of snapping back to the first item.
	#focusedItemValue: string | null = null;

	connectedCallback() {
		if (this.#ready) return;
		if (!this.#bindStructure()) return;

		this.addEventListener("focusin", this.#onItemFocusIn);
		document.addEventListener("pointerdown", this.#onDocPointerDown, true);
		document.addEventListener("focusin", this.#onDocFocusIn, true);
		window.addEventListener("resize", this.#reposition);
		// A fixed panel detaches from its anchor on scroll, so dismiss.
		// Capture phase to catch ancestor scrolls too.
		window.addEventListener("scroll", this.#onScroll, true);

		// A Datastar fat-morph re-emits the rows as direct children and
		// deletes our generated panel wrapper; rebind in place.
		this.#hostObserver = new MutationObserver(() => this.#checkForReset());
		this.#hostObserver.observe(this, { childList: true });

		if (typeof window.matchMedia === "function") {
			this.#pushMQL = window.matchMedia(PUSH_MEDIA_QUERY);
			this.#pushMQL.addEventListener("change", this.#onPushMQChange);
		}
		this.#applyEffectiveMode();
		this.#syncCssBackedAttrs();

		// Reads the `open` command on connect: explicit open/close obey;
		// absent keeps prior intent (persists across reconnect/morph).
		const cmd = openCommand(this);
		if (cmd === "open") this.#openIntent = true;
		else if (cmd === "close") this.#openIntent = false;
		this.#ready = true;
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

	// Side effects run on intent transitions, not attribute presence.
	#applyOpen(opts: { silent?: boolean } = {}): void {
		const wasOpen = this.#openIntent;
		this.#openIntent = true;
		this.#reflectOpen();
		this.trigger?.setAttribute("aria-expanded", "true");
		this.#position();
		this.#focusFirst();
		if (!wasOpen && !opts.silent) {
			this.dispatchEvent(new CustomEvent("neo-menu-open", { bubbles: true }));
		}
	}

	#applyClose(opts: { silent?: boolean } = {}): void {
		const wasOpen = this.#openIntent;
		this.#openIntent = false;
		this.#reflectClose();
		this.trigger?.setAttribute("aria-expanded", "false");
		this.querySelectorAll<HTMLElement>("neo-submenu[open]").forEach((s) => {
			const hide = (s as NeoSubmenuLike).hide;
			if (typeof hide === "function") hide.call(s);
		});
		if (wasOpen && !opts.silent) {
			this.dispatchEvent(new CustomEvent("neo-menu-close", { bubbles: true }));
		}
	}

	// Wrap direct children into the panel, resolve the host, and wire
	// the trigger when button-hosted. Idempotent.
	#bindStructure(): boolean {
		this.#unbindStructure();

		let panel = this.querySelector<HTMLElement>(":scope > [data-neo-menu-panel]");
		if (!panel) {
			panel = document.createElement("div");
			panel.setAttribute("data-neo-menu-panel", "");
			panel.setAttribute("role", "menu");
			panel.setAttribute("tabindex", "-1");
			panel.id = `neo-menu-${++nextId}`;
			this.appendChild(panel);
		}
		// Everything that isn't the panel is a row; move it inside.
		let next: ChildNode | null = this.firstChild;
		while (next) {
			const after = next.nextSibling;
			if (next !== panel) panel.appendChild(next);
			next = after;
		}
		this.panel = panel;

		// Resolve the host. The contract is a direct child of the host, so
		// the parent element is it; closest() tolerates a wrapper element.
		const host = (this.parentElement?.closest("neo-button, neo-contextmenu") as HTMLElement | null) ?? null;
		this.#hostEl = host;

		if (host && host.localName === "neo-button") {
			// Button is the trigger + anchor.
			this.trigger = host;
			this.returnFocusEl = host;
			this.#anchorEl = host;
			if (!host.hasAttribute("aria-haspopup")) {
				host.setAttribute("aria-haspopup", "menu");
			}
			host.setAttribute("aria-controls", panel.id);
			host.setAttribute("aria-expanded", String(this.hasAttribute("open")));
			host.addEventListener("click", this.#onTriggerClick);
			host.addEventListener("keydown", this.#onTriggerKeyDown);
		}
		// context-menu host: it calls openAtPoint() and sets returnFocusEl;
		// no trigger listeners here. unbindStructure() cleared anchorEl;
		// the point span survives rebinds, so restore it or a post-morph
		// reposition snaps to 0,0.
		if (!this.#anchorEl && this.#pointAnchor) {
			this.#anchorEl = this.#pointAnchor;
		}

		panel.addEventListener("keydown", this.#onPanelKeyDown);
		panel.addEventListener("mouseover", this.#onPanelMouseOver);
		panel.addEventListener("neo-menuitem-select", this.#onItemSelect);

		this.#childObserver = new MutationObserver(() => this.#refreshItems());
		this.#childObserver.observe(panel, { childList: true });
		this.#refreshItems();
		return true;
	}

	#unbindStructure() {
		this.trigger?.removeEventListener("click", this.#onTriggerClick);
		this.trigger?.removeEventListener("keydown", this.#onTriggerKeyDown);
		this.panel?.removeEventListener("keydown", this.#onPanelKeyDown);
		this.panel?.removeEventListener("mouseover", this.#onPanelMouseOver);
		this.panel?.removeEventListener("neo-menuitem-select", this.#onItemSelect);
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		this.trigger = null;
		this.#hostEl = null;
		this.#anchorEl = null;
		this.panel = null;
		this.#items = [];
	}

	#checkForReset() {
		if (this.#rebuilding) return;
		// Panel no longer a direct child = morph-reset; an in-panel edit
		// keeps it and refreshItems handles that.
		if (this.panel && this.panel.parentElement === this) return;
		this.#rebuilding = true;
		try {
			this.#bindStructure();
			this.#applyEffectiveMode();
			this.#syncCssBackedAttrs();
			// The morph stripped `open`; bindStructure already re-projected
			// the new authored rows. Drive off intent, not the attribute.
			if (this.#openIntent) {
				this.#reflectOpen();
				// New panel inserted while open replays the @starting-style
				// entry transition; this is recovery, not a user open.
				this.#suppressEntryAnimation();
				this.#position();
				// The morph destroyed the focused item; restore roving focus
				// to the row the user was on (by value), not item 0.
				this.#restoreFocusOrFirst();
			}
		} finally {
			this.#rebuilding = false;
		}
	}

	// Drop the new panel's transition for one frame so a recovery
	// rebuild snaps in place; restore so real open/close still animate.
	#suppressEntryAnimation(): void {
		const panel = this.panel;
		if (!panel) return;
		panel.style.transition = "none";
		requestAnimationFrame(() => {
			if (this.panel === panel) panel.style.transition = "";
		});
	}

	disconnectedCallback() {
		this.#unbindStructure();
		this.removeEventListener("focusin", this.#onItemFocusIn);
		document.removeEventListener("pointerdown", this.#onDocPointerDown, true);
		document.removeEventListener("focusin", this.#onDocFocusIn, true);
		window.removeEventListener("resize", this.#reposition);
		window.removeEventListener("scroll", this.#onScroll, true);
		this.#hostObserver?.disconnect();
		this.#hostObserver = null;
		this.#pushMQL?.removeEventListener("change", this.#onPushMQChange);
		this.#pushMQL = null;
		this.#pointAnchor?.remove();
		this.#pointAnchor = null;
		this.#ready = false;
	}

	attributeChangedCallback(name: string) {
		if (!this.#ready) return;
		if (name === "mode") {
			this.#applyEffectiveMode();
			return;
		}
		if (
			name === "placement" ||
			name === "screen-offset" ||
			name === "clamp-placement" ||
			name === "min-fit-height" ||
			name === "min-fit-width"
		) {
			if (name === "screen-offset" || name === "min-fit-height" || name === "min-fit-width") {
				this.#syncCssBackedAttr(name);
			}
			if (this.hasAttribute("open")) this.#position();
			return;
		}
		if (name !== "open" || this.#reflectingOpen) return;
		const cmd = openCommand(this);
		if (cmd === null) {
			// Absent: keep state; re-assert for `[open]` CSS. checkForReset
			// repositions the rebuilt panel.
			if (this.#openIntent) this.#reflectOpen();
			return;
		}
		if (cmd === "open") this.#applyOpen();
		else this.#applyClose();
	}

	#applyEffectiveMode(): void {
		const requested = this.getAttribute("mode") ?? "auto";
		let effective: "cascade" | "push";
		if (requested === "push" || requested === "cascade") {
			effective = requested;
		} else {
			effective = this.#pushMQL?.matches ? "push" : "cascade";
		}
		if (this.dataset.modeEffective !== effective) {
			this.dataset.modeEffective = effective;
		}
	}

	#onPushMQChange = () => {
		this.#applyEffectiveMode();
		if (this.hasAttribute("open")) this.#position();
	};

	#syncCssBackedAttrs(): void {
		for (const attr of CSS_BACKED_MENU_ATTRS) {
			this.#syncCssBackedAttr(attr);
		}
	}

	#syncCssBackedAttr(attr: CssBackedMenuAttr): void {
		const cssVar = menuCssVar(attr);
		const value = this.getAttribute(attr);
		if (value === null) this.style.removeProperty(cssVar);
		else this.style.setProperty(cssVar, value);
	}

	show(): void {
		if (!this.#openIntent) this.#applyOpen();
	}

	hide(): void {
		this.#applyClose();
	}

	toggle(): void {
		if (this.#openIntent) this.#applyClose();
		else this.#applyOpen();
	}

	// Open anchored at a viewport point: the context-menu entry path.
	// A fixed 1px element feeds the shared positionPanel unchanged.
	openAtPoint(x: number, y: number): void {
		if (!this.#pointAnchor) {
			const a = document.createElement("span");
			a.setAttribute("aria-hidden", "true");
			a.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none;";
			document.body.appendChild(a);
			this.#pointAnchor = a;
		}
		this.#pointAnchor.style.left = `${Math.round(x)}px`;
		this.#pointAnchor.style.top = `${Math.round(y)}px`;
		this.#anchorEl = this.#pointAnchor;
		// applyOpen repositions+refocuses whether or not it was already
		// open (re-open at a new point), and only emits neo-menu-open on
		// a real closed->open transition.
		this.#applyOpen();
	}

	#setRovingTabindex(active: HTMLElement | undefined): void {
		this.#items.forEach((el) => {
			el.tabIndex = el === active ? 0 : -1;
		});
	}

	#refreshItems(): void {
		if (!this.panel) return;
		this.#items = Array.from(this.panel.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
			.filter((el) => el.parentElement === this.panel)
			.filter((el) => !el.hasAttribute("disabled"));
		this.#setRovingTabindex(this.#items[0]);
	}

	#focusFirst(): void {
		if (this.#items.length === 0) return;
		this.#setRovingTabindex(this.#items[0]);
		// preventScroll: the panel is already in view, and a focus-induced
		// scroll would self-dismiss (scroll closes the menu).
		requestAnimationFrame(() => this.#items[0]?.focus({ preventScroll: true }));
	}

	// Morph recovery: re-focus the row whose value matches the pre-morph
	// focus, else the first item. Roving tabindex is reset to match.
	#restoreFocusOrFirst(): void {
		if (this.#items.length === 0) return;
		const matched =
			this.#focusedItemValue !== null
				? this.#items.find((it) => it.getAttribute("value") === this.#focusedItemValue)
				: undefined;
		const item = matched ?? this.#items[0];
		this.#setRovingTabindex(item);
		requestAnimationFrame(() => item.focus({ preventScroll: true }));
	}

	#onItemFocusIn = (e: FocusEvent) => {
		const t = e.target as Element | null;
		const item = this.#items.find((it) => it === t || it.contains(t));
		this.#focusedItemValue = item ? item.getAttribute("value") : null;
	};

	#moveFocus(delta: number): void {
		const active = document.activeElement as HTMLElement | null;
		if (!active) return;
		// Focus may live inside a submenu's auto-generated trigger row.
		const i = this.#items.findIndex((it) => it === active || it.contains(active));
		if (i < 0) return;
		const len = this.#items.length;
		const next = this.#items[(i + delta + len) % len];
		this.#setRovingTabindex(next);
		next.focus();
	}

	#onTriggerClick = (e: MouseEvent) => {
		if (this.panel && e.target instanceof Node && this.panel.contains(e.target)) return;
		e.preventDefault();
		this.toggle();
	};

	#onTriggerKeyDown = (e: KeyboardEvent) => {
		// <neo-button> already turns Enter/Space into a click (-> toggle);
		// handling them here too would double-fire. ArrowDown only.
		if (e.key === "ArrowDown") {
			e.preventDefault();
			this.show();
		}
	};

	#onPanelKeyDown = (e: KeyboardEvent) => {
		const active = document.activeElement;
		if (!active || !this.panel?.contains(active)) return;
		const deepestPanel = active.closest("[data-neo-menu-panel], [data-neo-submenu-panel]");
		if (deepestPanel !== this.panel) return;

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
				if (this.#items[0]) {
					this.#setRovingTabindex(this.#items[0]);
					this.#items[0].focus();
				}
				handled = true;
				break;
			case "End":
				if (this.#items.length > 0) {
					const last = this.#items[this.#items.length - 1];
					this.#setRovingTabindex(last);
					last.focus();
				}
				handled = true;
				break;
			case "Escape":
				this.hide();
				this.returnFocusEl?.focus();
				handled = true;
				break;
		}
		if (handled) {
			e.preventDefault();
			e.stopPropagation();
		}
	};

	#onPanelMouseOver = (e: MouseEvent) => {
		const target = e.target instanceof Element ? e.target : null;
		const eventPanel = target?.closest("[data-neo-menu-panel], [data-neo-submenu-panel]");
		if (eventPanel !== this.panel) return;

		let item: Element | null = target;
		while (item && item.parentElement !== this.panel) item = item.parentElement;
		if (!(item instanceof HTMLElement) || !this.#items.includes(item)) return;
		if (this.dataset.modeEffective === "push") {
			// Push opens submenus on click, not hover. Skip the open submenu:
			// its pushed panel owns its own hover focus, and refocusing its
			// trigger here would fight that.
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
		// Roving focus follows the pointer in both modes; without it the
		// visual focus strands on the previously focused row, so a hovered
		// item lights up alongside it.
		if (document.activeElement !== item && this.panel?.contains(item)) {
			item.focus({ preventScroll: true });
		}
	};

	#onItemSelect = () => {
		this.hide();
		this.returnFocusEl?.focus();
	};

	#onDocPointerDown = (e: PointerEvent) => {
		if (!this.hasAttribute("open")) return;
		const t = e.target as Node;
		if (this.contains(t)) return; // press inside the menu subtree
		// Button host: its click handler toggles; pre-closing here would
		// let that toggle re-open the menu.
		if (this.trigger && this.#hostEl?.contains(t)) return;
		// Context-menu host: only a right-click survives (neo-contextmenu
		// repositions on it); any other press dismisses, like a native menu.
		if (!this.trigger && e.button === 2 && this.#hostEl?.contains(t)) {
			const target = t instanceof Element ? t : t.parentNode instanceof Element ? t.parentNode : null;
			if (target?.closest("neo-contextmenu") === this.#hostEl) return;
		}
		// Scoped light-dismiss: inside a <neo-boundary>, ignore presses
		// outside it (e.g. surrounding UI driving the menu).
		const boundary = scopingBoundary(this, "dismiss");
		if (boundary && !eventEnters(e, boundary)) return;
		this.hide();
	};

	#onDocFocusIn = (e: FocusEvent) => {
		if (!this.hasAttribute("open")) return;
		const t = e.target as Node;
		if (this.contains(t) || this.#hostEl?.contains(t)) return;
		const boundary = scopingBoundary(this, "dismiss");
		if (boundary && !eventEnters(e, boundary)) return;
		this.hide();
	};

	#reposition = () => {
		if (this.hasAttribute("open")) this.#position();
	};

	// Capture-phase window listener sees every scroll. Dismiss only when
	// the scroller is an ancestor of the anchor, which is when it carries
	// the anchor away and the fixed panel detaches.
	#onScroll = (e: Event) => {
		if (!this.hasAttribute("open")) return;
		const target = e.target as Node | null;
		if (target && this.contains(target)) return;
		const ref = this.trigger ?? this.#hostEl ?? this.#anchorEl;
		const scroller =
			target === document || target === document.documentElement
				? document.documentElement
				: target instanceof Element
					? target
					: null;
		if (!ref || !scroller?.contains(ref)) return;
		// Scoped scroll: only independent outside scrollers follow. Inside
		// scrollers, and ancestor scrollers that carry the boundary, dismiss.
		const sb = scopingBoundary(this, "scroll");
		if (sb && isIndependentBoundaryScroll(sb, scroller)) {
			this.#position();
			return;
		}
		this.hide();
	};

	#position(): void {
		if (!this.#anchorEl || !this.panel) return;
		const placement = (this.getAttribute("placement") as Placement | null) ?? "bottom-start";
		const minFitHeight = resolveCssLengthPxOrContent(this, "--neo-menu-min-fit-height", "content");
		const minFitWidth = resolveCssLengthPxOrContent(this, "--neo-menu-min-fit-width", "content");
		const edgeOffset = resolveCssLengthPx(this, "--neo-menu-screen-offset");
		positionPanel(this.#anchorEl, this.panel, placement, edgeOffset, 4, {
			clamp: boolAttr(this, "clamp-placement", false),
			boundaryContext: this,
			minFitHeight,
			minFitWidth,
		});
	}
}

/** Structural type for <neo-submenu> bits used here; keeps the import
 *  graph one-directional. */
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

if (!customElements.get("neo-menu")) {
	customElements.define("neo-menu", NeoMenu);
}
