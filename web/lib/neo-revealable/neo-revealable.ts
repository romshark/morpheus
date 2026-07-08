// On hydration the children are wrapped in a [data-neo-revealable-content]
// div and a [data-neo-revealable-canvas] overlay sibling is appended.
// While concealed the content wrapper is inert plus aria-hidden so the
// secret never leaks to AT, and it re-conceals on patch so a morph can't
// flash it.

import { boolCommand } from "../command";

const CANVAS_ATTR = "data-neo-revealable-canvas";
const CONTENT_ATTR = "data-neo-revealable-content";

interface Particle {
	x: number;
	y: number;
	r: number;
	alpha: number;
	phase: number;
	speed: number;
}

function prefersReducedMotion(): boolean {
	return (
		window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
		document.documentElement.hasAttribute("data-pref-reduced-motion")
	);
}

export class NeoRevealable extends HTMLElement {
	static readonly observedAttributes = ["open", "rehide-after", "variant", "density", "blur-content"];

	#canvas: HTMLCanvasElement | null = null;
	#ctx: CanvasRenderingContext2D | null = null;
	#content: HTMLElement | null = null;
	#particles: Particle[] = [];
	#raf = 0;
	#rehideTimer: ReturnType<typeof setTimeout> | null = null;
	#resizeObserver: ResizeObserver | null = null;
	#mutationObserver: MutationObserver | null = null;
	// Set while the component edits its own light DOM, so the content
	// MutationObserver doesn't treat the canvas/wrapper it injects as an
	// external content patch.
	#internalMutation = false;
	// Gates for the rehide-after timer. Either being true pauses it
	// (clears any pending callback); the timer (re)starts only when both
	// fall false.
	#hovered = false;
	#focused = false;
	#width = 0;
	#height = 0;
	#ready = false;
	// Open intent; `open` reflects it (see command). Survives a morph that
	// strips the attribute so a fat morph omitting `open` can't re-conceal a
	// reveal the user just made.
	#openIntent = false;
	#reflectingOpen = false;

