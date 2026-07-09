---
name: templ
description: Use when creating or editing any Templ (`.templ`) file in this repo.
paths:
  - "**/*.templ"
  - "*.templ"
---

Three parts: parser gotchas that apply to every `.templ` file, the naming rule for wrapper `Opts` fields, and the conventions for component doc pages and their playgrounds.

## Parser gotchas

### No Go keywords at line start

Inside `.templ` element content, the words `for`, `if`, `switch`, `case`, `default`, `else`, `range` are parsed as control-flow keywords when one is the first token on a line (ignoring leading whitespace): `<p>X to do.\n\tfor a Y</p>`. Mid-line is fine, even right after an inline tag close (`<p>add <code>flag</code> for the Y</p>` parses).

Symptom: `expected nodes, but none were found: line N, col M`, often pointing at EOF.

Make sure Go keywords aren't the first token in a template line.

### Literal `=` / `"` inside `<code>`

`<code>foo="bar"</code>` is parsed as a `<code>` tag with attribute `foo="bar"` and breaks the same way. Wrap with backticks: `<code>{ `foo="bar"` }</code>`.

## Opts field naming

A wrapper `Opts` field has the same name as the custom-element attribute it sets, exported (PascalCase, since it's Go) and typed `Attr[T]`. Use the most specific type, not `Attr[string]`: a named enum for a fixed set of values, `CSSUnit` for a CSS length, `int` for a whole number (count, index, ms delay), `float64` for a value that can be fractional (a slider `value`/`min`/`max`/`step`).

- attribute `touch` becomes `Touch Attr[bool]`
- attribute `align` becomes `Align Attr[CarouselAlign]`
- attribute `spacing` becomes `Spacing Attr[CSSUnit]`
- attribute `page` becomes `Page Attr[int]`

For a layout-axis field, type it `Attr[Axis]` when the component supports only horizontal and vertical, or `Attr[Orientation]` when it also supports `grid` (e.g. navgroup, sortable). Using `Axis` keeps an unsupported `grid` unrepresentable.

## Doc page prose

How component doc pages (`internal/site/page_*.templ`) are written.

Page structure, in order:

1. Title & general description (the intro)
2. Live playground
3. Reference
4. Examples
5. Examples: Datastar (if any)

Rules:

- Describe the **custom element**, never the Templ wrapper.
  - Document the HTML surface: attributes, child elements, events, `[data-neo-*]` hooks. Not the `@neo.*` / `datastar.*` helper.
  - Exception: an example specifically about a wrapper.
- Write tersely.
  - Non-obvious only; cut what states the obvious.
  - Plain simple technical English, as brief as possible.
  - One term per concept (trigger / listbox / popover), matching the element's own naming.
  - Structure with lists and formatting, not prose paragraphs; keep the text minimal.
  - Link, don't repeat. Describe shared behavior once, link to it elsewhere.
- Intro: opens with ``Component <code>{ "<neo-foo>" }</code> is …``.
- Examples:
  - One concept per `anchoredH3` demo; if a note needs "and also…", split it.
  - Realistic data, never placeholders (`foo`, `Variant A`).
  - Each example is ONE self-contained templ function in `internal/site/examples/<name>.templ`. The `*_demo.go` renders it for the HTML tab and embeds the file verbatim for the Templ tab (`//go:embed examples/<name>.templ`); the page passes both as HTML source and Templ source and renders `@examples.X()` as the live preview. One source drives all three. Keep no separate `.html`, hard-coded `const` strings, or Go-built (string concat) HTML var for an example.
  - Examples must be SELF-SUFFICIENT: everything the Templ tab needs lives in that one embedded file. The test is visibility, not purity. The tab shows the whole file, so referencing code in ANOTHER file hides it from the reader. Banned: a shared/cross-file templ helper, a factored-out style-string const, any cross-file markup or data helper (the only cross-package `@…` calls allowed are the `@neo.*` wrappers the example demonstrates). Allowed (all visible in the same file): a helper templ func defined in this file (e.g. a recursive `templ treeNode(...)` for arbitrary-depth nesting, or a `templ.Component` value the wrapper API requires), a local type/data var, and `for` loops over inline data. Prefer copying markup/CSS over factoring it out; reach for a same-file helper only when structure forces it (recursion, a component-valued option).
  - Indent example `.templ` files with TABS, including inside `<style>` blocks (one tab per CSS nesting level). The HTML-tab pretty-printer converts those tabs to two spaces; space indentation in the source yields ragged output.
- Example notes (`<p class="demo-note">` above each demo):
  - Say what it's for, then how it works.
  - No heading-as-prefix (`Disabled options: …`).
  - One point: a single `<p class="demo-note">`.
  - Several points: a lead `<p class="demo-note">` + a
    `<ul class="demo-note">` (never a one-item list).
  - Effect only visible through interaction? End with the action ("Type *xyz* to see it").
- Reference docs (`ComponentDoc` `Description`):
  - Never empty. If thin/obvious, link to the page it defers to (e.g. forwarded-to-`<neo-popover>` → Popover page).
- The Parser gotchas above still apply.

### Component-doc playgrounds

New or migrated overview pages use the reusable `Playground` Templ component (`internal/site/playground.templ`), driven by the site-only `<site-playground>` controller (`web/site/site-playground.ts`). No per-page playground scripts, simulator routes, or one-off editors.

- The first state is named `Default`. Other states reuse the real examples already on the page, with no placeholders like `Variant A`.
- Each state's HTML is the single source for both its preview and the CodeMirror document. Don't add a separate parameter schema or duplicate the preview markup in the template.
- State HTML is trusted, repository-authored. The editor runs only in the browser; never persist or send edited HTML to a server.
- Declare editable signals as a Datastar object expression in `data-signals` (double-quoted attribute, unquoted keys, single-quoted strings: `data-signals="{foo_bar: 1, baz: 'x'}"`), and drive the markup with normal Datastar bindings. Controls handle scalar string, number, boolean, and null. Namespace signal names to the component/page.
- Two-way binding a boolean-command attribute (`checked`, `pressed`, `open`) needs the command-string form plus a synchronous write-back, not a bare boolean: `data-attr:checked="$sig ? 'true' : 'false'"` with `data-on:neo-<tag>-change="$sig = evt.detail.checked"`. A bare `data-attr:checked="$sig"` makes Datastar remove the attribute on `false`, which the component reads as "no command, keep current state" (DESIGN.md Attribute Contract), so the control snaps back and stays visually on until a second interaction. Canonical examples: `checkbox_default.html`, `sidebar_default.html`.
- The controller owns state selection, reordering, enable/disable, duplication, autoplay, renaming, resizing, mobile options, and code/signal editing. Keep the template declarative; don't reimplement these.
- Leave the preview height unset so it tracks the active state's content. Set `PlaygroundOpts.Height` only when the component needs a fixed canvas.
