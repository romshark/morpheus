import { observeManagedAttrs } from "../neo-morph-resilient";
import { clampInt } from "../num";
import { assignChildren, attachSlotRoot } from "../slot-root";

// Avatar children stay in light DOM so server patches can replace the row.
// The host hides an avatar by leaving it out of its slot, which writes
// nothing a morph could strip.

const ATTR_COLLAPSE_AT = "collapse-at";
const ATTR_OVERFLOW_COUNT = "overflow-count";
const OVERFLOW_ATTR = "data-neo-avatars-overflow";
const OVERFLOW_TEMPLATE_SELECTOR = "template[data-neo-avatars-overflow]";
const OVERFLOW_COUNT_SELECTOR = "[data-neo-avatars-overflow-count]";
const OVERFLOW_LABEL_ATTR = "data-neo-avatars-overflow-label";

export class NeoAvatars extends HTMLElement {
	static readonly observedAttributes = [ATTR_COLLAPSE_AT, ATTR_OVERFLOW_COUNT];

	#slot: HTMLSlotElement;
	#hidden = new Set<Node>();
	#resizeObserver: ResizeObserver | null = null;
	#mutationObserver: MutationObserver | null = null;
	#labelObserver: MutationObserver | null = null;
	#items: HTMLElement[] = [];
	#overflow: HTMLElement | null = null;
	#overflowTemplate: HTMLTemplateElement | null = null;
	#overflowIsCustom = false;
	#adapting = false;
	#adaptFrame = 0;
	#lastPartition: string | null = null;

	constructor() {
		super();
		this.#slot = attachSlotRoot(this);
	}

