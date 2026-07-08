import { boolAttr, warnBadAxis } from "../command";

let nextTabsId = 0;

export class NeoTabs extends HTMLElement {
	static readonly observedAttributes = ["value", "orientation", "easing", "enter-animation", "exit-animation"];

	#hostId = "";
	#ready = false;
	#childObserver: MutationObserver | null = null;
	#previousActiveValue: string | null = null;
	#leavingPanel: HTMLElement | null = null;
	#leavingHandler: ((e: AnimationEvent) => void) | null = null;
	// Value of the tab that last held focus. A fat morph re-creates the
	// tab and blurs it to <body>; sync() reseats focus by value.
	#focusedTabValue: string | null = null;
	// Current selected value (source of truth). A fat morph dropping `value`
	// is no command: keep this and re-reflect, so the selection survives.
	#valueIntent: string | null = null;
	#reflectingValue = false;

	connectedCallback() {
		if (!this.id) this.id = `neo-tabs-${++nextTabsId}`;
		this.#hostId = this.id;
		warnBadAxis(this);
		if (!this.hasAttribute("orientation")) {
			this.setAttribute("orientation", "horizontal");
		}
		this.addEventListener("click", this.#onClick);
		this.addEventListener("keydown", this.#onKeyDown);
		this.addEventListener("focusin", this.#onFocusIn);
		this.addEventListener("focusout", this.#onFocusOut);

		// Re-sync on child changes: initial render races the parser, and
		// a fat-morph re-emitting tabs/panels needs re-linking by value.
		this.#childObserver = new MutationObserver(() => this.#sync());
		this.#childObserver.observe(this, { childList: true, subtree: true });

		this.#ready = true;
		this.#valueIntent = this.getAttribute("value");
		this.#syncEasing();
		this.#sync();
		// Deep-link scenario: a non-leading selected tab might already be
		// off-screen in a narrow tablist on the first paint. Jump to it
		// without animation so the page loads with the selection in view.
		this.#scrollActiveTabIntoView("auto");
	}

	// Stash per-host rules in a <head> <style> keyed by host id.
	// Datastar morphs strip the host's `style` attribute, so inline
	// custom properties wouldn't survive; <head> is outside the morph
	// zone.
	#syncEasing() {
		if (!this.id) return;
		const styleId = `neo-tabs-easing-${this.id}`;
		const raw = this.getAttribute("easing");
		let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
		if (raw === null) {
			styleEl?.remove();
			return;
		}
		const trimmed = raw.trim() || "200ms";
		// Duration via --neo-duration-scale, timing via --neo-easing with
		// the author value as fallback: theme + reduced-motion overrides
		// win kit-wide, and vars unset resolves to the author's exact
		// `<dur> <fn>`.
		const m = trimmed.match(/^(\d*\.?\d+(?:ms|s))\s*(.*)$/);
		const dur = m ? m[1] : "200ms";
		const fn = m?.[2].trim() ? m[2].trim() : "ease";
		const value = `calc(${dur} * var(--neo-duration-scale, 1)) ` + `var(--neo-easing, ${fn})`;
		if (!styleEl) {
			styleEl = document.createElement("style");
			styleEl.id = styleId;
			document.head.appendChild(styleEl);
		}
		const sel = `[id="${this.id.replace(/"/g, '\\"')}"]`;
		const enter = this.getAttribute("enter-animation");
		const exit = this.getAttribute("exit-animation");
		const rules: string[] = [];
		if (enter) {
			rules.push(
				`${sel} > neo-tabpanel:not([hidden]):not([data-neo-leaving]) ` + `{ animation: ${enter} ${value} both; }`,
			);
		}
		if (exit) {
			rules.push(`${sel} > neo-tabpanel[data-neo-leaving] ` + `{ animation: ${exit} ${value} both; }`);
		}
		if (!enter && !exit) {
			// Fall back to opacity crossfade via the [hidden] override.
			rules.push(`${sel} > neo-tabpanel { transition: ${value}; }`);
		}
		styleEl.textContent = rules.join("\n");
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("keydown", this.#onKeyDown);
		this.removeEventListener("focusin", this.#onFocusIn);
		this.removeEventListener("focusout", this.#onFocusOut);
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		if (this.#leavingPanel && this.#leavingHandler) {
			this.#leavingPanel.removeEventListener("animationend", this.#leavingHandler);
		}
		this.#leavingPanel = null;
		this.#leavingHandler = null;
		if (this.id) {
			document.getElementById(`neo-tabs-easing-${this.id}`)?.remove();
		}
		this.#ready = false;
	}

	attributeChangedCallback(name: string, _old: string | null, newValue: string | null) {
		if (!this.#ready) return;
		if (name === "easing" || name === "enter-animation" || name === "exit-animation") {
			this.#syncEasing();
			return;
		}
		if (name === "value") {
			// Our own re-reflect write (keep-on-absent below); not a command.
			if (this.#reflectingValue) return;
			// Fat morph dropped `value`: no command, keep the current
			// selection. Re-reflect so the attribute stays the state mirror,
			// blocking a reset to the first tab.
			if (newValue === null) {
				this.#reflectValue();
				this.#sync();
				return;
			}
			this.#valueIntent = newValue;
			this.#sync();
			return;
		}
		this.#sync();
	}

	get value(): string | null {
		return this.#valueIntent;
	}

	set value(v: string | null) {
		this.#valueIntent = v;
		this.#reflectValue();
		this.#sync();
	}

	// Re-assert `value` from intent after a morph stripped it (or after the
	// setter changed it), guarded so the write isn't read back as a command.
	#reflectValue() {
		this.#reflectingValue = true;
		try {
			if (this.#valueIntent === null) this.removeAttribute("value");
			else if (this.getAttribute("value") !== this.#valueIntent) {
				this.setAttribute("value", this.#valueIntent);
			}
		} finally {
			this.#reflectingValue = false;
		}
	}

	#tabs(): HTMLElement[] {
		return Array.from(this.querySelectorAll<HTMLElement>("neo-tablist > neo-tab"));
	}

	#panels(): HTMLElement[] {
		return Array.from(this.querySelectorAll<HTMLElement>(":scope > neo-tabpanel"));
	}

	#resolvedValue(): string | null {
		const explicit = this.getAttribute("value");
		if (explicit !== null) return explicit;
		// Fall back to first enabled tab so panels show something.
		const first = this.#tabs().find(
			(t) => !boolAttr(t, "disabled", false) && t.getAttribute("aria-disabled") !== "true",
		);
		return first?.getAttribute("value") ?? null;
	}

	#sync() {
		const value = this.#resolvedValue();
		const orientation = this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal";

		const tabs = this.#tabs();
		for (const tab of tabs) {
			const v = tab.getAttribute("value");
			const selected = v !== null && v === value;
			const disabled = boolAttr(tab, "disabled", false) || tab.getAttribute("aria-disabled") === "true";
			// A morph strips the role stamped in the child's connectedCallback
			// (absent from SSR) and never re-fires it; re-assert here.
			if (!tab.hasAttribute("role")) tab.setAttribute("role", "tab");
			tab.setAttribute("aria-selected", String(selected));
			if (disabled) tab.setAttribute("aria-disabled", "true");
			tab.setAttribute("tabindex", selected && !disabled ? "0" : "-1");
			const tabId = `${this.#hostId}-tab-${v ?? ""}`;
			const panelId = `${this.#hostId}-panel-${v ?? ""}`;
			tab.id = tabId;
			tab.setAttribute("aria-controls", panelId);
		}

		// Direction derived from value transition (not DOM attr) so it
		// survives morph wiping data-neo-direction.
		const newIdx = tabs.findIndex((t) => t.getAttribute("value") === value);
		const oldIdx =
			this.#previousActiveValue !== null
				? tabs.findIndex((t) => t.getAttribute("value") === this.#previousActiveValue)
				: -1;
		if (newIdx >= 0 && oldIdx >= 0 && newIdx !== oldIdx) {
			this.setAttribute("data-neo-direction", newIdx > oldIdx ? "forward" : "backward");
		}

		const panels = this.#panels();
		const newActivePanel = panels.find((p) => p.getAttribute("value") === value);
		const oldActivePanel =
			this.#previousActiveValue !== null && this.#previousActiveValue !== value
				? panels.find((p) => p.getAttribute("value") === this.#previousActiveValue)
				: null;
		const exitAnim = this.getAttribute("exit-animation");

		this.#finalizeLeaving();

		for (const panel of panels) {
			const v = panel.getAttribute("value");
			const panelId = `${this.#hostId}-panel-${v ?? ""}`;
			const tabId = `${this.#hostId}-tab-${v ?? ""}`;
			panel.id = panelId;
			if (!panel.hasAttribute("role")) panel.setAttribute("role", "tabpanel");
			panel.setAttribute("aria-labelledby", tabId);

			const isActive = panel === newActivePanel;
			const isLeaving = panel === oldActivePanel && !!exitAnim;

			if (isActive) {
				panel.removeAttribute("hidden");
				panel.removeAttribute("data-neo-leaving");
				panel.removeAttribute("inert");
			} else if (isLeaving) {
				panel.removeAttribute("hidden");
				panel.setAttribute("data-neo-leaving", "");
				panel.removeAttribute("inert");
				this.#leavingPanel = panel;
				this.#leavingHandler = (e: AnimationEvent) => {
					if (e.target !== panel) return;
					this.#finalizeLeaving();
				};
				panel.addEventListener("animationend", this.#leavingHandler);
			} else {
				panel.setAttribute("hidden", "");
				panel.removeAttribute("data-neo-leaving");
				// The crossfade fallback keeps [hidden] panels at display:block;
				// `inert` keeps their descendants out of focus / a11y tree.
				panel.setAttribute("inert", "");
			}

			// Tab stop the panel only when active/leaving, has content, and
			// has no focusable descendant. Otherwise focus lands here for
			// no reason and the browser scroll-into-view's the layout.
			const hasContent = panel.firstElementChild !== null || (panel.textContent ?? "").trim() !== "";
			const hasFocusable = panel.querySelector(
				"a[href], button:not([disabled]), input:not([disabled])," +
					"select:not([disabled]), textarea:not([disabled])," +
					"[tabindex]:not([tabindex='-1']), [contenteditable]:not([contenteditable='false'])",
			);
			const wantsFocus = (isActive || isLeaving) && hasContent && !hasFocusable;
			panel.setAttribute("tabindex", wantsFocus ? "0" : "-1");
		}

		this.#previousActiveValue = value;

		const list = this.querySelector<HTMLElement>(":scope > neo-tablist");
		if (list) {
			if (!list.hasAttribute("role")) list.setAttribute("role", "tablist");
			list.setAttribute("aria-orientation", orientation);
		}

		this.#restoreFocusIfLost();
	}

	// Reseat focus on the tab matching focusedTabValue when a morph
	// re-created it and dropped focus to <body>. No-op when focus is still
	// inside (normal sync) or moved elsewhere; drops a vanished target.
	#restoreFocusIfLost() {
		if (this.#focusedTabValue === null) return;
		if (this.contains(document.activeElement)) return;
		const ae = document.activeElement;
		if (ae && ae !== document.body) return;
		const tab = this.#tabs().find((t) => t.getAttribute("value") === this.#focusedTabValue);
		if (!tab) {
			this.#focusedTabValue = null;
			return;
		}
		tab.focus();
	}

	#onFocusIn = (e: FocusEvent) => {
		const tab = (e.target as Element | null)?.closest<HTMLElement>("neo-tab");
		this.#focusedTabValue = tab && this.contains(tab) ? tab.getAttribute("value") : null;
	};

	#onFocusOut = (e: FocusEvent) => {
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		if (next) {
			this.#focusedTabValue = null;
			return;
		}
		// Blur to nothing: a morph re-creating the tab (sync() restores
		// first, same microtask checkpoint) or a real click-away / Escape.
		// If focus is still gone after sync() ran, it was the user.
		queueMicrotask(() => {
			if (this.contains(document.activeElement)) return;
			this.#focusedTabValue = null;
		});
	};

	// Hide the leaving panel and clear tracking. Called from
	// animationend (natural finish) and from sync() (new transition
	// starting before the previous one finished).
	#finalizeLeaving() {
		const panel = this.#leavingPanel;
		if (!panel) return;
		if (this.#leavingHandler) {
			panel.removeEventListener("animationend", this.#leavingHandler);
		}
		panel.setAttribute("hidden", "");
		panel.removeAttribute("data-neo-leaving");
		panel.setAttribute("tabindex", "-1");
		panel.setAttribute("inert", "");
		this.#leavingPanel = null;
		this.#leavingHandler = null;
	}

	#onClick = (e: MouseEvent) => {
		const tab = (e.target as Element | null)?.closest<HTMLElement>("neo-tab");
		if (!tab) return;
		if (!this.contains(tab)) return;
		if (boolAttr(tab, "disabled", false) || tab.getAttribute("aria-disabled") === "true") {
			return;
		}
		const v = tab.getAttribute("value");
		if (v === null) return;
		this.#commit(v);
		tab.focus();
	};

	#onKeyDown = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		const focused = (e.target as Element | null)?.closest<HTMLElement>("neo-tab");
		if (!focused || !this.contains(focused)) return;

		const tabs = this.#tabs().filter(
			(t) => !boolAttr(t, "disabled", false) && t.getAttribute("aria-disabled") !== "true",
		);
		if (tabs.length === 0) return;
		const idx = tabs.indexOf(focused);

		const vertical = this.getAttribute("orientation") === "vertical";
		const prev = vertical ? "ArrowUp" : "ArrowLeft";
		const next = vertical ? "ArrowDown" : "ArrowRight";

		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			const v = focused.getAttribute("value");
			if (v !== null) this.#commit(v);
			return;
		}

		let target = -1;
		if (e.key === prev) target = idx <= 0 ? tabs.length - 1 : idx - 1;
		else if (e.key === next) {
			target = idx < 0 || idx >= tabs.length - 1 ? 0 : idx + 1;
		} else if (e.key === "Home") target = 0;
		else if (e.key === "End") target = tabs.length - 1;
		else return;

		e.preventDefault();
		const moveTo = tabs[target];
		moveTo.focus();
		if (boolAttr(this, "auto-activate", false)) {
			const v = moveTo.getAttribute("value");
			if (v !== null) this.#commit(v);
		}
	};

