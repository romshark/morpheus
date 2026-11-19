# Breadcrumb

Component `<neo-breadcrumb>` is a horizontal trail of links ending in the current page. A `ResizeObserver` watches the host width and switches between the full trail, middle items collapsed into a popover, and just *menu + last* when even that doesn't fit.

```playground
- breadcrumb_default: Default
- breadcrumb_deep: Deep trail
- breadcrumb_compact: Deep trail, compact labels
- breadcrumb_slash: Slash separator
- breadcrumb_dot: Dot separator
- breadcrumb_sparkles: Icon separator (sparkles)
- breadcrumb_chips: Chip wrappers
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `placement` | `"bottom-start" \| "bottom" \| "bottom-end" \| "top-start" \| "top" \| "top-end" \| "left-start" \| "left" \| "left-end" \| "right-start" \| "right" \| "right-end"`, observed | `"bottom-start"` | Forwarded to the overflow [`<neo-popover>`](popover.md) when middle items collapse into a menu; see its placement values. |
| `screen-offset` | `string`, observed |  | Forwarded to the overflow [`<neo-popover>`](popover.md); controls the viewport edge margin and scrollable max size. |
| `follow-scroll` | `"always" \| "until-trigger-invisible"`, observed | `unset` | Forwarded to the overflow `<neo-popover>`. When absent, close on outside scroll. Set to `always` to stay anchored during scroll. Set to `until-trigger-invisible` to close once the trigger leaves the viewport. |
| `clamp-placement` | `boolean`, observed | `false` | Forwarded to the overflow [`<neo-popover>`](popover.md); re-anchor the menu so it stays inside the viewport when content would overflow. |
| `min-fit-height` | `CSS length \| "content"`, observed | `"content"` | Forwarded to the overflow [`<neo-popover>`](popover.md); minimum vertical slot before the menu auto-flips to the opposite side. |
| `min-fit-width` | `CSS length \| "content"`, observed | `"content"` | Forwarded to the overflow [`<neo-popover>`](popover.md); same as `min-fit-height` but for the horizontal axis. |
| `min-open-height` | `CSS length`, observed | `2rem` | Forwarded to the overflow [`<neo-popover>`](popover.md); close when the bounded vertical slot is too small to be useful. Use `0` to disable. |
| `min-open-width` | `CSS length`, observed | `2rem` | Forwarded to the overflow [`<neo-popover>`](popover.md); same as `min-open-height` but for horizontal space. Use `0` to disable. |
| `more-label` | `string`, observed | `"Show hidden breadcrumbs"` | Accessible name of the overflow trigger. |

### Slots

| Name | Description |
| --- | --- |
| default | Anchor or text items. Use `data-neo-breadcrumb-sep` on a child to render it as a custom separator. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-breadcrumb-change` | `{ shown: string[], hidden: string[] }` | yes | Fires when the trail adapts to its container, only on a real visible/collapsed change, not on every resize. `shown` and `hidden` are the ids of the items still in the trail vs. moved into the overflow menu; items without an id are omitted. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-breadcrumb-gap` | `calc(var(--page-spacing, 0.25rem) * 2)` | Gap between trail items and separators. |
| `--neo-breadcrumb-color` | `var(--muted, currentColor)` | Color of non-current links and separators. |
| `--neo-breadcrumb-current-color` | `var(--page-fg, currentColor)` | Color of the current page and hovered links. |
| `--neo-breadcrumb-separator-size` | `0.85em` | Separator font size. |

## Examples

### Deep trail

A deeper trail that exercises every render mode. The frame opens at a width that already forces the middle items into the `...` menu, with the tail kept visible. Drag the frame wider to recover the full trail, or narrower to collapse to *menu + last*.

```example breadcrumb_deep
width: 30rem
min-height: max-content
```

### Deep trail, compact labels

The same stress case with compact single-letter crumbs. This keeps many more items visible before collapsing, which is useful for checking that the separator logic still behaves when labels are tiny.

```example breadcrumb_compact
width: 24rem
min-height: max-content
```

### Slash separator

Write whatever you like as the `[data-neo-breadcrumb-sep]` element between 2 items. Here a slash.

```example breadcrumb_slash
width: 100%
min-height: max-content
```

### Dot separator

Same idea with a middle-dot character, which is softer and more typographic.

```example breadcrumb_dot
width: 100%
min-height: max-content
```

### Icon separator (sparkles)

A separator can hold arbitrary markup, including other kit components, like a `<neo-icon>` with a non-default name.

```example breadcrumb_sparkles
width: 100%
min-height: max-content
```

### Chip wrappers

Wrap each item in whatever markup you want; the wrapper just becomes the item. The current page can take its own treatment.

```example breadcrumb_chips
width: 100%
min-height: max-content
```
