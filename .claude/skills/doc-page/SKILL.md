---
name: doc-page
description: Use when working on a doc page (`internal/site/docs/*.md`) or its examples under `internal/site/examples/`.
paths:
  - "internal/site/docs/*.md"
  - "internal/site/examples/**"
---

A doc page is 2 kinds of file working together:

- `internal/site/docs/<slug>.md`: the page `/<slug>/`, with prose, playground, reference tables and example blocks.
- `internal/site/examples/<name>.templ` (or `.html`) plus an optional sibling `<name>.css`: 1 example each, which the page names in an `example` or `playground` block.

Read [internal/site/README.md](../../../internal/site/README.md) for the page format, blocks, reference tables, links and build checks before editing a page. `docs/button.md` is the model component page.

The Templ parser gotchas in the `templ` skill apply to every `.templ` example.

## Page structure

In order:

1. Title & general description (the intro)
2. Live playground
3. Reference
4. Examples
5. Examples: Datastar (if any)

## Prose

- Describe the **custom element**, never the Templ wrapper.
  - Document the HTML surface (attributes, child elements, events, `[data-neo-*]` hooks), not the `@neo.*` / `datastar.*` helper.
  - Exception: an example specifically about a wrapper.
- Write tersely.
  - Non-obvious only; cut what states the obvious.
  - Plain simple technical English, as brief as possible.
  - One term per concept (trigger / listbox / popover), matching the element's own naming.
  - Structure with lists and formatting, not prose paragraphs; keep the text minimal.
  - Link, don't repeat. Describe shared behavior once, link to it elsewhere.
- Links:
  - A mention of the page's own attribute, slot, part, state, event or CSS variable links to its reference row: ``[`::part(summary)`](#parts-summary)``. The row id is the section plus the name (`attributes-open`, `slots-summary-open`, `css-variables-neo-foo-gap`), with the element's section ID in front on pages with several references (`item-attributes-neo-hide-below`).
  - Another component links as ``[`<neo-foo>`](foo.md)``, which renders the link chip, never as plain text or a link without the code.
  - Both work in reference table descriptions too.
- Intro: opens with ``Component `<neo-foo>` is ...``.
- Example notes (the paragraphs above each example block, which render as `.demo-note`):
  - Say what it's for, then how it works.
  - No heading-as-prefix (`Disabled options: ...`).
  - One point: a single paragraph.
  - Several points: a lead paragraph and a list (never a 1-item list).
  - If the effect is visible only through interaction, end with the action ("Type *xyz* to see it").
- Reference tables (the Description cells):
  - Never empty. If thin/obvious, link to the page it defers to (e.g. forwarded-to-`<neo-popover>` -> Popover page).

## Examples

- One concept per `###` demo; if a note needs "and also...", split it.
- Realistic data, never placeholders (`foo`, `Variant A`).

### Source layout

Each example is one self-contained templ function in `internal/site/examples/<name>.templ`, listed in `examples.Templates`. An `example` block renders it as the live preview, renders it again for the HTML tab, and shows the file verbatim in the Templ tab. All 3 come from one source. Keep no separate `.html` for a templ example.

Indent example `.templ` files with tabs. The HTML-tab pretty-printer converts those tabs to 2 spaces; space indentation in the source yields ragged output.

### Self-sufficiency

Everything the Templ tab needs lives in that one embedded file. The test is visibility, not purity. The tab shows the whole file. Code referenced from another file stays hidden from the reader.

Banned: a shared/cross-file templ helper, a factored-out style-string const, any cross-file markup or data helper (the only cross-package `@...` calls allowed are the `@neo.*` wrappers the example demonstrates).

Allowed (all visible in the same file): a helper templ func defined in this file (e.g. a recursive `templ treeNode(...)` for arbitrary-depth nesting, or a `templ.Component` value the wrapper API requires), a local type/data var, and `for` loops over inline data.

