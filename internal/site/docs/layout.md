# Layout

Component `<neo-layout>` is a CSS-only Flexbox container whose attributes are CSS flex properties and whose values are CSS values. One element covers stacks, rows, wrapping clusters, and centered boxes, with no utility classes and no build step. Per-child flex behaviour comes from namespaced `neo-*` attributes on any flex child. You write no media queries of your own. A row that `wrap`s reflows on its own as its width changes, and children that grow or shrink ([`neo-flex-grow`](#item-attributes-neo-flex-grow), [`neo-flex-shrink`](#item-attributes-neo-flex-shrink)) take up or give back space. The row-to-column breakpoints it does have ([`collapse`](#attributes-collapse), [`neo-hide-below`](#item-attributes-neo-hide-below), [`neo-show-below`](#item-attributes-neo-show-below)) are CSS container queries keyed to the nearest [`container`](#attributes-container) ancestor's width, not the viewport, which lets the same markup adapt inside a sidebar, a drawer, or a full page. The example CSS sets only sizes and decoration, and the layout comes from the kit. Resize the live example to simulate a narrower screen, or reshape it with the parameters.

```playground
- layout_overview: Composition
- layout_cluster: Wrapping cluster
- layout_grid: Responsive grid
- layout_conditional: Responsive conditional rendering
- layout_collapse: Responsive collapse
- layout_align_items: align-items values
- layout_justify_content: justify-content values
- layout_align_content: align-content values
- layout_shell: Child attributes
- layout_spacer: Spacer
- layout_separate_gaps: Split row and column gaps
- layout_reverse: Reverse direction
- layout_inline: Inline flow
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `row, row-reverse, column, column-reverse` | `boolean` |  | flex-direction, as a boolean attribute. Pick one; row is the default. |
| `nowrap, wrap, wrap-reverse` | `boolean` |  | flex-wrap, as a boolean attribute. Default nowrap. |
| `align-items` | `"flex-start" \| "flex-end" \| "center" \| "stretch" \| "baseline"` |  | Cross-axis alignment. Its value is the literal CSS keyword, which makes the attribute read like the flex rule it emits. |
| `justify-content` | `"flex-start" \| "flex-end" \| "center" \| "space-between" \| "space-around" \| "space-evenly"` |  | Main-axis distribution. Its value is the literal CSS keyword, which makes the attribute read like the flex rule it emits. |
| `align-content` | `"flex-start" \| "flex-end" \| "center" \| "space-between" \| "space-around" \| "space-evenly" \| "stretch"` |  | Cross-axis distribution of wrapped lines; takes effect only with `wrap`. Its value is the literal CSS keyword, which makes the attribute read like the flex rule it emits. |
| `gap` | `"none" \| "xs" \| "sm" \| "md" \| "lg" \| "xl" \| "2xl"` |  | Spacing between children on both axes. `column-gap` and `row-gap` override it per axis. |
| `column-gap` | `"none" \| "xs" \| "sm" \| "md" \| "lg" \| "xl" \| "2xl"` |  | Spacing between children along the row. Overrides `gap` on this axis. |
| `row-gap` | `"none" \| "xs" \| "sm" \| "md" \| "lg" \| "xl" \| "2xl"` |  | Spacing between wrapped lines. Overrides `gap` on this axis. |
| `min-height` | `"100vh" \| "100%"` |  | Minimum-height preset. |
| `inline` | `boolean` |  | Use `display: inline-flex`. |
| `container` | `boolean` |  | Neo extension: make this a query container (`container-type: inline-size`) so a descendant's `collapse` reacts to this element's width. |
| `collapse` | `"sm" \| "md" \| "lg"` |  | Neo extension: fold a row to a column when the nearest `container` ancestor is narrower than the tier (40 / 48 / 64rem). Container-query based. Reacts to the box, not the viewport. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-space-none` | `0` | The `none` step of `gap`, `column-gap` and `row-gap`. |
| `--neo-space-xs` | `0.25rem` | The `xs` step of `gap`, `column-gap` and `row-gap`. |
| `--neo-space-sm` | `0.5rem` | The `sm` step of `gap`, `column-gap` and `row-gap`. |
| `--neo-space-md` | `1rem` | The `md` step of `gap`, `column-gap` and `row-gap`. |
| `--neo-space-lg` | `1.5rem` | The `lg` step of `gap`, `column-gap` and `row-gap`. |
| `--neo-space-xl` | `2rem` | The `xl` step of `gap`, `column-gap` and `row-gap`. |
| `--neo-space-2xl` | `3rem` | The `2xl` step of `gap`, `column-gap` and `row-gap`. |
| `--neo-size-sidebar` | `16rem` | Sidebar width preset. Set it as a child's `flex-basis` via `style`. |
| `--neo-size-panel` | `24rem` | Panel width preset. Set it as a child's `flex-basis` via `style`. |
| `--neo-size-content` | `48rem` | Content column width preset. Set it as a child's `flex-basis` via `style`. |

### Child attributes {.api-element}

Namespaced `neo-*` attributes set on any flex child. Each is `neo-` plus the CSS property it sets.

### Attributes {#item-attributes}

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `neo-flex-grow` | `"0" \| "1"` |  | flex-grow. Set to 1 to fill; doubles as a spacer. |
| `neo-flex-shrink` | `"0" \| "1"` |  | flex-shrink. Set to 0 to pin the size. |
| `neo-flex-basis` | `"0" \| "auto" \| "100%"` |  | flex-basis (CSS keywords only). For a fixed width set it via `style` (e.g. `style="flex-basis: var(--neo-size-sidebar)"`). |
| `neo-align-self` | `"flex-start" \| "flex-end" \| "center" \| "stretch" \| "baseline"` |  | Per-child align-self override. |
| `neo-width` | `"100%"` |  | Definite full width of the containing block. |
| `neo-height` | `"100%"` |  | Definite full height of the containing block. |
| `neo-min-width` | `"0"` |  | min-width:0, the flex min-size fix, in a row. |
| `neo-min-height` | `"0"` |  | min-height:0, the flex min-size fix, in a column. |
| `neo-overflow` | `"visible" \| "hidden" \| "scroll" \| "auto"` |  | Overflow behaviour. |
| `neo-truncate` | `boolean` |  | Neo extension: single-line ellipsis truncation. |
| `neo-hide-below` | `"sm" \| "md" \| "lg"` |  | Neo extension: hide the child while the nearest `container` is narrower than the tier (40 / 48 / 64rem). Container-query based. |
| `neo-show-below` | `"sm" \| "md" \| "lg"` |  | Neo extension: show the child only while the nearest `container` is narrower than the tier (hidden at or above it). |

## Examples

### Composition

A whole dashboard nested several levels deep and filling the stage. The root is a [`container`](#attributes-container). As you drag the corner, the navbar switches between 3 layouts (links become a search icon, full buttons become an icon group) via [`neo-hide-below`](#item-attributes-neo-hide-below) / [`neo-show-below`](#item-attributes-neo-show-below), the cards reflow from 3 to 2 to 1 per row, and the dashboard scrolls vertically when it overflows. All box-relative, no viewport media queries.

```example layout_overview
width: 56rem
height: 28rem
min-height: 20rem
min-width: 22rem
```

### Wrapping cluster {#cluster}

A `row` with `wrap` flows its children onto new lines as the stage narrows. This is the "cluster" shape for tags, chips, and filters.

```example layout_cluster
width: 30rem
min-height: max-content
min-width: 10rem
```

### Responsive grid

Growing cards with a shared `flex-basis` form equal rows and wrap into fewer columns as the stage narrows. No breakpoints required.

```example layout_grid
width: 44rem
height: 16rem
min-height: 8rem
min-width: 12rem
```

### Responsive conditional rendering {#conditional-rendering}

Resize the stage below `40rem`. The detailed label and text button hide, while compact replacements appear. The condition follows the nearest [`container`](#attributes-container), not the viewport.

```example layout_conditional
width: 44rem
min-height: max-content
min-width: 16rem
```

### Responsive collapse {#collapse}

A `row` folds to a single `column` when its nearest [`container`](#attributes-container) ancestor drops below a tier. Drag the stage under `40rem` and the 3 panels reflow from a row into a stack via a container query, which tracks the box, not the viewport.

```example layout_collapse
width: 44rem
min-height: max-content
min-width: 13rem
```

### align-items

Demonstrates all possible values for [`align-items`](#attributes-align-items).

```example layout_align_items
min-height: max-content
min-width: 13rem
```

### justify-content

Demonstrates all possible values for [`justify-content`](#attributes-justify-content).

```example layout_justify_content
width: 40rem
min-height: max-content
min-width: 15rem
```

### align-content

Demonstrates all possible values for [`align-content`](#attributes-align-content).

```example layout_align_content
width: 16.5rem
min-height: max-content
min-width: 16.5rem
```

### Child attributes

Resize in both directions. The folder rail keeps its fixed basis, the main pane grows into the remaining space, its long title truncates instead of forcing the row wider, and the checklist scrolls when height runs out. Each behaviour comes from a `neo-*` attribute on the child that needs it.

```example layout_shell
width: 36rem
height: 16rem
min-width: 22rem
```

### Spacer

A spacer is just an empty child that grows. Drop a child with [`neo-flex-grow="1"`](#item-attributes-neo-flex-grow) between 2 groups and it takes up the leftover space, pinning whatever follows to the far edge. Here it keeps **Save** to the right while **Back** and the title stay on the left.

```example layout_spacer
width: 30rem
min-height: max-content
min-width: 22rem
```

### Split row and column gaps {#separate-gaps}

[`column-gap`](#attributes-column-gap) spaces the children along the row; [`row-gap`](#attributes-row-gap) spaces the wrapped lines. Columns are tight (`xs`) and rows are loose (`lg`). The chips stay close while wrapped lines get room. Narrow the stage to wrap them.

```example layout_separate_gaps
width: 26rem
min-height: max-content
min-width: 10rem
```

### Reverse direction {#reverse}

`row-reverse` and `column-reverse` flip the main-axis order so the first child renders last; the DOM order (and tab order) stays intact. Both groups list 1, 2, 3 in source.

```example layout_reverse
width: 100%
height: 12rem
min-height: 9rem
min-width: 16rem
```

### Inline flow {#inline}

[`inline`](#attributes-inline) switches the container to `display: inline-flex`. It then sits in the text flow instead of forcing its own line, which suits an icon-and-label cluster inside running prose.

```example layout_inline
width: 26rem
min-height: max-content
min-width: 12rem
```
