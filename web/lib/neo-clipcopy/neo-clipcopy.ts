async function writeClipboardText(text: string): Promise<void> {
	if (navigator.clipboard && window.isSecureContext) {
		await navigator.clipboard.writeText(text);
		return;
	}
	// Fallback for insecure contexts (http://, file://): execCommand is
	// deprecated but still the only option without a secure context.
	const ta = document.createElement("textarea");
	ta.value = text;
	ta.setAttribute("readonly", "");
	ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
	document.body.appendChild(ta);
	ta.select();
	try {
		if (!document.execCommand("copy")) throw new Error("copy command failed");
	} finally {
		document.body.removeChild(ta);
	}
}

const DEFAULT_COPIED_DURATION_MS = 1500;

export class NeoClipcopy extends HTMLElement {
	#copiedTimer: number | null = null;

	connectedCallback() {
		// Listen on the host, not the trigger child: trigger clicks bubble
		// through the host (a stable ancestor), so a morph that swaps the
		// child can't strand the listener on a detached node. The trigger
		// is resolved live per click, never cached.
		this.addEventListener("click", this.#onClick);
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.#clearCopiedTimer();
	}

	#onClick = async (e: MouseEvent) => {
		if (e.defaultPrevented) return;
		// First element child is the trigger; ignore clicks outside it.
		const trigger = this.firstElementChild;
		if (!trigger?.contains(e.target as Node)) return;
		const value = this.#resolveValue();
		if (value === null) return;
		try {
			await writeClipboardText(value);
			this.#flashCopied();
			this.dispatchEvent(
				new CustomEvent("neo-clipcopy-copy", {
					bubbles: true,
					detail: { value },
				}),
			);
		} catch (error) {
			this.dispatchEvent(
				new CustomEvent("neo-clipcopy-error", {
					bubbles: true,
					detail: { error },
				}),
			);
		}
	};

	#resolveValue(): string | null {
		const explicit = this.getAttribute("value");
		if (explicit !== null) return explicit;
		const forId = this.getAttribute("for");
		if (forId) {
			const target = document.getElementById(forId);
			if (target) return (target.textContent ?? "").trim();
		}
		return null;
	}

	#flashCopied() {
		this.#clearCopiedTimer();
		this.setAttribute("copied", "");
		const duration = this.#readDurationAttr();
		if (duration <= 0) return;
		this.#copiedTimer = window.setTimeout(() => {
			this.#copiedTimer = null;
			this.removeAttribute("copied");
		}, duration);
	}

	#readDurationAttr(): number {
		const raw = this.getAttribute("copied-duration");
		if (raw === null) return DEFAULT_COPIED_DURATION_MS;
		const n = parseInt(raw, 10);
		return Number.isFinite(n) && n >= 0 ? n : DEFAULT_COPIED_DURATION_MS;
	}

	#clearCopiedTimer() {
		if (this.#copiedTimer !== null) {
			window.clearTimeout(this.#copiedTimer);
			this.#copiedTimer = null;
		}
	}
}

if (!customElements.get("neo-clipcopy")) {
	customElements.define("neo-clipcopy", NeoClipcopy);
}