Prefer copying markup/CSS over factoring it out; reach for a same-file helper only when structure forces it (recursion, a component-valued option).

### Styling

An example's styling lives in an inline `style` attribute on the element or in a sibling `.css` file.

A sibling `internal/site/examples/<name>.css` needs no wiring. The site injects it as `<style>@scope { ... }</style>` in the preview and the playground state, and shows it verbatim in the CSS tab. An inline `style` attribute shows up in the HTML tab, where the element it styles is.

Extract to a sibling `.css` when one of these holds:

- The rule cannot be inlined, as with a descendant or child selector, a pseudo-class, an at-rule, or a custom property that has to cascade to a descendant.
- It removes duplication of a substantive block, roughly 3 or more declarations repeated across elements in 1 example or across several states of 1 playground.

Otherwise keep it inline. A 1- or 2-declaration tweak (`width: 22rem`, `font-size: 3rem`, `margin: 0`) does not justify a class plus a file, even when it repeats.

Requirement: never put a `<style>` block in an example. Example CSS lives in light DOM, where an unscoped rule leaks page-wide and silently styles other demos. `examples/scope_test.go` fails the build on an unscoped block in a `.templ`.

Dynamic values stay inline. A `data-attr:style` binding and the server-rendered value it patches are data, not styling:

	<span
	  class="color-field-morph-swatch"
	  style="background: #2563eb"
	  data-attr:style="'background: ' + $cf_morph_value"
	></span>

The class carries the box metrics; the inline declaration carries the bound value.

Writing the `.css` file:

- One file per example, named after it. HTML states that share one block share 1 file named after their group (`popover_morph.css` beside `popover_morph_*.html`).
- Class names are kebab-case and prefixed with the example slug, such as `.popover-morph-panel` and `.skeleton-morph-avatar`.
- Tab-indented, 1 blank line between rules.
- Classes defined in `internal/site/static/style.css` already apply to previews. Use them instead of copying their rules into an example's CSS.

## Playgrounds

A `playground` block renders the reusable `Playground` component (`internal/site/playground.templ`), controlled by the site-only `<site-playground>` controller (`web/site/site-playground.ts`). No per-page playground scripts, simulator routes, or one-off editors.

- The first state is named `Default` and is the minimal example. Its signals cover only the attributes it must set. Other states reuse the real examples already on the page, with no placeholders like `Variant A`.
- After `Default`, 1 state per page example, in page order, labeled with its heading and naming the same example. Exempt are server-simulator examples and examples that show a change between their own states, such as a morph demo, because 1 of those states alone shows nothing.
- Each state's HTML is the single source for both its preview and the CodeMirror document. Don't add a separate parameter schema or duplicate the preview markup in the template.
- State HTML is trusted, repository-authored. The editor runs only in the browser; never persist or send edited HTML to a server.
- Declare editable signals as a Datastar object expression in `data-signals` (double-quoted attribute, unquoted keys, single-quoted strings, as in `data-signals="{foo_bar: 1, baz: 'x'}"`), and update the markup through normal Datastar bindings. Controls handle scalar string, number, boolean, and null. Namespace signal names to the component/page.
- Two-way binding a boolean-command attribute (`checked`, `pressed`, `open`) needs the command-string form plus a synchronous write-back, not a bare boolean. Use `data-attr:checked="$sig ? 'true' : 'false'"` with `data-on:neo-<tag>-change="$sig = evt.detail.checked"`. A bare `data-attr:checked="$sig"` makes Datastar remove the attribute on `false`, which the component reads as "no command, keep current state" (DESIGN.md Attribute Contract). The control snaps back and stays visually on until a second interaction. Canonical examples: `checkbox_default.html`, `sidebar_default.html`.
- The controller owns state selection, reordering, enable/disable, duplication, autoplay, renaming, resizing, mobile options, and code/signal editing. Keep the template declarative; don't reimplement these.
- Leave the preview height unset so it tracks the active state's content. Set the `height:` option only when the component needs a fixed canvas.
