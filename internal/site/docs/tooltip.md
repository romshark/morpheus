# Tooltip

Component `<neo-tooltip>` is a hover/focus tooltip on the same positioning primitives as `<neo-popover>` with tooltip semantics (no focus stealing, no click dismissal, `pointer-events: none`, `role="tooltip"`, and `aria-describedby` on the trigger). The first non-content child is the trigger. The [`text`](#attributes-text) attribute is the shorthand body; pass a child carrying [`[data-neo-tooltip-content]`](#slots-data-neo-tooltip-content) instead to render rich markup.

> [!WARNING]
> ### Not visible on touch
>
> Tooltips trigger on hover and keyboard focus. Touch devices have neither. A tap never reveals one. Never put essential information only in a tooltip; keep it available inline for touch and assistive technology users.

```playground
height: 20rem
- tooltip_default: Default
- tooltip_placements: Placements
- tooltip_shorthand: Shorthand body
- tooltip_rich: Rich content
- tooltip_delays: Delays
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | `string`, observed |  | Plain-text body. Ignored when `[data-neo-tooltip-content]` is present. |
| `placement` | `string`, observed | `"bottom-start"` | Same values as [`<neo-popover>`](popover.md); the bubble moves to the opposite side when it doesn't fit, and hides when neither side fits. |
| `hover-open-delay` | `number` | `350` | Hover dwell in ms before showing. Focus shows immediately. |
| `hover-close-delay` | `number` | `0` | Linger in ms after pointer leaves. |
| `open` | `boolean`, reflected, observed | `false` | Controls tooltip visibility. |

### Slots

| Name | Description |
| --- | --- |
| default | Trigger element. |
| `[data-neo-tooltip-content]` | Rich body. Overrides the `text` attribute. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-tooltip-bg` | `color-mix(in srgb, var(--page-fg) 92%, transparent)` | Tooltip background. |
| `--neo-tooltip-color` | `var(--page-bg)` | Tooltip text color. |
| `--neo-tooltip-radius` | `var(--page-radius, 0.25rem)` | Corner radius. |
| `--neo-tooltip-padding` | `calc(var(--page-spacing, 0.25rem) * 1.25) calc(var(--page-spacing, 0.25rem) * 2.25)` | Inner padding. |
| `--neo-tooltip-font-size` | `0.8rem` | Body font size. |
| `--neo-tooltip-max-width` | `18rem` | Maximum width before the body wraps. |
| `--neo-tooltip-shadow` | `0 4px 12px -2px rgba(0, 0, 0, 0.25)` | Box shadow. |
| `--neo-tooltip-z-index` | `1100` | Stacking order of the floating body. |
| `--neo-tooltip-enter-duration` | `calc(120ms * var(--neo-duration-scale, 1))` | Enter and exit transition duration. |
| `--neo-tooltip-screen-offset` | `8px` | Minimum margin between the body and the viewport edge. |

## Examples

### Placements

Each side (`top`, `right`, `bottom`, `left`) pairs with an optional `-start` or `-end` alignment, for 12 combinations. Bare side names center the panel on that edge; `bottom-start` is the initial value.

```example tooltip_placements
```

### Shorthand body

Pass [`text`](#attributes-text) and skip the slot entirely. Common for icon-only triggers where the tooltip names the action a glyph represents.

```example tooltip_shorthand
```

### Rich content

Drop a child carrying [`[data-neo-tooltip-content]`](#slots-data-neo-tooltip-content) to render arbitrary markup as the body. The [`text`](#attributes-text) attribute is ignored once that slot is present.

```example tooltip_rich
```

### Delays

[`hover-open-delay`](#attributes-hover-open-delay) is the hover dwell (ms) the host waits before showing the tooltip; [`hover-close-delay`](#attributes-hover-close-delay) is how long it lingers after the pointer leaves. Defaults are `350` and `0`. Focus shows the tooltip immediately; the delays are hover-only.

```example tooltip_delays
```
