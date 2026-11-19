# Pagination

Component `<neo-pagination>` is adaptive page navigation. Set [`page`](#attributes-page) and [`pages`](#attributes-pages) attributes and the host builds the Prev / boundary / window / boundary / Next chips, flags the current page with `aria-current="page"`, and dispatches [`neo-pagination-change`](#events-neo-pagination-change) on click. A ResizeObserver shrinks the sibling window first, then the boundary count, until the chips fit on a single row.

```playground
- pagination_default: Default
- pagination_sibling: Sibling count = 2
- pagination_boundary: Boundary count = 2
- pagination_first_page: First page
- pagination_last_page: Last page
- pagination_short_run: Short run
- pagination_custom_slots: Custom prev / next slots
- pagination_empty_slots: No prev / next buttons
- pagination_disabled: Disabled
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | `number`, reflected, observed | `1` | Active page (1-indexed). Two-way bind via `data-attr:page` `data-on:neo-pagination-change`. |
| `pages` | `number`, observed | `1` | Total page count. `page` is clamped to `[1, pages]` on every render. |
| `sibling-count` | `number`, observed | `1` | Pages shown on each side of the active one. Increase to make +/-N navigation cheaper; the adapt loop shrinks this first when the row runs out of room. |
| `boundary-count` | `number`, observed | `1` | Pages pinned at the start and end of the run. The adapt loop shrinks it after the sibling window has bottomed out at 0. |
| `disabled` | `boolean`, observed | `false` | Greys every chip and ignores clicks. Useful while a parent dataset is still loading. |
| `aria-label` | `string` | `"Pagination"` | Set on the host's `role="navigation"` so screen readers announce the landmark. |
| `previous-label` | `string`, observed | `"Previous page"` | Accessible name of the previous button. |
| `next-label` | `string`, observed | `"Next page"` | Accessible name of the next button. |
| `page-label` | `string`, observed | `"Page {n}"` | Accessible name of each page button. `{n}` stands for the page number. |

### Slots

| Name | Description |
| --- | --- |
| `template[data-neo-pagination-prev]` | Inner HTML of the prev button. Captured once on connect from a `<template>` child; the kit re-uses it on every render. Default (no template) is a single `chevron-left` icon (icon-only button). An *empty* template (`<template data-neo-pagination-prev></template>`) opts out of the prev button entirely. |
| `template[data-neo-pagination-next]` | Same as the prev slot, on the right; default is `chevron-right`, empty opts out. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-pagination-change` | `{ page: number }` | yes | Fires when the user picks a chip or clicks prev / next. `page` is the new active page; the host has already reflected `page=` by the time the event dispatches. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-pagination-gap` | `calc(var(--page-spacing, 0.25rem) * 1)` | Gap between chips. |
| `--neo-pagination-page-min` | `2.25rem` | Minimum width and height of a page chip. |
| `--neo-pagination-active-bg` | `var(--accent, currentColor)` | Background of the active page chip. |
| `--neo-pagination-active-color` | `var(--accent-fg, var(--page-bg, #fff))` | Text color of the active page chip. |
| `--neo-pagination-active-hover-bg` | `color-mix(in srgb, var(--neo-pagination-active-bg), #000 12%)` | Active chip background on hover. |
| `--neo-pagination-active-active-bg` | `color-mix(in srgb, var(--neo-pagination-active-hover-bg), #000 8%)` | Active chip background while pressed. |

## Examples

### Sibling count = 2

[`sibling-count="2"`](#attributes-sibling-count) reveals 2 neighbours on each side of the active page rather than 1. Useful when users frequently jump +/-2 pages and a single neighbour reads as too tight.

```example pagination_sibling
min-height: max-content
```

### Boundary count = 2

With [`boundary-count="2"`](#attributes-boundary-count) the first and last 2 pages always render, handy for tables where users habitually jump to "page 1 / 2" or "second-to-last / last".

```example pagination_boundary
min-height: max-content
```

### First page

When the current page sits at or near the boundary, the matching ellipsis collapses and the window snaps flush against the edge run.

```example pagination_first_page
min-height: max-content
```

### Last page

```example pagination_last_page
min-height: max-content
```

### Short run

With fewer pages than the configured window plus boundary, the host lays out every page with no ellipses.

```example pagination_short_run
min-height: max-content
```

### Custom prev / next slots

The host exposes 2 `<template>` slots, `[data-neo-pagination-prev]` and `[data-neo-pagination-next]`, whose inner HTML becomes the body of the prev / next buttons. Default content is a single chevron icon. A bare host renders icon-only buttons.

```example pagination_custom_slots
min-height: max-content
```

### No prev / next buttons

Pass a `<template data-neo-pagination-prev>` / `<template data-neo-pagination-next>` with no children and the matching button is omitted entirely. Only the page chips remain. Useful when the dataset's prev / next is wired elsewhere (keyboard shortcut, sidebar nav).

```example pagination_empty_slots
min-height: max-content
```

### Disabled

[`disabled`](#attributes-disabled) greys every chip and ignores clicks. Use it while a parent dataset is loading.

```example pagination_disabled
min-height: max-content
```
