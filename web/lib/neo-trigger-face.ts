// Trigger-face renderer shared by <neo-select> and <neo-combobox>. Clones
// an option's "face" into a `slot="trigger"` host child (light DOM, so the
// page's option CSS styles it) and toggles the host's
// `data-neo-trigger-rich` attribute; plain text falls back to the shadow
// label instead. The two components differ only in their view attribute.
export class TriggerFace {
	#view: HTMLElement | null = null;
	readonly #host: HTMLElement;
	readonly #label: HTMLElement;
	// Marker on the kit-managed clone container, e.g.
	// "data-neo-select-trigger-view".
	readonly #viewAttr: string;
	// Runs `fn` with the host's light-DOM MutationObserver paused.
	readonly #pause: (fn: () => void) => void;

	constructor(host: HTMLElement, label: HTMLElement, viewAttr: string, pause: (fn: () => void) => void) {
		this.#host = host;
		this.#label = label;
		this.#viewAttr = viewAttr;
		this.#pause = pause;
	}

	// Precedence: a `[data-neo-option-trigger]` child (a compact face distinct
	// from the list row), then the option's plain-text `label`, then the
	// option's own body. `value` seeds the fallback text; null uses the
	// placeholder.
	fromSource(sourceEl: HTMLElement | null, value: string | null): void {
		const sourceRoot = templateSourceRoot(sourceEl);
		const face = Array.from(sourceRoot?.children ?? []).find((el) => el.matches("[data-neo-option-trigger]")) ?? null;
		if (face) {
			this.clone(face.childNodes);
			return;
		}
		const label = sourceEl?.getAttribute?.("label");
		if (label) {
			this.text(label);
			return;
		}
		if (sourceRoot && sourceRoot.childElementCount > 0) {
			this.clone(sourceRoot.childNodes);
			return;
		}
		const text = sourceRoot?.textContent?.trim();
		this.text(text || (value === null ? this.#host.getAttribute("placeholder") || "Select…" : value));
	}

	// Deep-clone `nodes` into the trigger view.
	clone(nodes: NodeListOf<ChildNode>): void {
		this.set(Array.from(nodes).map((n) => n.cloneNode(true)));
	}

	// Mount ready-built `nodes` (e.g. multi-select chips) as the face.
	set(nodes: Node[]): void {
		this.#pause(() => {
			this.ensure().replaceChildren(...nodes);
			this.#label.textContent = "";
			this.rich(true);
		});
	}

	text(text: string): void {
		this.#pause(() => {
			this.#label.textContent = text;
			this.#view?.replaceChildren();
			this.rich(false);
		});
	}

	rich(on: boolean): void {
		this.#host.toggleAttribute("data-neo-trigger-rich", on);
	}

	// Lazy + reused clone container, slotted into the shadow trigger. A fat
	// morph detaches the view (no SSR counterpart), leaving this.view a stale
	// pointer to an orphaned node; reconcile against the live DOM and recreate
	// when it's gone so the trigger face survives the morph.
	ensure(): HTMLElement {
		let el = this.#view;
		if (!el || el.parentNode !== this.#host) {
			el = this.#host.querySelector<HTMLElement>(`:scope > [${this.#viewAttr}]`);
		}
		if (!el) {
			el = document.createElement("span");
			el.setAttribute(this.#viewAttr, "");
			el.setAttribute("slot", "trigger");
			this.#host.appendChild(el);
		}
		this.#view = el;
		return el;
	}
}

function templateSourceRoot(sourceEl: HTMLElement | null): HTMLElement | DocumentFragment | null {
	return sourceEl instanceof HTMLTemplateElement ? sourceEl.content : sourceEl;
}
