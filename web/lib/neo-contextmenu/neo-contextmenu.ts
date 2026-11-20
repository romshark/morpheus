// Wraps exactly 1 <neo-menu> and opens it at the pointer; all menu
// behavior comes from <neo-menu>, none of it reimplemented here.

import { setAriaRef } from "../aria-ref";
import { openCommand } from "../command";
import { retryWhileParsing, stillParsing } from "../document-parsing";
import { keyMenuLengths } from "../menu-length-sheet";
import { observeManagedAttrs, setAttrIfChanged } from "../neo-morph-resilient";

interface NeoMenuLike extends HTMLElement {
	panel: HTMLElement | null;
	returnFocusEl: HTMLElement | null;
	openAtPoint(x: number, y: number): void;
	hide(): void;
	hostConfigChanged?(name: string): void;
}

// The wrapped <neo-menu> reads these from this element unless it carries its own.
// Copying them onto the menu would need a rewrite after every morph strip.
const MENU_CONFIG_ATTRS = ["mode", "screen-offset", "clamp-placement", "min-fit-height", "min-fit-width"] as const;

const TRIGGER_ARIA = ["tabindex", "aria-haspopup", "aria-expanded", "aria-controls"];

export class NeoContextMenu extends HTMLElement {
	static readonly observedAttributes = ["open", ...MENU_CONFIG_ATTRS];

	#trigger: HTMLElement | null = null;
	#menu: NeoMenuLike | null = null;
	#hostObserver: MutationObserver | null = null;
	#triggerObserver: MutationObserver | null = null;
	// tabindex on the trigger is this element's only where the server rendered none.
	// Kept per trigger, because a morph strips it and the next sync restores it.
	#tabindexTrigger: HTMLElement | null = null;
	#ownsTabindex = false;
	#ready = false;
	#rebuilding = false;
	#reflecting = false;
	// Rendered open state; `open` is its reflection (see command).
	// Survives a morph strip; cleared only by onMenuClose.
	#openIntent = false;