	#commit(value: string) {
		if (this.#valueIntent === value) return;
		// Intent is the source of truth; reflect to the attribute (guarded)
		// so resolvedValue() and CSS-free a11y state stay consistent.
		this.#valueIntent = value;
		this.#reflectValue();
		this.#sync();
		this.dispatchEvent(
			new CustomEvent("neo-tabs-change", {
				bubbles: true,
				detail: { value },
			}),
		);
		this.#scrollActiveTabIntoView();
	}

	// Center the active tab in the tablist's strip. Not
	// Element.scrollIntoView: its inline option walks every scrollable
	// ancestor and would scroll the page too; only the tablist's own
	// scrollLeft/scrollTop is touched. scrollTo clamps, so first/last
	// sit flush with no slack. Position derived from
	// getBoundingClientRect + scroll offset, not offsetLeft/offsetTop,
	// whose reference is the nearest positioned ancestor (not the tablist).
	#scrollActiveTabIntoView(behavior: ScrollBehavior = "smooth") {
		const value = this.#resolvedValue();
		const tab = this.#tabs().find((t) => t.getAttribute("value") === value);
		if (!tab) return;
		const tablist = tab.parentElement as HTMLElement | null;
		if (!tablist) return;
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const b = reduced ? "auto" : behavior;
		const tabRect = tab.getBoundingClientRect();
		const tlRect = tablist.getBoundingClientRect();
		if (this.getAttribute("orientation") === "vertical") {
			const tabTopInList = tabRect.top - tlRect.top + tablist.scrollTop;
			const top = tabTopInList - (tablist.clientHeight - tabRect.height) / 2;
			tablist.scrollTo({ top, behavior: b });
		} else {
			const tabLeftInList = tabRect.left - tlRect.left + tablist.scrollLeft;
			const left = tabLeftInList - (tablist.clientWidth - tabRect.width) / 2;
			tablist.scrollTo({ left, behavior: b });
		}
	}
}

// <neo-tablist>, <neo-tab>, <neo-tabpanel>: minimal markers. All
// behaviour lives on the parent <neo-tabs>. These just stamp default
// ARIA roles for unstyled markup.
export class NeoTabList extends HTMLElement {
	connectedCallback() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "tablist");
	}
}

export class NeoTab extends HTMLElement {
	connectedCallback() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "tab");
	}
}

export class NeoTabPanel extends HTMLElement {
	connectedCallback() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "tabpanel");
	}
}

if (!customElements.get("neo-tabs")) {
	customElements.define("neo-tabs", NeoTabs);
}
if (!customElements.get("neo-tablist")) {
	customElements.define("neo-tablist", NeoTabList);
}
if (!customElements.get("neo-tab")) {
	customElements.define("neo-tab", NeoTab);
}
if (!customElements.get("neo-tabpanel")) {
	customElements.define("neo-tabpanel", NeoTabPanel);
}
