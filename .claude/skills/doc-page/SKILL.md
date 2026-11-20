---
name: doc-page
description: Use when working on a doc page (`internal/site/docs/*.md`) or its examples under `internal/site/examples/`.
paths:
  - "internal/site/docs/*.md"
  - "internal/site/examples/**"
---

A doc page is `internal/site/docs/<slug>.md`, the page `/<slug>/`. Each example lives in `internal/site/examples/<name>.templ` (or `.html`), with an optional sibling `<name>.css`, and the page names it in an `example` or `playground` block. Read [internal/site/README.md](../../../internal/site/README.md) for the page format, blocks, reference tables, links and build checks before editing a page. `docs/button.md` is the model component page. The `templ` skill applies to every `.templ` example.

## Page structure

In order:

1. Intro
2. Playground
3. Reference
4. Examples
5. Datastar examples, if any

## Prose

Describe the custom element and its HTML surface, not the Templ wrapper, unless the example is about the wrapper. Say only what isn't obvious, in natural, concise and non-verbose technical English, and prefer lists to paragraphs. Use 1 term per concept, the one the element itself uses. Link to shared behavior instead of repeating descriptions.

- Open the intro with ``Component `<neo-foo>` is ...``.
- Link a mention of the page's own attribute, slot, part, state, event or CSS variable to its reference row, as in ``[`::part(summary)`](#parts-summary)``. The row id is the section plus the name, as in `attributes-open`, with the element's section ID in front on a page with several references.
- Link another component as ``[`<neo-foo>`](foo.md)``, which renders the link chip. Both kinds of link work in reference table descriptions too.
- Give every reference row a description. When there's little to say, link to the page it defers to.

### Example notes

The paragraphs above an example block render as `.demo-note`. Explain only what the demo can't show, usually how it works, not what the reader would already see. Don't open with a heading-style label. A single point is 1 paragraph. Several points are a lead paragraph followed by a list of 2 or more items. When the effect only shows through interaction, end with the action to take.

### Alert notes

Call out a limit the reader would otherwise run into, such as a keyboard-only interaction touch devices lack or an API that needs a secure context, in an alert instead of a demo note. Write it as a GitHub alert, `> [!WARNING]` for a limit or `> [!NOTE]` for context the demo can't show, which renders as a `.demo-callout`. Give it a `###` title naming the limit and 1 paragraph on who is affected and what to do instead. Put it after the intro when it applies to the whole component, or next to the demo it concerns.

## Examples

Each demo shows 1 concept. If its note needs "and also", split it. Use realistic data, never placeholders.

Write each example as 1 self-contained templ function, indented with tabs, and list it in `examples.Templates`. It is the only source of the preview, the HTML tab and the Templ tab, which leaves no room for a second copy as an `.html` file.

### Self-sufficiency

The Templ tab shows a single file, and everything the example needs has to be in it. Cross-file templ helpers, factored-out style constants and other cross-file markup or data helpers are out. The only calls into another package are the `@neo.*` wrappers the example shows. Inside the file, a helper templ function, a local type or data variable and a `for` loop over inline data are all fine. Prefer copying markup and CSS over factoring it out, and add a helper only when the structure demands one, such as recursion or a component-valued option.

### Styling

Style an example inline, or in a sibling `<name>.css`, which the preview scopes with `@scope` and the CSS tab shows. Move a rule to the `.css` file only when it can't be inlined (a descendant or child selector, a pseudo-class, an at-rule, a custom property that has to cascade) or when it removes a duplicated block of about 3 or more declarations. A 1- or 2-declaration tweak stays inline, and so does a dynamic value such as a `data-attr:style` binding with its server-rendered value.

Never put a `<style>` block in an example. It leaks into the whole page, and a test fails the build on it.

Name the `.css` file after the example. HTML states that share a block share 1 file named after their group, as `popover_morph.css` styles `popover_morph_50.html`. Prefix class names with the example slug in kebab-case, indent with tabs and leave 1 blank line between rules. Reuse the classes `internal/site/static/style.css` already defines rather than copying them.

## Playgrounds

Build every playground from a `playground` block, which renders the `Playground` component and its `<site-playground>` controller, with no per-page scripts, simulator routes or one-off editors. The controller owns state selection, ordering, editing and resizing. Don't reimplement any of it.

- The first state is `Default`, the minimal example, with signals only for the attributes it must set.
- After it comes 1 state per page example, in page order, labeled with the example's heading and naming the same example. Server-simulator examples and examples that show a change between their own states are exempt.
- A state's HTML is the only source of both its preview and its editor document.
- State HTML is trusted and comes from the repository. Never persist edited HTML or send it to a server.
- Declare editable signals as a Datastar object expression in `data-signals`, as in `data-signals="{foo_bar: 1, baz: 'x'}"`. Use scalar values only, and prefix the names with the page.
- Two-way bind a boolean command attribute with the command string plus a synchronous write-back, as in `data-attr:checked="$sig ? 'true' : 'false'"` with `data-on:neo-<tag>-change="$sig = evt.detail.checked"`. A bare `$sig` removes the attribute on false, which the component reads as no command, and the control stays on.
- Leave the preview height unset unless the component needs a fixed canvas, which the `height:` option sets.
