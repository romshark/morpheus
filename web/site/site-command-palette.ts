// <site-command-palette>: the docs site's ⌘K/Ctrl+K page jumper.
//
// Pure client-side: the row list is baked into light DOM at render time
// (one <a> per site page), so navigation works without JS. This
// controller adds fuzzy filtering, ranking, keyboard navigation, and the
// ARIA combobox/listbox wiring on top.
//
// Markup (rendered by siteCommandPalette() in site.templ):
//
//   <site-command-palette>
//     <neo-dialog>
//       <neo-button data-neo-dialog-trigger>…⌘K…</neo-button>
//       <dialog>
//         <header data-neo-dialog-header>
//           <input role="combobox" data-site-cmdk-input>
//         </header>
//         <div role="listbox" data-site-cmdk-list>
//           <a role="option" data-site-cmdk-row data-label="Alert">…</a>
//           …
//           <p data-site-cmdk-empty hidden>…</p>
//         </div>
//       </dialog>
//     </neo-dialog>
//   </site-command-palette>
//
// The <neo-dialog> owns the modal lifecycle (top layer, focus trap,
// scroll lock, Escape-to-close); this element only opens it on the
// global shortcut and drives the result list.

interface FuzzyResult {
	score: number;
	// Half-open [start, end) ranges of matched chars in the label,
	// merged so adjacent hits highlight as one <mark>.
	ranges: [number, number][];
}

// Greedy subsequence match with Sublime/fzf-style bonuses: word-start
// hits and consecutive runs score higher, longer labels score slightly
// lower. Greedy is enough to *detect* a subsequence; the scoring just
// orders the matches sensibly for short nav labels. Returns null when
// the query isn't a subsequence of the text.
function fuzzyMatch(query: string, text: string): FuzzyResult | null {
	if (query === "") return { score: 0, ranges: [] };
	const q = query.toLowerCase();
	const t = text.toLowerCase();
	const ranges: [number, number][] = [];
	let qi = 0;
	let score = 0;
	let run = 0;
	let prevHit = -2;
	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] !== q[qi]) {
			run = 0;
			continue;
		}
		let bonus = 1;
		const prev = t[ti - 1];
		const wordStart = ti === 0 || prev === " " || prev === "-" || prev === "/" || prev === "_";
		if (wordStart) bonus += 8;
		if (ti === prevHit + 1) {
			run++;
			bonus += run * 4;
		} else {
			run = 1;
		}
		score += bonus;
		const last = ranges[ranges.length - 1];
		if (last && last[1] === ti) last[1] = ti + 1;
		else ranges.push([ti, ti + 1]);
		prevHit = ti;
		qi++;
	}
	if (qi < q.length) return null;
	// Tie-break toward shorter, more specific labels.
	score -= text.length * 0.1;
	return { score, ranges };
}

const ESCAPE_HTML: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
};

function escapeHTML(s: string): string {
	return s.replace(/[&<>]/g, (c) => ESCAPE_HTML[c]);
}

// Rebuild a label with matched ranges wrapped in <mark>. The label is
// repository-authored; only its own characters are re-emitted (the query
// is never interpolated), so this is injection-safe.
function highlight(label: string, ranges: [number, number][]): string {
	if (ranges.length === 0) return escapeHTML(label);
	let out = "";
	let i = 0;
	for (const [start, end] of ranges) {
		out += escapeHTML(label.slice(i, start));
		out += `<mark>${escapeHTML(label.slice(start, end))}</mark>`;
		i = end;
	}
	return out + escapeHTML(label.slice(i));
}

class SiteCommandPalette extends HTMLElement {
	#dialog: HTMLElement | null = null; // the <neo-dialog>
	// The search button. Its visibility proxies the sidebar's rendered
	// state; it's display:none in overlay mode, when the modal can't open.
	#trigger: HTMLElement | null = null;
	#input: HTMLInputElement | null = null;
	#list: HTMLElement | null = null;
	#empty: HTMLElement | null = null;
	// All rows in their baked order; never re-queried after connect since
	// the list is static.
	#rows: HTMLAnchorElement[] = [];
	#labels: string[] = [];
	#labelSpans: HTMLElement[] = [];
	// Rows currently shown, in display order; arrow keys walk this.
	#visible: HTMLAnchorElement[] = [];
	#activeIndex = -1;
	#wired = false;