	connectedCallback() {
		this.#syncLabel();
		this.#labelObserver = observeManagedAttrs(this, ["aria-label"], this.#syncLabel);
		this.#captureChildren();
		this.#adapt();

		this.#resizeObserver = new ResizeObserver(() => this.#scheduleAdapt());
		// Also observe the host, because the parent's border-box can stay constant
		// while the host's flex track reflows (sibling reflow, container query).
		// No feedback loop, because flex-grow sizes the track, not content.
		this.#resizeObserver.observe(this);
		// A content-sized host doesn't grow when free space does, which means
		// its own RO entry won't fire on a widen. Also observe a real ancestor.
		const ancestor = this.#layoutAncestor();
		if (ancestor) this.#resizeObserver.observe(ancestor);

		// #adapt drops the records of its own writes, which leaves only outside
		// changes here. A morph removing the generated "+N" chip is one of them.
		this.#mutationObserver = new MutationObserver(() => {
			this.#captureChildren();
			// New children render at once, before the next paint; the adapt in the
			// next frame then hides the ones that don't fit.
			assignChildren(this, this.#slot, this.#hidden);
			this.#scheduleAdapt();
		});
		this.#mutationObserver.observe(this, { childList: true });
	}

	disconnectedCallback() {
		if (this.#adaptFrame) {
			cancelAnimationFrame(this.#adaptFrame);
			this.#adaptFrame = 0;
		}
		this.#resizeObserver?.disconnect();
		this.#resizeObserver = null;
		this.#mutationObserver?.disconnect();
		this.#mutationObserver = null;
		this.#labelObserver?.disconnect();
		this.#labelObserver = null;
	}

	#syncLabel = () => {
		if (!this.hasAttribute("aria-label")) this.setAttribute("aria-label", "Avatars");
	};

	attributeChangedCallback() {
		if (!this.isConnected) return;
		this.#scheduleAdapt();
	}

	// Nearest ancestor with a principal box. display:contents elements
	// produce no box and never fire ResizeObserver. Skip them.
	#layoutAncestor(): HTMLElement | null {
		let el = this.parentElement;
		while (el && getComputedStyle(el).display === "contents") {
			el = el.parentElement;
		}
		return el;
	}

	get #collapseAt(): number {
		return clampInt(this.getAttribute(ATTR_COLLAPSE_AT), 0, Number.MAX_SAFE_INTEGER, 0);
	}

	get #overflowCount(): number {
		return clampInt(this.getAttribute(ATTR_OVERFLOW_COUNT), 0, Number.MAX_SAFE_INTEGER, 0);
	}

	#captureChildren() {
		this.#overflowTemplate = this.querySelector<HTMLTemplateElement>(`:scope > ${OVERFLOW_TEMPLATE_SELECTOR}`);
		this.#overflow = this.querySelector<HTMLElement>(`:scope > [${OVERFLOW_ATTR}]`);
		this.#items = Array.from(this.children).filter(
			(child): child is HTMLElement =>
				child instanceof HTMLElement &&
				!child.hasAttribute(OVERFLOW_ATTR) &&
				!child.matches(OVERFLOW_TEMPLATE_SELECTOR),
		);
		for (const node of this.#hidden) {
			if (node.parentNode !== this) this.#hidden.delete(node);
		}
	}

	#ensureOverflow(): HTMLElement {
		const wantsCustom = this.#overflowTemplate !== null;
		if (this.#overflow?.isConnected && this.#overflowIsCustom === wantsCustom) {
			return this.#overflow;
		}
		this.#overflow?.remove();

		const el = wantsCustom ? this.#createCustomOverflow() : document.createElement("span");
		el.setAttribute(OVERFLOW_ATTR, "");
		this.#overflowIsCustom = wantsCustom;
		this.#overflow = el;
		return el;
	}

	#createCustomOverflow(): HTMLElement {
		const first = this.#overflowTemplate?.content.firstElementChild;
		if (first instanceof HTMLElement) {
			const el = first.cloneNode(true) as HTMLElement;
			el.setAttribute("data-neo-avatars-overflow-custom", "");
			return el;
		}
		const button = document.createElement("button");
		button.type = "button";
		// Safari's default Tab order skips a <button> without an explicit tabindex.
		button.setAttribute("tabindex", "0");
		button.setAttribute("data-neo-avatars-overflow-custom", "");
		button.append("+", document.createElement("span"));
		button.lastElementChild?.setAttribute("data-neo-avatars-overflow-count", "");
		return button;
	}

	#renderVisible(visible: number) {
		const total = this.#items.length;
		const hidden = Math.max(0, total - visible);
		const overflowTotal = hidden + this.#overflowCount;
		const needsOverflow = overflowTotal > 0;

		for (let i = 0; i < total; i++) {
			if (i >= visible) this.#hidden.add(this.#items[i]);
			else this.#hidden.delete(this.#items[i]);
		}

		if (!needsOverflow) {
			this.#overflow?.remove();
		} else {
			const overflow = this.#ensureOverflow();
			this.#updateOverflow(overflow, overflowTotal);
			const anchor = this.#items[visible] ?? null;
			if (overflow.parentElement !== this || overflow.nextElementSibling !== anchor) {
				this.insertBefore(overflow, anchor);
			}
		}
		assignChildren(this, this.#slot, this.#hidden);
	}

	#updateOverflow(overflow: HTMLElement, overflowTotal: number) {
		const label = `${overflowTotal} more ${overflowTotal === 1 ? "avatar" : "avatars"}`;
		overflow.dataset.neoAvatarsOverflowValue = String(overflowTotal);

		const countTargets = [
			...(overflow.matches(OVERFLOW_COUNT_SELECTOR) ? [overflow] : []),
			...Array.from(overflow.querySelectorAll<HTMLElement>(OVERFLOW_COUNT_SELECTOR)),
		];
		if (countTargets.length > 0) {
			for (const target of countTargets) {
				if (target.textContent !== String(overflowTotal)) {
					target.textContent = String(overflowTotal);
				}
			}
		} else if (!this.#overflowIsCustom && overflow.textContent !== `+${overflowTotal}`) {
			// A custom template owns its content, which means only the
			// generated overflow takes the default "+N" label. Without a count
			// target the total stays readable from
			// [data-neo-avatars-overflow-value] and from the control's
			// aria-label.
			this.#setDefaultOverflowLabel(overflow, overflowTotal);
		}

		const control = findOverflowControl(overflow);
		if (!control.hasAttribute("aria-label")) control.setAttribute("aria-label", label);
	}

	#setDefaultOverflowLabel(overflow: HTMLElement, overflowTotal: number) {
		let label = overflow.querySelector<HTMLElement>(`:scope > [${OVERFLOW_LABEL_ATTR}]`);
		if (!label) {
			overflow.textContent = "";
			label = document.createElement("span");
			label.setAttribute(OVERFLOW_LABEL_ATTR, "");
			overflow.appendChild(label);
		}
		const text = `+${overflowTotal}`;
		if (label.textContent !== text) label.textContent = text;
	}

	#fits(): boolean {
		// scrollWidth only counts rightward overflow in LTR. A flex-end row
		// (chat header) overflows left and always reports "fits".
		// Zero-size boxes (unassigned children, the <template>) drop out.
		const host = this.getBoundingClientRect();
		if (host.width <= 0) return true;
		let left = Infinity;
		let right = -Infinity;
		for (const child of this.children) {
			if (!(child instanceof HTMLElement)) continue;
			const rect = child.getBoundingClientRect();
			if (rect.width === 0 && rect.height === 0) continue;
			left = Math.min(left, rect.left);
			right = Math.max(right, rect.right);
		}
		if (right < left) return true;
		return right - left <= host.width + 1;
	}

	#scheduleAdapt() {
		if (this.#adaptFrame) return;
		this.#adaptFrame = requestAnimationFrame(() => {
			this.#adaptFrame = 0;
			this.#adapt();
		});
	}

	#adapt() {
		if (this.#adapting) return;
		this.#adapting = true;
		try {
			const total = this.#items.length;
			const capped = this.#collapseAt > 0 ? Math.min(total, this.#collapseAt) : total;

			for (let visible = capped; visible >= 0; visible--) {
				this.#renderVisible(visible);
				if (this.#fits()) break;
			}
		} finally {
			this.#adapting = false;
			this.#mutationObserver?.takeRecords();
		}
		this.#emitChange();
	}

	// adapt() runs on every resize/mutation. Listeners get an event only on
	// a real partition change. Called after `adapting` is cleared so a listener
	// may safely re-enter adapt().
	#emitChange() {
		const shown: string[] = [];
		const hidden: string[] = [];
		for (const item of this.#items) {
			const id = avatarId(item);
			if (id === null) continue;
			(this.#hidden.has(item) ? hidden : shown).push(id);
		}
		const signature = JSON.stringify([shown, hidden]);
		if (signature === this.#lastPartition) return;
		this.#lastPartition = signature;
		this.dispatchEvent(
			new CustomEvent("neo-avatars-change", {
				bubbles: true,
				detail: { shown, hidden },
			}),
		);
	}
}

function findOverflowControl(overflow: HTMLElement): HTMLElement {
	return (
		(overflow.matches("button, a[href], [role='button'], [data-neo-popover-trigger]")
			? overflow
			: overflow.querySelector<HTMLElement>("button, a[href], [role='button'], [data-neo-popover-trigger]")) ?? overflow
	);
}

// Fall back to the wrapper's id (anchor/button wrappers often carry it).
// null means untrackable and omitted from the change event.
function avatarId(item: HTMLElement): string | null {
	const avatar = item.matches("neo-avatar") ? item : item.querySelector("neo-avatar");
	return avatar?.id || item.id || null;
}

if (!customElements.get("neo-avatars")) {
	customElements.define("neo-avatars", NeoAvatars);
}
