import { boolAttr } from "../command";

const STORAGE_LOG_PREFIX = "<neo-persist>";

function splitTokens(raw: string | null): string[] {
	if (!raw) return [];
	return raw.split(/\s+/).filter((t) => t.length > 0);
}

function pickStorage(useSession: boolean): Storage | null {
	try {
		return useSession ? window.sessionStorage : window.localStorage;
	} catch {
		return null;
	}
}

// Read/write an object property by dot path: "scrollTop", "style.cssText",
// "dataset.foo". Single-segment paths reduce to plain `obj[prop]`.
function readProp(obj: unknown, path: string): unknown {
	return path.split(".").reduce<unknown>((cur, p) => (cur == null ? cur : (cur as Record<string, unknown>)[p]), obj);
}

function writeProp(obj: unknown, path: string, value: unknown): void {
	const parts = path.split(".");
	const last = parts.pop() as string;
	const host = parts.reduce<unknown>((cur, p) => (cur == null ? cur : (cur as Record<string, unknown>)[p]), obj);
	if (host != null) (host as Record<string, unknown>)[last] = value;
}

export class NeoPersist extends HTMLElement {
	#target: HTMLElement | null = null;
	#listenerEvents: string[] = [];
	#rafHandle: number | null = null;
	#childObserver: MutationObserver | null = null;

	connectedCallback() {
		this.#bind(true);
		// A morph can swap the child target while the host stays connected
		// (no disconnect/connect fires). Re-resolve the target from the DOM
		// and move the listeners instead of stranding them on a detached
		// node. Warnings stay quiet here so morph transients don't spam.
		this.#childObserver = new MutationObserver(() => this.#bind(false));
		this.#childObserver.observe(this, { childList: true });
	}

	// Resolve the target from the live DOM and (re)bind listeners. A
	// no-op when the resolved target is unchanged.
	#bind(warn: boolean) {
		const target = this.#resolveTarget(warn);
		if (target === this.#target) return;
		this.#unbind();
		if (!target) return;
		this.#target = target;
		this.#restore();
		this.#listenerEvents = splitTokens(this.getAttribute("on"));
		for (const ev of this.#listenerEvents) {
			target.addEventListener(ev, this.#onEvent, { passive: true });
		}
	}

	#unbind() {
		if (this.#target) {
			for (const ev of this.#listenerEvents) {
				this.#target.removeEventListener(ev, this.#onEvent);
			}
		}
		this.#target = null;
		this.#listenerEvents = [];
	}

	#resolveTarget(warn: boolean): HTMLElement | null {
		const forId = this.getAttribute("for");
		if (forId) {
			const found = document.getElementById(forId);
			if (!found) {
				if (warn) {
					console.warn(`${STORAGE_LOG_PREFIX} for="${forId}" found no element.`);
				}
				return null;
			}
			return found;
		}
		const children = this.children;
		if (children.length === 0) {
			if (warn) {
				console.warn(`${STORAGE_LOG_PREFIX} needs a child element or a for="<id>".`);
			}
			return null;
		}
		if (children.length > 1 && warn) {
			console.warn(`${STORAGE_LOG_PREFIX} expects exactly one child; extra children will be ignored.`);
		}
		return children[0] as HTMLElement;
	}

	disconnectedCallback() {
		this.#unbind();
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		if (this.#rafHandle !== null) {
			window.cancelAnimationFrame(this.#rafHandle);
			this.#rafHandle = null;
		}
	}

	#storage(): Storage | null {
		return pickStorage(boolAttr(this, "session", false));
	}

	#storageKey(): string | null {
		const key = this.getAttribute("key");
		return key && key.length > 0 ? key : null;
	}

	#propNames(): string[] {
		return splitTokens(this.getAttribute("props"));
	}

	#restore() {
		const target = this.#target;
		if (!target) return;
		const key = this.#storageKey();
		if (!key) return;
		const storage = this.#storage();
		if (!storage) return;
		const props = this.#propNames();
		if (props.length === 0) return;

		const raw = storage.getItem(key);
		if (raw === null) return;

		let parsed: Record<string, unknown>;
		try {
			const value = JSON.parse(raw);
			if (!value || typeof value !== "object") return;
			parsed = value as Record<string, unknown>;
		} catch {
			return;
		}

		// rAF: scrollTop is a no-op before post-layout scrollHeight.
		requestAnimationFrame(() => {
			const t = this.#target;
			if (!t) return;
			for (const prop of props) {
				if (Object.hasOwn(parsed, prop)) {
					try {
						writeProp(t, prop, parsed[prop]);
					} catch {
						/* read-only or type mismatch */
					}
				}
			}
		});
	}

	#onEvent = () => {
		if (this.#rafHandle !== null) return;
		this.#rafHandle = window.requestAnimationFrame(() => {
			this.#rafHandle = null;
			this.#snapshot();
		});
	};

	#snapshot() {
		const target = this.#target;
		if (!target) return;
		const key = this.#storageKey();
		if (!key) return;
		const storage = this.#storage();
		if (!storage) return;
		const props = this.#propNames();
		if (props.length === 0) return;

		const payload: Record<string, unknown> = {};
		for (const prop of props) {
			payload[prop] = readProp(target, prop);
		}
		try {
			storage.setItem(key, JSON.stringify(payload));
		} catch {
			/* quota exceeded or storage disabled */
		}
	}
}

if (!customElements.get("neo-persist")) {
	customElements.define("neo-persist", NeoPersist);
}
