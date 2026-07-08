// Slides and nav buttons are light DOM so Datastar morphs reach them; the
// dot-pagination markup lives in the host's shadow root. Scrolling is
// native (overflow plus scroll-snap): JS only computes the next snap
// target on prev/next/keyboard/autoplay and dispatches change events.

import { boolAttr, warnBadAxis } from "../command";

let nextCarouselId = 0;

// Shadow template for <neo-carousel>. Holds dot markup + autoplay sweep
// + the slot for slides/track/buttons. The dots container sits after
// the slot in source order so it stacks below the slotted content by
// default; pages override layout via `::part(dots)` from outside.
// Shadow CSS notes, kept out of the template string so the minifier drops
// them from the bundle. Anchored by selector:
// - :host flex column (not plain block) lets a CSS `order` on the dots
//   container place it visually below the slotted content even though DOM
//   order puts it first. DOM-first is needed so Tab reaches the dots
//   tablist before any slotted controls (e.g. a data-neo-carousel-pause
//   button). Pages overriding display (e.g. to grid) keep their own
//   layout: grid-area on ::part(dots) wins.
// - :host([data-neo-carousel-autoplay]) [data-neo-carousel-dots] >
//   button[aria-current="true"]::after: active-dot sweep when autoplay is
//   configured. The ::after grows from 0 -> full over
//   --neo-carousel-autoplay-interval, set per-host by the JS.
// - @media (forced-colors: active) [data-neo-carousel-dots] > button:
//   dots are ~0.55rem so a real border would eat the visible area; inset
//   box-shadow gives the ring instead. forced-color-adjust keeps our
//   colours through the UA remap.
// - :host-context(:root[data-pref-contrast-more]) [data-neo-carousel-dots]
//   > button: host-context pierces the shadow boundary for the page-level
//   data-pref-contrast-more attribute. At 0.55rem a ring is too thin to
//   read; inactive = solid currentColor, active = accent + scale.
const CAROUSEL_TEMPLATE = document.createElement("template");
CAROUSEL_TEMPLATE.innerHTML = `
<style>
  :host {
    display: flex;
    flex-direction: column;
    position: relative;
    min-width: 0;
    outline: none;
    border-radius: inherit;
  }
  ::slotted(*) { box-sizing: border-box; }
  [data-neo-carousel-dots] {
    order: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--neo-carousel-dot-gap, 0.4rem);
    padding: 0.5rem 0;
  }
  :host(:not([dots])) [data-neo-carousel-dots],
  :host([dots="false"]) [data-neo-carousel-dots] { display: none; }
  [data-neo-carousel-dots] > button {
    width: var(--neo-carousel-dot-size, 0.55rem);
    height: var(--neo-carousel-dot-size, 0.55rem);
    padding: 0;
    border: 0;
    border-radius: var(--neo-carousel-dot-radius, 999px);
    background: var(--neo-carousel-dot-bg, rgba(127, 127, 127, 0.25));
    cursor: pointer;
    transition:
      width 180ms var(--neo-easing, ease-out),
      background-color 160ms var(--neo-easing, ease-out),
      transform 160ms var(--neo-easing, ease-out);
  }
  [data-neo-carousel-dots] > button:hover {
    background: color-mix(in srgb,
      var(--neo-carousel-dot-active-bg, var(--accent, currentColor)) 60%,
      var(--neo-carousel-dot-bg, rgba(127, 127, 127, 0.25)));
  }
  [data-neo-carousel-dots] > button[data-neo-carousel-dot-visibility="partial"] {
    background: color-mix(in srgb,
      var(--neo-carousel-dot-active-bg, var(--accent, currentColor)) 50%,
      var(--neo-carousel-dot-bg, rgba(127, 127, 127, 0.25)));
    transform: scale(1.05);
  }
  [data-neo-carousel-dots] > button[data-neo-carousel-dot-visibility="full"] {
    background: var(--neo-carousel-dot-active-bg, var(--accent, currentColor));
    transform: scale(1.15);
  }
  [data-neo-carousel-dots] > button:focus { outline: none; }
  [data-neo-carousel-dots] > button:focus-visible {
    outline: 2px solid var(--neo-carousel-focus-ring, var(--accent, currentColor));
    outline-offset: 2px;
  }
  :host([data-neo-carousel-autoplay]) [data-neo-carousel-dots] > button[aria-current="true"] {
    position: relative;
    width: calc(var(--neo-carousel-dot-size, 0.55rem) * 3);
    background: var(--neo-carousel-dot-bg, rgba(127, 127, 127, 0.25));
    transform: none;
    overflow: hidden;
  }
  :host([data-neo-carousel-autoplay]) [data-neo-carousel-dots] > button[aria-current="true"]::after {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--neo-carousel-dot-active-bg, var(--accent, currentColor));
    transform-origin: left center;
    transform: scaleX(0);
    border-radius: inherit;
    animation: neo-carousel-dot-fill
      var(--neo-carousel-autoplay-interval, 0s) linear forwards;
  }
  :host([data-neo-carousel-autoplay][orientation="vertical"]) [data-neo-carousel-dots] > button[aria-current="true"]::after {
    transform-origin: top center;
  }
  :host([data-neo-carousel-autoplay][paused]:not([paused="false"])) [data-neo-carousel-dots] > button[aria-current="true"]::after,
  :host([data-neo-carousel-autoplay][data-neo-carousel-interacting]) [data-neo-carousel-dots] > button[aria-current="true"]::after {
    animation-play-state: paused;
  }
  @keyframes neo-carousel-dot-fill {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-neo-carousel-dots] > button { transition: none; }
    :host([data-neo-carousel-autoplay]) [data-neo-carousel-dots] > button[aria-current="true"]::after {
      animation: none;
      transform: scaleX(1);
    }
  }
  @media (forced-colors: active) {
    [data-neo-carousel-dots] > button {
      background: transparent;
      box-shadow: inset 0 0 0 2px CanvasText;
      forced-color-adjust: none;
    }
    [data-neo-carousel-dots] > button[data-neo-carousel-dot-visibility="partial"] {
      background: color-mix(in srgb, Highlight 50%, Canvas);
      box-shadow: inset 0 0 0 2px Highlight;
    }
    [data-neo-carousel-dots] > button[data-neo-carousel-dot-visibility="full"] {
      background: Highlight;
      box-shadow: inset 0 0 0 2px Highlight;
    }
    :host([data-neo-carousel-autoplay]) [data-neo-carousel-dots] > button[aria-current="true"] {
      background: transparent;
    }
    :host([data-neo-carousel-autoplay]) [data-neo-carousel-dots] > button[aria-current="true"]::after {
      background: Highlight;
    }
    [data-neo-carousel-dots] > button:focus-visible {
      outline-color: Highlight;
    }
  }
  :host-context(:root[data-pref-contrast-more]) [data-neo-carousel-dots] > button {
    background: currentColor;
  }
  :host-context(:root[data-pref-contrast-more]) [data-neo-carousel-dots] > button[data-neo-carousel-dot-visibility="partial"] {
    background: color-mix(in srgb, var(--accent, currentColor) 60%, currentColor);
  }
  :host-context(:root[data-pref-contrast-more]) [data-neo-carousel-dots] > button[data-neo-carousel-dot-visibility="full"] {
    background: var(--accent, currentColor);
  }
  :host-context(:root[data-pref-contrast-more])[data-neo-carousel-autoplay] [data-neo-carousel-dots] > button[aria-current="true"] {
    background: transparent;
    box-shadow: inset 0 0 0 2px currentColor;
  }
  :host-context(:root[data-pref-contrast-more])[data-neo-carousel-autoplay] [data-neo-carousel-dots] > button[aria-current="true"]::after {
    background: var(--accent, currentColor);
  }
</style>
<div data-neo-carousel-dots part="dots"></div>
<slot></slot>
`;

// Honour both the OS-level prefers-reduced-motion media query and
// the kit's `:root[data-pref-reduced-motion]` simulator attribute
// (toggled by the a11y settings panel). The two are independent
// triggers, mirrored on the CSS side as `@media (prefers-reduced-
// motion)` + `:root[data-pref-reduced-motion]` selectors.
function prefersReducedMotion(): boolean {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		return true;
	}
	return document.documentElement.hasAttribute("data-pref-reduced-motion");
}

