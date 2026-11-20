# Rating

Component `<neo-rating>` is a symbol-based rating control (stars by default) following the WAI-ARIA slider pattern. The host is the single focusable slider and the symbols are decorative, which makes screen readers announce a single value instead of [`max`](#attributes-max) separate widgets. Hover or drag previews; click commits. Keyboard arrows, `Home` / `End`, and digit keys preview; `Enter` commits. Set [`precision="0.5"`](#attributes-precision) to allow half symbols.

```playground
- rating_default: Default
- rating_basic: Basic
- rating_half: Half-symbol precision
- rating_readonly: Read-only
- rating_disabled: Disabled
- rating_ten: Custom range
- rating_hearts: Hearts, large
- rating_fire: Themed via custom properties
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number`, reflected, observed | `0` | Current rating, clamped to `[0, max]` and snapped to `precision`. |
| `max` | `number`, observed | `5` | Number of symbols. |
| `precision` | `number`, observed | `1` | Smallest selectable step in `(0, 1]`. `0.5` gives half symbols, `0.25` quarters. |
| `icon` | `string`, observed | `"star"` | `neo-icon` name drawn for each symbol (e.g. `heart`). |
| `label` | `string`, observed |  | Accessible name; mirrored to `aria-label` unless an `aria-labelledby` is already set. |
| `size` | `"" \| "sm" \| "lg"` | `""` | Symbol size shorthand for `--neo-rating-symbol-size`. |
| `readonly` | `boolean`, observed | `false` | Display-only. Announced to AT but not interactive and out of the tab order. |
| `disabled` | `boolean`, observed | `false` | Read-only plus a dimmed, non-interactive appearance. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-rating-input` | `{ value: number }` | yes | Fires continuously while previewing (hover, drag, or keyboard candidate) with the value not yet committed. |
| `neo-rating-change` | `{ value: number }` | yes | Fires on commit (click, drag end, keyboard Enter) and only when the value actually changed. |

### Parts

| Name | Description |
| --- | --- |
| `::part(svg)` | The symbol's `<svg>`, forwarded from the nested `<neo-icon>` so its fill and stroke can be styled. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-rating-symbol-size` | `1.5rem` | Symbol size. |
| `--neo-rating-symbol-gap` | `0.15rem` | Gap between symbols. |
| `--neo-rating-color` | `#f59e0b` | Color of filled symbols. |
| `--neo-rating-preview-color` | `var(--neo-rating-color)` | Color of the preview shown while hovering or dragging. |
| `--neo-rating-empty-color` | `var(--btn-border)` | Color of empty symbols. |
| `--neo-rating-transition-duration` | `calc(120ms * var(--neo-duration-scale, 1))` | Fill transition duration. |

## Examples

### Basic

5 stars, whole-symbol steps. Click a star or focus the control, preview with a digit / arrow key, and press `Enter` to commit.

```example rating_basic
min-height: max-content
```

### Half-symbol precision

With [`precision="0.5"`](#attributes-precision) the left half of a symbol selects the half value and the right half the whole one; pointer and arrow keys both step by `0.5`.

```example rating_half
min-height: max-content
```

### Read-only {#readonly}

[`readonly`](#attributes-readonly) shows an aggregate score. It is still announced to assistive tech but takes no pointer or keyboard input and stays out of the tab order.

```example rating_readonly
min-height: max-content
```

### Disabled

[`disabled`](#attributes-disabled) is read-only plus a dimmed, non-interactive look; use it when the rating is temporarily unavailable.

```example rating_disabled
min-height: max-content
```

### Custom range {#custom-max}

[`max`](#attributes-max) sets the symbol count; here a score out of 10.

```example rating_ten
min-height: max-content
```

## Customization

The symbol is any `neo-icon` via the [`icon`](#attributes-icon) attribute. The look comes from [`--neo-rating-color`](#css-variables-neo-rating-color) (filled), [`--neo-rating-empty-color`](#css-variables-neo-rating-empty-color) (track), and [`--neo-rating-symbol-size`](#css-variables-neo-rating-symbol-size) / [`--neo-rating-symbol-gap`](#css-variables-neo-rating-symbol-gap). The [`size`](#attributes-size) attribute is a shorthand for the common small / large symbol sizes.

### Hearts, large {#hearts}

[`icon="heart"`](#attributes-icon) swaps the symbol; [`size="lg"`](#attributes-size) scales it up.

```example rating_hearts
min-height: max-content
```

### Themed via custom properties {#themed}

A scoped class redefines the `--neo-rating-*` variables (a warm ember palette with wider spacing) without touching the component itself.

```example rating_fire
min-height: max-content
```
