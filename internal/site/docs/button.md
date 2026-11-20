# Button

Component `<neo-button>` is a styled, keyboard-activated button with variant, size, and icon-slot conventions shared across the kit.

```playground
- button_default: Default
- button_variants: Variants & states
- button_composed: Composed content
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"primary" \| "secondary" \| "ghost" \| "danger" \| "anchor"` | | Visual style. Omit for the default neutral styling. |
| `disabled` | `boolean`, observed | `false` | Removes the host from the tab order and swallows clicks. |
| `size` | `"sm" \| "lg"` | | Control-size step, `sm` compact or `lg` large. Omit for the default size. |
| `value` | `string` | | Selection value inside a [`<neo-buttongroup>`](button-group.md). |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| [`click`](https://www.w3.org/TR/uievents/#event-type-click) | | yes | Also fires on `Enter` / `Space`. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-button-bg` | `var(--btn-bg)` | Background of the default neutral button. |
| `--neo-button-color` | `var(--btn-fg)` | Text color of the default neutral button. |
| `--neo-button-border-color` | `var(--btn-border)` | Border color of the default neutral button. |
| `--neo-button-hover-bg` | `var(--btn-hover-bg)` | Background on hover for the default neutral button. |
| `--neo-button-active-bg` | `rgba(0, 0, 0, 0.08)` | Background while pressed (`:active`) for the default neutral button. Darker than hover. |
| `--neo-button-active-color` | `var(--neo-button-color)` | Text color while pressed for the default neutral button. |
| `--neo-button-gap` | `0.35rem` | Gap between adjacent button content (icon and label). |
| `--neo-button-shadow` | `0 1px 2px rgba(0, 0, 0, 0.1)` | Resting box shadow. |
| `--neo-button-hover-shadow` | `0 6px 16px rgba(0, 0, 0, 0.2)` | Box shadow on hover. |
| `--neo-button-active-shadow` | `0 1px 3px rgba(0, 0, 0, 0.14)` | Box shadow while pressed. |
| `--neo-button-hover-lift` | `-1px` | Vertical `translateY` offset on hover. Zeroed under reduced motion and while a popup is anchored open. |
| `--neo-button-active-lift` | `1px` | Vertical `translateY` offset while pressed. Zeroed under reduced motion and while a popup is anchored open. |
| `--neo-button-radius` | `var(--page-radius, 0.25rem)` | Corner radius. |
| `--neo-button-padding` | `round(calc(var(--page-spacing, 0.25rem) * 2), 1px) round(calc(var(--page-spacing, 0.25rem) * 3.5), 1px)` | Per-side padding, snapped to whole pixels so the used height stays an integer. |
| `--neo-button-primary-bg` | `var(--accent)` | Background of the `primary` variant. |
| `--neo-button-primary-color` | `var(--accent-fg)` | Text color of the `primary` variant. |
| `--neo-button-primary-hover-bg` | `var(--accent-hover)` | Background on hover for the `primary` variant. |
| `--neo-button-primary-active-bg` | `color-mix(in srgb, var(--neo-button-primary-hover-bg), #000 8%)` | Background while pressed for the `primary` variant. |
| `--neo-button-secondary-bg` | `color-mix(in srgb, var(--page-fg) 10%, transparent)` | Background of the `secondary` variant. |
| `--neo-button-secondary-color` | `var(--page-fg)` | Text color of the `secondary` variant. |
| `--neo-button-secondary-hover-bg` | `color-mix(in srgb, var(--page-fg) 16%, transparent)` | Background on hover for the `secondary` variant. |
| `--neo-button-secondary-active-bg` | `rgba(0, 0, 0, 0.14)` | Background while pressed for the `secondary` variant. |
| `--neo-button-ghost-bg` | `transparent` | Background of the `ghost` variant. |
| `--neo-button-ghost-color` | `var(--page-fg)` | Text color of the `ghost` variant. |
| `--neo-button-ghost-hover-bg` | `var(--btn-hover-bg)` | Background on hover for the `ghost` variant. |
| `--neo-button-ghost-active-bg` | `rgba(0, 0, 0, 0.1)` | Background while pressed for the `ghost` variant. |
| `--neo-button-danger-bg` | `var(--danger-bg)` | Background of the `danger` variant. |
| `--neo-button-danger-color` | `var(--danger-fg)` | Text color of the `danger` variant. |
| `--neo-button-danger-hover-bg` | `var(--danger-hover-bg)` | Background on hover for the `danger` variant. |
| `--neo-button-danger-active-bg` | `color-mix(in srgb, var(--neo-button-danger-hover-bg), #000 8%)` | Background while pressed for the `danger` variant. |
| `--neo-button-anchor-underline-offset` | `0.25em` | Underline offset for the `anchor` variant. |
| `--neo-button-focus-ring` | `var(--accent)` | Focus-visible outline color. |
| `--neo-link-radius` | `2px` | Corner radius of the focus outline on the `anchor` variant and `<a data-neo-link>`. |
| `--neo-button-border-width` | `1px` | Border width. The select and combobox triggers use it too. |

## Examples

### Variants & states

The 6 built-in [`variant`](#attributes-variant) values (`default`, `primary`, `secondary`, `ghost`, `danger`, `anchor`), the [`disabled`](#attributes-disabled) state, and an icon-and-label composition.

```example button_variants
min-height: max-content
```

### Composed content

A button can host richer markup when the action needs more context than a short label.

```example button_composed
min-height: max-content
```
