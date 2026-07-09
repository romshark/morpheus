// <glitch-cycle-text>: cycles a list of phrases with a decorative
// scramble + chromatic-aberration flicker. The word rotation is
// content (kept under reduced motion); the scramble/flicker is
// decorative (dropped under reduced motion).

import { prefersReducedMotion, watchReducedMotion } from "./reduced-motion";

const glitchGlyphs = "01アイウエオカキクケコサシスセソABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&";

function randomGlitchGlyph(): string {
	return glitchGlyphs[Math.floor(Math.random() * glitchGlyphs.length)];
}

function fitGlitchTextLength(value: string, length: number): string {
	return value.padEnd(length, " ").slice(0, length);
}

function randomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function readNumber(element: Element, name: string, fallback: number): number {
	const value = Number(element.getAttribute(name));
	return Number.isFinite(value) ? value : fallback;
}

class GlitchCycleText extends HTMLElement {
	#textElement: HTMLElement;
	#glitchLayers: NodeListOf<HTMLElement>;
	#slotElement: HTMLSlotElement;

	#words: string[] = [];
	#wordIndex = 0;
	#intervalDelay = 2300;
	#frameDelay = 34;
	#frames = 28;
	#flickeringIntervalMin = 1200;
	#flickeringIntervalMax = 3600;
	#flickeringDurationMin = 80;
	#flickeringDurationMax = 220;
	#flickeringIntensityMin = 0.6;
	#flickeringIntensityMax = 1.5;

	#cycleTimer: number | undefined;
	#scrambleTimer: number | undefined;
	#scrambleGlitchTimer: number | undefined;
	#flickerDelayTimer: number | undefined;
	#flickerDurationTimer: number | undefined;
	#unwatchReducedMotion: (() => void) | null = null;
	#intersectionObserver: IntersectionObserver;
	// Whether any part of the title is in the viewport. Off-screen, all timers
	// and the CSS glitch animations are paused so an invisible hero title isn't
	// cycling text and flickering behind content the user isn't looking at.
	#onScreen = true;