	connectedCallback() {
		if (!this.hasAttribute("variant")) {
			this.setAttribute("variant", this.#inferVariant());
		}
		if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
		this.setAttribute("role", "button");

		// Explicit open / open="false" commands intent; absent keeps it.
		const cmd = boolCommand(this, "open");
		if (cmd !== null) this.#openIntent = cmd;
		this.#sync();
		this.#reflectOpen();
		this.#syncAria();

		if (!this.#ready) {
			this.addEventListener("click", this.#onClick);
			this.addEventListener("keydown", this.#onKeyDown);
			this.addEventListener("mouseenter", this.#onMouseEnter);
			this.addEventListener("mouseleave", this.#onMouseLeave);
			this.addEventListener("focusin", this.#onFocusIn);
			this.addEventListener("focusout", this.#onFocusOut);
			this.#resizeObserver = new ResizeObserver(() => this.#resetParticles());
			this.#resizeObserver.observe(this);
			this.#mutationObserver = new MutationObserver((records) => this.#onMutations(records));
			this.#mutationObserver.observe(this, {
				childList: true,
				characterData: true,
				subtree: true,
			});
			this.#ready = true;
		}

		// Re-init engagement state in case we reconnected mid-interaction
		// (no enter/focusin events fire on reconnect).
		this.#hovered = this.matches(":hover");
		this.#focused = this.contains(document.activeElement);

		this.#resetParticles();
		if (!this.open) this.#startAnimation();
		else this.#maybeStartRehideTimer();
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("keydown", this.#onKeyDown);
		this.removeEventListener("mouseenter", this.#onMouseEnter);
		this.removeEventListener("mouseleave", this.#onMouseLeave);
		this.removeEventListener("focusin", this.#onFocusIn);
		this.removeEventListener("focusout", this.#onFocusOut);
		this.#stopAnimation();
		this.#clearRehideTimer();
		this.#resizeObserver?.disconnect();
		this.#mutationObserver?.disconnect();
		this.#resizeObserver = null;
		this.#mutationObserver = null;
		this.#content = null;
		this.#canvas = null;
		this.#ctx = null;
		this.#ready = false;
	}

	attributeChangedCallback(name: string) {
		if (!this.#ready) return;

		if (name === "open") {
			if (this.#reflectingOpen) return;
			const cmd = boolCommand(this, "open");
			// Absent: keep current state; re-assert the attribute for the CSS.
			if (cmd === null) {
				this.#reflectOpen();
				return;
			}
			this.#applyOpen(cmd);
			return;
		}
		this.#syncAria();
		if (name === "density" || name === "variant") {
			this.#resetParticles();
		}
	}

	get open(): boolean {
		return this.#openIntent;
	}

	set open(value: boolean) {
		this.#applyOpen(!!value);
	}

	// Single path for both programmatic and command-driven changes: update
	// intent, reflect, run the reveal/conceal side effects on a real change.
	#applyOpen(next: boolean): void {
		const changed = next !== this.#openIntent;
		this.#openIntent = next;
		this.#reflectOpen();
		this.#syncAria();
		if (!this.#ready || !changed) return;
		if (next) {
			this.#stopAnimation();
			this.#maybeStartRehideTimer();
		} else {
			this.#clearRehideTimer();
			this.#resetParticles();
			this.#startAnimation();
		}
		// Inline two-state disclosure fires one toggle event; `open` in the
		// detail carries the new state (per DESIGN Events).
		this.dispatchEvent(
			new CustomEvent("neo-revealable-toggle", {
				bubbles: true,
				composed: true,
				detail: { open: next },
			}),
		);
	}

	// State → attribute, guarded so it isn't read back as a command.
	#reflectOpen(): void {
		this.#reflectingOpen = true;
		try {
			if (this.#openIntent) {
				if (this.getAttribute("open") !== "") this.setAttribute("open", "");
			} else if (this.hasAttribute("open")) {
				this.removeAttribute("open");
			}
		} finally {
			this.#reflectingOpen = false;
		}
	}

	get #rehideAfter(): number {
		const n = Number(this.getAttribute("rehide-after"));
		return Number.isFinite(n) ? Math.max(0, n) : 0;
	}

	get #density(): number {
		const n = Number(this.getAttribute("density"));
		if (!Number.isFinite(n) || n === 0) return 1;
		return Math.max(0.3, Math.min(n, 3));
	}

	reveal(): void {
		this.open = true;
	}

	conceal(): void {
		this.open = false;
	}

	toggle(): void {
		this.open = !this.open;
	}

	#onClick = (e: MouseEvent) => {
		// Content is live once revealed; let clicks pass through (text
		// selection, links). The hover/focus gate keeps the timer paused.
		if (this.open) return;
		e.preventDefault();
		window.getSelection()?.removeAllRanges();
		this.reveal();
	};

	#onKeyDown = (e: KeyboardEvent) => {
		// Same as click: never re-conceal from a keystroke, just let it
		// through to whatever has focus inside the content.
		if (this.open) return;
		if (e.key !== "Enter" && e.key !== " ") return;
		e.preventDefault();
		window.getSelection()?.removeAllRanges();
		this.reveal();
	};

	// Hover and focus gate the rehide-after timer: either being live
	// pauses it, both gone restarts it. mouseenter/mouseleave fire on
	// the host (crossing into / out of its bounding box, ignoring
	// children); focusin/focusout bubble from descendants.
	#onMouseEnter = () => {
		this.#hovered = true;
		this.#clearRehideTimer();
	};

	#onMouseLeave = () => {
		this.#hovered = false;
		this.#maybeStartRehideTimer();
	};

	#onFocusIn = () => {
		this.#focused = true;
		this.#clearRehideTimer();
	};

	#onFocusOut = (e: FocusEvent) => {
		// relatedTarget is the next focus owner; focus moving to a
		// descendant (e.g. tabbing from host into a link inside content)
		// keeps focus "inside" us, so the timer must stay paused.
		const next = e.relatedTarget as Node | null;
		if (next && this.contains(next)) return;
		this.#focused = false;
		this.#maybeStartRehideTimer();
	};

	#maybeStartRehideTimer(): void {
		if (!this.open || this.#hovered || this.#focused) return;
		this.#startRehideTimer();
	}

	// Idempotent: wrap loose author children in [data-neo-revealable-
	// content] and keep exactly one [data-neo-revealable-canvas] overlay.
	// Safe to call after any morph that stripped/duplicated either.
	#sync(): void {
		this.#internalMutation = true;
		try {
			let content = this.querySelector<HTMLElement>(`:scope > [${CONTENT_ATTR}]`);
			if (!content) {
				content = document.createElement("div");
				content.setAttribute(CONTENT_ATTR, "");
				for (const node of Array.from(this.childNodes)) {
					if (node instanceof Element && (node.hasAttribute(CANVAS_ATTR) || node.hasAttribute(CONTENT_ATTR))) {
						continue;
					}
					content.appendChild(node);
				}
				this.insertBefore(content, this.firstChild);
			} else {
				// Fold any post-morph loose children back into the wrapper.
				for (const node of Array.from(this.childNodes)) {
					if (node === content) continue;
					if (node instanceof Element && (node.hasAttribute(CANVAS_ATTR) || node.hasAttribute(CONTENT_ATTR))) {
						continue;
					}
					content.appendChild(node);
				}
			}
			this.#content = content;

			const canvases = this.querySelectorAll<HTMLCanvasElement>(`:scope > [${CANVAS_ATTR}]`);
			for (let i = 1; i < canvases.length; i++) canvases[i].remove();
			let canvas = canvases[0] ?? null;
			if (!canvas) {
				canvas = document.createElement("canvas");
				canvas.setAttribute(CANVAS_ATTR, "");
				canvas.setAttribute("aria-hidden", "true");
				this.appendChild(canvas);
			} else if (canvas !== this.lastElementChild) {
				this.appendChild(canvas);
			}
			this.#canvas = canvas;
			this.#ctx = canvas.getContext("2d", { alpha: true });
		} finally {
			this.#internalMutation = false;
			this.#mutationObserver?.takeRecords();
		}
	}

	#onMutations(records: MutationRecord[]): void {
		if (this.#internalMutation) return;
		const external = records.some((m) => {
			const t = m.target as Node;
			if (t === this.#canvas || this.#canvas?.contains(t)) return false;
			for (const n of m.addedNodes) {
				if (n instanceof Element && n.hasAttribute(CANVAS_ATTR)) return false;
			}
			return true;
		});
		if (!external) return;
		// Content was patched (e.g. a server morph swapped the secret):
		// re-hide so it can't flash, then rebuild the veil.
		this.#sync();
		this.#syncAria();
		if (this.open) {
			this.conceal();
		} else {
			this.#resetParticles();
			this.#startAnimation();
		}
	}

	#syncAria(): void {
		this.setAttribute("aria-expanded", String(this.open));
		if (!this.hasAttribute("aria-label") && !this.hasAttribute("aria-labelledby")) {
			this.setAttribute("aria-label", "Spoiler, hidden content");
		}
		if (!this.#content) return;
		// Keep the secret out of the a11y tree (and focus order) until
		// revealed. A transparent colour alone still reads aloud.
		if (this.open) {
			this.#content.removeAttribute("inert");
			this.#content.removeAttribute("aria-hidden");
		} else {
			this.#content.setAttribute("inert", "");
			this.#content.setAttribute("aria-hidden", "true");
		}
	}

	#inferVariant(): "inline" | "media" {
		return this.getBoundingClientRect().height > 80 ? "media" : "inline";
	}

	#startRehideTimer(): void {
		this.#clearRehideTimer();
		const delay = this.#rehideAfter;
		if (delay <= 0) return;
		this.#rehideTimer = setTimeout(() => this.conceal(), delay);
	}

	#clearRehideTimer(): void {
		if (this.#rehideTimer === null) return;
		clearTimeout(this.#rehideTimer);
		this.#rehideTimer = null;
	}

	#startAnimation(): void {
		if (this.open || this.#raf) return;
		if (prefersReducedMotion()) {
			this.#draw(0);
			return;
		}
		const tick = (t: number) => {
			this.#draw(t);
			this.#raf = requestAnimationFrame(tick);
		};
		this.#raf = requestAnimationFrame(tick);
	}

	#stopAnimation(): void {
		if (!this.#raf) return;
		cancelAnimationFrame(this.#raf);
		this.#raf = 0;
	}

	#resetParticles(): void {
		if (!this.#canvas || !this.#ctx) return;
		const rect = this.getBoundingClientRect();
		if (!rect.width || !rect.height) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.#width = rect.width;
		this.#height = rect.height;
		// Pin the CSS box to the exact px and the bitmap to that × dpr.
		// The canvas is a replaced element stretched by width/height:100%;
		// without an explicit style size the browser resamples a rounded
		// bitmap onto a fractional box, smearing the bottom/right edge
		// into stray lines (visible because inline grain is near-black).
		this.#canvas.style.width = `${rect.width}px`;
		this.#canvas.style.height = `${rect.height}px`;
		this.#canvas.width = Math.round(rect.width * dpr);
		this.#canvas.height = Math.round(rect.height * dpr);
		this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const media = this.#variant() === "media";
		const area = rect.width * rect.height;
		const maxCount = media ? 3500 : 420;
		// Clamp the area-derived baseline to the ceiling *before* applying
		// density, then density scales it within [24, maxCount]. Applying
		// density and clamping afterwards pinned inline at the cap for
		// every density (area * 0.22 ≫ 420 for any real text run), so the
		// parameter had no visible effect.
		const base = Math.min(area * (media ? 0.007 : 0.05), maxCount);
		const count = Math.max(24, Math.min(Math.round(base * this.#density), maxCount));

		const particles: Particle[] = [];
		for (let i = 0; i < count; i++) {
			particles.push({
				x: Math.random() * rect.width,
				y: Math.random() * rect.height,
				r: media ? 0.45 + Math.random() * 0.8 : 0.55 + Math.random() * 0.6,
				alpha: (media ? 0.35 : 0.45) + Math.random() * 0.5,
				phase: Math.random() * Math.PI * 2,
				speed: 0.001 + Math.random() * 0.003,
			});
		}
		this.#particles = particles;
		this.#draw(0);
	}

	#variant(): string {
		return this.getAttribute("variant") || "inline";
	}

	#draw(time: number): void {
		const ctx = this.#ctx;
		if (!ctx || this.open) return;
		const w = this.#width;
		const h = this.#height;
		ctx.clearRect(0, 0, w, h);

		// Grain only. The veil is a CSS ::after rendered identically
		// before and after upgrade, so the canvas just layers animated
		// particles on top of it (no hydration flash).
		const cs = getComputedStyle(this);
		const color = cs.getPropertyValue("--neo-revealable-particle-color").trim() || "currentColor";
		ctx.fillStyle = color === "currentColor" ? cs.color : color;

		for (const p of this.#particles) {
			const dx = Math.sin(time * p.speed + p.phase) * 2.8;
			const dy = Math.cos(time * p.speed * 0.8 + p.phase) * 2.8;
			const flicker = 0.55 + Math.sin(time * p.speed * 6 + p.phase) * 0.45;
			ctx.globalAlpha = Math.max(0.05, p.alpha * flicker);
			ctx.beginPath();
			ctx.arc(p.x + dx, p.y + dy, p.r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}
}

if (!customElements.get("neo-revealable")) {
	customElements.define("neo-revealable", NeoRevealable);
}
