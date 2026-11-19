# Badge

Component `<neo-badge>` is a small inline label / chip for status, counts, tags, and category markers. Variants reuse the button colour tokens, which means a theme change restyles badges too.

```playground
- badge_default: Default
- badge_variants: Variants
- badge_with_icon: With icon
- badge_status_dot: With status dot
- badge_as_link: As link
- badge_counts: Counts
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"primary" \| "secondary" \| "danger" \| "outline"` |  | Visual style. Omit for the default neutral chip. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-badge-padding-y` | `0.125rem` | Vertical padding. |
| `--neo-badge-padding-x` | `0.5rem` | Horizontal padding. |
| `--neo-badge-radius` | `9999px` | Corner radius. Default fully rounds the chip into a pill. |
| `--neo-badge-font-size` | `0.75rem` | Label font size. |
| `--neo-badge-font-weight` | `600` | Label font weight. |
| `--neo-badge-gap` | `0.25rem` | Gap between an icon and the label. |
| `--neo-badge-border-color` | `color-mix(in srgb, var(--page-fg) 14%, transparent)` | Border color of the default and `outline` chips. |
| `--neo-badge-bg` | `color-mix(in srgb, var(--page-fg) 6%, transparent)` | Background of the default chip. |
| `--neo-badge-color` | `var(--page-fg)` | Text color of the default chip. |

## Examples

### Variants

The default (neutral), `primary`, `secondary`, `danger`, and `outline` (transparent with a border) fills are tied to the button colour tokens.

```example badge_variants
min-height: max-content
```

### With icon

Drop a `<neo-icon>` as the badge's first child. The flex layout spaces it from the label. The icon inherits the badge's font colour and recolours with the variant.

```example badge_with_icon
min-height: max-content
```

### With status dot

A small inline `<span>` with a round `background` makes a status-indicator badge. A modifier class sets the dot colour per status.

```example badge_status_dot
min-height: max-content
```

### As link

Wrap the badge in an `<a>`. Its `display: inline-flex` lets it nest inside inline anchors and pick up the link's hover and focus from the cascade.

```example badge_as_link
min-height: max-content
```

### Counts

Short numeric badges next to a label form the unread-count pattern. `line-height: 1` keeps them from stretching the row at small font sizes.

```example badge_counts
min-height: max-content
```

The badge sits on the text baseline and reads as part of a sentence without pushing surrounding lines apart. New tags roll out <neo-badge variant="primary">weekly</neo-badge> and the experimental ones ship behind a <neo-badge variant="outline">beta</neo-badge> flag.
