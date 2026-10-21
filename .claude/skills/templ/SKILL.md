---
name: templ
description: Use when creating or editing any Templ (`.templ`) file in this repo.
paths:
  - "**/*.templ"
  - "*.templ"
---

Two parts: parser gotchas that apply to every `.templ` file, and the naming rule for wrapper `Opts` fields.

Component doc pages (`internal/site/page_*.templ`), their examples, and their playgrounds have their own conventions: see the `doc-page` skill.

## Parser gotchas

### No Go keywords at the start of a text run

Inside `.templ` element content, the words `for`, `if`, `switch`, `case`, `default`, `else`, `range` are parsed as control-flow keywords when one is the first token on a line (ignoring leading whitespace): `<p>X to do.\n\tfor a Y</p>`. `for`, `if`, and `switch` are also parsed as keywords right after an element's closing tag: `<p>add <code>flag</code> for the Y</p>` fails. Mid-line after plain text is fine: `<p>add the flag for the Y</p>`.

Symptom: `for: unterminated (missing closing '{')`, or `expected nodes, but none were found: line N, col M`, often pointing at EOF.

Reword, or write the word as a string expression: `{ "for" }`.

### `@` after whitespace starts a component call

In text, `@` preceded by a space or tab starts a templ element expression: `no @media query` calls `media`. `user@example.com` stays text. Write a literal `@` after whitespace as a string expression: `{ "@media" }`.

### Spaces around component calls in prose

Line breaks around a `@call` render as follows:

- Text, then a call on the next line: no space. Put the call on the same line after a space (`see @neo.Icon("x")`) or add `{ " " }`.
- A call without a children block, then text on the next line: the line break renders as a space. To attach the text, write it on the same line right after the call: `@ComponentLink("neo-button", href.PageButton())&nbsp;children`. A period cannot follow the call directly (`x().` parses as a Go selector); write `&period;`.
- A call with a children block (`@neo.Link(...) { label }`), then text on the next line: no space. Trailing punctuation goes on its own line after the closing `}`.
- Two calls on consecutive lines: no space between them.

These rules matter in inline content only: whitespace between flex or grid items does not render.

### Literal `=` / `"` inside `<code>`

`<code>foo="bar"</code>` is parsed as a `<code>` tag with attribute `foo="bar"` and breaks the same way. Wrap with backticks: `<code>{ `foo="bar"` }</code>`.

## Opts field naming

A wrapper `Opts` field has the same name as the custom-element attribute it sets, exported (PascalCase, since it's Go) and typed `Attr[T]`. Use the most specific type, not `Attr[string]`: a named enum for a fixed set of values, `CSSUnit` for a CSS length, `int` for a whole number (count, index, ms delay), `float64` for a value that can be fractional (a slider `value`/`min`/`max`/`step`).

- attribute `touch` becomes `Touch Attr[bool]`
- attribute `align` becomes `Align Attr[CarouselAlign]`
- attribute `spacing` becomes `Spacing Attr[CSSUnit]`
- attribute `page` becomes `Page Attr[int]`

For a layout-axis field, type it `Attr[Axis]` when the component supports only horizontal and vertical, or `Attr[Orientation]` when it also supports `grid` (e.g. navgroup, sortable). Using `Axis` keeps an unsupported `grid` unrepresentable.
