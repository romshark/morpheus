# Card

Component `<neo-card>` is a styled surface container. Wrap content in a single `<div data-neo-card-inner>`. The host paints the border, background, and radius; the inner element carries padding and gap rhythm. Optional `data-neo-card-*` markers cue a header / media / body / footer cadence.

```playground
- card_default: Default
- card_variants: Variants
- card_composed: Composed
- card_media_hero: Media hero
- card_horizontal: Horizontal media
- card_adaptive: Adaptive
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"" \| "outline" \| "elevated"` |  | Surface treatment. Empty (default) renders a filled card with a subtle border; `outline` drops the fill; `elevated` drops the border and adds a soft shadow. |
| `orientation` | `"" \| "horizontal"` |  | Layout direction. Empty (default) stacks slots top-to-bottom; `horizontal` places the media slot on the left and stacks header/body/footer in a column on the right. Horizontal cards auto-collapse to vertical when their own inline size drops below 28rem, via a CSS `@container` query (not viewport). |

### Slots

| Name | Description |
| --- | --- |
| `[data-neo-card-header]` | Header row. Stacks vertically (title above description); switches to a horizontal row pinning `[data-neo-card-actions]` to the end when actions are present. |
| `[data-neo-card-title]` | Card title. Bolder weight, slightly larger size; no default margin. |
| `[data-neo-card-description]` | Secondary line under the title. Muted color, no default margin. |
| `[data-neo-card-actions]` | Right-aligned actions inside the header. |
| `[data-neo-card-media]` | Edge-to-edge media. Escapes the card's padding via negative margins and rounds the corners that touch the card edge when placed first or last. |
| `[data-neo-card-body]` | Main content. Block layout, default line-height. |
| `[data-neo-card-footer]` | Footer actions row. Right-aligned, wraps on narrow widths. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-card-bg` | `var(--btn-bg, transparent)` | Card background. |
| `--neo-card-color` | `var(--page-fg, currentColor)` | Card text color. |
| `--neo-card-border-color` | `var(--btn-border, currentColor)` | Border color. |
| `--neo-card-border-width` | `1px` | Border width. |
| `--neo-card-radius` | `var(--page-radius, 0.5rem)` | Corner radius. |
| `--neo-card-padding` | `calc(var(--page-spacing, 0.25rem) * 5)` | Inner padding. |
| `--neo-card-gap` | `calc(var(--page-spacing, 0.25rem) * 4)` | Gap between stacked slots. |
| `--neo-card-shadow` | `0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 14px rgba(0, 0, 0, 0.08)` | Box shadow used by the `elevated` variant. |
| `--neo-card-title-size` | `1.05rem` | Title font size. |
| `--neo-card-title-weight` | `600` | Title font weight. |
| `--neo-card-description-color` | `color-mix(in srgb, var(--page-fg) 65%, transparent)` | Description text color. |
| `--neo-card-horizontal-media-width` | `12rem` | Media column width in horizontal orientation. |
| `--neo-card-horizontal-body-min-width` | `12rem` | Body minimum width in horizontal orientation. |
| `--neo-card-media-default-height` | `8rem` | Default height of the media slot. |

## Examples

### Variants

The default [`variant`](#attributes-variant) is filled with a subtle border, `outline` has a border and no fill, and `elevated` has a soft shadow and no border.

```example card_variants
min-height: max-content
min-width: 18rem
```

### Composed

A typical composition uses a header (with title, description, and right-aligned actions), a body, and a footer row of buttons. The header switches from vertical stack to horizontal row via `:has([data-neo-card-actions])` only when actions are present.

```example card_composed
width: 28rem
min-height: max-content
min-width: 18rem
```

### Media hero

[`[data-neo-card-media]`](#slots-data-neo-card-media) escapes the card's padding so an image fills it edge-to-edge. The corners that touch the card edge round to match the host's [`--neo-card-radius`](#css-variables-neo-card-radius); the opposite edge stays sharp where it meets the next slot.

```example card_media_hero
width: 20rem
min-height: max-content
min-width: 18rem
```

### Horizontal media {#horizontal}

[`orientation="horizontal"`](#attributes-orientation) lays the card out as a row of [`[data-neo-card-media]`](#slots-data-neo-card-media) on the left and a column of [`[data-neo-card-header]`](#slots-data-neo-card-header), [`[data-neo-card-body]`](#slots-data-neo-card-body), and [`[data-neo-card-footer]`](#slots-data-neo-card-footer) on the right. The media slot fills the left column edge-to-edge and rounds the corners that touch the card's left edge.

```example card_horizontal
width: 36rem
min-height: 8rem
min-width: 36rem
```

### Adaptive

The same horizontal-mode markup auto-collapses to a vertical stack via an `@container` query keyed on the card's own inline size, below a fixed 28rem. No `@media` rule and no JavaScript. Drag the resize handle below 28rem to see the card adapt to its own width.

```example card_adaptive
width: 36rem
min-height: max-content
min-width: 18rem
```
