type SignalValue = string | number | boolean | null;

interface PlaygroundState {
	id: string;
	label: string;
	code: string;
	css: string;
	enabled: boolean;
}

interface SortableEndDetail {
	from: number;
	to: number;
	changed: boolean;
}

const DEFAULT_AUTOPLAY_DELAY = 3400;
// The settings panel publishes the autoplay duration on window and
// fires this event on change so running playgrounds re-arm.
const PLAYGROUND_CONFIG_EVENT = "morpheus-playground-config";
const CODE_PATCH_DELAY = 300;

// Autoplay step duration, tuned from the settings panel. Falls back to
// the default for an unset / non-positive value.
function autoplayDelay(): number {
	const ms = Number((window as { morpheusPlaygroundAutoplayMs?: number }).morpheusPlaygroundAutoplayMs);
	return Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_AUTOPLAY_DELAY;
}
const SIGNAL_REF = /^\$([A-Za-z_][A-Za-z0-9_]*)$/;
const BOOL_COMMAND_REF = /^\$([A-Za-z_][A-Za-z0-9_]*)\s*\?\s*['"]true['"]\s*:\s*['"]false['"]$/;
const signalRef = (expr: string): string | null => {
	const value = expr.trim();
	return value.match(SIGNAL_REF)?.[1] ?? value.match(BOOL_COMMAND_REF)?.[1] ?? null;
};

// Kit change events that signal a preview element committed a new value to
// one of its own `data-attr:*`-bound attributes via user interaction. The
// back-channel reads the value from these (signal <- DOM direction), since
// it fires synchronously before Datastar's MutationObserver re-asserts the
// stale signal value onto the DOM; a mutation observer here always loses
// that race. `*-change` only (never `*-input`): commit, not every tick.
const PREVIEW_CHANGE_EVENTS = [
	"neo-switch-change",
	"neo-checkbox-change",
	"neo-toggle-change",
	"neo-toggle-group-change",
	"neo-buttongroup-change",
	"neo-radio-group-change",
	"neo-tabs-change",
	"neo-carousel-change",
	"neo-select-change",
	"neo-combobox-change",
	"neo-rating-change",
	"neo-pagination-change",
	"neo-breadcrumb-change",
	"neo-avatars-change",
	"neo-slider-change",
	"neo-slider-range-change",
	"neo-textinput-change",
];

// Continuous slider events update their Datastar signals in the example
// markup itself. Mirror the current attribute into the Signals pane on
// every tick, but don't send another server patch while the pointer moves.
const PREVIEW_INPUT_EVENTS = ["neo-slider-input", "neo-slider-range-input"];

class SitePlayground extends HTMLElement {
	#states: PlaygroundState[] = [];
	#activeID = "";
	#defaultID = "";
	#copyCount = 0;
	#codeTimer = 0;
	#playTimer = 0;
	// Autoplay intent (the toggle) vs. whether it's currently running.
	// While off-screen the interval is halted but the intent persists, so
	// it resumes when the playground scrolls back into view.
	#autoplayWanted = false;
	#onScreen = true;
	#visibilityObserver: IntersectionObserver | null = null;
	#signalValues = new Map<string, SignalValue>();
	// Item the shared states context menu currently targets.
	#contextItemId = "";

	connectedCallback(): void {
		if (this.#states.length > 0) return;
		this.#readStates();
		this.addEventListener("click", this.#onStateNameSecondClick, true);
		this.addEventListener("click", this.#onClick);
		this.addEventListener("neo-toggle-change", this.#onToggle);
		this.addEventListener("neo-menuitem-select", this.#onMenuSelect);
		this.addEventListener("neo-sortable-end", this.#onSortEnd);
		this.addEventListener("site-codemirror-input", this.#onCodeInput);
		this.addEventListener("neo-textinput-change", this.#onSignalInput);
		this.addEventListener("neo-switch-change", this.#onSwitchChange);
		this.addEventListener("input", this.#onStateNameInput);
		this.addEventListener("keydown", this.#onStateNameKeyDown, true);
		this.addEventListener("focusout", this.#onStateNameFocusOut);
		this.addEventListener("contextmenu", this.#onContextMenu, true);
		for (const type of PREVIEW_CHANGE_EVENTS) this.addEventListener(type, this.#onPreviewChange);
		for (const type of PREVIEW_INPUT_EVENTS) this.addEventListener(type, this.#onPreviewInput);
		document.addEventListener(PLAYGROUND_CONFIG_EVENT, this.#onConfigChange);
		if (this.#states.length > 0) this.#select(this.#states[0].id, false);
		// Autoplay off by default; opt in via the `autoplay` attribute. A
		// single state has nothing to cycle. The observer below starts it
		// once the playground is in view.
		if (this.hasAttribute("autoplay") && this.#states.length > 1) {
			this.#autoplayWanted = true;
			this.querySelector(".component-playground-play")?.setAttribute("pressed", "");
		}
		this.#visibilityObserver = new IntersectionObserver(this.#onVisibilityChange);
		this.#visibilityObserver.observe(this);
	}

	disconnectedCallback(): void {
		this.removeEventListener("click", this.#onStateNameSecondClick, true);
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("neo-toggle-change", this.#onToggle);
		this.removeEventListener("neo-menuitem-select", this.#onMenuSelect);
		this.removeEventListener("neo-sortable-end", this.#onSortEnd);
		this.removeEventListener("site-codemirror-input", this.#onCodeInput);
		this.removeEventListener("neo-textinput-change", this.#onSignalInput);
		this.removeEventListener("neo-switch-change", this.#onSwitchChange);
		this.removeEventListener("input", this.#onStateNameInput);
		this.removeEventListener("contextmenu", this.#onContextMenu, true);
		this.removeEventListener("keydown", this.#onStateNameKeyDown, true);
		this.removeEventListener("focusout", this.#onStateNameFocusOut);
		document.removeEventListener("pointerdown", this.#onEditOutsidePointerDown, true);
		for (const type of PREVIEW_CHANGE_EVENTS) this.removeEventListener(type, this.#onPreviewChange);
		for (const type of PREVIEW_INPUT_EVENTS) this.removeEventListener(type, this.#onPreviewInput);
		document.removeEventListener(PLAYGROUND_CONFIG_EVENT, this.#onConfigChange);
		this.#visibilityObserver?.disconnect();
		this.#visibilityObserver = null;
		window.clearTimeout(this.#codeTimer);
		this.#haltAutoplay();
	}

	get #editor(): HTMLElement {
		return this.querySelector<HTMLElement>('.component-playground-code site-codemirror[data-editor="html"]')!;
	}

	get #cssEditor(): HTMLElement {
		return this.querySelector<HTMLElement>('.component-playground-code site-codemirror[data-editor="css"]')!;
	}

	get #codeSync(): HTMLElement {
		return this.querySelector<HTMLElement>(".component-playground-code neo-switch")!;
	}

	get #signalSync(): HTMLElement {
		return this.querySelector<HTMLElement>(".component-playground-signals footer neo-switch")!;
	}

	get #signalPatch(): HTMLElement {
		return this.querySelector<HTMLElement>(".component-playground-patch-signals")!;
	}

	#readStates(): void {
		const templates = this.querySelectorAll<HTMLTemplateElement>(":scope > template[data-playground-state]");
		const cssTemplates = this.querySelectorAll<HTMLTemplateElement>(":scope > template[data-playground-css]");
		const items = this.querySelectorAll<HTMLElement>(".component-playground-state");
		this.#states = Array.from(templates, (template, index) => ({
			id: items[index]?.id || `${this.id}-state-${index}`,
			label: template.dataset.label || `State ${index + 1}`,
			code: template.content.textContent ?? "",
			css: cssTemplates[index]?.content.textContent ?? "",
			enabled: true,
		}));
		this.#defaultID = this.#states[0]?.id ?? "";
	}

	#select(id: string, patch: boolean): void {
		const state = this.#states.find((item) => item.id === id);
		if (!state) return;
		this.#activeID = id;
		this.#editor.setAttribute("value", state.code);
		this.#cssEditor.setAttribute("value", state.css);
		for (const item of this.querySelectorAll<HTMLElement>(".component-playground-state")) {
			item.toggleAttribute("data-active", item.id === id);
		}
		if (patch) this.#requestElementsPatch(state);
		else this.#updateSignalControls(state.code);
		// A manual switch restarts the dwell so it doesn't advance early.
		this.#resetAutoplayTimer();
	}

	#requestElementsPatch(state: PlaygroundState, mode = "morph"): void {
		this.#updateSignalControls(state.code);
		this.dispatchEvent(
			new CustomEvent("site-playground-patch-elements", {
				bubbles: true,
				detail: { code: this.#previewCode(state), mode },
			}),
		);
	}

	// Preview body for a state: scoped CSS then markup. Must match
	// playground.go playgroundPreviewHTML so an unedited state patches
	// identically to the server-rendered initial preview.
	#previewCode(state: PlaygroundState): string {
		const css = state.css.trim();
		if (!css) return state.code;
		return `<style>@scope {\n${css}\n}</style>\n${state.code}`;
	}

	#updateSignalControls(code: string): void {
		this.#signalValues = this.#parseSignals(code);
		this.#renderSignals();
	}

	#requestSignalsPatch(): void {
		this.dispatchEvent(
			new CustomEvent("site-playground-patch-signals", {
				bubbles: true,
				detail: {
					signals: JSON.stringify(Object.fromEntries(this.#signalValues)),
				},
			}),
		);
	}

	#parseSignals(code: string): Map<string, SignalValue> {
		const document = new DOMParser().parseFromString(code, "text/html");
		const values = new Map<string, SignalValue>();
		// data-signals values are Datastar expressions (unquoted keys,
		// single-quoted strings), not strict JSON. Evaluate as JS the way
		// Datastar does; the state HTML is trusted, repo-authored. The editor
		// stays patchable on a throw; only the malformed control is omitted.
		// biome-ignore lint/nursery/noImpliedEval: Datastar-syntax state HTML is trusted, repo-authored; evaluated as JS like Datastar itself does.
		const evalExpr = (expr: string): unknown => new Function(`"use strict";return(${expr})`)();
		const keep = (name: string, value: unknown): void => {
			if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
				values.set(name, value);
			}
		};
		for (const element of document.querySelectorAll<HTMLElement>("*")) {
			// Object form: data-signals="{foo: 1, bar: 'x'}".
			const obj = element.getAttribute("data-signals");
			if (obj) {
				try {
					for (const [name, value] of Object.entries(evalExpr(obj) as Record<string, unknown>)) {
						keep(name, value);
					}
				} catch {
					/* malformed object expression */
				}
			}
			// Per-key form: data-signals:foo="1". Datastar camel-cases the
			// key (hyphens removed) unless a __case modifier overrides; the
			// value is its own expression. A bare word is an undefined
			// identifier in Datastar (an error), so an eval throw means "not
			// a scalar signal value" and is skipped, like a non-scalar object
			// entry. Quote strings: data-signals:foo="'x'".
			for (const attr of Array.from(element.attributes)) {
				if (!attr.name.startsWith("data-signals:")) continue;
				const name = this.#signalKey(attr.name.slice("data-signals:".length));
				// Nested keys (foo.bar) declare object signals; the panel only
				// edits flat scalars, matching the object form.
				if (!name || name.includes(".")) continue;
				try {
					keep(name, evalExpr(attr.value));
				} catch {
					/* not a scalar Datastar expression */
				}
			}
		}
		return values;
	}

	// Resolve a `data-signals:*` attribute key to the signal name Datastar
	// creates: default camel case (hyphens removed, the next letter
	// uppercased), overridable by the `__case` modifier. Modifiers are
	// appended with `__`; underscores are left as-is.
	#signalKey(raw: string): string {
		const modAt = raw.indexOf("__");
		const key = modAt === -1 ? raw : raw.slice(0, modAt);
		const mode =
			modAt === -1 ? "camel" : (raw.slice(modAt).match(/__case\.(camel|kebab|snake|pascal)/)?.[1] ?? "camel");
		const toCamel = (s: string): string => s.replace(/-+[a-zA-Z0-9]/g, (m) => m.replace(/-/g, "").toUpperCase());
		switch (mode) {
			case "kebab":
				return key;
			case "snake":
				return key.replace(/-/g, "_");
			case "pascal": {
				const c = toCamel(key);
				return c.charAt(0).toUpperCase() + c.slice(1);
			}
			default:
				return toCamel(key);
		}
	}

	#renderSignals(): void {
		const list = this.querySelector<HTMLElement>(".component-playground-signal-list")!;
		// A preview interaction fires this on every value change. Update the
		// existing rows in place when the signal set is unchanged, so each
		// interaction does not recreate every input element (and its event
		// listeners), which churns the DOM and the JS listener count.
		if (this.#updateSignalsInPlace(list)) return;
		list.replaceChildren();
		for (const [name, value] of this.#signalValues) {
			const label = document.createElement("label");
			label.className = "component-playground-signal";
			const title = document.createElement("span");
			title.textContent = `$${name}`;
			label.appendChild(title);
			if (typeof value === "boolean") {
				const input = document.createElement("neo-switch");
				input.setAttribute("size", "sm");
				input.setAttribute("aria-label", name);
				input.dataset.signal = name;
				input.toggleAttribute("checked", value);
				label.appendChild(input);
			} else {
				const input = document.createElement("neo-textinput");
				input.setAttribute("aria-label", name);
				input.setAttribute("value", value == null ? "" : String(value));
				input.dataset.signal = name;
				input.dataset.signalType = typeof value;
				label.appendChild(input);
			}
			list.appendChild(label);
		}
		if (this.#signalValues.size === 0) {
			const empty = document.createElement("p");
			empty.className = "component-playground-signals-empty";
			empty.textContent = "No signals in this state.";
			list.appendChild(empty);
		}
		// Nothing to patch when the state declares no signals.
		this.#signalPatch.toggleAttribute("disabled", this.#signalValues.size === 0);
	}

	// Update the value shown in each existing signal row without recreating
	// it. Returns false (caller rebuilds) when the row set no longer matches
	// the signals by name and kind, e.g. a state change adds or drops a signal
	// or flips a signal between boolean (neo-switch) and text (neo-textinput).
	#updateSignalsInPlace(list: HTMLElement): boolean {
		const rows = list.querySelectorAll<HTMLElement>(":scope > label.component-playground-signal");
		if (rows.length !== this.#signalValues.size) return false;
		const byName = new Map<string, HTMLElement>();
		for (const row of rows) {
			const input = row.querySelector<HTMLElement>("[data-signal]");
			if (!input) return false;
			byName.set(input.dataset.signal ?? "", input);
		}
		for (const [name, value] of this.#signalValues) {
			const input = byName.get(name);
			if (!input) return false;
			if ((typeof value === "boolean") !== (input.tagName === "NEO-SWITCH")) return false;
		}
		for (const [name, value] of this.#signalValues) {
			const input = byName.get(name);
			if (!input) continue;
			if (typeof value === "boolean") {
				if (input.hasAttribute("checked") !== value) input.toggleAttribute("checked", value);
			} else {
				const str = value == null ? "" : String(value);
				if (input.getAttribute("value") !== str) input.setAttribute("value", str);
			}
		}
		return true;
	}

	#duplicateDefault(): void {
		const source = this.#states.find((state) => state.id === this.#defaultID);
		if (!source) return;
		this.#copyCount++;
		const state: PlaygroundState = {
			id: `${this.id}-state-copy-${this.#copyCount}`,
			label: this.#nextUnnamedLabel(),
			code: source.code,
			css: source.css,
			enabled: true,
		};
		this.#states.unshift(state);
		const item = this.#createStateItem(state);
		this.querySelector(".component-playground-states")?.prepend(item);
		this.#select(state.id, true);
	}

	// Copy a state in place: a new item with the same code, inserted right
	// after the source.
	#duplicateState(source: PlaygroundState, sourceItem: HTMLElement): void {
		this.#copyCount++;
		const state: PlaygroundState = {
			id: `${this.id}-state-copy-${this.#copyCount}`,
			label: this.#nextCopyLabel(source.label),
			code: source.code,
			css: source.css,
			enabled: true,
		};
		this.#states.splice(this.#states.indexOf(source) + 1, 0, state);
		sourceItem.after(this.#createStateItem(state));
		this.#select(state.id, true);
	}

	// "Unnamed", then "Unnamed 2", "Unnamed 3", … reusing freed numbers.
	#nextUnnamedLabel(): string {
		const used = new Set(this.#states.map((state) => state.label));
		if (!used.has("Unnamed")) return "Unnamed";
		let n = 2;
		while (used.has(`Unnamed ${n}`)) n++;
		return `Unnamed ${n}`;
	}

	// Copy name: strip a trailing number off the source, then append the
	// lowest free count ≥ 2. "With actions" → "With actions 2"; duplicating
	// "With actions 2" → "With actions 3".
	#nextCopyLabel(label: string): string {
		const base = label.replace(/\s+\d+$/, "").trim() || "Unnamed";
		const used = new Set(this.#states.map((state) => state.label));
		let n = 2;
		while (used.has(`${base} ${n}`)) n++;
		return `${base} ${n}`;
	}

	#createStateItem(state: PlaygroundState): HTMLElement {
		const item = document.createElement("div");
		item.id = state.id;
		item.className = "neo-sortable-item component-playground-state";
		item.setAttribute("title", `Select ${state.label}`);

		const handle = document.createElement("span");
		handle.className = "neo-sortable-handle";
		handle.setAttribute("data-neo-sortable-handle", "");
		handle.setAttribute("aria-label", `Reorder ${state.label}`);
		handle.setAttribute("title", "Reorder state");
		handle.innerHTML = '<neo-icon name="grip-vertical"></neo-icon>';

		const name = document.createElement("span");
		name.className = "component-playground-state-name";
		name.tabIndex = 0;
		name.setAttribute("title", "Double-click or press Enter to rename");
		name.textContent = state.label;

		const enable = document.createElement("neo-toggle");
		enable.className = "component-playground-enable-state";
		enable.setAttribute("pressed", "");
		enable.setAttribute("size", "sm");
		enable.setAttribute("aria-label", `Include ${state.label} in autoplay`);
		enable.setAttribute("title", "Include in autoplay");
		enable.innerHTML =
			'<span data-neo-toggle-on><neo-icon name="eye"></neo-icon></span>' +
			'<span data-neo-toggle-off><neo-icon name="eye-closed"></neo-icon></span>';

		item.append(handle, name, enable);
		this.#syncStateLabels(item, state);
		return item;
	}

	#syncStateLabels(item: HTMLElement, state: PlaygroundState): void {
		const label = state.label || "Untitled";
		item.setAttribute("title", `Select ${label}`);
		item.querySelector(".neo-sortable-handle")?.setAttribute("aria-label", `Reorder ${label}`);
		item
			.querySelector(".component-playground-enable-state")
			?.setAttribute("aria-label", `Include ${label} in autoplay`);
	}

	#toggleAutoplay(): void {
		this.#autoplayWanted = !this.#autoplayWanted;
		this.querySelector(".component-playground-play")?.toggleAttribute("pressed", this.#autoplayWanted);
		// Switching on arms a fresh full-duration interval; don't jump to
		// the next state right away.
		this.#syncAutoplay();
	}

	// Reconcile the running timer with intent + visibility. Start always
	// holds the current state for one full delay before advancing.
	#syncAutoplay(): void {
		if (this.#autoplayWanted && this.#onScreen) this.#runAutoplay();
		else this.#haltAutoplay();
	}

	#runAutoplay(): void {
		if (this.#playTimer !== 0) return;
		this.#playTimer = window.setInterval(() => this.#advance(), autoplayDelay());
	}

	#haltAutoplay(): void {
		window.clearInterval(this.#playTimer);
		this.#playTimer = 0;
	}

	// Re-arm the running interval from now; no-op when autoplay isn't on.
	// Picks up a new autoplay duration from the settings panel.
	#resetAutoplayTimer(): void {
		if (this.#playTimer === 0) return;
		window.clearInterval(this.#playTimer);
		this.#playTimer = window.setInterval(() => this.#advance(), autoplayDelay());
	}

	#onConfigChange = (): void => {
		this.#resetAutoplayTimer();
	};

	// Pause while scrolled out of view; resume if it was wanted before.
	#onVisibilityChange = (entries: IntersectionObserverEntry[]): void => {
		this.#onScreen = entries.some((entry) => entry.isIntersecting);
		this.#syncAutoplay();
	};

	#advance(): void {
		const enabled = this.#states.filter((state) => state.enabled);
		if (enabled.length === 0) return;
		const index = enabled.findIndex((state) => state.id === this.#activeID);
		const next = enabled[(index + 1 + enabled.length) % enabled.length];
		this.#select(next.id, true);
	}

	#activeState(): PlaygroundState | undefined {
		return this.#states.find((state) => state.id === this.#activeID);
	}

	#isChecked(element: HTMLElement): boolean {
		return element.hasAttribute("checked");
	}

	#onClick = (event: MouseEvent): void => {
		const target = event.target as Element | null;
		if (target?.closest(".component-playground-add")) this.#duplicateDefault();
		const item = target?.closest<HTMLElement>(".component-playground-state");
		const editingName = target?.closest('.component-playground-state-name[contenteditable="plaintext-only"]');
		const enable = target?.closest(".component-playground-enable-state");
		const handle = target?.closest("[data-neo-sortable-handle]");
		if (item && !editingName && !enable && !handle && item.id !== this.#activeID) {
			this.#select(item.id, true);
		}
		if (target?.closest(".component-playground-replace-code")) {
			const state = this.#activeState();
			if (state) this.#requestElementsPatch(state, "replace");
		}
		if (target?.closest(".component-playground-patch-code")) {
			const state = this.#activeState();
			if (state) this.#requestElementsPatch(state);
		}
		if (target?.closest(".component-playground-patch-signals")) this.#requestSignalsPatch();
	};

	#onStateNameSecondClick = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const name = target.closest<HTMLElement>(".component-playground-state-name");
		if (!name) return;
		if (name.isContentEditable) {
			event.stopPropagation();
			return;
		}
		if (event.detail !== 2) return;
		event.preventDefault();
		event.stopPropagation();
		this.#editStateName(name);
	};

	#onToggle = (event: Event): void => {
		const target = event.target as HTMLElement;
		if (target.matches(".component-playground-enable-state")) {
			const item = target.closest<HTMLElement>(".component-playground-state");
			const state = this.#states.find((candidate) => candidate.id === item?.id);
			if (state) state.enabled = target.hasAttribute("pressed");
			item?.classList.toggle("is-disabled", !state?.enabled);
			return;
		}
		if (target.matches(".component-playground-play")) this.#toggleAutoplay();
	};

	#onMenuSelect = (event: Event): void => {
		const target = event.target instanceof Element ? event.target : null;
		const fromToolbarMenu = !!target?.closest(".component-playground-menu");
		const fromStatesMenu = !!target?.closest(".component-playground-states-menu");
		if (!fromToolbarMenu && !fromStatesMenu) return;

		const value = (event as CustomEvent<{ value: string }>).detail.value;
		// Toolbar overflow menu.
		if (fromToolbarMenu && value === "new") {
			this.#duplicateDefault();
			return;
		}
		if (fromToolbarMenu && value === "play") {
			this.#toggleAutoplay();
			return;
		}
		if (!fromStatesMenu) return;

		// Per-item states context menu.
		const item = this.#contextItemId ? this.querySelector<HTMLElement>(`#${CSS.escape(this.#contextItemId)}`) : null;
		const state = this.#states.find((candidate) => candidate.id === this.#contextItemId);
		if (!item || !state) return;
		if (value === "toggle") {
			state.enabled = !state.enabled;
			item.querySelector(".component-playground-enable-state")?.toggleAttribute("pressed", state.enabled);
			item.classList.toggle("is-disabled", !state.enabled);
		} else if (value === "rename") {
			const name = item.querySelector<HTMLElement>(".component-playground-state-name");
			// Defer: the menu returns focus to its trigger on close, which
			// would otherwise steal focus from the rename field.
			if (name) requestAnimationFrame(() => this.#editStateName(name));
		} else if (value === "duplicate") {
			this.#duplicateState(state, item);
		} else if (value === "delete") {
			if (this.#states.length > 1) this.#removeState(state, item);
		}
	};

	// Capture the right-clicked state before neo-contextmenu opens its
	// shared menu, and label the toggle row for that item. Right-clicks
	// off an item (toolbar gaps) suppress the menu.
	#onContextMenu = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof Element) || !target.closest(".component-playground-states")) return;
		const item = target.closest<HTMLElement>(".component-playground-state");
		if (!item) {
			event.stopPropagation();
			return;
		}
		this.#contextItemId = item.id;
		const state = this.#states.find((candidate) => candidate.id === item.id);
		const toggle = this.querySelector<HTMLElement>('.component-playground-states-menu neo-menuitem[value="toggle"]');
		if (toggle && state) toggle.textContent = state.enabled ? "Deactivate" : "Activate";
	};

	#onSortEnd = (event: Event): void => {
		const detail = (event as CustomEvent<SortableEndDetail>).detail;
		if (!detail.changed) return;
		const [state] = this.#states.splice(detail.from, 1);
		if (state) this.#states.splice(detail.to, 0, state);
	};

	#editStateName(name: HTMLElement): void {
		name.contentEditable = "plaintext-only";
		name.setAttribute("role", "textbox");
		name.setAttribute("aria-label", "State name");
		name.setAttribute("aria-multiline", "false");
		name.setAttribute("spellcheck", "false");
		name.setAttribute("data-neo-sortable-nodrag", "");
		name.focus();
		// A pointerdown on a non-focusable sibling (another state, toolbar
		// gap) won't blur the field, so commit it explicitly. Capture phase
		// fires before the click reorders/selects.
		document.addEventListener("pointerdown", this.#onEditOutsidePointerDown, true);

		const selection = window.getSelection();
		const range = document.createRange();
		range.selectNodeContents(name);
		selection?.removeAllRanges();
		selection?.addRange(range);
	}

	#onStateNameInput = (event: Event): void => {
		const name = event.target;
		if (
			!(name instanceof HTMLElement) ||
			!name.matches('.component-playground-state-name[contenteditable="plaintext-only"]')
		) {
			return;
		}
		const item = name.closest<HTMLElement>(".component-playground-state");
		const state = this.#states.find((candidate) => candidate.id === item?.id);
		if (!item || !state) return;
		state.label = name.textContent?.replace(/\s+/g, " ") ?? "";
		this.#syncStateLabels(item, state);
	};

	#onStateNameKeyDown = (event: KeyboardEvent): void => {
		const name = event.target;
		if (!(name instanceof HTMLElement) || !name.matches(".component-playground-state-name")) {
			return;
		}
		// Editing: Enter / Escape commit and exit (focusout writes back).
		if (name.isContentEditable) {
			if (event.key !== "Enter" && event.key !== "Escape") return;
			event.preventDefault();
			event.stopPropagation();
			name.blur();
			return;
		}
		// Focused but idle: Enter / F2 enter rename without a mouse.
		if (event.key !== "Enter" && event.key !== "F2") return;
		event.preventDefault();
		event.stopPropagation();
		this.#editStateName(name);
	};

	#onEditOutsidePointerDown = (event: PointerEvent): void => {
		const editing = this.querySelector<HTMLElement>(
			'.component-playground-state-name[contenteditable="plaintext-only"]',
		);
		if (!editing) return;
		const target = event.target;
		if (target instanceof Node && editing.contains(target)) return;
		editing.blur();
	};

	#onStateNameFocusOut = (event: FocusEvent): void => {
		const name = event.target;
		if (!(name instanceof HTMLElement) || !name.matches(".component-playground-state-name")) return;
		// Only commit a real edit. A plain tab-through must not rewrite the
		// text node; that mutation trips neo-sortable's child observer and
		// snaps focus back to the grip, breaking Tab order.
		if (!name.isContentEditable) return;
		document.removeEventListener("pointerdown", this.#onEditOutsidePointerDown, true);
		const item = name.closest<HTMLElement>(".component-playground-state");
		const state = this.#states.find((candidate) => candidate.id === item?.id);
		if (!item || !state) return;
		const label = name.textContent?.replace(/\s+/g, " ").trim() ?? "";
		// An emptied name deletes the state, unless it's the last one left:
		// that one can't be removed, so it falls back to a generated name.
		if (label === "" && this.#states.length > 1) {
			this.#removeState(state, item);
			return;
		}
		state.label = label || this.#nextUnnamedLabel();
		name.textContent = state.label;
		name.removeAttribute("contenteditable");
		name.removeAttribute("role");
		name.removeAttribute("aria-label");
		name.removeAttribute("aria-multiline");
		name.removeAttribute("spellcheck");
		name.removeAttribute("data-neo-sortable-nodrag");
		this.#syncStateLabels(item, state);
	};

	#removeState(state: PlaygroundState, item: HTMLElement): void {
		const index = this.#states.indexOf(state);
		if (index === -1) return;
		this.#states.splice(index, 1);
		item.remove();
		// Keep duplication working if the default itself was removed.
		if (this.#defaultID === state.id) this.#defaultID = this.#states[0]?.id ?? "";
		// Move selection to a neighbor when the active state goes away.
		if (this.#activeID === state.id) {
			const next = this.#states[Math.min(index, this.#states.length - 1)];
			if (next) this.#select(next.id, true);
		}
	}

	#onCodeInput = (event: Event): void => {
		const target = event.target as HTMLElement;
		const editor = target.closest<HTMLElement>(".component-playground-code site-codemirror");
		if (!editor) return;
		const state = this.#activeState();
		if (!state) return;
		const value = (event as CustomEvent<{ value: string }>).detail.value;
		if (editor.dataset.editor === "css") state.css = value;
		else state.code = value;
		window.clearTimeout(this.#codeTimer);
		if (!this.#isChecked(this.#codeSync)) return;
		this.#codeTimer = window.setTimeout(() => this.#requestElementsPatch(state), CODE_PATCH_DELAY);
	};

	#onSignalInput = (event: Event): void => {
		const input = event.target as HTMLElement;
		const name = input.dataset.signal;
		if (!name) return;
		const raw = (event as CustomEvent<{ value: string }>).detail.value;
		const type = input.dataset.signalType;
		this.#signalValues.set(name, type === "number" ? Number(raw) : raw);
		if (this.#isChecked(this.#signalSync)) this.#requestSignalsPatch();
	};

	#onSwitchChange = (event: Event): void => {
		const input = event.target as HTMLElement;
		const name = input.dataset.signal;
		const checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
		if (input === this.#codeSync) {
			const state = this.#activeState();
			if (checked && state) this.#requestElementsPatch(state);
			return;
		}
		if (input === this.#signalSync) {
			if (checked) this.#requestSignalsPatch();
			return;
		}
		if (!name) return;
		this.#signalValues.set(name, checked);
		if (this.#isChecked(this.#signalSync)) this.#requestSignalsPatch();
	};

	// A live preview element committed a new value through user interaction
	// (toggle, drag, pick). Mirror it into the bound signal. Toolbar and
	// signal-editor controls live outside the preview and have their own
	// handlers, so skip them.
	#onPreviewChange = (event: Event): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (!target.closest(".component-playground-preview")) return;
		this.#mirrorPreviewBindings(target);
	};

	#onPreviewInput = (event: Event): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (!target.closest(".component-playground-preview")) return;
		this.#mirrorPreviewBindings(target, false);
	};

	// Read an element's `data-attr:*`-bound attributes and write any changed
	// value back into its signal. Called synchronously from the element's
	// change event so the attribute is still the just-committed value;
	// Datastar's MutationObserver re-asserts the old signal value a microtask
	// later, which is exactly why a mutation observer can't drive this.
	#mirrorPreviewBindings(el: Element, patch = true): void {
		if (!this.#isChecked(this.#signalSync)) return;
		let changed = false;
		for (const attr of el.attributes) {
			if (!attr.name.startsWith("data-attr:")) continue;
			const name = signalRef(attr.value);
			if (!name || !this.#signalValues.has(name)) continue;
			const bound = attr.name.slice("data-attr:".length);
			const current = this.#signalValues.get(name);
			const next =
				typeof current === "boolean"
					? el.hasAttribute(bound) && el.getAttribute(bound)?.toLowerCase() !== "false"
					: typeof current === "number"
						? Number(el.getAttribute(bound))
						: (el.getAttribute(bound) ?? "");
			if (next === current) continue;
			this.#signalValues.set(name, next);
			changed = true;
		}
		if (changed) {
			if (patch) this.#requestSignalsPatch();
			this.#renderSignals();
		}
	}
}

if (!customElements.get("site-playground")) {
	customElements.define("site-playground", SitePlayground);
}
