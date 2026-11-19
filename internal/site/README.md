# Doc pages

A doc page is a Markdown file, `internal/site/docs/<slug>.md`, which [`internal/cmd/gen`](../cmd/gen) renders as the page `/<slug>/`. It shows live examples from [`examples/`](examples), so the HTML, Templ and CSS on the page come from the same files as the preview. [`docs/button.md`](docs/button.md) is the model component page. [`docs/frameworks.md`](docs/frameworks.md), [`docs/server-driven.md`](docs/server-driven.md) and [`docs/theming.md`](docs/theming.md) are the model guide pages.

The landing page, the components index, the bundle builder and the debug pages are Templ files, `page_*.templ`.

The rules for prose, examples and playgrounds are in the [doc-page skill](../../.claude/skills/doc-page/SKILL.md).

## Building

`make gen` builds the site into `dst/`, see [Developing](../../README.md#developing).

`make watch` serves `dst/` at <http://localhost:9090> through [templier](https://github.com/romshark/templier) and reloads the browser after each rebuild. Saving a file in `docs/` or `examples/` reruns gen, which rebuilds every page. `templier.yml` lists the watched files; restart `make watch` after changing it.

## Output

For `docs/button.md`, gen writes:

- `dst/button/index.html`: the page.
- `dst/button/index.md`: the Markdown copy, for agents. It is the source with each `example` block expanded into the code blocks of its tabs, each `playground` block reduced to the states that no example block shows, and the `<script>` and `<template>` blocks removed. Its links are relative.

## Adding a page

1. Add `PageX()` to [`internal/href/href.go`](../href/href.go). Its path segment is the file name: `PageButtonGroup()` is `/button-group/` and `docs/button-group.md`.
2. Write `docs/<slug>.md`, see [Page format](#page-format).
3. Add `{href.PageX(), docs.Page(href.PageX(), morpheusVersion)}` to `buildPages` in [`internal/cmd/gen/main.go`](../cmd/gen/main.go). The order of that list is the order of the search index.
4. Add the page to [`site.go`](site.go): a component page to `ComponentGroups`, with its icons, as the doc comment there describes, and a guide page to `DocLinks`.
5. Add the examples, see [Examples](#examples).

## Page format

````md
# Button

Component `<neo-button>` is a styled, keyboard-activated button ...

```playground
- button_default: Default
- button_variants: Variants & states
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"primary" \| "ghost"` | | Visual style. |
| `disabled` | `boolean`, observed | `false` | Removes the host from the tab order. |

## Examples

### Variants & states

The 6 built-in [`variant`](#attributes-variant) values.

```example button_variants
min-height: max-content
```
````

- The page starts with its only level 1 heading, which is its title.
- `## Reference` stays in the section of the overview. Every other `##` heading starts a new `<section>`.
- Heading IDs are the heading text in lowercase, with each run of other characters replaced by 1 `-`: "Variants & states" is `#variants-states`. A 2nd heading with the same ID gets `-1`, the next `-2`. Set an ID with `### Heading {#id}`.
- A table that is not an API table renders as the site's tables do: a row header in the first cell, and each cell labeled with its column for narrow screens.
- A code block in another language renders read-only in the site's code editor, inside the `.theming-source` frame that every page puts around code.
- A code block that names a file and has no body shows that file, as the site ships or runs it, so the page never holds a 2nd copy. The path is relative to `docs/`, under `../static/` or `../examples/`:

  ````md
  ```css ../static/theme-default.css
  ```
  ````
- A code block that names a file replaces `{VERSION}` in it with the release, as the install snippet of [`docs/getting-started.md`](docs/getting-started.md) does.
- A `<script>` block, such as `<script type="module" src="/static/react-demo.js"></script>`, loads code for the page. A `<template>` block holds a response of the in-browser server simulator, which its script reads by ID. Both go at the end of the page, after the content. A simulator script is a file under `static/sim/<page>/`.

On every page, the first paragraph before the first `##` heading is the `.intro`.

A page in `ComponentGroups` in [`site.go`](site.go) is a component page. Its title is `#overview` with the page icon, its other paragraphs and top-level lists are `.demo-note`, and its alerts are `.demo-callout`. Any other page is a guide page, whose title keeps its heading ID, as in `# Server-driven architecture {#architecture}`, and whose other prose is plain.

### Alerts

A [GitHub alert](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts) renders as a `<neo-alert>`. An optional heading is its title, and 1 paragraph is its description:

```md
> [!NOTE]
> ### Every Morpheus demo uses Datastar
>
> In order to avoid hosting a server ...
```

`NOTE` is the `info` variant, and `WARNING` the `warning` variant. Other kinds fail the build until a page needs one. A blockquote without a marker stays a blockquote.

### Diagrams

`![alt](../static/<name>.svg)` renders `internal/site/static/<name>.svg` as an inline SVG, which styles itself with `currentColor` and the page's CSS variables. Use the SVG's own `aria-label` as the alt text, which GitHub and the Markdown copy show. A paragraph that holds only the image renders without a `<p>`. The relative path also works on GitHub and in the Markdown copy.

To put a diagram beside text, wrap both in raw HTML. Leave a blank line inside each `<div>`, so Markdown parses its content:

```md
<neo-layout row collapse="md" gap="lg" align-items="center">
<div neo-flex-grow="1" neo-flex-basis="0" neo-min-width="0" neo-width="100%">

1. A component **dispatches an event** ...

</div>
<div style="flex-grow: 2" neo-flex-basis="0" neo-min-width="0" neo-width="100%">

![Action-to-patch round trip: ...](../static/action_to_patch.svg)

</div>
</neo-layout>
```

### Block options

The info string of an `example` or `playground` block holds only the block type and the example name. Its options go in the body, 1 `key: value` per line. The value is the rest of the line, without quotes. An unknown key, a key set 2 times, a line without a key and a value, or a `key="value"` in the info string fails the build, at the line of the option.

### Example blocks

````md
```example <name>
min-height: max-content
```
````

shows the example `<name>` in a resizable demo frame with a tab per source file, see [Examples](#examples). Options:

| Option | Sets | Default |
| --- | --- | --- |
| `min-height` | Minimum stage height | `12rem` |
| `max-height` | Maximum stage height | `48rem` |
| `min-width` | Minimum stage width | `10%` |
| `max-width` | Maximum stage width | `100%` |
| `width`, `height` | Initial stage size | Content size |
| `class` | Extra class on the stage | None |
| `style` | Extra style of the stage, as in `align-items: flex-end;` | None |
| `boundary` | The scopes of the `<neo-boundary>` around the preview: `dismiss`, `positioning`, `scroll`, `stacking` | `dismiss positioning` |
| `tab` | Tab open at load: `html`, `templ`, `css`, `tsx`, `typescript` or `script`, if the frame has it | `hide` |
| `tabs` | The tabs to show, as in `templ css` for a demo whose HTML says little. `none` shows the preview alone, for a preview of the site itself such as the theme showcase. The Markdown copy shows the same sources. | The tabs of the files |
| `script` | A simulator module under `static/`, as in `sim/frameworks/accent.js`. The page loads it and the Server script tab shows it. | None |
| `simulator` | `delay` puts the hint that loading states need simulated delay above the frame, and `errors` the server error controls and that hint | None |
| `wrap` | The class of a `<div>` around the preview, for site layout the tabs leave out | None |

`min-height: max-content` fits the stage to the example. 273 of the 356 example blocks use it. A block without options has an empty body.

### Playground blocks

````md
```playground
height: 20rem
- button_default: Default
- button_variants: Variants & states
```
````

shows the interactive playground with 1 state per list item, `- <example>: <label>`, in that order. The other lines are options:

| Option | Sets | Default |
| --- | --- | --- |
| `id` | Element ID and Datastar signal prefix | `<slug>-playground` |
| `height` | Fixed preview height | Content height |
| `min-width` | Minimum preview width | `14rem` |
| `autoplay` | `true` cycles through the states once in view | Off |
| `boundary` | The scopes of the `<neo-boundary>` around the preview, as for example blocks | `dismiss positioning` |

A 2nd playground on 1 page needs its own `id`.

### Reference tables

Under `## Reference`, a level 3 heading named after an API kind takes a table with these columns, in this order. Elsewhere, such as an example called "States", it is a plain heading.

| Heading | Columns |
| --- | --- |
| `### Attributes` | Name, Type, Default, Description |
| `### States` | Name, Description |
| `### Slots` | Name, Description |
| `### Events` | Name, Detail, Bubbles, Description |
| `### Parts` | Name, Description |
| `### CSS variables` | Name, Default, Description |

- Each row gets the ID `<section>-<name>`, as in `#attributes-variant` and `#css-variables-neo-button-bg`. Write states as `` `:state(open)` `` and parts as `` `::part(summary)` ``. Their IDs use the bare name: `#states-open`.
- A Type cell holds the type in backticks, then the flags `reflected` and `observed` if any: `` `boolean`, reflected, observed ``. The flags render as badges.
- An empty Type, Default or Detail cell renders "none".
- Bubbles is `yes` or `no`.
- Escape `|` in a cell as `\|`, inside backticks too.
- On a page that documents several elements, `### <neo-menuitem> {.api-element}` names the element whose tables follow, and the paragraph after it describes the element. Give each API heading its own ID, as in `### Attributes {#menuitem-attributes}`. The rows then get `#menuitem-attributes-<name>`. [`docs/menu.md`](docs/menu.md) documents 3 elements.
- A table with the columns of Attributes, Events or CSS variables, which no other kind has, is an API table under any heading. Its rows take the ID of the heading above, as the Kit-wide variables of [`docs/theming.md`](docs/theming.md) take `#kit-variables-<name>`. The `Name | Description` kinds need their heading.

### Links

| Write | For | Renders |
| --- | --- | --- |
| ``[`variant`](#attributes-variant)`` | A heading or reference row on the page | A code link |
| ``[`<neo-buttongroup>`](button-group.md)`` | Another page | A link chip |
| ``[`click`](https://www.w3.org/TR/uievents/#event-type-click)`` | An external page | A link chip |
| `[theming](theming.md)` | Another page, in prose | A plain link |
| `[React](https://react.dev)` | An external page, in prose | A link that opens in a new tab, with an icon |

A link whose whole text is code renders as a chip unless it leads to `#id` on the page. `<name>.md` names the page `/<name>/`, also a Templ page such as `bundle-builder.md`.

## Examples

An example is the files `<name>.*` in [`examples/`](examples), or the directory `<name>/`. Each file fills 1 tab.

As files:

- `<name>.templ` with 1 template, such as `templ ButtonVariants()` in `button_variants.templ`. Add it to `Templates` in [`examples/examples.go`](examples/examples.go). It is the preview, and the HTML tab shows its rendered output.
- `<name>.html`, the preview and the HTML tab of an example without a `.templ` file. 54 of the 57 playground defaults (`*_default`) are HTML.
- `<name>.css`, optional. The preview scopes it to the frame with `@scope`. An HTML example without one uses the CSS of its group: `popover_morph.css` styles `popover_morph_50.html`.

`examples.Templates` lists every `.templ` example, and `TestTemplates` fails when a `.templ` file is missing from it.

As a directory, for an example whose preview differs from the source it shows, such as [`examples/react/`](examples/react):

| File | Preview and page | Tab |
| --- | --- | --- |
| `preview.html`, required | The preview | HTML, unless another `.html` file exists |
| 1 other `.html` | None | HTML |
| `.css` | Scoped to the preview | CSS |
| `.tsx` | None | TSX |
| `.ts` | None | TypeScript |
| `.js` | Loaded by the page once, inline, as a module | Server script |

Any other file fails the build, and so does a 2nd file for 1 tab. A templ example can't be a directory, because Go makes each directory its own package. An example with a `.js` file takes no `script` option and can't be a playground state.

React's runtime, [`static/react-demo.js`](static/react-demo.js), is not part of the example. It is a hand-written JavaScript copy of `ColorPicker.tsx` that mounts into the `#framework-demo-root` of `preview.html`, so `frameworks.md` loads it with a `<script>` block.

## Build checks

`go test ./internal/site` and gen fail on:

- A page that doesn't start with `# Title`, or has 2 level 1 headings.
- An example name with neither a registered `.templ` nor an `.html` file, in an example block or a playground state.
- An example block without exactly 1 name, with a `tab` the frame doesn't show, or with a `script` that is not a file under `static/sim/`.
- A directory example without `preview.html`, with a file of another type, or with 2 files for 1 tab. A `.js` file that holds `</script`.
- A playground state that isn't `- <example>: <label>`, or a playground without states.
- A broken option, see [Block options](#block-options).
- An API heading without a table, wrong columns, a wrong cell count, an empty name, or 2 rows with the same ID.
- A Type cell that doesn't start with the type in backticks, or has a flag other than `reflected` and `observed`. A Bubbles cell other than `yes` and `no`.
- A `#id` that is not on the page, or `<name>.md#id` that is not on a Markdown page.
- An image that is not `../static/<name>.svg`, or whose file doesn't exist.
- An alert of a kind other than `NOTE`, or with more than a heading and 1 paragraph.
- A code block that names a file it can't find, a file outside `../static/` and `../examples/`, more than 1 file, or a file and a body.
- `tabs` with a tab the frame doesn't have, `simulator` other than `delay` and `errors`, `autoplay` other than `true`, or an unknown `boundary` scope.
- A link that is not a URL, `#id`, `<name>.md` or `<name>.md#id`.

gen also fails on a link to `<name>.md` that is not a page, and on a Markdown page missing from `buildPages`.

Not checked: fragments on Templ pages, empty descriptions, and Markdown style.
