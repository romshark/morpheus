// Behavior-only, no UI: while connected it installs one key listener on a
// target element (its parent by default) and dispatches a bubbling
// CustomEvent on a matched chord. Framework-agnostic by contract: config in
// via attributes, activation out via the event, with no framework here.

import { boolAttr } from "../command";
import { type Alternative, type Chord, IS_APPLE, parseKeys } from "../platform";

const EVENT_NAME = "neo-keys";
const DEFAULT_SEQUENCE_TIMEOUT = 1000;

// Input types that are not text entry, so bare-key shortcuts stay live
// when focus is on them.
const NON_TEXT_INPUTS = new Set(["button", "checkbox", "radio", "range", "color", "file", "submit", "reset", "image"]);

function chordMatches(c: Chord, e: KeyboardEvent): boolean {
	const wantMeta = c.meta || (c.mod && IS_APPLE);
	const wantCtrl = c.ctrl || (c.mod && !IS_APPLE);
	if (e.metaKey !== wantMeta) return false;
	if (e.ctrlKey !== wantCtrl) return false;
	if (e.altKey !== c.alt) return false;
	// Shift is enforced only when declared, so `?` matches regardless of
	// the layout's shift state while `shift+?` requires it.
	if (c.shift && !e.shiftKey) return false;
	return e.key.toLowerCase() === c.key;
}

// A chord with no non-shift modifier is suppressed in text-entry
// contexts unless `in-input` is set.
function isBareChord(c: Chord): boolean {
	return !c.mod && !c.ctrl && !c.meta && !c.alt;
}

function isEditableTarget(e: KeyboardEvent): boolean {
	const node = (e.composedPath?.()[0] ?? e.target) as Element | null;
	if (!(node instanceof HTMLElement)) return false;
	if (node.isContentEditable) return true;
	switch (node.tagName) {
		case "TEXTAREA":
		case "SELECT":
			return true;
		case "INPUT":
			return !NON_TEXT_INPUTS.has((node as HTMLInputElement).type);
		default:
			return false;
	}
}

export class NeoKeys extends HTMLElement {
	static observedAttributes = ["keys", "target", "up"];

	#bindings: Alternative[] = [];
	// Per-alternative position in its sequence; 0 = idle.
	#progress: number[] = [];
	#lastTime = 0;
	#listenTarget: EventTarget | null = null;
	#listenType: "keydown" | "keyup" = "keydown";

	connectedCallback() {
		this.#parse();
		this.#bind();
	}

	disconnectedCallback() {
		this.#unbind();
	}

	attributeChangedCallback(name: string) {
		// Upgrade calls this before connectedCallback; let connect do the
		// first parse/bind, then react to live changes only.
		if (!this.isConnected) return;
		if (name === "keys") this.#parse();
		else this.#bind();
	}

	#parse() {
		this.#bindings = parseKeys(this.getAttribute("keys") ?? "");
		this.#progress = this.#bindings.map(() => 0);
		this.#lastTime = 0;
	}

	// parent (default) | window | document | CSS selector.
	#resolveTarget(): EventTarget | null {
		const raw = (this.getAttribute("target") ?? "parent").trim();
		if (raw === "" || raw === "parent") return this.parentElement;
		if (raw === "window") return window;
		if (raw === "document") return document;
		const found = document.querySelector(raw);
		if (!found) {
			console.warn(`<neo-keys> target="${raw}" matched no element.`);
			return null;
		}
		return found;
	}

	#bind() {
		this.#unbind();
		const target = this.#resolveTarget();
		if (!target) return;
		this.#listenTarget = target;
		this.#listenType = boolAttr(this, "up", false) ? "keyup" : "keydown";
		target.addEventListener(this.#listenType, this.#onKey as EventListener);
	}

	#unbind() {
		if (!this.#listenTarget) return;
		this.#listenTarget.removeEventListener(this.#listenType, this.#onKey as EventListener);
		this.#listenTarget = null;
	}

	#sequenceTimeout(): number {
		const n = Number(this.getAttribute("sequence-timeout"));
		return Number.isFinite(n) && n > 0 ? n : DEFAULT_SEQUENCE_TIMEOUT;
	}

	#onKey = (e: KeyboardEvent) => {
		if (boolAttr(this, "disabled", false)) return;
		if (e.repeat && !boolAttr(this, "repeat", false)) return;
		if (this.#bindings.length === 0) return;

		// Drop stale sequence progress once the inter-key gap elapses.
		if (this.#lastTime && e.timeStamp - this.#lastTime > this.#sequenceTimeout()) {
			this.#progress.fill(0);
		}
		this.#lastTime = e.timeStamp;

		const editable = isEditableTarget(e);
		const allowInInput = boolAttr(this, "in-input", false);
		const hit = (c: Chord): boolean => {
			if (editable && !allowInInput && isBareChord(c)) return false;
			return chordMatches(c, e);
		};

		let fired: Alternative | null = null;
		for (let i = 0; i < this.#bindings.length; i++) {
			const alt = this.#bindings[i];
			const idx = this.#progress[i];
			if (hit(alt.steps[idx])) {
				const next = idx + 1;
				if (next >= alt.steps.length) {
					this.#progress[i] = 0;
					fired = alt;
				} else {
					this.#progress[i] = next;
				}
			} else {
				// Mismatch mid-sequence: allow this key to restart the chain.
				this.#progress[i] = idx > 0 && hit(alt.steps[0]) ? 1 : 0;
			}
		}

		if (!fired) return;
		// A completed match clears every alternative's partial state.
		this.#progress.fill(0);
		if (boolAttr(this, "prevent", true)) e.preventDefault();
		if (boolAttr(this, "stop", false)) e.stopPropagation();
		this.#dispatch(fired, e);
	};

	#dispatch(alt: Alternative, e: KeyboardEvent) {
		const forID = this.getAttribute("for");
		if (forID) {
			const target = document.getElementById(forID);
			if (target instanceof HTMLElement) {
				target.click();
			} else {
				console.warn(`<neo-keys> for="${forID}" matched no HTMLElement.`);
			}
		}
		this.dispatchEvent(
			new CustomEvent(EVENT_NAME, {
				bubbles: true,
				composed: true,
				detail: {
					combo: alt.raw,
					key: e.key,
					sequence: alt.raw.split(",").map((s) => s.trim()),
					originalEvent: e,
				},
			}),
		);
	}
}

if (!customElements.get("neo-keys")) {
	customElements.define("neo-keys", NeoKeys);
}
