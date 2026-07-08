import { num } from "../num";

type Handle = "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

const ALL_HANDLES: readonly Handle[] = [
	"top",
	"bottom",
	"left",
	"right",
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right",
] as const;

const DEFAULT_ICON: Record<Handle, string> = {
	top: "grip-horizontal",
	bottom: "grip-horizontal",
	left: "grip-vertical",
	right: "grip-vertical",
	"top-left": "move-diagonal-2",
	"bottom-right": "move-diagonal-2",
	"top-right": "move-diagonal",
	"bottom-left": "move-diagonal",
};

const CURSOR_BY_HANDLE: Record<Handle, string> = {
	top: "ns-resize",
	bottom: "ns-resize",
	left: "ew-resize",
	right: "ew-resize",
	"top-left": "nwse-resize",
	"bottom-right": "nwse-resize",
	"top-right": "nesw-resize",
	"bottom-left": "nesw-resize",
};

interface ActiveDrag {
	handle: Handle;
	pointerId: number;
	startX: number;
	startY: number;
	startW: number;
	startH: number;
}

export class NeoResizable extends HTMLElement {
	static readonly observedAttributes = [
		"handles",
		"min-width",
		"max-width",
		"min-height",
		"max-height",
		"width",
		"height",
	];

	#handleEls = new Map<Handle, HTMLElement>();
	#wired = new WeakSet<HTMLElement>();
	#childObserver: MutationObserver | null = null;
	#active: ActiveDrag | null = null;
	// Tracks the previous pointerdown for synthetic double-tap detection.
	// `dblclick` is mouse-only, so touch users never get the kit's
	// built-in handle reset without this.
	#lastTap: {
		time: number;
		handle: Handle | null;
		x: number;
		y: number;
	} = { time: 0, handle: null, x: 0, y: 0 };
	#ready = false;

	connectedCallback() {
		this.#ready = true;
		this.#syncAll();
		// Re-reconcile handles when a morph strips/replaces the injected
		// handle spans while the host stays connected (no disconnect/
		// connect fires). Handles are re-resolved from the DOM, never
		// trusted from the cached map. childList only (not subtree) so
		// slotted-content morphs don't thrash this.
		this.#childObserver = new MutationObserver(() => {
			if (this.#ready) this.#syncHandles();
		});
		this.#childObserver.observe(this, { childList: true });
	}

	disconnectedCallback() {
		this.#ready = false;
		this.#endDrag();
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		for (const el of this.#handleEls.values()) el.remove();
		this.#handleEls.clear();
	}

	attributeChangedCallback(name: string) {
		if (!this.#ready) return;
		if (name === "handles") {
			this.#syncHandles();
			return;
		}
		this.#applyAttr(name);
	}

	#syncAll() {
		for (const attr of NeoResizable.observedAttributes) {
			if (attr === "handles") continue;
			if (this.hasAttribute(attr)) this.#applyAttr(attr);
		}
		this.#syncHandles();
	}

	// Mirror one size attr to its inline-style counterpart. Per-attr
	// rather than full sync because a drag mutates `style.width/height`
	// directly, and a later `min-width` change mustn't clobber it.
	#applyAttr(name: string) {
		const map: Record<string, string> = {
			"min-width": "minWidth",
			"max-width": "maxWidth",
			"min-height": "minHeight",
			"max-height": "maxHeight",
			width: "width",
			height: "height",
		};
		const prop = map[name];
		if (!prop) return;
		const v = this.getAttribute(name);
		(this.style as unknown as Record<string, string>)[prop] = v ?? "";
		if (name === "width") this.#setSizeVar("width", v);
		if (name === "height") this.#setSizeVar("height", v);
	}

	#setSizeVar(axis: "width" | "height", value: string | null) {
		const prop = `--neo-resizable-${axis}`;
		if (value) this.style.setProperty(prop, value);
		else this.style.removeProperty(prop);
	}

	#parseHandles(): Set<Handle> {
		const raw = this.getAttribute("handles") ?? "";
		const out = new Set<Handle>();
		for (const tok of raw.split(/\s+/)) {
			if ((ALL_HANDLES as readonly string[]).includes(tok)) {
				out.add(tok as Handle);
			}
		}
		return out;
	}

	#syncHandles() {
		const desired = this.#parseHandles();

		// Reconcile against the live DOM, not the cached map: a morph can
		// strip or replace handle spans while the host stays connected.
		// Adopt the DOM's handles (prerendered or morph-preserved, so the
		// inlined icon survives), drop undesired/duplicate ones, then
		// create whatever's still missing. wireHandle self-guards against
		// double-binding, so re-entrant observer calls converge.
		const seen = new Map<Handle, HTMLElement>();
		for (const el of this.querySelectorAll<HTMLElement>(":scope > [data-neo-resizable-handle]")) {
			const dir = el.getAttribute("data-neo-resizable-handle") as Handle | null;
			const valid = dir !== null && (ALL_HANDLES as readonly string[]).includes(dir);
			if (!valid || !desired.has(dir as Handle) || seen.has(dir as Handle)) {
				el.remove();
				continue;
			}
			this.#wireHandle(el);
			seen.set(dir as Handle, el);
		}

		for (const dir of desired) {
			if (seen.has(dir)) continue;
			seen.set(dir, this.#createHandle(dir));
		}

		this.#handleEls = seen;
	}

	#createHandle(dir: Handle): HTMLElement {
		const wrap = document.createElement("span");
		wrap.setAttribute("data-neo-resizable-handle", dir);
		const userIcon = this.querySelector<HTMLElement>(`:scope > [data-neo-resizable-icon="${dir}"]`);
		if (userIcon) {
			wrap.appendChild(userIcon);
		} else {
			const icon = document.createElement("neo-icon");
			icon.setAttribute("name", DEFAULT_ICON[dir]);
			icon.setAttribute("aria-hidden", "true");
			wrap.appendChild(icon);
		}
		this.#wireHandle(wrap);
		this.appendChild(wrap);
		return wrap;
	}

	// Idempotent: a handle element is wired at most once even if
	// syncHandles re-adopts it across morph-driven observer passes.
	#wireHandle(wrap: HTMLElement) {
		if (this.#wired.has(wrap)) return;
		this.#wired.add(wrap);
		wrap.addEventListener("pointerdown", this.#onHandlePointerDown);
		wrap.addEventListener("dblclick", this.#onHandleDblClick);
	}

	#handleFromEvent(e: Event): Handle | null {
		const el = e.currentTarget;
		if (!(el instanceof HTMLElement)) return null;
		// A morph can preserve a handle node while changing its direction.
		// Resolve the live attribute at gesture time instead of closing over it.
		const dir = el.getAttribute("data-neo-resizable-handle");
		if (!(ALL_HANDLES as readonly string[]).includes(dir ?? "")) return null;
		return dir as Handle;
	}

	#onHandleDblClick = (e: MouseEvent) => {
		const dir = this.#handleFromEvent(e);
		if (!dir) return;
		if (this.#active) return;
		e.preventDefault();
		e.stopPropagation();
		const isCorner = dir.includes("-");
		const resetW = isCorner || dir === "left" || dir === "right";
		const resetH = isCorner || dir === "top" || dir === "bottom";
		if (resetW) {
			this.style.width = "";
			this.#setSizeVar("width", null);
		}
		if (resetH) {
			this.style.height = "";
			this.#setSizeVar("height", null);
		}
	};

	#onHandlePointerDown = (e: PointerEvent) => {
		const dir = this.#handleFromEvent(e);
		if (!dir) return;
		if (e.button !== 0) return;
		// Synthetic double-tap -> handle reset, since touch devices never
		// fire `dblclick`. Two pointerdowns on the same handle within
		// 350ms and ~24px count as a tap-tap.
		const now = performance.now();
		const dx = e.clientX - this.#lastTap.x;
		const dy = e.clientY - this.#lastTap.y;
		if (this.#lastTap.handle === dir && now - this.#lastTap.time < 350 && Math.hypot(dx, dy) < 24) {
			this.#lastTap = { time: 0, handle: null, x: 0, y: 0 };
			this.#onHandleDblClick(e);
			return;
		}
		this.#lastTap = { time: now, handle: dir, x: e.clientX, y: e.clientY };
		e.preventDefault();
		const r = this.getBoundingClientRect();
		this.#active = {
			handle: dir,
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			startW: r.width,
			startH: r.height,
		};
		// Pin pixel values so the first move resolves cleanly even when the
		// host was previously sized by the surrounding layout. Pin only the
		// axis this handle controls; pinning the other axis freezes
		// content-driven growth (a width drag would lock the height, so a
		// taller layout can no longer stretch the host). Mirrors onPointerMove.
		const setW = dir !== "top" && dir !== "bottom";
		const setH = dir !== "left" && dir !== "right";
		if (setW) {
			this.style.width = `${r.width}px`;
			this.#setSizeVar("width", `${r.width}px`);
		}
		if (setH) {
			this.style.height = `${r.height}px`;
			this.#setSizeVar("height", `${r.height}px`);
		}
		this.setAttribute("resizing", "");
		this.setAttribute("data-neo-resizable-active-handle", dir);
		document.documentElement.setAttribute("data-neo-resizable-cursor", CURSOR_BY_HANDLE[dir]);
		(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		document.addEventListener("pointermove", this.#onPointerMove);
		document.addEventListener("pointerup", this.#onPointerUp);
		document.addEventListener("pointercancel", this.#onPointerUp);
		this.dispatchEvent(new CustomEvent("neo-resizable-start", { bubbles: true }));
	};

	#onPointerMove = (e: PointerEvent) => {
		if (!this.#active || e.pointerId !== this.#active.pointerId) return;
		const dx = e.clientX - this.#active.startX;
		const dy = e.clientY - this.#active.startY;
		const h = this.#active.handle;
		let w = this.#active.startW;
		let ht = this.#active.startH;
		if (h.includes("right")) w = this.#active.startW + dx;
		if (h.includes("left")) w = this.#active.startW - dx;
		if (h.includes("bottom")) ht = this.#active.startH + dy;
		if (h.includes("top")) ht = this.#active.startH - dy;

		// Only set the axis this handle controls; otherwise an edge drag
		// would lock the other axis and freeze content-driven growth.
		const setW = h !== "top" && h !== "bottom";
		const setH = h !== "left" && h !== "right";
		if (setW) {
			const next = `${this.#snapToStep(Math.max(0, w), "step-horizontal")}px`;
			this.style.width = next;
		}
		if (setH) {
			const next = `${this.#snapToStep(Math.max(0, ht), "step-vertical")}px`;
			this.style.height = next;
		}

		const r = this.getBoundingClientRect();
		// CSS min/max constraints can clamp the host away from the raw
		// pointer-derived style width/height. Publish the used size so
		// children driven by --neo-resizable-* stay aligned with the
		// actual handle edge.
		if (setW) this.#setSizeVar("width", `${r.width}px`);
		if (setH) this.#setSizeVar("height", `${r.height}px`);
		this.dispatchEvent(
			new CustomEvent("neo-resizable-resize", {
				bubbles: true,
				detail: { width: r.width, height: r.height },
			}),
		);
	};

	// Snap a pixel size to the axis step grid (origin 0, so the size lands
	// on a multiple of the step). A missing or non-positive step disables
	// snapping. CSS min/max still clamp the snapped value afterward.
	#snapToStep(px: number, attr: "step-horizontal" | "step-vertical"): number {
		const step = num(this.getAttribute(attr), 0);
		if (step <= 0) return px;
		return Math.round(px / step) * step;
	}

	#onPointerUp = (e: PointerEvent) => {
		if (!this.#active || e.pointerId !== this.#active.pointerId) return;
		this.#endDrag();
	};

	#endDrag() {
		if (!this.#active) return;
		this.#active = null;
		this.removeAttribute("resizing");
		this.removeAttribute("data-neo-resizable-active-handle");
		document.documentElement.removeAttribute("data-neo-resizable-cursor");
		document.removeEventListener("pointermove", this.#onPointerMove);
		document.removeEventListener("pointerup", this.#onPointerUp);
		document.removeEventListener("pointercancel", this.#onPointerUp);
		this.dispatchEvent(new CustomEvent("neo-resizable-end", { bubbles: true }));
	}
}

if (!customElements.get("neo-resizable")) {
	customElements.define("neo-resizable", NeoResizable);
}
