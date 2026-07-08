// Wraps exactly one <neo-menu> and opens it at the pointer; all menu
// behavior comes from <neo-menu>, none of it reimplemented here.

import { openCommand } from "../command";

interface NeoMenuLike extends HTMLElement {
	panel: HTMLElement | null;
	returnFocusEl: HTMLElement | null;
	openAtPoint(x: number, y: number): void;
	hide(): void;
}

const FORWARDED_ATTRS = ["mode", "screen-offset", "clamp-placement", "min-fit-height", "min-fit-width"] as const;

export class NeoContextMenu extends HTMLElement {
	static readonly observedAttributes = ["open", ...FORWARDED_ATTRS];

	#trigger: HTMLElement | null = null;
	#menu: NeoMenuLike | null = null;
	#hostObserver: MutationObserver | null = null;
	#ready = false;
	#rebuilding = false;
	#reflecting = false;
	// Rendered open state; `open` is its reflection (see command).
	// Survives a morph strip; cleared only by onMenuClose.
	#openIntent = false;

	connectedCallback() {
		if (this.#ready) return;
		if (!this.#bindStructure()) return;
		this.#hostObserver = new MutationObserver(() => this.#checkForReset());
		this.#hostObserver.observe(this, { childList: true });
		this.#ready = true;
		// Command `open` on connect: explicit open/close obey; absent
		// keeps prior intent (persists across reconnect/morph).
		const cmd = openCommand(this);
		if (cmd === "open") {
			this.#openIntent = true;
			this.#openFromTrigger();
		} else if (cmd === "close") {
			this.#openIntent = false;
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
		this.#forwardAttr(name);
	}

	#bindStructure(): boolean {
		const trigger = this.#findTrigger();
		if (!trigger) {
			console.warn("<neo-contextmenu> requires a [data-neo-contextmenu-trigger] descendant.");
			return false;
		}
		const menus = Array.from(this.querySelectorAll<NeoMenuLike>(":scope > neo-menu"));
		if (menus.length === 0) {
			console.warn("<neo-contextmenu> requires a <neo-menu> child.");
			return false;
		}
		if (menus.length > 1) {
			console.warn("<neo-contextmenu> expects exactly one <neo-menu> child; using the first.");
		}

		this.#unbindStructure();
		this.#trigger = trigger;
		this.#menu = menus[0];

		if (!trigger.hasAttribute("tabindex")) trigger.setAttribute("tabindex", "0");
		// No role stamp: the trigger opens the menu only on right-click and
		// the context-menu key, never on primary activation (left-click /
		// Enter / Space), so it is not a button. role="button" would promise
		// an activation that never happens and would mask the surface from
		// other components that reason about roles (e.g. <neo-tree>'s
		// click-to-toggle). The primary, keyboard-activatable affordance for
		// these actions belongs on a real button elsewhere; aria-haspopup /
		// aria-expanded remain as popup hints.
		trigger.setAttribute("aria-haspopup", "menu");
		trigger.setAttribute("aria-expanded", "false");

		for (const attr of FORWARDED_ATTRS) this.#forwardAttr(attr);

		trigger.addEventListener("contextmenu", this.#onTriggerContextMenu);
		trigger.addEventListener("keydown", this.#onTriggerKeyDown);
		this.#menu.addEventListener("neo-menu-open", this.#onMenuOpen);
		this.#menu.addEventListener("neo-menu-close", this.#onMenuClose);
		return true;
	}

	// Trigger may sit inside a transparent wrapper (e.g. <neo-tooltip>),
	// so we can't use `:scope > ...`. Walk descendants and pick the first
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
				// here would yank a point-anchored menu to the trigger box.
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

	#forwardAttr(name: string) {
		if (!this.#menu) return;
		const v = this.getAttribute(name);
		if (v === null) this.#menu.removeAttribute(name);
		else this.#menu.setAttribute(name, v);
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
		this.#trigger?.setAttribute("aria-expanded", "true");
		if (this.#menu?.panel?.id) {
			this.#trigger?.setAttribute("aria-controls", this.#menu.panel.id);
		}
		this.#openIntent = true;
		this.#reflecting = true;
		this.setAttribute("open", "");
		this.#reflecting = false;
		this.dispatchEvent(new CustomEvent("neo-contextmenu-open", { bubbles: true }));
	};

	#onMenuClose = () => {
		this.#trigger?.setAttribute("aria-expanded", "false");
		this.#openIntent = false;
		this.#reflecting = true;
		this.removeAttribute("open");
		this.#reflecting = false;
		this.dispatchEvent(new CustomEvent("neo-contextmenu-close", { bubbles: true }));
	};
}

if (!customElements.get("neo-contextmenu")) {
	customElements.define("neo-contextmenu", NeoContextMenu);
}