	connectedCallback(): void {
		this.#resolve();
		// The global shortcut is bound once for the element's lifetime; the
		// rest of the wiring is idempotent so a DOM morph can't double-bind.
		if (!this.#wired) {
			window.addEventListener("keydown", this.#onGlobalKey);
			this.#wired = true;
		}
	}

	disconnectedCallback(): void {
		window.removeEventListener("keydown", this.#onGlobalKey);
		this.#wired = false;
	}

	#resolve(): void {
		const dialog = this.querySelector<HTMLElement>("neo-dialog");
		const input = this.querySelector<HTMLInputElement>("[data-site-cmdk-input]");
		const list = this.querySelector<HTMLElement>("[data-site-cmdk-list]");
		if (!dialog || !input || !list) return;

		this.#dialog = dialog;
		this.#trigger = dialog.querySelector<HTMLElement>("[data-neo-dialog-trigger]");
		this.#empty = list.querySelector<HTMLElement>("[data-site-cmdk-empty]");

		if (input !== this.#input) {
			input?.removeEventListener("input", this.#onInput);
			input.addEventListener("input", this.#onInput);
			input.addEventListener("keydown", this.#onInputKey);
			this.#input = input;
		}
		if (list !== this.#list) {
			list.addEventListener("pointermove", this.#onPointerMove);
			this.#list = list;
		}
		// neo-dialog-open fires on both trigger click and the ⌘K path.
		this.addEventListener("neo-dialog-open", this.#onOpen);

		this.#rows = Array.from(list.querySelectorAll<HTMLAnchorElement>("[data-site-cmdk-row]"));
		this.#labels = this.#rows.map((r) => r.dataset.label ?? r.textContent?.trim() ?? "");
		this.#labelSpans = this.#rows.map((r) => r.querySelector<HTMLElement>("[data-site-cmdk-label]") ?? r);
		// The shortcut hint (platform glyph + touch-hide) is owned by the
		// <neo-kbd key="mod"> + <neo-kbd key="k"> in the trigger; nothing
		// to do here.
	}

	#onGlobalKey = (e: KeyboardEvent): void => {
		if (!(e.key === "k" || e.key === "K") || !(e.metaKey || e.ctrlKey)) return;
		if (e.altKey) return;
		e.preventDefault();
		// The palette lives in the collapsible sidebar; when that's closed
		// (display:none in overlay mode) the modal can't render, so showModal
		// would enter a broken invisible state. Gate on the trigger, not the
		// host: the host is display:contents (no box), so its own
		// checkVisibility() is always false and would kill ⌘K everywhere.
		if (this.#trigger?.checkVisibility && !this.#trigger.checkVisibility()) return;
		(this.#dialog as { show?: () => void } | null)?.show?.();
	};

	#onOpen = (): void => {
		if (!this.#input) return;
		this.#input.value = "";
		this.#filter("");
		// showModal lands focus on the first focusable (the input), but
		// re-focus explicitly so the caret is ready after the ⌘K path too.
		requestAnimationFrame(() => this.#input?.focus());
	};

	#onInput = (): void => {
		this.#filter(this.#input?.value ?? "");
	};

	#filter(query: string): void {
		if (!this.#list) return;
		const q = query.trim();

		const scored: { row: HTMLAnchorElement; i: number; score: number; ranges: [number, number][] }[] = [];
		const hidden: HTMLAnchorElement[] = [];
		this.#rows.forEach((row, i) => {
			const m = fuzzyMatch(q, this.#labels[i]);
			if (m) scored.push({ row, i, score: m.score, ranges: m.ranges });
			else hidden.push(row);
		});

		// Empty query keeps the baked order; otherwise rank by score with
		// the original index as a stable tie-break.
		if (q !== "") scored.sort((a, b) => b.score - a.score || a.i - b.i);

		for (const { row, i, ranges } of scored) {
			row.hidden = false;
			this.#labelSpans[i].innerHTML = highlight(this.#labels[i], ranges);
			this.#list.appendChild(row);
		}
		for (const row of hidden) {
			row.hidden = true;
			row.setAttribute("aria-selected", "false");
		}
		// Keep the empty-state node last in the list.
		if (this.#empty) {
			this.#list.appendChild(this.#empty);
			this.#empty.hidden = scored.length > 0;
		}

		this.#visible = scored.map((s) => s.row);
		this.#setActive(this.#visible.length ? 0 : -1, false);
	}

	#setActive(index: number, scroll = true): void {
		this.#activeIndex = index;
		const active = index >= 0 ? this.#visible[index] : null;
		for (const row of this.#visible) {
			row.setAttribute("aria-selected", row === active ? "true" : "false");
		}
		this.#input?.setAttribute("aria-activedescendant", active?.id ?? "");
		if (active && scroll) active.scrollIntoView({ block: "nearest" });
	}

	#onInputKey = (e: KeyboardEvent): void => {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				if (this.#visible.length) {
					this.#setActive(Math.min(this.#activeIndex + 1, this.#visible.length - 1));
				}
				break;
			case "ArrowUp":
				e.preventDefault();
				if (this.#visible.length) this.#setActive(Math.max(this.#activeIndex - 1, 0));
				break;
			case "Home":
				if (this.#visible.length) {
					e.preventDefault();
					this.#setActive(0);
				}
				break;
			case "End":
				if (this.#visible.length) {
					e.preventDefault();
					this.#setActive(this.#visible.length - 1);
				}
				break;
			case "Enter": {
				const active = this.#visible[this.#activeIndex];
				if (active) {
					e.preventDefault();
					active.click();
				}
				break;
			}
			case "Tab":
				// Pin focus to the field: the only other focus stop in the
				// modal is the (now tabindex=-1) scroller, so Tab has nowhere
				// useful to go. Keeps the combobox the sole focus target.
				e.preventDefault();
				break;
			// Escape is handled by the native <dialog> (cancel → neo-dialog).
		}
	};

	#onPointerMove = (e: PointerEvent): void => {
		const row = (e.target as Element | null)?.closest<HTMLAnchorElement>("[data-site-cmdk-row]");
		if (!row || row.hidden) return;
		const i = this.#visible.indexOf(row);
		if (i >= 0 && i !== this.#activeIndex) this.#setActive(i, false);
	};
}

customElements.define("site-command-palette", SiteCommandPalette);
