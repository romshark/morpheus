const SHORTCUT_HINT_ATTR = "data-neo-menuitem-shortcut";

function isMac(): boolean {
	if (typeof navigator === "undefined") return false;
	const platform = (navigator as { platform?: string }).platform ?? "";
	if (platform.toLowerCase().includes("mac")) return true;
	return /Mac|iP(hone|od|ad)/.test(navigator.userAgent ?? "");
}

interface ShortcutMatcher {
	cmd: boolean;
	ctrl: boolean;
	shift: boolean;
	alt: boolean;
	key: string;
}

function parseShortcut(s: string): ShortcutMatcher | null {
	const parts = s
		.split(/[+-]/)
		.map((p) => p.trim().toLowerCase())
		.filter(Boolean);
	const m: ShortcutMatcher = { cmd: false, ctrl: false, shift: false, alt: false, key: "" };
	for (const p of parts) {
		if (p === "cmd" || p === "meta" || p === "command") m.cmd = true;
		else if (p === "mod") {
			if (isMac()) m.cmd = true;
			else m.ctrl = true;
		} else if (p === "ctrl" || p === "control") m.ctrl = true;
		else if (p === "shift") m.shift = true;
		else if (p === "alt" || p === "option" || p === "opt") m.alt = true;
		else m.key = p;
	}
	return m.key ? m : null;
}

function formatShortcut(s: string): string {
	const parts = s
		.split(/[+-]/)
		.map((p) => p.trim())
		.filter(Boolean);
	const mac = isMac();
	return parts
		.map((p) => {
			const lower = p.toLowerCase();
			if (lower === "cmd" || lower === "meta" || lower === "command" || lower === "mod") return mac ? "⌘" : "Ctrl";
			if (lower === "ctrl" || lower === "control") return mac ? "⌃" : "Ctrl";
			if (lower === "shift") return mac ? "⇧" : "Shift";
			if (lower === "alt" || lower === "option" || lower === "opt") return mac ? "⌥" : "Alt";
			return p.length === 1 ? p.toUpperCase() : p;
		})
		.join(mac ? "" : "+");
}

function matchesShortcut(e: KeyboardEvent, m: ShortcutMatcher): boolean {
	if (e.metaKey !== m.cmd) return false;
	if (e.ctrlKey !== m.ctrl) return false;
	if (e.shiftKey !== m.shift) return false;
	if (e.altKey !== m.alt) return false;
	return e.key.toLowerCase() === m.key;
}

// One-shot keyboard detection for coarse touch/no-hover devices. CSS
// shows shortcuts by default on desktop/laptop contexts, hides them on
// touch-first devices, then reveals them again when a trusted keydown
// proves a hardware keyboard is available.
let keyboardObserverInstalled = false;

function observeKeyboardOnce(): void {
	if (keyboardObserverInstalled) return;
	keyboardObserverInstalled = true;
	const handler = (e: KeyboardEvent) => {
		if (!e.isTrusted) return;
		document.documentElement.setAttribute("data-neo-has-keyboard", "");
		document.removeEventListener("keydown", handler, true);
	};
	document.addEventListener("keydown", handler, true);
}

import { boolAttr } from "../command";
import { observeManagedAttrs, removeAttrIfPresent, setAttrIfChanged } from "../neo-morph-resilient";

const RESILIENT_ATTRS = ["role", "tabindex", "aria-disabled"];

export class NeoMenuItem extends HTMLElement {
	static readonly observedAttributes = ["disabled", "shortcut"];

	#shortcutHandler: ((e: KeyboardEvent) => void) | null = null;
	#morphObserver: MutationObserver | null = null;

	connectedCallback() {
		this.#resync();
		this.#renderShortcutHint();
		this.#bindShortcut();
		this.addEventListener("click", this.#onClick);
		this.addEventListener("keydown", this.#onKeyDown);
		if (this.getAttribute("shortcut")) observeKeyboardOnce();
		this.#morphObserver = observeManagedAttrs(this, RESILIENT_ATTRS, this.#resync);
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("keydown", this.#onKeyDown);
		this.#unbindShortcut();
		this.#morphObserver?.disconnect();
		this.#morphObserver = null;
	}

	attributeChangedCallback(name: string) {
		if (name === "disabled") this.#syncDisabled();
		else if (name === "shortcut") {
			this.#renderShortcutHint();
			this.#unbindShortcut();
			this.#bindShortcut();
		}
	}

	/** Dispatch select + bubble to the enclosing menu. No-op when disabled. */
	activate(): void {
		if (boolAttr(this, "disabled", false)) return;
		this.dispatchEvent(
			new CustomEvent("neo-menuitem-select", {
				bubbles: true,
				detail: { value: this.getAttribute("value") },
			}),
		);
	}

	#resync = () => {
		if (!this.hasAttribute("role")) this.setAttribute("role", "menuitem");
		if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "-1");
		this.#syncDisabled();
	};

	#syncDisabled(): void {
		if (boolAttr(this, "disabled", false)) {
			setAttrIfChanged(this, "aria-disabled", "true");
		} else {
			removeAttrIfPresent(this, "aria-disabled");
		}
	}

	#onClick = (e: MouseEvent) => {
		if (boolAttr(this, "disabled", false)) {
			e.stopImmediatePropagation();
			e.preventDefault();
			return;
		}
		e.preventDefault();
		this.activate();
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (boolAttr(this, "disabled", false)) return;
		if (e.key !== "Enter" && e.key !== " ") return;
		e.preventDefault();
		this.activate();
	};

	#renderShortcutHint(): void {
		// Dedup against the DOM, not an instance field: a fat-morph can
		// re-attach an injected hint a JS pointer no longer tracks, so a
		// reconnect would append a duplicate.
		for (const el of this.querySelectorAll(`:scope > [${SHORTCUT_HINT_ATTR}]`)) {
			el.remove();
		}
		const shortcut = this.getAttribute("shortcut");
		if (!shortcut) return;
		const hint = document.createElement("span");
		hint.setAttribute(SHORTCUT_HINT_ATTR, "");
		hint.setAttribute("aria-hidden", "true");
		hint.textContent = formatShortcut(shortcut);
		this.appendChild(hint);
	}

	#bindShortcut(): void {
		const shortcut = this.getAttribute("shortcut");
		if (!shortcut) return;
		const matcher = parseShortcut(shortcut);
		if (!matcher) return;
		const handler = (e: KeyboardEvent) => {
			if (boolAttr(this, "disabled", false)) return;
			if (!matchesShortcut(e, matcher)) return;
			// Don't fire when typing into an editable target.
			const target = e.target as HTMLElement | null;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
			e.preventDefault();
			this.activate();
		};
		this.#shortcutHandler = handler;
		document.addEventListener("keydown", handler);
	}

	#unbindShortcut(): void {
		if (!this.#shortcutHandler) return;
		document.removeEventListener("keydown", this.#shortcutHandler);
		this.#shortcutHandler = null;
	}
}

if (!customElements.get("neo-menuitem")) {
	customElements.define("neo-menuitem", NeoMenuItem);
}