export class NeoCarousel extends HTMLElement {
	static readonly observedAttributes = [
		"value",
		"orientation",
		"per-view",
		"spacing",
		"align",
		"loop",
		"autoplay",
		"autoplay-step",
		"paused",
		"touch",
		"easing",
	];

	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.appendChild(CAROUSEL_TEMPLATE.content.cloneNode(true));
	}

	#hostId = "";
	#ready = false;
	#dotsEl: HTMLElement | null = null;
	#childObserver: MutationObserver | null = null;
	#resizeObserver: ResizeObserver | null = null;
	// Track had a measurable box at the last resize tick. A `value` set
	// while display:none (hidden tab panel, closed lightbox) can't scroll;
	// re-center on the false->true transition when the carousel is revealed.
	#wasMeasurable = false;
	// Snap target index, updated only on settle. Mid-scroll updates
	// would fight macOS trackpad momentum.
	#activeIndex = -1;
	// Active value as of last sync(); gates change events to real
	// transitions.
	#previousActiveValue: string | null = null;
	#autoplayTimer: number | null = null;
	// performance.now() of last autoplay tick; with autoplayElapsed
	// computes the remaining interval after a pause so the JS timer
	// and the CSS dot-fill animation resume in sync.
	#autoplayLastTickAt = 0;
	#autoplayElapsed = 0;
	// Set while a programmatic scrollTo is in flight; gates
	// updateActiveFromScroll so pre-settle callbacks don't revert
	// `value` to the pre-scroll slide. Cleared on scrollend (or by the
	// fallback timer for browsers without it).
	#scrollLock = false;
	#scrollLockTimer: number | null = null;
	// Set for the setAttribute("value", …) call updateActiveFromScroll
	// makes; attributeChangedCallback sees it and skips its smooth
	// scrollTo, which would otherwise stutter macOS trackpad momentum.
	#syncingFromScroll = false;
	// Set for the carousel's OWN nav writes (commitIndex: next/prev/dots/
	// keys/autoplay). Those always animate; an external `value` patch
	// (Datastar data-attr, server morph, setAttribute) jumps unless
	// `animate-patch` is set.
	#selfNav = false;
	// Guards the keep-on-absent re-reflect so it isn't read as a command.
	#reflectingValue = false;
	// Coalesces an external `value` patch into a microtask so the scroll
	// decision reads `animate-patch` after the whole morph/batch applied,
	// regardless of attribute order. Bumped by self writes to supersede a
	// pending external scroll.
	#externalScrollToken = 0;
	// Fallback for browsers without scrollend (Safari < 17).
	#scrollSettleTimer: number | null = null;
	// Slide-set signature; reconnects observer only on actual changes
	// (otherwise every sync() queues a batch of initial callbacks).
	#observedSignature = "";
	// Last duplicate-value set we warned about. Re-emitting only on
	// change keeps a persistent duplicate from spamming every tick.
	#warnedDupesSig = "";
	// JS scroll animation (when `easing` is configured): a hidden probe
	// element animated via WAAPI; each rAF reads its computed transform
	// and projects onto scrollLeft/Top. null when idle.
	#scrollAnimRaf: number | null = null;
	#scrollAnimAnim: Animation | null = null;
	#scrollAnimProbe: HTMLElement | null = null;
	// Track + its inline scroll-snap-type, saved while the JS animator
	// runs. mandatory snap would yank each interpolated scrollLeft to
	// the nearest target, defeating the easing.
	#scrollAnimTrack: HTMLElement | null = null;
	#scrollAnimSavedSnap = "";
	// Deadline (performance.now()) until which onTrackScroll's settle
	// path is suppressed. Set on orientation flip; a co-occurring
	// patchElements morph briefly shifts slide positions, and a settle
	// tick on that in-flux layout would write a stale `value` and
	// trigger a smooth scroll to it.
	#postOrientationSettleAt = 0;

	connectedCallback() {
		if (!this.id) this.id = `neo-carousel-${++nextCarouselId}`;
		this.#hostId = this.id;
		warnBadAxis(this);
		if (!this.hasAttribute("role")) this.setAttribute("role", "region");
		if (!this.hasAttribute("aria-roledescription")) {
			this.setAttribute("aria-roledescription", "carousel");
		}
		if (this.hasAttribute("tabindex")) this.removeAttribute("tabindex");

		const track = this.#track();
		// Author can opt the track out of the tab order with `tabindex="-1"`
		// (useful when the carousel is driven entirely by external prev /
		// next buttons and the scrollable region itself has no value as a
		// focus stop).
		if (track && !track.hasAttribute("tabindex")) {
			track.setAttribute("tabindex", "0");
		}

		this.addEventListener("click", this.#onClick);
		this.addEventListener("keydown", this.#onKeyDown);
		// Pointer drag for `drag-nav`. No-op when the attribute is unset;
		// the early-return inside the handlers keeps the cost negligible.
		this.addEventListener("pointerdown", this.#onPointerDown);
		this.addEventListener("pointermove", this.#onPointerMove);
		this.addEventListener("pointerup", this.#onPointerEnd);
		this.addEventListener("pointercancel", this.#onPointerEnd);
		this.addEventListener("dragstart", this.#onDragStart);

		// Initial render races the parser; a fat-morph can also re-emit
		// slides. Sync on any child change so ARIA + dots stay accurate.
		this.#childObserver = new MutationObserver(() => this.#sync());
		this.#childObserver.observe(this, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["value"],
		});

		// Track width changes can shift which slide is centered; keep
		// the dots' aria-current honest after a resize.
		this.#resizeObserver = new ResizeObserver(() => this.#onResize());

		this.#ready = true;
		this.#sync();
		// Defer until layout settles so the track has a measurable
		// scrollWidth.
		queueMicrotask(() => this.#scrollToValue(this.#resolvedValue(), "auto"));
		this.#refreshAutoplay();
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.#onClick);
		this.removeEventListener("keydown", this.#onKeyDown);
		this.removeEventListener("pointerdown", this.#onPointerDown);
		this.removeEventListener("pointermove", this.#onPointerMove);
		this.removeEventListener("pointerup", this.#onPointerEnd);
		this.removeEventListener("pointercancel", this.#onPointerEnd);
		this.removeEventListener("dragstart", this.#onDragStart);
		const track = this.#track();
		if (track) {
			track.removeEventListener("scroll", this.#onTrackScroll);
			track.removeEventListener("scrollend", this.#onScrollEnd);
		}
		this.#childObserver?.disconnect();
		this.#childObserver = null;
		this.#resizeObserver?.disconnect();
		this.#resizeObserver = null;
		if (this.#scrollSettleTimer !== null) {
			window.clearTimeout(this.#scrollSettleTimer);
			this.#scrollSettleTimer = null;
		}
		if (this.#scrollLockTimer !== null) {
			window.clearTimeout(this.#scrollLockTimer);
			this.#scrollLockTimer = null;
		}
		this.#scrollLock = false;
		this.#wasMeasurable = false;
		this.#observedSignature = "";
		this.#cancelScrollAnim();
		this.#stopAutoplay();
		if (this.id) {
			document.getElementById(`neo-carousel-autoplay-${this.id}`)?.remove();
		}
		this.#ready = false;
	}

	attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
		if (!this.#ready) return;
		if (oldValue === newValue) return;
		if (name === "autoplay" || name === "autoplay-step") {
			// A changed interval/step starts fresh; clear any accumulated
			// pause-elapsed so the dot-fill animation and the timer both
			// begin at 0.
			this.#refreshAutoplay(true);
			return;
		}
		if (name === "paused") {
			// Don't reset elapsed here; refreshAutoplay's stopAutoplay
			// call will accumulate the time spent running before this
			// pause toggle, so a subsequent unpause picks up where the
			// animation visibly stopped.
			this.#refreshAutoplay();
			return;
		}
		if (name === "loop") {
			this.#sync();
			this.#refreshAutoplay(true);
			return;
		}
		if (name === "value") {
			// Our own re-reflect write (keep-on-absent below); not a command.
			if (this.#reflectingValue) return;
			// Fat morph dropped `value`: no command, keep the active slide
			// (mirrors the open contract). Re-reflect so the attribute stays the state
			// mirror; don't scroll, nothing moved.
			if (newValue === null) {
				if (oldValue !== null) this.#reflectValue(oldValue);
				return;
			}
			if (this.#syncingFromScroll) {
				// Our own scroll reflection: the track is already there.
				this.#externalScrollToken++;
			} else if (this.#selfNav) {
				// Our own nav (next/prev/dots/keys/autoplay): animate.
				this.#externalScrollToken++;
				this.#scrollToValue(this.#resolvedValue(), this.#isPostOrientationPatch() ? "auto" : "smooth");
			} else {
				// External attribute patch: jump unless `animate-patch`.
				// Coalesced so the read sees `animate-patch` regardless of the
				// order the morph applied the two attributes.
				this.#scheduleExternalScroll();
			}
			this.#sync();
			this.#refreshAutoplay(true);
			return;
		}
		if (name === "align") {
			// Layout-time re-snap is unanimated per spec; smooth-scroll to
			// the resolved value at the new alignment to override.
			this.#sync();
			this.#scrollToValue(this.#resolvedValue(), this.#isPostOrientationPatch() ? "auto" : "smooth");
			return;
		}
		if (name === "orientation") {
			// Axis flip zeroes the new axis to slide 1; jump instantly to
			// avoid a backtrack-then-animate. Deferred one rAF so layout
			// settles before getBoundingClientRect.
			this.#sync();
			this.#postOrientationSettleAt = performance.now() + 400;
			requestAnimationFrame(() => {
				this.#scrollToValue(this.#resolvedValue(), "auto");
			});
			return;
		}
		if (name === "per-view" || name === "spacing") {
			// Defer a frame so getBoundingClientRect reads post-layout
			// sizes; same reasoning as `align` for the smooth scroll.
			this.#sync();
			requestAnimationFrame(() => {
				this.#scrollToValue(this.#resolvedValue(), this.#isPostOrientationPatch() ? "auto" : "smooth");
			});
			return;
		}
		this.#sync();
	}

	get value(): string | null {
		return this.getAttribute("value");
	}

	set value(v: string | null) {
		if (v === null) this.removeAttribute("value");
		else this.setAttribute("value", v);
	}

	#track(): HTMLElement | null {
		return this.querySelector<HTMLElement>(":scope > neo-carousel-track");
	}

	#isPostOrientationPatch() {
		return performance.now() < this.#postOrientationSettleAt;
	}

	#slides(): HTMLElement[] {
		const track = this.#track();
		if (!track) return [];
		return Array.from(track.querySelectorAll<HTMLElement>(":scope > neo-carousel-slide"));
	}

	#dotsHost(): HTMLElement | null {
		if (this.#dotsEl) return this.#dotsEl;
		this.#dotsEl = this.shadowRoot?.querySelector<HTMLElement>("[data-neo-carousel-dots]") ?? null;
		return this.#dotsEl;
	}

	// Light-DOM <template data-neo-carousel-dot>: per-button inner-content
	// template the kit clones into each dot. Author writes it as a child
	// of <neo-carousel>; absent -> empty button (default CSS-styled circle).
	#dotTemplate(): HTMLTemplateElement | null {
		return this.querySelector<HTMLTemplateElement>(":scope > template[data-neo-carousel-dot]");
	}

	#resolvedValue(): string | null {
		const explicit = this.getAttribute("value");
		if (explicit !== null) return explicit;
		const first = this.#slides()[0];
		return first?.getAttribute("value") ?? null;
	}

	// Write `value` as the carousel's own navigation, so it animates.
	// External patches reach setAttribute directly and jump unless
	// `animate-patch` is set.
	#navSetValue(v: string) {
		if (this.getAttribute("value") === v) return;
		this.#selfNav = true;
		try {
			this.setAttribute("value", v);
		} finally {
			this.#selfNav = false;
		}
	}

	// Re-assert `value` after a morph stripped it, guarded so the write
	// isn't read back as a command.
	#reflectValue(v: string) {
		if (this.getAttribute("value") === v) return;
		this.#reflectingValue = true;
		try {
			this.setAttribute("value", v);
		} finally {
			this.#reflectingValue = false;
		}
	}

	// Apply an external `value` patch after a microtask, so the scroll
	// behavior reads `animate-patch` once the whole morph/batch has landed
	// (order-independent). A self write (nav / scroll reflection) bumps the
	// token to supersede a still-pending external scroll.
	#scheduleExternalScroll() {
		const token = ++this.#externalScrollToken;
		queueMicrotask(() => {
			if (token !== this.#externalScrollToken || !this.#ready || !this.isConnected) return;
			const value = this.#resolvedValue();
			if (value === null) return;
			const animate = boolAttr(this, "animate-patch", false) && !this.#isPostOrientationPatch();
			this.#scrollToValue(value, animate ? "smooth" : "auto");
		});
	}

	// ARIA on slides, dot rendering + aria-current, pause-button
	// aria-pressed, observer wiring. Cheap enough for the mutation
	// observer to call every tick.
	#sync() {
		const slides = this.#slides();
		const value = this.#resolvedValue();
		const total = slides.length;

		this.#clampPerView(slides);
		this.#applySpacing();

		// Tally values for the duplicate check (warnOnDuplicateValues).
		const seen = new Map<string, number>();
		for (let i = 0; i < slides.length; i++) {
			const slide = slides[i];
			const v = slide.getAttribute("value") ?? String(i + 1);
			seen.set(v, (seen.get(v) ?? 0) + 1);
			if (!slide.hasAttribute("role")) slide.setAttribute("role", "group");
			if (!slide.hasAttribute("aria-roledescription")) {
				slide.setAttribute("aria-roledescription", "slide");
			}
			slide.setAttribute("aria-label", `${i + 1} of ${total}`);
			slide.id = `${this.#hostId}-slide-${v}`;
		}
		this.#warnOnDuplicateValues(seen);

		this.#renderDots(slides, value);
		this.#syncPauseButtons();
		this.#syncNavButtons();
		this.#observeSlides();

		if (this.#previousActiveValue !== value) {
			this.#previousActiveValue = value;
			const idx = slides.findIndex((s) => s.getAttribute("value") === value);
			this.#activeIndex = idx;
			this.dispatchEvent(
				new CustomEvent("neo-carousel-change", {
					bubbles: true,
					detail: { value, index: idx },
				}),
			);
		}
	}

	// Reuse existing dot buttons so focus survives a partial re-render;
	// only count/labels change between syncs in the steady state. Buttons
	// live inside the shadow root; author opts in via the `dots`
	// attribute (CSS gate :host(:not([dots])) hides the container) and
	// can customize per-button inner markup via <template
	// data-neo-carousel-dot>.
	#renderDots(slides: HTMLElement[], value: string | null) {
		const host = this.#dotsHost();
		if (!host) return;
		const existing = Array.from(host.querySelectorAll<HTMLButtonElement>(":scope > button"));
		for (let i = slides.length; i < existing.length; i++) {
			existing[i].remove();
		}
		const tpl = this.#dotTemplate();
		for (let i = 0; i < slides.length; i++) {
			const slide = slides[i];
			const slideValue = slide.getAttribute("value") ?? String(i + 1);
			let btn = existing[i];
			if (!btn) {
				btn = document.createElement("button");
				btn.type = "button";
				btn.setAttribute("data-neo-carousel-dot", "");
				// `part` is rewritten with visibility-specific names by
				// syncDotsCurrent; initialize with the always-present "dot".
				btn.setAttribute("part", "dot");
				if (tpl) {
					btn.appendChild(tpl.content.cloneNode(true));
				}
				host.appendChild(btn);
			} else if (tpl && btn.childElementCount === 0) {
				// First sync after a template was added: backfill into the
				// already-present buttons.
				btn.appendChild(tpl.content.cloneNode(true));
			}
			btn.dataset.value = slideValue;
			btn.setAttribute("aria-label", `Go to slide ${i + 1}`);
		}
		this.#syncDotsCurrent(slides, value);
	}

	// Writes visibility markers on slides AND dot buttons in one pass:
	//   - data-neo-carousel-slide-visibility="full" | "partial" on each
	//     slide (absent when off-screen).
	//   - data-neo-carousel-dot-visibility="full" | "partial" on each
	//     dot, mirroring its slide.
	//   - aria-current="true" on one dot. During user scroll this may
	//     point at the live snapped candidate before `value` settles;
	//     during programmatic scroll it stays on the target value.
	// Falls back to anchor-only when layout isn't ready (initial render
	// before the track has measurable bounds).
	#syncDotsCurrent(slides: HTMLElement[], value: string | null, currentValue = value) {
		const visibility = this.#slideVisibility(slides);
		const anchorIdx =
			currentValue === null
				? slides.findIndex((s) => s.getAttribute("value") === null)
				: slides.findIndex((s, i) => (s.getAttribute("value") ?? String(i + 1)) === currentValue);
		for (let i = 0; i < slides.length; i++) {
			const v = visibility ? visibility[i] : i === anchorIdx ? "full" : "none";
			if (v === "none") {
				slides[i].removeAttribute("data-neo-carousel-slide-visibility");
			} else {
				slides[i].setAttribute("data-neo-carousel-slide-visibility", v);
			}
		}
		const host = this.#dotsHost();
		if (!host) return;
		const buttons = host.querySelectorAll<HTMLButtonElement>(":scope > button");
		if (buttons.length === 0) return;
		// Roving tabindex follows focus when the user is mid-arrow-nav so a
		// sync mid-navigation doesn't yank the tabstop back to aria-current.
		// shadowRoot.activeElement is the only reliable way to read focus
		// inside the shadow tree from outside.
		const activeInShadow = this.shadowRoot?.activeElement;
		const focused =
			activeInShadow instanceof HTMLButtonElement && activeInShadow.parentElement === host ? activeInShadow : null;
		for (let i = 0; i < buttons.length; i++) {
			const v = visibility ? visibility[i] : i === anchorIdx ? "full" : "none";
			if (v === "none") {
				buttons[i].removeAttribute("data-neo-carousel-dot-visibility");
			} else {
				buttons[i].setAttribute("data-neo-carousel-dot-visibility", v);
			}
			const isAnchor = i === anchorIdx;
			buttons[i].setAttribute("aria-current", isAnchor ? "true" : "false");
			const tabstop = focused ? buttons[i] === focused : isAnchor;
			buttons[i].tabIndex = tabstop ? 0 : -1;
			// Multi-value `part` is the only way for external CSS to style
			// state-specific dots: ::part() can be followed by pseudo-classes
			// but not attribute selectors, so we mirror state into named
			// parts (`dot-partial`, `dot-full`, `dot-current`) the page can
			// target directly.
			const partNames = ["dot"];
			if (v === "partial") partNames.push("dot-partial");
			else if (v === "full") partNames.push("dot-full");
			if (isAnchor) partNames.push("dot-current");
			buttons[i].setAttribute("part", partNames.join(" "));
		}
	}

	// Per-slide visibility against the track viewport. "full" means the
	// slide box is entirely inside; "partial" means it intersects but
	// pokes past an edge; "none" means it's off-screen. 2px tolerance
	// avoids edge flicker. Returns null when layout isn't ready (track
	// has zero dimensions).
	#slideVisibility(slides: HTMLElement[]): ("full" | "partial" | "none")[] | null {
		const track = this.#track();
		if (!track) return null;
		const trackRect = track.getBoundingClientRect();
		if (trackRect.width === 0 && trackRect.height === 0) return null;
		const vertical = this.getAttribute("orientation") === "vertical";
		const trackStart = vertical ? trackRect.top : trackRect.left;
		const trackEnd = vertical ? trackRect.bottom : trackRect.right;
		return slides.map((slide) => {
			const r = slide.getBoundingClientRect();
			const slideStart = vertical ? r.top : r.left;
			const slideEnd = vertical ? r.bottom : r.right;
			if (slideEnd <= trackStart + 2 || slideStart >= trackEnd - 2) {
				return "none";
			}
			if (slideStart >= trackStart - 2 && slideEnd <= trackEnd + 2) {
				return "full";
			}
			return "partial";
		});
	}

	#syncPauseButtons() {
		const paused = boolAttr(this, "paused", false);
		const autoplaying = this.#autoplayInterval !== null;
		for (const btn of this.querySelectorAll<HTMLElement>("[data-neo-carousel-pause]")) {
			btn.setAttribute("aria-pressed", String(paused));
			if (!autoplaying) {
				btn.setAttribute("aria-disabled", "true");
			} else {
				btn.removeAttribute("aria-disabled");
			}
		}
	}

	#syncNavButtons() {
		const prevDisabled = !this.#canScroll(-1);
		const nextDisabled = !this.#canScroll(1);
		for (const btn of this.#carouselControls("[data-neo-carousel-prev]")) {
			this.#setControlDisabled(btn, prevDisabled);
		}
		for (const btn of this.#carouselControls("[data-neo-carousel-next]")) {
			this.#setControlDisabled(btn, nextDisabled);
		}
	}

	#carouselControls(selector: string): HTMLElement[] {
		return Array.from(this.querySelectorAll<HTMLElement>(selector)).filter((el) => el.closest("neo-carousel") === this);
	}

	#setControlDisabled(el: HTMLElement, disabled: boolean) {
		const supportsDisabled = el instanceof HTMLButtonElement || el.localName === "neo-button";
		const isDisabled = this.#isControlDisabled(el);
		if (isDisabled === disabled) return;
		if (disabled) {
			el.setAttribute("aria-disabled", "true");
			if (supportsDisabled) el.setAttribute("disabled", "");
		} else {
			el.removeAttribute("aria-disabled");
			if (supportsDisabled) el.removeAttribute("disabled");
		}
	}

	#isControlDisabled(el: HTMLElement) {
		return el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";
	}

	#canScroll(direction: -1 | 1) {
		const slides = this.#slides();
		if (boolAttr(this, "loop", false)) return slides.length > 1;
		const track = this.#track();
		if (!track) return false;
		const vertical = this.getAttribute("orientation") === "vertical";
		const pos = vertical ? track.scrollTop : track.scrollLeft;
		const max = vertical ? track.scrollHeight - track.clientHeight : track.scrollWidth - track.clientWidth;
		return direction < 0 ? pos > 1 : pos < max - 1;
	}

	// Re-attach scroll listeners only when the slide set changes.
	// `value` is never written mid-scroll; settle handlers (scrollend,
	// or the debounced timer for Safari < 17) cover it.
	// ResizeObserver callback. Re-center the active slide when the track
	// gains a measurable box (revealed from a hidden tab panel / closed
	// lightbox): a `value` set while display:none couldn't scroll.
	#onResize() {
		const track = this.#track();
		const measurable = !!track && (track.clientWidth > 0 || track.clientHeight > 0);
		if (measurable && !this.#wasMeasurable) {
			this.#scrollToValue(this.#resolvedValue(), "auto");
		}
		this.#wasMeasurable = measurable;
		this.#observeSlides();
	}

	#observeSlides() {
		const track = this.#track();
		if (!track) return;
		const slides = this.#slides();
		const signature = slides.map((s, i) => s.getAttribute("value") ?? String(i + 1)).join("|");
		if (signature === this.#observedSignature) return;
		this.#observedSignature = signature;

		this.#resizeObserver?.disconnect();
		if (slides.length === 0) return;

		track.removeEventListener("scroll", this.#onTrackScroll);
		track.removeEventListener("scrollend", this.#onScrollEnd);
		track.addEventListener("scroll", this.#onTrackScroll, { passive: true });
		track.addEventListener("scrollend", this.#onScrollEnd);
		this.#resizeObserver?.observe(track);
	}

	// Bumps a settle timer on each scroll event; updateActiveFromScroll
	// runs only when events stop. updateDotsFromScroll runs on every
	// event but writes only aria-current on dots, never `value`.
	#onTrackScroll = () => {
		if (this.#scrollLock) {
			// Programmatic smooth scroll in flight. Push the fallback
			// timer back so it can't fire on an intermediate scrollLeft
			// and write the wrong slide into `value`. Dot visibility is
			// scroll-position-only, so it can keep updating while locked.
			this.#bumpScrollLockTimer();
			this.#updateDotsFromScroll();
			return;
		}
		// Suppress while a patchElements morph reshuffles layout post-
		// orientation-flip; see attributeChangedCallback.
		if (performance.now() < this.#postOrientationSettleAt) return;
		this.#beginUserScroll();
		this.#updateDotsFromScroll(true);
		if (this.#dragState) {
			// A drag-nav drag owns its settle (onPointerEnd). Arming the
			// settle timer here would let a 140ms mid-drag pause fire
			// endUserScroll and resume autoplay while the pointer is still
			// down; autoplay must stay paused for the whole drag.
			if (this.#scrollSettleTimer !== null) {
				window.clearTimeout(this.#scrollSettleTimer);
				this.#scrollSettleTimer = null;
			}
			return;
		}
		if (this.#scrollSettleTimer !== null) {
			window.clearTimeout(this.#scrollSettleTimer);
		}
		this.#scrollSettleTimer = window.setTimeout(() => {
			this.#scrollSettleTimer = null;
			this.#updateActiveFromScroll();
			// 140ms of quiet → treat as settle; resume autoplay with a
			// fresh interval (scrollend covers most browsers but Safari
			// pre-17 doesn't fire it).
			this.#endUserScroll();
		}, 140);
	};

	// Mid-scroll dot indicator: every dot whose slide is currently in
	// view lights up. Multiple dots can be active under per-view=N or
	// while a gesture is between snap points. For user scrolls,
	// aria-current follows the live snapped candidate; `value` still
	// updates only after settle.
	#updateDotsFromScroll(liveCurrent = false) {
		const slides = this.#slides();
		if (slides.length === 0) return;
		let currentValue = this.#resolvedValue();
		if (liveCurrent) {
			const idx = this.#computeSnappedIndex(slides);
			if (idx >= 0) {
				currentValue = slides[idx].getAttribute("value") ?? String(idx + 1);
			}
		}
		this.#syncDotsCurrent(slides, this.#resolvedValue(), currentValue);
		this.#syncNavButtons();
	}

	#onScrollEnd = () => {
		// A drag-nav drag assigns scrollLeft on every pointermove, and the
		// browser fires scrollend whenever motion momentarily stalls, so
		// mid-drag scrollend bursts would re-run the settle path on every
		// pause. Let the drag own its settle: onPointerEnd restores snap
		// and the snap-back scroll produces the real terminal scrollend
		// (dragState is null by then, so this guard no longer applies).
		if (this.#dragState) return;
		if (this.#scrollSettleTimer !== null) {
			window.clearTimeout(this.#scrollSettleTimer);
			this.#scrollSettleTimer = null;
		}
		// Programmatic scrolls already have `value` at the target; re-
		// deriving here can pick a different slide at scroll-range
		// boundaries (multiple slides → same scrollLeft) and flap.
		const wasProgrammatic = this.#scrollLock;
		if (this.#scrollLockTimer !== null) {
			window.clearTimeout(this.#scrollLockTimer);
			this.#scrollLockTimer = null;
		}
		this.#scrollLock = false;
		if (!wasProgrammatic) {
			this.#updateActiveFromScroll();
			this.#endUserScroll();
		}
		// Always refresh dot visibility on settle. Programmatic scrolls
		// suppress mid-scroll updateDotsFromScroll via scrollLock, so a
		// dot click that triggers the scroll would otherwise leave the
		// dots stuck on the pre-click visibility set.
		this.#updateDotsFromScroll();
	};

	// For each slide, compute the scrollPos at which it would be
	// snapped under the configured alignment, then pick the closest to
	// the current scrollPos. Picking by snap-pos (not by centre
	// distance) keeps multi-item layouts from ratcheting value forward.
	// Ties at the end-of-track boundary go to the slide already in
	// `value` so prev/next don't oscillate between collapsed candidates.
	#computeSnappedIndex(slides: HTMLElement[]): number {
		const track = this.#track();
		if (!track || slides.length === 0) return -1;
		const vertical = this.getAttribute("orientation") === "vertical";
		const align = this.#snapAlign();

		const scrollPos = vertical ? track.scrollTop : track.scrollLeft;
		const trackRect = track.getBoundingClientRect();
		const trackOrigin = vertical ? trackRect.top : trackRect.left;
		const trackInner = vertical ? track.clientHeight : track.clientWidth;
		const maxScroll = vertical ? track.scrollHeight - track.clientHeight : track.scrollWidth - track.clientWidth;

		const currentValue = this.getAttribute("value");

		let bestIdx = 0;
		let bestDist = Infinity;
		for (let i = 0; i < slides.length; i++) {
			const slide = slides[i];
			const r = slide.getBoundingClientRect();
			const slideStart = (vertical ? r.top : r.left) - trackOrigin + scrollPos;
			const slideSize = vertical ? slide.offsetHeight : slide.offsetWidth;
			let snapPoint = slideStart;
			if (align === "center") snapPoint -= (trackInner - slideSize) / 2;
			else if (align === "end") snapPoint -= trackInner - slideSize;
			// Clamp to achievable range; end-of-track slides share one snapPoint.
			snapPoint = Math.max(0, Math.min(maxScroll, snapPoint));
			const d = Math.abs(snapPoint - scrollPos);
			if (d < bestDist - 0.5) {
				bestDist = d;
				bestIdx = i;
			} else if (Math.abs(d - bestDist) <= 0.5 && currentValue !== null) {
				// Tie (within 0.5px). Prefer the slide that's already
				// reflected in `value` so navigation doesn't flap between
				// two snapPoint-collapsed candidates.
				const v = slide.getAttribute("value") ?? String(i + 1);
				if (v === currentValue) {
					bestIdx = i;
				}
			}
		}
		return bestIdx;
	}

	#updateActiveFromScroll() {
		if (this.#scrollLock) return;
		const slides = this.#slides();
		if (slides.length === 0) return;
		const bestIdx = this.#computeSnappedIndex(slides);
		if (bestIdx < 0 || bestIdx === this.#activeIndex) return;
		this.#activeIndex = bestIdx;
		const newValue = slides[bestIdx].getAttribute("value") ?? String(bestIdx + 1);
		if (this.getAttribute("value") === newValue) return;
		// Mark the write so attributeChangedCallback skips the counter-
		// scroll. Flag clears synchronously after the call returns; the
		// callback runs in the same tick.
		this.#syncingFromScroll = true;
		try {
			this.setAttribute("value", newValue);
		} finally {
			this.#syncingFromScroll = false;
		}
	}

	// Scroll the track so `value` lands at the configured snap
	// alignment. lockScroll prevents pre-settle callbacks from reverting
	// `value` mid-scroll.
	#scrollToValue(value: string | null, behavior: ScrollBehavior) {
		const track = this.#track();
		if (!track || value === null) return;
		const slides = this.#slides();
		const slide = slides.find((s) => s.getAttribute("value") === value);
		if (!slide) return;
		this.#lockScroll();
		const b = prefersReducedMotion() ? "auto" : behavior;
		const vertical = this.getAttribute("orientation") === "vertical";
		const align = this.#snapAlign();
		let target: number;
		if (vertical) {
			const trackTopInScroll = track.getBoundingClientRect().top;
			const slideTopInScroll = slide.getBoundingClientRect().top;
			const slideTopInTrack = slideTopInScroll - trackTopInScroll + track.scrollTop;
			target = slideTopInTrack;
			if (align === "center") {
				target -= (track.clientHeight - slide.offsetHeight) / 2;
			} else if (align === "end") {
				target -= track.clientHeight - slide.offsetHeight;
			}
		} else {
			const trackLeftInScroll = track.getBoundingClientRect().left;
			const slideLeftInScroll = slide.getBoundingClientRect().left;
			const slideLeftInTrack = slideLeftInScroll - trackLeftInScroll + track.scrollLeft;
			target = slideLeftInTrack;
			if (align === "center") {
				target -= (track.clientWidth - slide.offsetWidth) / 2;
			} else if (align === "end") {
				target -= track.clientWidth - slide.offsetWidth;
			}
		}
		this.#animateScrollTo(track, vertical, target, b);
	}

	// Routes to native smooth, instant jump, or a JS rAF animator. The
	// animator drives scrollLeft/Top from a hidden probe whose transform
	// is animated via WAAPI, so every CSS timing-function shape works
	// (cubic-bezier, steps, linear-easing) without a JS evaluator.
	#animateScrollTo(track: HTMLElement, vertical: boolean, target: number, behavior: ScrollBehavior) {
		this.#cancelScrollAnim();
		if (behavior === "auto") {
			// CSS sets `scroll-behavior: smooth` on the track; a temporary
			// override is the reliable instant path and cancels any native
			// smooth scroll in flight.
			const savedBehavior = track.style.scrollBehavior;
			track.style.scrollBehavior = "auto";
			if (vertical) track.scrollTop = target;
			else track.scrollLeft = target;
			track.style.scrollBehavior = savedBehavior;
			this.#updateDotsFromScroll();
			return;
		}
		const easing = this.#resolveEasing();
		if (!easing) {
			if (vertical) track.scrollTo({ top: target, behavior: "smooth" });
			else track.scrollTo({ left: target, behavior: "smooth" });
			return;
		}
		const start = vertical ? track.scrollTop : track.scrollLeft;
		const distance = target - start;
		if (Math.abs(distance) < 0.5) {
			if (vertical) track.scrollTop = target;
			else track.scrollLeft = target;
			track.dispatchEvent(new Event("scrollend"));
			return;
		}
		// Suspend snap so each interpolated scrollLeft isn't yanked to
		// the nearest target. Restored in cleanup.
		this.#scrollAnimTrack = track;
		this.#scrollAnimSavedSnap = track.style.scrollSnapType;
		track.style.scrollSnapType = "none";
		const probe = document.createElement("div");
		probe.style.cssText =
			"position:absolute;left:-9999px;top:0;width:0;height:0;visibility:hidden;pointer-events:none;contain:strict;";
		this.appendChild(probe);
		const anim = probe.animate([{ transform: "translateX(0px)" }, { transform: `translateX(${distance}px)` }], {
			duration: easing.duration,
			easing: easing.timingFn,
			fill: "forwards",
		});
		this.#scrollAnimAnim = anim;
		this.#scrollAnimProbe = probe;
		const step = () => {
			if (this.#scrollAnimAnim !== anim) return;
			const m = new DOMMatrixReadOnly(getComputedStyle(probe).transform);
			const pos = start + m.m41;
			if (vertical) track.scrollTop = pos;
			else track.scrollLeft = pos;
			// "running" is missing from this lib.dom playState union;
			// compare against the terminal states instead.
			const ps = anim.playState;
			if (ps !== "finished" && ps !== "idle") {
				this.#scrollAnimRaf = requestAnimationFrame(step);
			} else {
				// Snap to exact target; float drift could leave us off-snap.
				if (vertical) track.scrollTop = target;
				else track.scrollLeft = target;
				this.#cancelScrollAnim();
				// scrollend doesn't fire for scrollLeft assignment; synthesise.
				track.dispatchEvent(new Event("scrollend"));
			}
		};
		this.#scrollAnimRaf = requestAnimationFrame(step);
	}

	#cancelScrollAnim() {
		if (this.#scrollAnimRaf !== null) {
			cancelAnimationFrame(this.#scrollAnimRaf);
			this.#scrollAnimRaf = null;
		}
		if (this.#scrollAnimAnim) {
			try {
				this.#scrollAnimAnim.cancel();
			} catch {
				// Already finished; ignore.
			}
			this.#scrollAnimAnim = null;
		}
		if (this.#scrollAnimProbe) {
			this.#scrollAnimProbe.remove();
			this.#scrollAnimProbe = null;
		}
		if (this.#scrollAnimTrack) {
			this.#scrollAnimTrack.style.scrollSnapType = this.#scrollAnimSavedSnap;
			this.#scrollAnimTrack = null;
			this.#scrollAnimSavedSnap = "";
		}
	}

	// Returns the JS animator config, or null to fall through to the
	// browser's native smooth scroll. Bare-duration `easing` attribute
	// values pair with the theme's --neo-easing; an unset attribute
	// still returns one if the theme defines --neo-easing (so a
	// theme's stepped easing like `steps(2, end)` applies without
	// per-component opt-in).
	#resolveEasing(): { duration: number; timingFn: string } | null {
		const themed = getComputedStyle(this).getPropertyValue("--neo-easing").trim();
		const raw = this.getAttribute("easing");
		if (raw === null) {
			if (!themed) return null;
			return { duration: 400, timingFn: themed };
		}
		const trimmed = raw.trim();
		if (!trimmed) return null;
		const m = trimmed.match(/^(\d+(?:\.\d+)?)(ms|s)\b\s*(.*)$/);
		if (!m) return null;
		let duration = parseFloat(m[1]);
		if (m[2] === "s") duration *= 1000;
		if (!Number.isFinite(duration) || duration <= 0) return null;
		const fnPart = m[3].trim();
		const timingFn = fnPart || themed || "ease-in-out";
		return { duration, timingFn };
	}

	#snapAlign(): "start" | "center" | "end" {
		const v = this.getAttribute("align");
		return v === "center" || v === "end" ? v : "start";
	}

	// Slide values must be unique: navigation, ARIA, and `value`
	// reflection all key off string equality. Warns only when the
	// duplicate set changes so a persistent collision doesn't spam.
	#warnOnDuplicateValues(counts: Map<string, number>) {
		const dupes: string[] = [];
		for (const [v, n] of counts) {
			if (n > 1) dupes.push(v);
		}
		const sig = dupes.sort().join("|");
		if (sig === this.#warnedDupesSig) return;
		this.#warnedDupesSig = sig;
		if (dupes.length === 0) return;
		const label = dupes.map((d) => `"${d}"`).join(", ");
		const host = this.id ? `<neo-carousel id="${this.id}">` : "<neo-carousel>";
		console.warn(
			`${host}: slide values must be unique. Duplicate value(s): ${label}. Navigation, ARIA, and the reflected \`value\` attribute target only the first match.`,
		);
	}

	// The `spacing` attribute takes any CSS length, so it can't be
	// mapped via attribute selectors. Mirror it onto the variable.
	#applySpacing() {
		const raw = this.getAttribute("spacing");
		if (raw === null || raw.trim() === "") {
			this.style.removeProperty("--neo-carousel-spacing");
			return;
		}
		this.style.setProperty("--neo-carousel-spacing", raw);
	}

	// Override --neo-carousel-per-view inline with min(per-view,
	// slides.length) so per-view=7 with 5 slides splits into 5 columns,
	// not the CSS attribute selectors' fallback (which only cover
	// per-view 1..6). Cleared when not clamping or per-view="auto".
	#clampPerView(slides: HTMLElement[]) {
		const raw = this.getAttribute("per-view");
		if (raw === null || raw === "auto") {
			this.style.removeProperty("--neo-carousel-per-view");
			return;
		}
		const n = parseInt(raw, 10);
		if (!Number.isFinite(n) || n <= 0) {
			this.style.removeProperty("--neo-carousel-per-view");
			return;
		}
		if (slides.length > 0 && n > slides.length) {
			this.style.setProperty("--neo-carousel-per-view", String(slides.length));
		} else {
			this.style.removeProperty("--neo-carousel-per-view");
		}
	}

	// Suppress updateActiveFromScroll until the programmatic scroll
	// settles. scrollend is primary; the 600ms timer is a fallback for
	// cases it doesn't fire (Safari < 17, zero-distance scrolls).
	// onTrackScroll bumps the timer per event so long smooth scrolls
	// don't fire it mid-animation.
	#lockScroll() {
		const track = this.#track();
		if (!track) return;
		this.#scrollLock = true;
		this.#armScrollLockTimer(600);
	}

	#bumpScrollLockTimer() {
		if (this.#scrollLockTimer === null) return;
		// Quiet period after the last scroll event. 200ms outlasts a
		// typical rAF burst, so the timer only fires when the smooth
		// scroll has truly stopped emitting frames.
		this.#armScrollLockTimer(200);
	}

	#armScrollLockTimer(ms: number) {
		if (this.#scrollLockTimer !== null) {
			window.clearTimeout(this.#scrollLockTimer);
		}
		this.#scrollLockTimer = window.setTimeout(() => {
			this.#scrollLock = false;
			this.#scrollLockTimer = null;
			// Resync now that the lock is released; without scrollend,
			// both `value` (active slide) and dot visibility would lag.
			this.#updateActiveFromScroll();
			this.#updateDotsFromScroll();
		}, ms);
	}

	#commitIndex(idx: number) {
		const slides = this.#slides();
		if (slides.length === 0) return;
		const wrap = boolAttr(this, "loop", false);
		let target = idx;
		if (wrap) {
			target = ((target % slides.length) + slides.length) % slides.length;
		} else if (target < 0) {
			target = 0;
		} else if (target >= slides.length) {
			target = slides.length - 1;
		}
		const v = slides[target].getAttribute("value") ?? String(target + 1);
		this.#navSetValue(v);
	}

	next() {
		if (!this.#canScroll(1)) return;
		this.#commitIndex(this.#currentIndex() + this.#navStep());
	}

	prev() {
		if (!this.#canScroll(-1)) return;
		this.#commitIndex(this.#currentIndex() - this.#navStep());
	}

	// Number of slides a prev/next or arrow-key step advances. Default is
	// per-view (page-mode: a press exposes a whole new visible group);
	// author can override with `step="N"`.
	#navStep(): number {
		const raw = this.getAttribute("step");
		if (raw !== null) {
			const n = parseInt(raw, 10);
			if (Number.isFinite(n) && n > 0) return n;
		}
		return this.#numericPerView;
	}

	#autoplayNext() {
		if (!this.#canScroll(1)) return;
		// Roving tabindex keeps the current dot at tabindex 0 and the rest
		// at -1. If a dot has focus when autoplay advances, move focus to
		// the dot that just became current so it isn't stranded on a now
		// un-tabbable dot. Dots live in this.shadowRoot, so check the
		// shadow root's activeElement; document.activeElement retargets to
		// the host across the shadow boundary.
		const focusedInShadow = this.shadowRoot?.activeElement;
		const dotHadFocus = !!focusedInShadow && (this.#dotsHost()?.contains(focusedInShadow) ?? false);
		this.#commitIndex(this.#currentIndex() + this.#autoplayStep);
		if (dotHadFocus) this.#focusCurrentDot();
	}

	#currentIndex(): number {
		const slides = this.#slides();
		const value = this.#resolvedValue();
		const idx = slides.findIndex((s) => s.getAttribute("value") === value);
		return idx >= 0 ? idx : 0;
	}

	#onClick = (e: MouseEvent) => {
		const target = e.target as Element | null;
		if (!target) return;
		const prev = target.closest<HTMLElement>("[data-neo-carousel-prev]");
		if (prev) {
			e.preventDefault();
			if (this.#isControlDisabled(prev)) return;
			this.prev();
			return;
		}
		const next = target.closest<HTMLElement>("[data-neo-carousel-next]");
		if (next) {
			e.preventDefault();
			if (this.#isControlDisabled(next)) return;
			this.next();
			return;
		}
		const pause = target.closest<HTMLElement>("[data-neo-carousel-pause]");
		if (pause) {
			if (this.#autoplayInterval === null) return;
			e.preventDefault();
			if (boolAttr(this, "paused", false)) this.removeAttribute("paused");
			else this.setAttribute("paused", "");
			return;
		}
		// Dots live in this.shadowRoot, so the event retargets to the host
		// before reaching this listener; composedPath()[0] is still the
		// original click target.
		const inner = e.composedPath()[0];
		if (inner instanceof Element) {
			const dotCandidate = inner.closest<HTMLElement>("[data-neo-carousel-dot]");
			const dot = dotCandidate && dotCandidate.getRootNode() === this.shadowRoot ? dotCandidate : null;
			if (dot) {
				const v = (dot as HTMLButtonElement).dataset.value;
				if (v !== undefined && v !== null) this.#navSetValue(v);
				return;
			}
		}
		if (boolAttr(this, "click-nav", false)) {
			// Drag-then-release fires click; ignore those so a mouse drag
			// doesn't double as a slide activation.
			if (this.#dragMoved) return;
			// Skip clicks on interactive content inside a slide so links,
			// buttons, form fields keep their normal click semantics.
			if (target.closest("a, button, input, textarea, select, [contenteditable]")) return;
			const slide = target.closest<HTMLElement>("neo-carousel-slide");
			if (slide && slide.parentElement === this.#track()) {
				const v = slide.getAttribute("value");
				if (v !== null && v !== this.getAttribute("value")) {
					this.#navSetValue(v);
				}
			}
		}
	};

	// Mouse / pen drag-to-scroll under `drag-nav`. Touch handled
	// natively. snap and scroll-behavior are suspended only after
	// movement crosses the threshold (see onPointerMove).
	#dragState: null | {
		x: number;
		y: number;
		left: number;
		top: number;
		pointerId: number;
		captured: boolean;
	} = null;
	#dragMoved = false;
	#dragSavedSnap = "";
	#dragSavedBehavior = "";

	#onDragStart = (e: DragEvent) => {
		if (!boolAttr(this, "drag-nav", false)) return;
		if (!boolAttr(this, "touch", true)) return;
		const target = e.target as Element | null;
		if (!target) return;
		if (!this.#track()?.contains(target)) return;
		e.preventDefault();
	};

	#onPointerDown = (e: PointerEvent) => {
		if (!boolAttr(this, "drag-nav", false)) return;
		if (!boolAttr(this, "touch", true)) return;
		if (e.pointerType === "touch") return;
		if (e.button !== 0) return;
		const target = e.target as Element | null;
		if (!target) return;
		if (target.closest("a, button, input, textarea, select, [contenteditable], [data-neo-carousel-dot]")) return;
		const track = this.#track();
		if (!track?.contains(target)) return;
		this.#dragState = {
			x: e.clientX,
			y: e.clientY,
			left: track.scrollLeft,
			top: track.scrollTop,
			pointerId: e.pointerId,
			captured: false,
		};
		this.#dragMoved = false;
		// Defer pointer capture + snap/behavior suspension until the user
		// actually moves past the threshold. Capturing on pointerdown
		// would retarget the post-pointerup click event onto the track,
		// making click-nav's `closest("neo-carousel-slide")` lookup miss.
	};

	#onPointerMove = (e: PointerEvent) => {
		const ds = this.#dragState;
		if (!ds || ds.pointerId !== e.pointerId) return;
		// Primary button no longer down: a pointerup landed outside the
		// host (a fast swipe that left the carousel before pointer capture
		// engaged), so onPointerEnd never ran. Tear the stale drag down
		// here instead of resuming it on this unrelated move.
		if (!(e.buttons & 1)) {
			this.#onPointerEnd(e);
			return;
		}
		const track = this.#track();
		if (!track) return;
		const dx = e.clientX - ds.x;
		const dy = e.clientY - ds.y;
		if (!this.#dragMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
			this.#dragMoved = true;
			// Promote to a real drag now that we've crossed the threshold:
			// capture the pointer (so the drag survives leaving the track)
			// and suspend snap + smooth scroll-behavior so each scrollLeft
			// assignment is instant and doesn't get yanked to a snap point.
			this.#dragSavedSnap = track.style.scrollSnapType;
			this.#dragSavedBehavior = track.style.scrollBehavior;
			track.style.scrollSnapType = "none";
			track.style.scrollBehavior = "auto";
			track.setPointerCapture?.(e.pointerId);
			ds.captured = true;
		}
		if (!this.#dragMoved) return;
		if (this.getAttribute("orientation") === "vertical") {
			track.scrollTop = ds.top - dy;
		} else {
			track.scrollLeft = ds.left - dx;
		}
	};

	#onPointerEnd = (e: PointerEvent) => {
		const ds = this.#dragState;
		if (!ds || ds.pointerId !== e.pointerId) return;
		this.#dragState = null;
		const track = this.#track();
		if (track && ds.captured) {
			track.style.scrollSnapType = this.#dragSavedSnap;
			track.style.scrollBehavior = this.#dragSavedBehavior;
			track.releasePointerCapture?.(e.pointerId);
		}
		this.#dragSavedSnap = "";
		this.#dragSavedBehavior = "";
		if (this.#dragMoved) {
			// The drag suppressed onTrackScroll's settle timer, so settle
			// explicitly now: a post-drag scrollend never fires when the
			// release already sits on a snap point. endUserScroll resumes
			// the autoplay that the drag's beginUserScroll paused.
			this.#updateActiveFromScroll();
			this.#endUserScroll();
			// Clear in a microtask so the synthesised click that follows
			// pointerup hits the dragMoved guard in onClick.
			queueMicrotask(() => {
				this.#dragMoved = false;
			});
		}
	};

	// Keyboard nav fires when focus is on the host, the track (Tab lands
	// there because it carries the visible scroll viewport), or a dot
	// button. Slides themselves may contain arrow-key consumers (sliders,
	// textareas, etc.); we don't want to steal those. composedPath: dot
	// events retarget to the host before reaching this listener, so
	// e.target is the host; the path's innermost entry is still the dot.
	#onKeyDown = (e: KeyboardEvent) => {
		if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		const inner = e.composedPath()[0];
		if (!(inner instanceof Element)) return;
		const dotCandidate = inner.closest<HTMLElement>("[data-neo-carousel-dot]");
		const dot = dotCandidate && dotCandidate.getRootNode() === this.shadowRoot ? dotCandidate : null;
		const onDot = !!dot;
		const onTrack = inner === this.#track();
		const onHost = inner === this;
		if (!onHost && !onTrack && !onDot) return;

		const vertical = this.getAttribute("orientation") === "vertical";
		const prevKey = vertical ? "ArrowUp" : "ArrowLeft";
		const nextKey = vertical ? "ArrowDown" : "ArrowRight";

		if (onDot) {
			// Tablist semantics: arrow / Home / End move focus only. Enter or
			// Space commits the focused dot. `auto-activate` (mirrors neo-tabs)
			// commits during focus move as well.
			const autoActivate = boolAttr(this, "auto-activate", false);
			const dots = this.#dotButtons();
			const idx = dots.indexOf(dot as HTMLButtonElement);
			let target = -1;
			if (e.key === prevKey) target = idx <= 0 ? dots.length - 1 : idx - 1;
			else if (e.key === nextKey) target = idx >= dots.length - 1 ? 0 : idx + 1;
			else if (e.key === "Home") target = 0;
			else if (e.key === "End") target = dots.length - 1;
			else if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
				e.preventDefault();
				this.#commitDotValue((dot as HTMLButtonElement).dataset.value);
				return;
			} else {
				return;
			}
			e.preventDefault();
			this.#focusDotAt(target);
			if (autoActivate) {
				this.#commitDotValue(dots[target]?.dataset.value);
			}
			return;
		}

		// Focus on host or track: navigate slides directly. The track has
		// tabindex 0 so Tab lands there for native scroll; without this
		// branch arrow keys would scroll the track by ~40px instead of
		// advancing a whole slide.
		if (e.key === prevKey) {
			e.preventDefault();
			this.prev();
		} else if (e.key === nextKey) {
			e.preventDefault();
			this.next();
		} else if (e.key === "Home") {
			e.preventDefault();
			this.#commitIndex(0);
		} else if (e.key === "End") {
			e.preventDefault();
			this.#commitIndex(this.#slides().length - 1);
		} else if (e.key === " " || e.key === "Spacebar") {
			if (this.#autoplayInterval === null) return;
			e.preventDefault();
			if (boolAttr(this, "paused", false)) this.removeAttribute("paused");
			else this.setAttribute("paused", "");
		}
	};

	#dotButtons(): HTMLButtonElement[] {
		const host = this.#dotsHost();
		if (!host) return [];
		return Array.from(host.querySelectorAll<HTMLButtonElement>(":scope > button"));
	}

	// Focus a dot by index and rove tabindex so Tab returns to it later.
	#focusDotAt(idx: number) {
		const dots = this.#dotButtons();
		const target = dots[idx];
		if (!target) return;
		for (const b of dots) b.tabIndex = b === target ? 0 : -1;
		target.focus();
	}

	// Commit by slide value (used by dot Enter / Space and auto-activate).
	// Falls through to commitIndex so loop / clamp + change-event semantics
	// stay identical to a prev() / next() commit.
	#commitDotValue(v: string | undefined) {
		if (v === undefined || v === null) return;
		const slides = this.#slides();
		const idx = slides.findIndex((s, i) => (s.getAttribute("value") ?? String(i + 1)) === v);
		if (idx < 0) return;
		this.#commitIndex(idx);
	}

	// Transient autoplay pause during user scrolling. On settle the
	// timer restarts with a fresh full interval so the user gets the
	// whole window to read the slide they landed on. Internal-only;
	// doesn't surface as aria-pressed on pause buttons (sticky [paused]
	// does that).
	#userScrolling = false;

	#beginUserScroll() {
		if (this.#userScrolling) return;
		this.#userScrolling = true;
		if (this.#autoplayInterval === null) return;
		if (!this.hasAttribute("data-neo-carousel-interacting")) {
			this.setAttribute("data-neo-carousel-interacting", "");
		}
		// Cancel any pending tick and reset elapsed so the *resume* path
		// schedules a full interval, not a partial one.
		if (this.#autoplayTimer !== null) {
			window.clearTimeout(this.#autoplayTimer);
			this.#autoplayTimer = null;
		}
		this.#autoplayElapsed = 0;
	}

	#endUserScroll() {
		if (!this.#userScrolling) return;
		this.#userScrolling = false;
		if (this.hasAttribute("data-neo-carousel-interacting")) {
			this.removeAttribute("data-neo-carousel-interacting");
		}
		// Restart the active dot's fill animation from frame 0. The CSS
		// animation is tied to the [aria-current="true"] selector; the
		// bounce un-matches and re-matches the rule, which the engine
		// treats as a fresh animation application.
		this.#restartDotAnimation();
		// Schedule a new tick at full interval (autoplayElapsed is 0).
		this.#refreshAutoplay(true);
	}

	// Move focus to the dot that syncDotsCurrent just marked current
	// (aria-current="true", tabindex 0). No-op when there are no dots.
	#focusCurrentDot() {
		const host = this.#dotsHost();
		host?.querySelector<HTMLElement>('button[aria-current="true"]')?.focus();
	}

	#restartDotAnimation() {
		const host = this.#dotsHost();
		if (!host) return;
		const active = host.querySelector<HTMLElement>('button[aria-current="true"]');
		if (!active) return;
		active.removeAttribute("aria-current");
		void active.offsetWidth;
		active.setAttribute("aria-current", "true");
	}

	#refreshAutoplay(resetElapsed = false) {
		this.#stopAutoplay();
		if (resetElapsed) this.#autoplayElapsed = 0;
		this.#syncAutoplayDuration();
		this.#syncPauseButtons();
		if (boolAttr(this, "paused", false)) return;
		const interval = this.#autoplayInterval;
		if (interval === null) return;
		// remaining = interval - elapsed-before-pause; keeps the JS timer
		// and the CSS dot-fill animation synced across pause/resume.
		const remaining = Math.max(0, interval - this.#autoplayElapsed);
		this.#autoplayLastTickAt = performance.now();
		this.#autoplayTimer = window.setTimeout(() => {
			this.#autoplayTimer = null;
			this.#autoplayElapsed = 0;
			if (boolAttr(this, "paused", false) || this.#autoplayInterval === null) {
				return;
			}
			this.#autoplayNext();
		}, remaining);
	}

	#stopAutoplay() {
		if (this.#autoplayTimer !== null) {
			// Accumulate elapsed regardless of reason; the caller resets
			// it (via attributeChangedCallback for "value" / "autoplay")
			// when a fresh interval should start.
			this.#autoplayElapsed += performance.now() - this.#autoplayLastTickAt;
			window.clearTimeout(this.#autoplayTimer);
			this.#autoplayTimer = null;
		}
	}

	// Publish the autoplay interval as --neo-carousel-autoplay-interval
	// on a per-host <head> <style>. Inline style would be stripped by
	// Datastar fat-morphs and the dot animation would lose its duration.
	#syncAutoplayDuration() {
		if (!this.id) return;
		const styleId = `neo-carousel-autoplay-${this.id}`;
		let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
		const interval = this.#autoplayInterval;
		if (interval === null) {
			this.removeAttribute("data-neo-carousel-autoplay");
			styleEl?.remove();
			return;
		}
		this.setAttribute("data-neo-carousel-autoplay", "");
		if (!styleEl) {
			styleEl = document.createElement("style");
			styleEl.id = styleId;
			document.head.appendChild(styleEl);
		}
		const sel = `[id="${this.id.replace(/"/g, '\\"')}"]`;
		styleEl.textContent = `${sel} { --neo-carousel-autoplay-interval: ${interval}ms; }`;
	}

	get #autoplayInterval(): number | null {
		const raw = this.getAttribute("autoplay");
		if (raw === null) return null;
		const interval = parseInt(raw, 10);
		if (!Number.isFinite(interval) || interval <= 0) return null;
		return interval;
	}

	get #autoplayStep(): number {
		const perView = this.#numericPerView;
		if (perView <= 1) return 1;
		const raw = this.getAttribute("autoplay-step");
		if (raw === null) return 1;
		const step = parseInt(raw, 10);
		if (!Number.isFinite(step) || step <= 0) return 1;
		return step;
	}

	get #numericPerView(): number {
		const raw = this.getAttribute("per-view");
		if (raw === null || raw === "auto") return 1;
		const n = parseInt(raw, 10);
		return Number.isFinite(n) && n > 0 ? n : 1;
	}
}

// Track + slide markers: light-DOM author wrappers; behaviour lives on
// the host. Dots are not a light-DOM element; the host auto-renders
// them inside <neo-carousel>'s shadow root.
export class NeoCarouselTrack extends HTMLElement {}
export class NeoCarouselSlide extends HTMLElement {}

if (!customElements.get("neo-carousel")) {
	customElements.define("neo-carousel", NeoCarousel);
}
if (!customElements.get("neo-carousel-track")) {
	customElements.define("neo-carousel-track", NeoCarouselTrack);
}
if (!customElements.get("neo-carousel-slide")) {
	customElements.define("neo-carousel-slide", NeoCarouselSlide);
}
