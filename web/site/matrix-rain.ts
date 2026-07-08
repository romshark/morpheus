// <matrix-rain>: decorative falling-glyph canvas for the landing
// backdrop. Pure visual; pointer-events:none, hidden entirely under
// reduced motion (the loop is torn down, not just paused).

import { prefersReducedMotion, watchReducedMotion } from "./reduced-motion";

const defaultMatrixChars = "日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function readMatrixNumber(element: Element, name: string, fallback: number): number {
	const value = Number(element.getAttribute(name));
	return Number.isFinite(value) ? value : fallback;
}

function readMatrixColor(element: Element, name: string, fallback: string): string {
	return element.getAttribute(name) || fallback;
}

function matrixRandomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function matrixRandomItem<T>(items: readonly T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}

interface MatrixOptions {
	chars: string[];
	fontSize: number;
	columnGap: number;
	density: number;
	fps: number;
	speedMin: number;
	speedMax: number;
	trailMin: number;
	trailMax: number;
	fadeOpacity: number;
	headColor: string;
	bodyColor: string;
	dimColor: string;
	glow: number;
	blur: number;
	mutateRate: number;
	maxFallRatio: number;
	maxFallHeight: number;
	fallVariance: number;
}

interface MatrixColumn {
	x: number;
	row: number;
	speed: number;
	trail: number;
	active: boolean;
	elapsed: number;
	fallLimit: number;
	cells: Map<number, string>;
}

class MatrixRain extends HTMLElement {
	static observedAttributes = [
		"charset",
		"font-size",
		"column-gap",
		"density",
		"fps",
		"speed-min",
		"speed-max",
		"trail-min",
		"trail-max",
		"fade-opacity",
		"head-color",
		"body-color",
		"dim-color",
		"glow",
		"blur",
		"mutate-rate",
		"max-fall-ratio",
		"max-fall-height",
		"fall-variance",
	];

	#canvas: HTMLCanvasElement;
	#context: CanvasRenderingContext2D;
	#columns: MatrixColumn[] = [];
	#lastFrameTime = 0;
	#resizeObserver: ResizeObserver;
	#unwatchReducedMotion: (() => void) | null = null;
	#animationFrame = 0;
	#options!: MatrixOptions;
	#width!: number;
	#height!: number;
	#fallLimit!: number;
	#cellHeight!: number;
	#columnStep!: number;
	#rowCount!: number;

	constructor() {
		super();

		const root = this.attachShadow({ mode: "open" });
		root.innerHTML = `
      <style>
        :host {
          display: block;
          contain: strict;
          overflow: hidden;
          pointer-events: none;
        }

        canvas {
          display: block;
          width: 100%;
          height: 100%;
        }
      </style>
      <canvas part="canvas"></canvas>
    `;

		this.#canvas = root.querySelector("canvas")!;
		this.#context = this.#canvas.getContext("2d", { alpha: true })!;
		this.#resizeObserver = new ResizeObserver(() => this.#resize());
	}

	connectedCallback() {
		this.#readOptions();
		this.#resizeObserver.observe(this);
		this.#unwatchReducedMotion = watchReducedMotion(() => this.#applyReducedMotion());
		this.#applyReducedMotion();
	}

	disconnectedCallback() {
		this.#stop();
		this.#resizeObserver.disconnect();
		this.#unwatchReducedMotion?.();
		this.#unwatchReducedMotion = null;
	}

