// <site-codemirror>: CodeMirror 6 editor for docs code samples.
// Outside the UI kit on purpose: docs UI, not a reusable widget;
// the kit ships no editor primitives.
//
// Attributes: `language` (a key of LANG below; unknown -> plain text),
// `readonly` (block edits, unchanged look), `disabled` (block edits +
// not-allowed/dim CSS styling), `lazy` (defer mounting while inside a
// hidden/inert tab panel), `value` (bidirectional doc bind for Datastar).
// Events bubble, detail {value}: `site-codemirror-input` per edit,
// `site-codemirror-change` at focusout (commit-time). Theme follows the
// doc `dark` class via the `neo-theme-change` event.

// Compose basicSetup from the individual sub-packages so the editor bundle is
// fully local and docs pages do not depend on CDN module fetches.
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import {
	bracketMatching,
	defaultHighlightStyle,
	foldGutter,
	indentOnInput,
	syntaxHighlighting,
} from "@codemirror/language";
import { Annotation, Compartment, EditorState, type Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
// Runtime StreamLanguage parser, no Lezer build step; see
// site-codemirror-templ.ts for coverage.
import { templ } from "./site-codemirror-templ";

const basicSetup = [
	lineNumbers(),
	highlightActiveLineGutter(),
	highlightActiveLine(),
	history(),
	foldGutter(),
	bracketMatching(),
	indentOnInput(),
	syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
	keymap.of([...defaultKeymap, ...historyKeymap]),
];

// Marks a doc change as our own `value`-attr write-back so the update
// listener skips it; otherwise it echo-loops with a consumer that
// data-binds `value`.
const externalSync = Annotation.define();

const LANG: Record<string, () => Extension> = {
	go: () => go(),
	javascript: () => javascript(),
	js: () => javascript(),
	jsx: () => javascript({ jsx: true }),
	ts: () => javascript({ typescript: true }),
	tsx: () => javascript({ jsx: true, typescript: true }),
	typescript: () => javascript({ typescript: true }),
	markdown: () => markdown(),
	md: () => markdown(),
	css: () => css(),
	html: () => html(),
	templ: () => templ(),
};

class SiteCodeMirror extends HTMLElement {
	static get observedAttributes(): string[] {
		return ["language", "readonly", "disabled", "lazy", "value"];
	}

	#_view: EditorView | null = null;
	#_lang = new Compartment();
	#_theme = new Compartment();
	#_readonly = new Compartment();
	#_morphObserver: MutationObserver | null = null;
	#_lazyObserver: MutationObserver | null = null;

	connectedCallback(): void {
		if (!this.#_view) {
			if (this.#_shouldDeferMount()) {
				this.#_observeLazyPanel();
			} else {
				this.#_mount();
			}
		}

		// A Datastar fat-morph re-emits the authored shape and wipes the
		// editor DOM; idiomorph can't be told to skip our subtree, so
		// detect the wipe and rebuild (same contract as <neo-select>).
		if (!this.#_morphObserver) {
			this.#_morphObserver = new MutationObserver(() => this.#_checkMorph());
		}
		this.#_morphObserver.observe(this, { childList: true });
		// commit-time `site-codemirror-change` (vs per-keystroke -input).
		this.addEventListener("focusout", this.#_onFocusOut);
	}

	disconnectedCallback(): void {
		this.#_morphObserver?.disconnect();
		this.#_lazyObserver?.disconnect();
		this.#_lazyObserver = null;
		this.removeEventListener("focusout", this.#_onFocusOut);
		document.documentElement.removeEventListener("neo-theme-change", this.#_onThemeChange);
		if (this.#_view) {
			this.#_view.destroy();
			this.#_view = null;
		}
	}

	#_onFocusOut = (e: FocusEvent): void => {
		// relatedTarget inside the host = focus moved within the editor
		// (gutter <-> content); only fire when it actually left.
		if (e.relatedTarget && this.contains(e.relatedTarget as Node)) return;
		if (!this.#_view) return;
		this.dispatchEvent(
			new CustomEvent("site-codemirror-change", {
				bubbles: true,
				detail: { value: this.#_view.state.doc.toString() },
			}),
		);
	};

	#_checkMorph(): void {
		const tpl = this.querySelector(":scope > template");
		const host = this.querySelector(":scope > .site-codemirror-host");
		if (!tpl || host) return;
		if (this.#_shouldDeferMount()) {
			this.#_observeLazyPanel();
			return;
		}
		// Authored shape back without our host = morph wiped it; rebuild.
		if (this.#_view) {
			this.#_view.destroy();
			this.#_view = null;
		}
		this.#_mount();
	}

	#_mount(): void {
		if (this.#_view) return;
		this.#_lazyObserver?.disconnect();
		this.#_lazyObserver = null;

		const source = this.#_readSource();
		this.textContent = "";

		const host = document.createElement("div");
		host.className = "site-codemirror-host";
		this.appendChild(host);

		this.#_view = new EditorView({
			state: EditorState.create({
				doc: source,
				extensions: [
					basicSetup,
					this.#_lang.of(this.#_langExt()),
					this.#_theme.of(this.#_isDark() ? oneDark : []),
					this.#_readonly.of(EditorState.readOnly.of(this.#_isLocked())),
					// User edits -> `site-codemirror-input` (a Datastar
					// listener can mirror it into a signal). Skip
					// externalSync transactions: our own value write-back,
					// which would echo (see externalSync).
					// biome-ignore lint/suspicious/noExplicitAny: CodeMirror ViewUpdate type, CDN-external, no value types.
					EditorView.updateListener.of((update: any) => {
						if (!update.docChanged) return;
						// biome-ignore lint/suspicious/noExplicitAny: CodeMirror Transaction type, CDN-external, no value types.
						if (update.transactions.some((tr: any) => tr.annotation(externalSync))) {
							return;
						}
						this.dispatchEvent(
							new CustomEvent("site-codemirror-input", {
								bubbles: true,
								detail: { value: update.state.doc.toString() },
							}),
						);
					}),
					// CM sets role="textbox" on cm-content (input role) ->
					// needs an accessible name; default it from
					// language/lock state.
					EditorView.contentAttributes.of({
						"aria-label": this.#_ariaLabel(),
					}),
				],
			}),
			parent: host,
		});

		document.documentElement.addEventListener("neo-theme-change", this.#_onThemeChange);
	}

	attributeChangedCallback(name: string): void {
		if (name === "lazy") {
			if (!this.#_view && this.isConnected) {
				if (this.#_shouldDeferMount()) this.#_observeLazyPanel();
				else this.#_mount();
			}
			return;
		}
		if (!this.#_view) return;
		if (name === "language") {
			this.#_view.dispatch({
				effects: this.#_lang.reconfigure(this.#_langExt()),
			});
		} else if (name === "readonly" || name === "disabled") {
			this.#_view.dispatch({
				effects: this.#_readonly.reconfigure(EditorState.readOnly.of(this.#_isLocked())),
			});
		} else if (name === "value") {
			// `data-attr:value` pushes a signal into the doc. Bail when
			// already equal: the echoed signal would otherwise churn a
			// transaction per keystroke. externalSync stops this write
			// re-emitting `site-codemirror-input`.
			const next = this.getAttribute("value") ?? "";
			const cur = this.#_view.state.doc.toString();
			if (cur === next) return;
			this.#_view.dispatch({
				changes: { from: 0, to: this.#_view.state.doc.length, insert: next },
				annotations: externalSync.of(true),
			});
		}
	}

	#_shouldDeferMount(): boolean {
		if (!this.hasAttribute("lazy")) return false;
		const panel = this.closest("neo-tabpanel");
		if (!panel) return false;
		return panel.hasAttribute("hidden") || panel.hasAttribute("inert");
	}

	#_observeLazyPanel(): void {
		const panel = this.closest("neo-tabpanel");
		if (!panel) return;
		if (!this.#_shouldDeferMount()) {
			this.#_mount();
			return;
		}
		this.#_lazyObserver?.disconnect();
		this.#_lazyObserver = new MutationObserver(() => {
			if (this.#_shouldDeferMount()) return;
			this.#_mount();
		});
		this.#_lazyObserver.observe(panel, {
			attributes: true,
			attributeFilter: ["hidden", "inert"],
		});
	}

	#_onThemeChange = (e: Event): void => {
		if (!this.#_view) return;
		const detail = (e as CustomEvent).detail;
		const dark = (detail && detail.effectiveMode === "dark") || this.#_isDark();
		this.#_view.dispatch({
			effects: this.#_theme.reconfigure(dark ? oneDark : []),
		});
	};

	#_langExt(): Extension {
		const name = (this.getAttribute("language") || "").toLowerCase();
		const factory = LANG[name];
		return factory ? factory() : [];
	}

	#_isDark(): boolean {
		return document.documentElement.classList.contains("dark");
	}

	#_ariaLabel(): string {
		const explicit = this.getAttribute("aria-label");
		if (explicit) return explicit;
		const lang = (this.getAttribute("language") || "").trim();
		const base = lang ? `${lang} code` : "Code";
		if (this.hasAttribute("disabled")) return `${base}, disabled`;
		if (this.hasAttribute("readonly")) return `${base}, read-only`;
		return base;
	}

	// readonly and disabled both block edits; only `disabled` adds the
	// not-allowed/dim CSS styling.
	#_isLocked(): boolean {
		return this.hasAttribute("readonly") || this.hasAttribute("disabled");
	}

	// Priority: `value` attr -> <template> child (keeps indentation
	// through HTML round-trips) -> textContent. `value` wins so a
	// `data-attr:value`-bound editor first-paints the signal, not a
	// stale authored literal.
	#_readSource(): string {
		const valueAttr = this.getAttribute("value");
		if (valueAttr !== null) return valueAttr;
		const tpl = this.querySelector<HTMLTemplateElement>(":scope > template");
		if (tpl) return tpl.content.textContent ?? "";
		return (this.textContent ?? "").replace(/^\n/, "");
	}
}

customElements.define("site-codemirror", SiteCodeMirror);