	connectedCallback() {
		if (this.#ready) return;
		if (!this.#bindStructure()) {
			retryWhileParsing(this, () => this.connectedCallback());
			return;
		}
		this.#hostObserver = new MutationObserver(() => this.#checkForReset());
		this.#hostObserver.observe(this, { childList: true });
		keyMenuLengths(this);
		this.#ready = true;
		// On connect, an explicit open/close command is obeyed; an absent
		// one keeps prior intent (persists across reconnect/morph).
		const cmd = openCommand(this);
		if (cmd === "open") {
			this.#openIntent = true;
			// The <neo-menu> child upgrades after this host (tree order, and
			// it is defined later in the bundle). Open once it has.
			void customElements.whenDefined("neo-menu").then(() => {
				if (this.#ready && this.#openIntent) this.#openFromTrigger();
			});
		} else if (cmd === "close") {
			this.#openIntent = false;
			this.#reflecting = true;
			this.removeAttribute("open");
			this.#reflecting = false;
		}
	}

	disconnectedCallback() {
		this.#unbindStructure();
		this.#hostObserver?.disconnect();
		this.#hostObserver = null;
		this.#ready = false;
	}

	attributeChangedCallback(name: string) {
		if (!this.#ready || this.#reflecting) return;
		if (name === "open") {
			const cmd = openCommand(this);
			if (cmd === null) {
				// Absent: keep state, re-assert; neo-menu self-recovers its
				// own panel/position.
				if (this.#openIntent && !this.hasAttribute("open")) {
					this.#reflecting = true;
					this.setAttribute("open", "");
					this.#reflecting = false;
				}
			} else if (cmd === "open") {
				this.#openIntent = true;
				this.#openFromTrigger();
			} else {
				// Explicit open="false": close. menu.hide() -> neo-menu-close
				// -> onMenuClose clears openIntent and normalizes the attr.
				this.#menu?.hide();
			}
			return;
		}
		keyMenuLengths(this);
		this.#menu?.hostConfigChanged?.(name);
	}

	#bindStructure(): boolean {
		const trigger = this.#findTrigger();
		if (!trigger) {
			if (!stillParsing()) console.warn("<neo-contextmenu> requires a [data-neo-contextmenu-trigger] descendant.");
			return false;
		}
		const menus = Array.from(this.querySelectorAll<NeoMenuLike>(":scope > neo-menu"));
		if (menus.length === 0) {
			if (!stillParsing()) console.warn("<neo-contextmenu> requires a <neo-menu> child.");
			return false;
		}
		if (menus.length > 1) {
			console.warn("<neo-contextmenu> expects exactly one <neo-menu> child; using the first.");
		}

		this.#unbindStructure();
		this.#trigger = trigger;
		this.#menu = menus[0];

		if (trigger !== this.#tabindexTrigger) {
			this.#tabindexTrigger = trigger;
			this.#ownsTabindex = !trigger.hasAttribute("tabindex");
		}
		this.#syncTrigger();
		this.#triggerObserver = observeManagedAttrs(trigger, TRIGGER_ARIA, this.#syncTrigger);

		trigger.addEventListener("contextmenu", this.#onTriggerContextMenu);
		trigger.addEventListener("keydown", this.#onTriggerKeyDown);
		this.#menu.addEventListener("neo-menu-open", this.#onMenuOpen);
		this.#menu.addEventListener("neo-menu-close", this.#onMenuClose);
		return true;
	}

	// `:scope > ...` misses a trigger inside a transparent wrapper (e.g.
	// <neo-tooltip>). Walk descendants and pick the first
	// marker whose nearest <neo-menu>/<neo-contextmenu> ancestor is us.
	// Skips items inside our own <neo-menu> and any nested contextmenu.
	#findTrigger(): HTMLElement | null {
		const candidates = this.querySelectorAll<HTMLElement>("[data-neo-contextmenu-trigger]");
		for (const c of candidates) {
			if (c.closest("neo-menu, neo-contextmenu") === this) return c;
		}
		return null;
	}

	#unbindStructure() {
		this.#triggerObserver?.disconnect();
		this.#triggerObserver = null;
		this.#trigger?.removeEventListener("contextmenu", this.#onTriggerContextMenu);
		this.#trigger?.removeEventListener("keydown", this.#onTriggerKeyDown);
		this.#menu?.removeEventListener("neo-menu-open", this.#onMenuOpen);
		this.#menu?.removeEventListener("neo-menu-close", this.#onMenuClose);
		this.#trigger = null;
		this.#menu = null;
	}

	#checkForReset() {
		if (this.#rebuilding) return;
		// Still bound to live descendants? Nothing to do.
		if (
			this.#trigger &&
			this.#trigger.closest("neo-menu, neo-contextmenu") === this &&
			this.#menu?.parentElement === this
		) {
			return;
		}
		this.#rebuilding = true;
		try {
			this.#bindStructure();
			if (this.#openIntent) {
				// neo-menu self-recovers its panel/position. Only keep our
				// reflected `open` (trigger aria-expanded, styling); re-opening
				// here would move a point-anchored menu to the trigger box.
				if (!this.hasAttribute("open")) {
					this.#reflecting = true;
					this.setAttribute("open", "");
					this.#reflecting = false;
				}
			} else if (openCommand(this) === "open") {
				this.#openFromTrigger();
			}
		} finally {
			this.#rebuilding = false;
		}
	}

	// No role. The trigger opens the menu only on right-click and the
	// context-menu key, never on primary activation (left-click / Enter / Space).
	// role="button" would promise an activation that never happens
	// and would mask the surface from other components that reason about
	// roles (e.g. <neo-tree>'s click-to-toggle). The primary control for
	// these actions belongs on a real button elsewhere; aria-haspopup and
	// aria-expanded remain as popup hints.
	#syncTrigger = (): void => {
		const t = this.#trigger;
		if (!t) return;
		if (this.#ownsTabindex) setAttrIfChanged(t, "tabindex", "0");
		setAttrIfChanged(t, "aria-haspopup", "menu");
		setAttrIfChanged(t, "aria-expanded", String(this.#openIntent));
		const panel = this.#menu?.panel;
		setAriaRef(t, "aria-controls", panel ? [panel] : []);
	};

	// menuBound is called by the inner <neo-menu> after it builds its panel.
	menuBound(): void {
		this.#syncTrigger();
	}

	#openFromTrigger(): void {
		if (!this.#trigger || !this.#menu) return;
		const r = this.#trigger.getBoundingClientRect();
		this.#menu.returnFocusEl = this.#trigger;
		this.#menu.openAtPoint(r.left, r.bottom);
	}

	#onTriggerContextMenu = (e: MouseEvent) => {
		if (!this.#menu) return;
		e.preventDefault();
		e.stopPropagation();
		this.#menu.returnFocusEl = this.#trigger;
		this.#menu.openAtPoint(e.clientX, e.clientY);
	};

	#onTriggerKeyDown = (e: KeyboardEvent) => {
		if (e.key !== "ContextMenu" && !(e.shiftKey && e.key === "F10")) return;
		e.preventDefault();
		e.stopPropagation();
		this.#openFromTrigger();
	};

	#onMenuOpen = () => {
		this.#openIntent = true;
		this.#syncTrigger();
		this.#reflecting = true;
		this.setAttribute("open", "");
		this.#reflecting = false;
		this.dispatchEvent(new CustomEvent("neo-contextmenu-open", { bubbles: true }));
	};

	#onMenuClose = () => {
		this.#openIntent = false;
		this.#syncTrigger();
		this.#reflecting = true;
		this.removeAttribute("open");
		this.#reflecting = false;
		this.dispatchEvent(new CustomEvent("neo-contextmenu-close", { bubbles: true }));
	};
}

if (!customElements.get("neo-contextmenu")) {
	customElements.define("neo-contextmenu", NeoContextMenu);
}
