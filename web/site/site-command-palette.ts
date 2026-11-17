// <site-command-palette> is the docs site's Cmd+K/Ctrl+K page jumper.
//
// Pure client-side. Page rows are baked into light DOM at render time
// (1 <a> per site page), which makes navigation work without JS. Index
// rows, 1 per anchored heading and 1 per API table row (attribute, event,
// CSS variable, ...), come from the JSON at the `index` URL, fetched on
// first open, because thousands of baked rows would bloat every page.
// This controller adds matching, ranking, keyboard navigation, and the
// ARIA combobox/listbox wiring on top.
//
// Markup (rendered by siteCommandPalette() in site.templ):
//
//   <site-command-palette index="/static/search-index.json">
//     <neo-dialog>
//       <neo-button data-neo-dialog-trigger>...</neo-button>
//       <dialog>
//         <header data-neo-dialog-header>
//           <input role="combobox" data-site-cmdk-input>
//         </header>
//         <div role="listbox" data-site-cmdk-list>
//           <a role="option" data-site-cmdk-row data-label="Alert">...</a>
//           ...
//           <p data-site-cmdk-empty hidden>...</p>
//         </div>
//       </dialog>
//     </neo-dialog>
//   </site-command-palette>
//
// The <neo-dialog> owns the modal lifecycle (top layer, focus trap,
// scroll lock, Escape-to-close); this element only opens it on the
// global shortcut and manages the result list.

type Hit = [number, number];

interface Match {
	score: number;
	// Half-open [start, end) ranges of matched chars in the label,
	// merged so adjacent hits highlight as one <mark>.
	ranges: Hit[];
}

interface Entry {
	row: HTMLAnchorElement;
	labelSpan: HTMLElement;
	label: string;
	labelKey: string;
	// Lowercased group tag of an index row ("icon", "sortable › css
	// variables"), matched but not highlighted. Empty for page rows.
	contextKey: string;
	indexed: boolean;
}

// The JSON internal/cmd/gen writes. path matches a page row's href.
interface IndexPage {
	path: string;
	sections: {
		id: string;
		title: string;
		items?: { id: string; name: string }[];
	}[];
}

// Score tiers. The whole query as a substring of the label beats every
// query word found on its own, which beats a fuzzy subsequence. Within a
// tier, word starts and shorter labels rank higher.
const TIER_PHRASE = 3000;
const TIER_WORDS = 2000;
const TIER_FUZZY_MAX = 1000;
// Puts a page above an index row with an equally good label, e.g. the
// Icon page above the "Icon only" section of Button.
const PAGE_BONUS = 50;
// A short query such as "a" hits most of the index. Rendering thousands of
// rows per keystroke is slow and no one scrolls that far.
const MAX_RESULTS = 100;

function isWordStart(text: string, i: number): boolean {
	if (i === 0) return true;
	const prev = text[i - 1];
	return prev === " " || prev === "-" || prev === "/" || prev === "_" || prev === "<" || prev === "(";
}

// findWord returns the first index of needle in text that starts a word,
// else the first index anywhere, else -1.
function findWord(text: string, needle: string): number {
	let first = -1;
	for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) {
		if (isWordStart(text, i)) return i;
		if (first < 0) first = i;
	}
	return first;
}

function mergeRanges(ranges: Hit[]): Hit[] {
	ranges.sort((a, b) => a[0] - b[0]);
	const out: Hit[] = [];
	for (const [start, end] of ranges) {
		const last = out[out.length - 1];
		if (last && start <= last[1]) last[1] = Math.max(last[1], end);
		else out.push([start, end]);
	}
	return out;
}

function matchPhrase(label: string, q: string): Match | null {
	const at = findWord(label, q);
	if (at < 0) return null;
	let score = TIER_PHRASE;
	if (at === 0) score += 300;
	else if (isWordStart(label, at)) score += 200;
	if (label.length === q.length) score += 200;
	return { score, ranges: [[at, at + q.length]] };
}

// matchWords matches each query word on its own and in any order, against
// the label or the group tag of an index row. At least 1 word must hit the
// label, which keeps "icon" from listing every section of the Icon page
// while "icon prose" still finds Icon's "Inline in prose".
function matchWords(e: Entry, words: string[]): Match | null {
	let score = TIER_WORDS;
	let inLabel = false;
	const ranges: Hit[] = [];
	for (const w of words) {
		const at = findWord(e.labelKey, w);
		if (at >= 0) {
			inLabel = true;
			score += isWordStart(e.labelKey, at) ? 50 : 20;
			ranges.push([at, at + w.length]);
			continue;
		}
		const contextAt = findWord(e.contextKey, w);
		if (contextAt < 0) return null;
		score += isWordStart(e.contextKey, contextAt) ? 30 : 10;
	}
	return inLabel ? { score, ranges: mergeRanges(ranges) } : null;
}

