# CLAUDE.md

For the kit's technical design decisions and rules, see [DESIGN.md](DESIGN.md). This file holds operational rules for working in the repo.

## Repository Structure

- `web/lib`: TypeScript sources for the actual custom elements.
- `web/site`: miscellaneous TypeScrit and CSS for the demo site.
- `neo`: the Templ wrapper for the custom elements.
- `datastar`: same as `/neo` but specifically for Datastar + Templ.
- `internal/href`: links for the static site generator.
- `internal/cmd`: helper scripts in Go.
- `internal/site`: the source for the static site generator.
- `dst`: ignored, it's what gets built from `/internal/site` by `internal/cmd/gen`.

## Build

Don't run `templ generate`, `go build`, or `pnpm build.ts` by hand. Watch mode (`make watch` / templier) is running in another terminal: it rebuilds on save and, on any `web/` TypeScript or CSS change, runs Biome lint and `tsc` (`pnpm check-all`), failing on a lint or type error. When the watcher is off, run `pnpm check-all` in `web/` to verify, and `pnpm lint-apply` / `pnpm format` to autofix.

## Writing Style

Write like a technical specification, not an essay or marketing copy. Applies to all writing: comments, commit messages, and documentation (READMEs, doc pages, etc.).

- Use plain English: short declarative sentences, common words, active voice, few adjectives or adverbs.
- State facts and requirements directly. A sentence says what is true or required, not why it matters emotionally.
- Structure text as a logical hierarchy of sections and subsections: one topic per section, related points grouped together, nested under the broader topic they belong to, ordered general to specific.
- State each thing once. Reference or link to it from elsewhere instead of copying; duplicated text drifts out of sync.
- Headings are plain descriptors of their content, never slogans or metaphors.
- In Markdown files, do not hard-wrap prose: put each paragraph on one line and let the editor soft-wrap, so an edit doesn't reflow the whole paragraph.
- No metaphors, similes, slogans, or rhetorical flourishes.
- No editorializing or motivational framing.
- No second-person hype and no selling the reader on the design; only concise descriptive technical text.
- Mark rationale with an explicit label (`Rationale:`, `Why:`, `Requirement:`, `Check:`) rather than weaving persuasion into the prose.

### Git commits

Follow [Conventional Commits 1.0](https://www.conventionalcommits.org/en/v1.0.0/): `<type>[optional scope]: <description>` (e.g. `feat(switch): …`, `fix: …`, `chore: …`). Title 50 characters max. Description wraps at 72 characters per line. State the non-obvious _why_ of the change. Never paraphrase the diff's _what_.

### Comment style

Prefer one or two lines over a paragraph and a sentence fragment over a full sentence when it's unambiguous. State the non-obvious _why_ (invariant, constraint, browser quirk, gotcha). Never paraphrase the code's _what_. Use precise terms (e.g. "top layer", "capture phase", "passive listener", "cascade", "containing block") rather than narrating in plain English. If a comment grows past ~3 lines, the reason it needs that much prose is usually the signal to split or rename, not to keep writing.

No history in comments: describe the current state, not what the code used to do or what changed. That belongs in commit messages.

If a reader could infer the comment from the code itself, remove it as it adds no value.

#### Templ and Go comments

An exported Go or Templ symbol takes a doc comment that opens with its name, per Go convention:

```
// Combobox renders <neo-combobox> ...
templ Combobox(opts ComboboxOpts) { ... }
```

When a comment names another symbol, write it as a `[Name]` doc link, not `neo.Name` or unlinked text; a same-package link takes the bare name (`[RadioGroup]`, `[Option]`). Keep runnable example code (`@neo.Foo(neo.FooOpts{…})`) literal and tab-indented so godoc renders it as a code block, not a link.

```
// Radio renders <neo-radio>, a child of [RadioGroup]:
//
//	@neo.Radio(neo.RadioOpts{Value: neo.Set("a")}) { A }
```

An `SomethingAttrs` wrapper carries only the back-reference `// SomethingAttrs is [Something] with an extra attribute set.`; the component's full doc lives once on the high-level `Something` templ.
