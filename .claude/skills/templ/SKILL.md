---
name: templ
description: Use when creating or editing any Templ (`.templ`) file in this repo.
paths:
  - "**/*.templ"
  - "*.templ"
---

This skill covers the rules for every `.templ` file. Doc pages, their examples and playgrounds also follow the `doc-page` skill.

## Parser gotchas

- Templ reads a Go keyword (`for`, `if`, `switch`, `case`, `default`, `else`, `range`) as control flow when it starts a text line or follows a closing tag. Reword the sentence, or write the word as `{ "for" }`.
- An `@` after whitespace starts a component call. Write a literal one as `{ "@media" }`.
- After other punctuation, `@` renders as text. Put a call that follows punctuation on its own line.
- Templ treats any attribute whose name starts with `on` as an event handler and drops a plain string value. Pass the value through `attrValue`, as `Attr.Attrs` already does.
- Inside `<code>`, text with `=` or `"` parses as an attribute. Write it as a backtick expression, as in `<code>{ `foo="bar"` }</code>`.

## Spaces around component calls

In inline content, line breaks around a call render like this:

- Text followed by a call on the next line gets no space. Keep the call on the same line after a space, or add `{ " " }`.
- A call without children followed by text on the next line gets a space. To attach the text, write it right after the call, as in `@x()&nbsp;word`, and write a period as `&period;`.
- A call with children followed by text on the next line gets no space. Put trailing punctuation on its own line after the closing `}`.
- 2 calls on consecutive lines get no space between them.

## What a wrapper renders

A wrapper renders only the attributes the server owns (see "Attribute ownership" in the `neo-component` skill). It never invents an `id`. It renders the caller's `id`, or a part `id` derived from it the same way on every render. It may render the initial value of a managed attribute, which gives correct semantics before the element upgrades.

## Opts field naming

A wrapper `Opts` field takes the name of the attribute it sets, in PascalCase, typed `Attr[T]` with the most specific `T`. Use a named enum for a fixed set of values, `CSSUnit` for a CSS length, `int` for a whole number and `float64` for anything fractional. A layout-axis field is `Attr[Axis]` when the component supports only horizontal and vertical, and `Attr[Orientation]` when it also supports `grid`.

- `touch` becomes `Touch Attr[bool]`
- `align` becomes `Align Attr[CarouselAlign]`
- `spacing` becomes `Spacing Attr[CSSUnit]`
- `page` becomes `Page Attr[int]`
