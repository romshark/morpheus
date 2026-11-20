---
name: doc-page
description: Use when working on a component doc page (`internal/site/page_*.templ`), its examples under `internal/site/examples/`, or the `*_demo.go` that wires them together.
paths:
  - "internal/site/page_*.templ"
  - "internal/site/*_demo.go"
  - "internal/site/examples/**"
---

A component doc page is made of 3 parts. The page itself is `internal/site/page_<component>.templ`. Each example lives in `internal/site/examples/<name>.templ` (or `.html`), with an optional sibling `<name>.css`. `internal/site/<component>_demo.go` hands the example sources to the page. The `templ` skill applies to every `.templ` file here.

## Page structure

In order:

1. Intro
2. Playground
3. Reference
4. Examples
5. Datastar examples, if any

## Prose

Describe the custom element and its HTML surface, not the Templ wrapper, unless the example is about the wrapper. Say only what isn't obvious, in natural, concise and non-verbose technical English, and prefer lists to paragraphs. Use 1 term per concept, the one the element itself uses. Link to shared behavior instead of repeating descriptions.

- Open the intro with ``Component <code>{ "<neo-foo>" }</code> is ...``.
- Link a mention of the page's own attribute, slot, part, state, event or CSS variable to its reference row with `@AnchorCode`. The row id is the section plus the name, as in `attributes-open`, with the doc's `Prefix` in front on a page with several references.
- Link another component with `@ComponentLink`. Inside a `templ.Raw` description, write `<a href="#..."><code>...</code></a>` instead.
- Give every reference row a description. When there's little to say, link to the page it defers to.

### Example notes

Explain only what the demo can't show, usually how it works, not what the reader would already see. Don't open with a heading-style label. A single point is 1 `<p class="demo-note">`. Several points are a lead `<p class="demo-note">` followed by a `<ul class="demo-note">` of 2 or more items. When the effect only shows through interaction, end with the action to take.

### Alert notes

Call out a limit the reader would otherwise run into, such as a keyboard-only interaction touch devices lack or an API that needs a secure context, in an alert instead of a demo note. Render it with `@neo.AlertAttrs` and the `demo-callout` class, as a warning (`triangle-alert` icon) for a limit or as info (`info` icon) for context the demo can't show. Give it a short title naming the limit and a description of who is affected and what to do instead. Put it after the intro when it applies to the whole component, or next to the demo it concerns.

## Examples

Each demo shows 1 concept. If its note needs "and also", split it. Use realistic data, never placeholders.

Write each example as 1 self-contained templ function, indented with tabs. It is the only source of the preview, the HTML tab and the Templ tab, which leaves no room for a second copy as an `.html` file, a `const` string or Go-built HTML.

### Self-sufficiency

The Templ tab shows a single file, and everything the example needs has to be in it. Cross-file templ helpers, factored-out style constants and other cross-file markup or data helpers are out. The only calls into another package are the `@neo.*` wrappers the example shows. Inside the file, a helper templ function, a local type or data variable and a `for` loop over inline data are all fine. Prefer copying markup and CSS over factoring it out, and add a helper only when the structure demands one, such as recursion or a component-valued option.

### Styling

Style an example inline, or in a sibling `<name>.css` that the demo file embeds and passes to the page. Move a rule to the `.css` file only when it can't be inlined (a descendant or child selector, a pseudo-class, an at-rule, a custom property that has to cascade) or when it removes a duplicated block of about 3 or more declarations. A 1- or 2-declaration tweak stays inline, and so does a dynamic value such as a `data-attr:style` binding with its server-rendered value.

Never put a `<style>` block in an example. It leaks into the whole page, and a test fails the build on it.

In the `.css` file, name it after the example and let states that share a block share 1 embedded variable. Prefix class names with the example slug in kebab-case, indent with tabs and leave 1 blank line between rules. Reuse the classes `internal/site/static/style.css` already defines rather than copying them.

## Playgrounds

Build every playground from the `Playground` component and its `<site-playground>` controller, with no per-page scripts, simulator routes or one-off editors. The controller owns state selection, ordering, editing and resizing. Don't reimplement any of it.

- The first state is `Default`, the minimal example, with signals only for the attributes it must set.
- After it comes 1 state per page example, in page order, labeled with the example's heading and built from the same sources. Server-simulator examples and examples that show a change between their own states are exempt.
- A state's HTML is the only source of both its preview and its editor document.
- State HTML is trusted and comes from the repository. Never persist edited HTML or send it to a server.
- Declare editable signals as a Datastar object expression in `data-signals`, as in `data-signals="{foo_bar: 1, baz: 'x'}"`. Use scalar values only, and prefix the names with the page.
- Two-way bind a boolean command attribute with the command string plus a synchronous write-back, as in `data-attr:checked="$sig ? 'true' : 'false'"` with `data-on:neo-<tag>-change="$sig = evt.detail.checked"`. A bare `$sig` removes the attribute on false, which the component reads as no command, and the control stays on.
- Leave the preview height unset unless the component needs a fixed canvas.
