// Holds option data (<neo-option> / <neo-optgroup>) for a control to read.
// Not interactive: no shadow DOM, no keyboard. Modeled on native
// <datalist>: give it an id and a control opts in with list="<id>".

// Controls that can read a datalist.
export const DATALIST_CONTROLS = "neo-select, neo-combobox, neo-textinput";

// Option-bearing children a control clones / reads from a datalist.
const OPTION_NODES = "neo-option, neo-optgroup, [data-neo-empty-results]";
const CONTROL_OWNED_OPTION_ATTRS = new Set([
	"aria-disabled",
	"aria-selected",
	"data-neo-navgroup-item",
	"data-neo-value",
	"id",
	"role",
	"tabindex",
]);

export class NeoDatalist extends HTMLElement {
	static readonly observedAttributes = ["id"];

	#observer: MutationObserver | null = null;

	// Shared when it stands outside any control. An inline datalist (a child
	// of one control) is re-read by that control's own observer, so it needs
	// no self-observer here.
	get isShared(): boolean {
		return !this.closest(DATALIST_CONTROLS);
	}

	connectedCallback() {
		if (this.isShared) this.#activate();
	}

	disconnectedCallback() {
		// Capture targets before tearing down so they re-resolve (and drop
		// this source) once it's gone.
		const targets = this.#controlsFor(this.id);
		this.#deactivate();
		for (const t of targets) notify(t);
	}

	attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
		if (name !== "id" || !this.isConnected) return;
		// Re-pointing the id moves which controls read this; re-sync both the
		// ones that referenced the old id and the ones now matching the new.
		for (const t of [...this.#controlsFor(oldValue), ...this.#controlsFor(newValue)]) notify(t);
	}

	#activate() {
		if (!this.#observer) {
			this.#observer = new MutationObserver(() => this.#notifyTargets());
			this.#observer.observe(this, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["value", "label", "disabled", "aria-disabled", "hidden"],
			});
		}
		this.#notifyTargets();
	}

	#deactivate() {
		this.#observer?.disconnect();
		this.#observer = null;
	}

	#controlsFor(id: string | null): HTMLElement[] {
		if (!id) return [];
		return Array.from(document.querySelectorAll<HTMLElement>(`[list="${CSS.escape(id)}"]`)).filter((el) =>
			el.matches(DATALIST_CONTROLS),
		);
	}

	#notifyTargets() {
		for (const t of this.#controlsFor(this.id)) notify(t);
	}
}

// Duck-typed re-read trigger so this module needn't import the controls.
function notify(host: HTMLElement) {
	(host as HTMLElement & { syncDatalist?: () => void }).syncDatalist?.();
}

// A control has its own option source (inline datalist or directly authored
// options): an external datalist must not override it. Clones a control made
// from an external datalist live under [data-neo-datalist-managed] and don't
// count as an inline source.
export function hasInlineSource(host: HTMLElement): boolean {
	return Array.from(host.querySelectorAll("neo-option, neo-optgroup")).some(
		(o) => !o.closest("[data-neo-datalist-managed]"),
	);
}

// The external datalist a control should read, honoring precedence. A control
// opts in with list="<id>" (like native <input list>). Returns null when an
// inline source wins, the list attribute is absent, or it points at no
// upgraded <neo-datalist>.
export function externalDatalistFor(host: HTMLElement): NeoDatalist | null {
	if (hasInlineSource(host)) return null;
	const id = host.getAttribute("list");
	if (!id) return null;
	const el = document.getElementById(id);
	return el instanceof NeoDatalist ? el : null;
}

// Reconcile a control's managed container with clones of the datalist's
// options. Clones (not the live nodes) because one datalist may feed several
// controls, and a node can't be slotted into more than one at once. Reusing a
// keyed clone when possible keeps an already-open listbox/textinput popover
// from seeing stable options as removed-and-reinserted rows.
export function cloneDatalistOptionsInto(container: HTMLElement, datalist: NeoDatalist) {
	reconcileOptionChildren(container, Array.from(datalist.querySelectorAll<HTMLElement>(`:scope > ${OPTION_NODES}`)));
}

function reconcileOptionChildren(container: HTMLElement, sourceChildren: HTMLElement[]) {
	const existing = new Map<string, HTMLElement[]>();
	for (const child of Array.from(container.children)) {
		if (!(child instanceof HTMLElement) || !child.matches(OPTION_NODES)) continue;
		const key = optionNodeKey(child);
		if (!existing.has(key)) existing.set(key, []);
		existing.get(key)!.push(child);
	}
	const next = sourceChildren.map((source) => {
		const key = optionNodeKey(source);
		const target = existing.get(key)?.shift() ?? (source.cloneNode(false) as HTMLElement);
		syncClone(target, source);
		return target;
	});
	container.replaceChildren(...next);
}

function optionNodeKey(el: HTMLElement): string {
	if (el.matches("neo-option")) {
		return `option:${el.getAttribute("value") ?? el.getAttribute("data-neo-value") ?? el.textContent?.trim() ?? ""}`;
	}
	if (el.matches("neo-optgroup")) {
		return `group:${el.getAttribute("label") ?? el.textContent?.trim() ?? ""}`;
	}
	return `${el.localName}:${el.getAttribute("data-neo-empty-results") ?? el.textContent?.trim() ?? ""}`;
}

function syncClone(target: HTMLElement, source: HTMLElement) {
	for (const name of target.getAttributeNames()) {
		if (!source.hasAttribute(name) && !CONTROL_OWNED_OPTION_ATTRS.has(name)) target.removeAttribute(name);
	}
	for (const name of source.getAttributeNames()) {
		const value = source.getAttribute(name) ?? "";
		if (target.getAttribute(name) !== value) target.setAttribute(name, value);
	}
	const optionChildren = Array.from(source.children).filter(
		(child): child is HTMLElement => child instanceof HTMLElement && child.matches(OPTION_NODES),
	);
	if (optionChildren.length > 0) {
		reconcileOptionChildren(target, optionChildren);
		return;
	}
	target.replaceChildren(...Array.from(source.childNodes).map((node) => node.cloneNode(true)));
}

if (!customElements.get("neo-datalist")) {
	customElements.define("neo-datalist", NeoDatalist);
}