	// Decorative-only: under reduced motion, hide the host and tear
	// down the canvas loop entirely (not just pause).
	#applyReducedMotion() {
		if (prefersReducedMotion()) {
			this.#stop();
			this.style.display = "none";
			return;
		}
		this.style.display = "";
		this.#resize();
		this.#start();
	}

	attributeChangedCallback() {
		if (!this.isConnected) {
			return;
		}

		this.#readOptions();
		this.#resize();
	}

	#readOptions() {
		const charset = this.getAttribute("charset") || defaultMatrixChars;

		this.#options = {
			chars: Array.from(charset),
			fontSize: readMatrixNumber(this, "font-size", 18),
			columnGap: readMatrixNumber(this, "column-gap", 1),
			density: readMatrixNumber(this, "density", 0.88),
			fps: readMatrixNumber(this, "fps", 30),
			speedMin: readMatrixNumber(this, "speed-min", 8),
			speedMax: readMatrixNumber(this, "speed-max", 24),
			trailMin: readMatrixNumber(this, "trail-min", 9),
			trailMax: readMatrixNumber(this, "trail-max", 28),
			fadeOpacity: readMatrixNumber(this, "fade-opacity", 0.09),
			headColor: readMatrixColor(this, "head-color", "#eafff2"),
			bodyColor: readMatrixColor(this, "body-color", "#00ff8a"),
			dimColor: readMatrixColor(this, "dim-color", "#047a43"),
			glow: readMatrixNumber(this, "glow", 12),
			blur: readMatrixNumber(this, "blur", 0),
			mutateRate: readMatrixNumber(this, "mutate-rate", 0.035),
			maxFallRatio: readMatrixNumber(this, "max-fall-ratio", 0.72),
			maxFallHeight: readMatrixNumber(this, "max-fall-height", 0),
			fallVariance: readMatrixNumber(this, "fall-variance", 0.18),
		};

		if (this.#options.chars.length === 0) {
			this.#options.chars = Array.from(defaultMatrixChars);
		}
	}

	#resize() {
		const rect = this.getBoundingClientRect();
		const width = Math.max(1, rect.width);
		const height = Math.max(1, rect.height);
		const ratio = Math.min(window.devicePixelRatio || 1, 2);

		this.#canvas.width = Math.floor(width * ratio);
		this.#canvas.height = Math.floor(height * ratio);
		this.#canvas.style.width = `${width}px`;
		this.#canvas.style.height = `${height}px`;
		this.#context.setTransform(ratio, 0, 0, ratio, 0, 0);
		this.#width = width;
		this.#height = height;
		this.#fallLimit = this.#resolveFallLimit();

		this.#createColumns();
		this.#clear();
	}

	#resolveFallLimit(): number {
		if (this.#options.maxFallHeight > 0) {
			return Math.min(this.#height, this.#options.maxFallHeight);
		}

		return this.#height * Math.max(0.05, Math.min(this.#options.maxFallRatio, 1));
	}

	#createColumns() {
		this.#cellHeight = Math.max(4, this.#options.fontSize);
		this.#columnStep = Math.max(4, this.#options.fontSize + this.#options.columnGap);
		this.#rowCount = Math.ceil(this.#fallLimit / this.#cellHeight) + 2;
		const count = Math.ceil(this.#width / this.#columnStep);

		this.#columns = Array.from({ length: count }, (_, index) => {
			const active = Math.random() <= this.#options.density;
			const x = index * this.#columnStep + matrixRandomBetween(-this.#columnStep * 0.12, this.#columnStep * 0.12);

			return this.#createColumn(x, active);
		});
	}

	#createColumn(x: number, active = true): MatrixColumn {
		const trail = Math.round(matrixRandomBetween(this.#options.trailMin, this.#options.trailMax));

		return {
			x,
			row: this.#randomTopStartRow(),
			speed: matrixRandomBetween(this.#options.speedMin, this.#options.speedMax),
			trail,
			active,
			elapsed: 0,
			fallLimit: this.#randomColumnFallLimit(),
			cells: new Map(),
		};
	}

	#randomTopStartRow(): number {
		return Math.floor(matrixRandomBetween(-this.#rowCount, 0));
	}

	#randomColumnFallLimit(): number {
		const variance = Math.max(0, this.#options.fallVariance);
		const min = this.#fallLimit * Math.max(0.05, 1 - variance);
		const max = Math.min(this.#height, this.#fallLimit * (1 + variance));

		return matrixRandomBetween(min, max);
	}

	#start() {
		this.#stop();

		// Host is display:none under reduced motion (applyReducedMotion);
		// don't schedule a rAF that paints into nothing.
		if (prefersReducedMotion()) {
			return;
		}

		this.#animationFrame = requestAnimationFrame((time) => this.#tick(time));
	}

	#stop() {
		cancelAnimationFrame(this.#animationFrame);
	}

	#tick(time: number) {
		const frameInterval = 1000 / Math.max(1, this.#options.fps);

		if (time - this.#lastFrameTime >= frameInterval) {
			this.#lastFrameTime = time;
			this.#drawFrame();
		}

		this.#animationFrame = requestAnimationFrame((nextTime) => this.#tick(nextTime));
	}

	#clear() {
		this.#context.clearRect(0, 0, this.#width, this.#height);
	}

	// destination-out, not source-over fade-to-bg. Fading toward
	// --page-bg leaves a faint seam where the rain ends: iterative
	// fillRect rounding lands the canvas ±1 off the body and the host
	// opacity compounds it. Erasing to transparent has no seam.
	#fadePreviousFrame() {
		this.#context.save();
		this.#context.globalCompositeOperation = "destination-out";
		this.#context.fillStyle = `rgba(0, 0, 0, ${this.#options.fadeOpacity})`;
		this.#context.fillRect(0, 0, this.#width, this.#height);
		this.#context.restore();
	}

	#drawFrame() {
		this.#fadePreviousFrame();
		this.#context.font = `${this.#options.fontSize}px "Roboto Mono", "SFMono-Regular", Consolas, monospace`;
		this.#context.textAlign = "center";
		this.#context.textBaseline = "top";

		this.#columns.forEach((column) => {
			if (!column.active) {
				return;
			}

			this.#advanceColumn(column);
			this.#drawColumn(column);
		});
	}

	#advanceColumn(column: MatrixColumn) {
		column.elapsed += column.speed;

		while (column.elapsed >= this.#cellHeight) {
			column.elapsed -= this.#cellHeight;
			column.row += 1;
			column.cells.set(column.row, matrixRandomItem(this.#options.chars));

			for (const row of column.cells.keys()) {
				if (row < column.row - column.trail) {
					column.cells.delete(row);
				}
			}

			if ((column.row - column.trail) * this.#cellHeight > column.fallLimit) {
				Object.assign(column, this.#createColumn(column.x, Math.random() <= this.#options.density));
				column.row = this.#randomTopStartRow();
				break;
			}
		}
	}

	#drawColumn(column: MatrixColumn) {
		for (const [row, char] of column.cells) {
			let glyph = char;

			if (Math.random() < this.#options.mutateRate) {
				glyph = matrixRandomItem(this.#options.chars);
				column.cells.set(row, glyph);
			}

			const y = row * this.#cellHeight;

			if (y < -this.#options.fontSize || y > column.fallLimit + this.#options.fontSize) {
				continue;
			}

			const distance = Math.max(0, column.row - row);
			const age = distance / Math.max(1, column.trail - 1);
			const alpha = Math.max(0, 1 - age);
			const isHead = distance === 0;

			this.#context.save();
			this.#context.globalAlpha = isHead ? 1 : alpha * 0.72;
			this.#context.fillStyle = isHead
				? this.#options.headColor
				: age > 0.72
					? this.#options.dimColor
					: this.#options.bodyColor;
			this.#context.shadowColor = this.#options.bodyColor;
			this.#context.shadowBlur = isHead ? this.#options.glow * 1.4 : this.#options.glow * alpha;
			this.#context.filter = this.#options.blur > 0 ? `blur(${this.#options.blur}px)` : "none";
			this.#context.fillText(glyph, column.x, y);
			this.#context.restore();
		}
	}
}

if (!customElements.get("matrix-rain")) {
	customElements.define("matrix-rain", MatrixRain);
}