// Greedy subsequence match with Sublime/fzf-style bonuses, for
// abbreviations like "rdgrp" -> "Radio group". Word-start hits and
// consecutive runs score higher. Greedy is enough to detect a
// subsequence; the scoring just orders the matches sensibly for short
// nav labels. Returns null when q isn't a subsequence of text.
function matchFuzzy(text: string, q: string): Match | null {
	const ranges: Hit[] = [];
	let qi = 0;
	let score = 0;
	let run = 0;
	let prevHit = -2;
	for (let ti = 0; ti < text.length && qi < q.length; ti++) {
		if (text[ti] !== q[qi]) {
			run = 0;
			continue;
		}
		let bonus = 1;
		if (isWordStart(text, ti)) bonus += 8;
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
	return { score: Math.min(score, TIER_FUZZY_MAX - 1), ranges };
}

// match scores entry e against the normalized query q and its words.
// Index rows skip the fuzzy tier. Across thousands of labels a
// subsequence of almost any query matches dozens of unrelated ones.
function match(e: Entry, q: string, words: string[]): Match | null {
	const m =
		matchPhrase(e.labelKey, q) ??
		(words.length > 1 ? matchWords(e, words) : null) ??
		(e.indexed ? null : matchFuzzy(e.labelKey, q));
	if (!m) return null;
	if (!e.indexed) m.score += PAGE_BONUS;
	m.score -= e.label.length * 0.1;
	return m;
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
// is never interpolated), which makes this injection-safe.
function highlight(label: string, ranges: Hit[]): string {
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
	// Baked page rows, re-queried on connect, and the rows built from the
	// index, kept across reconnects.
	#pages: Entry[] = [];
	#indexed: Entry[] = [];
	#indexRequested = false;
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
			list.addEventListener("click", this.#onListClick);
			this.#list = list;
		}
		// neo-dialog-open fires on both trigger click and the shortcut path.
		this.addEventListener("neo-dialog-open", this.#onOpen);

		const rows = list.querySelectorAll<HTMLAnchorElement>("[data-site-cmdk-row]:not([data-site-cmdk-kind])");
		this.#pages = Array.from(rows, (row) => {
			const label = row.dataset.label ?? row.textContent?.trim() ?? "";
			return {
				row,
				labelSpan: row.querySelector<HTMLElement>("[data-site-cmdk-label]") ?? row,
				label,
				labelKey: label.toLowerCase(),
				contextKey: "",
				indexed: false,
			};
		});
		// The shortcut hint (platform glyph + touch-hide) is owned by the
		// <neo-kbd key="mod"> + <neo-kbd key="k"> in the trigger; nothing
		// to do here.
	}

	#loadIndex(): void {
		const src = this.getAttribute("index");
		if (!src || this.#indexRequested) return;
		this.#indexRequested = true;
		fetch(src)
			.then((res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json() as Promise<IndexPage[]>;
			})
			.then((index) => {
				this.#addIndex(index);
				// Results typed before the index arrived lack index rows.
				const q = this.#input?.value ?? "";
				if (q.trim() !== "") this.#filter(q);
			})
			.catch((err: unknown) => {
				// Retry on the next open; page rows still work meanwhile.
				this.#indexRequested = false;
				console.warn(`site-command-palette: loading ${src}:`, err);
			});
	}

	// Index rows clone their page's baked row, which keeps the row markup
	// defined once in site.templ.
	#addIndex(index: IndexPage[]): void {
		const pages = new Map(this.#pages.map((e) => [e.row.getAttribute("href"), e]));
		for (const page of index) {
			const owner = pages.get(page.path);
			if (!owner) continue;
			for (const s of page.sections) {
				// The page's own title heading duplicates the page row.
				if (s.title.toLowerCase() !== owner.labelKey) {
					this.#addRow(owner, "section", `${page.path}#${s.id}`, s.title, owner.label);
				}
				const tag = `${owner.label} › ${s.title}`;
				for (const item of s.items ?? []) {
					this.#addRow(owner, "api", `${page.path}#${item.id}`, item.name, tag);
				}
			}
		}
	}

	#addRow(owner: Entry, kind: "section" | "api", href: string, label: string, tag: string): void {
		if (!this.#list) return;
		const row = owner.row.cloneNode(true) as HTMLAnchorElement;
		row.id = `site-cmdk-index-${this.#indexed.length}`;
		row.href = href;
		row.dataset.label = label;
		row.dataset.siteCmdkKind = kind;
		row.hidden = false;
		// A <neo-icon> in each of the ~2000 index rows would upgrade and resolve
		// its icon set, so index rows keep the slot empty.
		row.querySelector("[data-site-cmdk-icon]")?.replaceChildren();
		const labelSpan = row.querySelector<HTMLElement>("[data-site-cmdk-label]") ?? row;
		labelSpan.textContent = label;
		const group = row.querySelector<HTMLElement>("[data-site-cmdk-group]");
		if (group) group.textContent = tag;
		this.#indexed.push({
			row,
			labelSpan,
			label,
			labelKey: label.toLowerCase(),
			contextKey: tag.toLowerCase(),
			indexed: true,
		});
	}

	#onGlobalKey = (e: KeyboardEvent): void => {
		if (!(e.key === "k" || e.key === "K") || !(e.metaKey || e.ctrlKey)) return;
		if (e.altKey) return;
		e.preventDefault();
		// The palette lives in the collapsible sidebar. When that's closed
		// (display:none in overlay mode) the modal can't render, and showModal
		// would enter a broken invisible state. Gate on the trigger, not the
		// host, because the host is display:contents (no box). Its own
		// checkVisibility() is always false and would disable the shortcut
		// everywhere.
		if (this.#trigger?.checkVisibility && !this.#trigger.checkVisibility()) return;
		(this.#dialog as { show?: () => void } | null)?.show?.();
	};

	#onOpen = (): void => {
		if (!this.#input) return;
		this.#loadIndex();
		this.#input.value = "";
		this.#filter("");
		// showModal lands focus on the first focusable (the input), but
		// re-focus explicitly so the caret is ready after the shortcut path too.
		requestAnimationFrame(() => this.#input?.focus());
	};

	#onInput = (): void => {
		this.#filter(this.#input?.value ?? "");
	};

	#filter(query: string): void {
		if (!this.#list) return;
		const q = query.trim().toLowerCase().replace(/\s+/g, " ");
		const words = q.split(" ");

		const shown: { e: Entry; i: number; m: Match }[] = [];
		const hidden: Entry[] = [];
		const entries = [...this.#pages, ...this.#indexed];
		entries.forEach((e, i) => {
			// An empty query lists the pages only, in baked order.
			const m = q === "" ? (e.indexed ? null : { score: 0, ranges: [] }) : match(e, q, words);
			if (m) shown.push({ e, i, m });
			else hidden.push(e);
		});

		if (q !== "") {
			// The original index is a stable tie-break.
			shown.sort((a, b) => b.m.score - a.m.score || a.i - b.i);
			for (const { e } of shown.splice(MAX_RESULTS)) hidden.push(e);
		}
		// Index rows live in the list only while shown. Hidden in place, they add
		// ~7500 elements that every keystroke restyles. Page rows stay in the
		// list for navigation without JS.
		for (const e of hidden) {
			if (e.indexed) e.row.remove();
			else if (!e.row.hidden) e.row.hidden = true;
		}

		for (const { e, m } of shown) {
			if (e.row.hidden) e.row.hidden = false;
			e.labelSpan.innerHTML = highlight(e.label, m.ranges);
			this.#list.appendChild(e.row);
		}
		// Keep the empty-state node last in the list.
		if (this.#empty) {
			this.#list.appendChild(this.#empty);
			this.#empty.hidden = shown.length > 0;
		}

		this.#visible = shown.map((s) => s.e.row);
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
				// Pin focus to the field. The only other focus stop in the
				// modal is the (now tabindex=-1) scroller, and Tab has nowhere
				// useful to go. Keeps the combobox the sole focus target.
				e.preventDefault();
				break;
			// Escape is handled by the native <dialog> (cancel -> neo-dialog).
		}
	};

	// A fragment link into the current page doesn't unload it, which would
	// leave the modal open over the target. Close first and navigate on
	// neo-dialog-close, which fires after the dialog restores focus to the
	// trigger; navigating earlier lets that focus() scroll away again.
	#onListClick = (e: MouseEvent): void => {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		const row = (e.target as Element | null)?.closest<HTMLAnchorElement>("[data-site-cmdk-row]");
		if (!row?.hash || row.pathname !== location.pathname || row.search !== location.search) return;
		e.preventDefault();
		const href = row.href;
		this.addEventListener("neo-dialog-close", () => location.assign(href), { once: true });
		(this.#dialog as { hide?: () => void } | null)?.hide?.();
	};

	#onPointerMove = (e: PointerEvent): void => {
		const row = (e.target as Element | null)?.closest<HTMLAnchorElement>("[data-site-cmdk-row]");
		if (!row || row.hidden) return;
		const i = this.#visible.indexOf(row);
		if (i >= 0 && i !== this.#activeIndex) this.#setActive(i, false);
	};
}

customElements.define("site-command-palette", SiteCommandPalette);