	constructor() {
		super();

		this.#intersectionObserver = new IntersectionObserver((entries) => {
			this.#onScreen = entries[entries.length - 1].isIntersecting;
			this.#syncPlayback();
		});

		const root = this.attachShadow({ mode: "open" });
		root.innerHTML = `
      <style>
        :host {
          position: relative;
          display: inline-grid;
          white-space: nowrap;
          /* Host line-height (1/1.05 on .landing-brand/.landing-slogan)
           * cascades into the shadow DOM and clips g/j/p/y descenders
           * at multi-rem font-size. 1.15 is the smallest value that
           * keeps them inside the box across all cycled phrases. */
          line-height: 1.15;
        }

        .text,
        .glitch {
          grid-area: 1 / 1;
          display: inline-block;
          width: var(--glitch-text-width, 17ch);
          max-width: 100%;
          overflow: visible;
          white-space: nowrap;
        }

        .glitch {
          pointer-events: none;
          opacity: 0;
        }

        .glitch-left {
          color: #ff3f7f;
          transform: translateX(calc(var(--glitch-shift, 0.035em) * -1));
        }

        .glitch-right {
          color: var(--cyan, #6ef7ff);
          transform: translateX(var(--glitch-shift, 0.035em));
        }

        :host(.is-scrambling) .glitch-left,
        :host(.is-flickering) .glitch-left {
          animation: glitch-left 120ms steps(2, end) infinite;
        }

        :host(.is-scrambling) .glitch-right,
        :host(.is-flickering) .glitch-right {
          animation: glitch-right 150ms steps(2, end) infinite;
        }

        @keyframes glitch-left {
          0%,
          100% {
            clip-path: inset(0 0 82% 0);
            opacity: calc(0.82 * var(--glitch-opacity, 1));
          }

          35% {
            clip-path: inset(36% 0 46% 0);
          }

          70% {
            clip-path: inset(74% 0 4% 0);
          }
        }

        @keyframes glitch-right {
          0%,
          100% {
            clip-path: inset(72% 0 8% 0);
            opacity: calc(0.72 * var(--glitch-opacity, 1));
          }

          42% {
            clip-path: inset(12% 0 70% 0);
          }

          78% {
            clip-path: inset(46% 0 28% 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          :host(.is-scrambling) .glitch-left,
          :host(.is-scrambling) .glitch-right,
          :host(.is-flickering) .glitch-left,
          :host(.is-flickering) .glitch-right {
            animation: none;
          }
        }
      </style>
      <span class="text" part="text"></span>
      <span class="glitch glitch-left" aria-hidden="true"></span>
      <span class="glitch glitch-right" aria-hidden="true"></span>
      <slot hidden></slot>
    `;

		this.#textElement = root.querySelector(".text")!;
		this.#glitchLayers = root.querySelectorAll<HTMLElement>(".glitch");
		this.#slotElement = root.querySelector("slot")!;
	}

	connectedCallback() {
		window.clearInterval(this.#cycleTimer);
		window.clearInterval(this.#scrambleTimer);
		window.clearTimeout(this.#scrambleGlitchTimer);
		window.clearTimeout(this.#flickerDelayTimer);
		window.clearTimeout(this.#flickerDurationTimer);
		this.#cycleTimer = undefined;

		this.#words = this.#readWords();
		this.#intervalDelay = Number(this.getAttribute("interval")) || 2300;
		this.#frameDelay = Number(this.getAttribute("frame-delay")) || 34;
		this.#frames = Number(this.getAttribute("frames")) || 28;
		this.#flickeringIntervalMin = readNumber(this, "flickering-interval-min", 1200);
		this.#flickeringIntervalMax = readNumber(this, "flickering-interval-max", 3600);
		this.#flickeringDurationMin = readNumber(this, "flickering-duration-min", 80);
		this.#flickeringDurationMax = readNumber(this, "flickering-duration-max", 220);
		this.#flickeringIntensityMin = readNumber(this, "flickering-intensity-min", 0.6);
		this.#flickeringIntensityMax = readNumber(this, "flickering-intensity-max", 1.5);
		this.#wordIndex = 0;

		if (this.#words.length === 0) {
			this.#words = ["Server-Driven"];
		}

		this.#setText(this.#words[0]);

		this.#intersectionObserver.observe(this);
		this.#unwatchReducedMotion = watchReducedMotion(() => this.#syncPlayback());
		this.#syncPlayback();
	}

	disconnectedCallback() {
		window.clearInterval(this.#cycleTimer);
		window.clearInterval(this.#scrambleTimer);
		window.clearTimeout(this.#scrambleGlitchTimer);
		window.clearTimeout(this.#flickerDelayTimer);
		window.clearTimeout(this.#flickerDurationTimer);
		this.#intersectionObserver.disconnect();
		this.#unwatchReducedMotion?.();
		this.#unwatchReducedMotion = null;
	}

	// Reconcile all animation with visibility and reduced motion. Driven by the
	// intersection observer (scroll) and reduced-motion changes.
	//   - Word rotation is content: it runs while on-screen, regardless of
	//     motion (#cyclePhrase swaps outright under reduced motion).
	//   - The scramble + flicker are decorative: they additionally require
	//     motion, and stop off-screen or under reduced motion.
	#syncPlayback() {
		if (this.#onScreen && this.#words.length > 1) {
			if (this.#cycleTimer === undefined) {
				this.#cycleTimer = window.setInterval(() => this.#cyclePhrase(), this.#intervalDelay);
			}
		} else {
			window.clearInterval(this.#cycleTimer);
			this.#cycleTimer = undefined;
		}
		if (this.#onScreen && !prefersReducedMotion()) this.#scheduleFlicker();
		else this.#stopDecorative();
	}

	// Kill any in-flight scramble/flicker and settle to the current word, so a
	// pause (off-screen) or a reduced-motion flip lands clean.
	#stopDecorative() {
		window.clearInterval(this.#scrambleTimer);
		window.clearTimeout(this.#scrambleGlitchTimer);
		window.clearTimeout(this.#flickerDelayTimer);
		window.clearTimeout(this.#flickerDurationTimer);
		this.classList.remove("is-scrambling");
		this.classList.remove("is-flickering");
		this.style.removeProperty("--glitch-shift");
		this.style.removeProperty("--glitch-opacity");
		this.#setText(this.#words[this.#wordIndex]);
	}

	#readWords(): string[] {
		const slottedWords = this.#slotElement
			.assignedNodes({ flatten: true })
			.map((node) => (node.textContent ?? "").trim())
			.filter(Boolean);

		if (slottedWords.length > 0) {
			return slottedWords;
		}

		const attributeWords = (this.getAttribute("words") || "")
			.split("|")
			.map((word) => word.trim())
			.filter(Boolean);

		if (attributeWords.length > 0) {
			return attributeWords;
		}

		const fallbackText = (this.textContent ?? "").trim();
		return fallbackText ? [fallbackText] : ["Server-Driven"];
	}

	#setText(text: string) {
		this.#textElement.textContent = text;
		this.#glitchLayers.forEach((layer) => {
			layer.textContent = text;
		});
		// Intentionally NOT setting `this.dataset.text = text`; Datastar
		// 1.0 reads `data-text` as a directive and would try to evaluate
		// the visible word as a JS expression (e.g. `MORPHEUS` -> ReferenceError).
	}

	#cyclePhrase() {
		this.#wordIndex = (this.#wordIndex + 1) % this.#words.length;
		// Reduced motion: swap outright. The scramble is decorative;
		// the word rotation itself is content, so it stays.
		if (prefersReducedMotion()) {
			this.#setText(this.#words[this.#wordIndex]);
			return;
		}
		this.#scrambleTo(this.#words[this.#wordIndex]);
	}

	#scrambleTo(nextText: string) {
		const from = this.#textElement.textContent?.trimEnd() ?? "";
		const length = Math.max(from.length, nextText.length);
		const target = fitGlitchTextLength(nextText, length);
		let frame = 0;

		window.clearInterval(this.#scrambleTimer);
		window.clearTimeout(this.#scrambleGlitchTimer);
		this.classList.add("is-scrambling");

		this.#scrambleTimer = window.setInterval(() => {
			const progress = frame / this.#frames;
			const stableCount = Math.floor(progress * length);
			let output = "";

			for (let index = 0; index < length; index += 1) {
				output += index < stableCount ? target[index] : randomGlitchGlyph();
			}

			this.#setText(output);
			frame += 1;

			if (frame > this.#frames) {
				window.clearInterval(this.#scrambleTimer);
				this.#setText(nextText);
				this.#scrambleGlitchTimer = window.setTimeout(() => this.classList.remove("is-scrambling"), 180);
			}
		}, this.#frameDelay);
	}

	#scheduleFlicker() {
		const intervalMin = Math.max(0, this.#flickeringIntervalMin);
		const intervalMax = Math.max(intervalMin, this.#flickeringIntervalMax);

		if (intervalMax === 0) {
			return;
		}

		// The flicker is decorative chromatic-aberration; nothing to
		// schedule under reduced motion.
		if (prefersReducedMotion()) {
			return;
		}

		window.clearTimeout(this.#flickerDelayTimer);
		this.#flickerDelayTimer = window.setTimeout(() => this.#startFlicker(), randomBetween(intervalMin, intervalMax));
	}

	#startFlicker() {
		const durationMin = Math.max(0, this.#flickeringDurationMin);
		const durationMax = Math.max(durationMin, this.#flickeringDurationMax);
		const intensityMin = Math.max(0, this.#flickeringIntensityMin);
		const intensityMax = Math.max(intensityMin, this.#flickeringIntensityMax);
		const intensity = randomBetween(intensityMin, intensityMax);

		this.style.setProperty("--glitch-shift", `${0.035 * intensity}em`);
		this.style.setProperty("--glitch-opacity", String(Math.min(intensity, 1.6)));
		this.classList.add("is-flickering");
		window.clearTimeout(this.#flickerDurationTimer);
		this.#flickerDurationTimer = window.setTimeout(
			() => {
				this.classList.remove("is-flickering");
				this.style.removeProperty("--glitch-shift");
				this.style.removeProperty("--glitch-opacity");
				this.#scheduleFlicker();
			},
			randomBetween(durationMin, durationMax),
		);
	}
}

if (!customElements.get("glitch-cycle-text")) {
	customElements.define("glitch-cycle-text", GlitchCycleText);
}
