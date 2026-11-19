# Checkbox

Component `<neo-checkbox>` is a 3-state checkbox with [`checked`](#attributes-checked), unchecked, and [`indeterminate`](#attributes-indeterminate) (`aria-checked="mixed"`) states. Indeterminate is for parent rows whose children are partially selected. Participates in a wrapping `<label>` like a native checkbox.

```playground
- checkbox_default: Default
- checkbox_states: States
- checkbox_small: Small size
- checkbox_disabled: Disabled
- checkbox_with_label: With label
- checkbox_settings_group: Settings group
- checkbox_cards: Selectable cards
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `checked` | `boolean`, reflected, observed | `false` | Mirrored to `aria-checked`. |
| `indeterminate` | `boolean`, reflected, observed | `false` | 3-state mixed indicator. |
| `disabled` | `boolean`, observed | `false` | Non-interactive state. |
| `size` | `"sm"` |  | Compact size. Omit for the default size. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-checkbox-change` | `{ checked: boolean, indeterminate: boolean }` | yes | Fires after a click or `Space` / `Enter` activation. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-checkbox-size` | `1.15rem` | Box width and height. Drops to `0.875rem` at `size="sm"`. |
| `--neo-checkbox-radius` | `calc(var(--page-radius, 0.25rem) * 0.5)` | Corner radius. |
| `--neo-checkbox-border-width` | `1px` | Border width. |
| `--neo-checkbox-border` | `var(--btn-border)` | Border color when unchecked. |
| `--neo-checkbox-bg` | `transparent` | Background when unchecked. |
| `--neo-checkbox-checked-bg` | `var(--accent)` | Background when checked or indeterminate. |
| `--neo-checkbox-checked-border` | `var(--accent)` | Border color when checked or indeterminate. |
| `--neo-checkbox-mark-color` | `var(--accent-fg)` | Color of the check / indeterminate mark. |
| `--neo-checkbox-transition-duration` | `calc(120ms * var(--neo-duration-scale, 1))` | Duration of the background and mark transitions. |
| `--neo-checkbox-mark` | `url("data:image/svg+xml;utf8,<svg …><polyline points='5 12 10 17 19 7'/></svg>")` | Mask image for the checked mark. Override to swap the mark shape. |
| `--neo-checkbox-mark-indeterminate` | `url("data:image/svg+xml;utf8,<svg …><line x1='5' y1='12' x2='19' y2='12'/></svg>")` | Mask image for the indeterminate mark. |

## Examples

### States

Shows the unchecked, checked, and indeterminate states. Click the box or focus with <neo-kbd>Tab</neo-kbd> and toggle with <neo-kbd>Space</neo-kbd>. Input on a mixed checkbox resolves it to checked, matching the native rule.

```example checkbox_states
min-height: max-content
```

### Small size

The [`size="sm"`](#attributes-size) variant is a 0.875rem square, for dense rows where the default 1.15rem box would dominate.

```example checkbox_small
min-height: max-content
```

### Disabled

[`disabled`](#attributes-disabled) blocks pointer events, drops the host from the tab order, and fades it to 50% opacity. Each state still reads correctly.

```example checkbox_disabled
min-height: max-content
```

### With label

Wrapping a checkbox in a `<label>` makes the whole row clickable. The host forwards clicks on its closest `<label>` ancestor and moves focus to itself, keeping the keyboard target in sync.

```example checkbox_with_label
min-height: max-content
```

### Settings group

A typical settings panel. Each row is its own `<label>`, with the checkbox on the left and the description on the right. The disabled row still shows its current value but resists interaction.

```example checkbox_settings_group
width: 100%
min-height: max-content
```

### Selectable cards

A multi-select grid of rich cards. Each card is a `<label>`, which makes the image and text toggle the checkbox. The card styles itself from `:has(> neo-checkbox[checked])`. Click a card or press <neo-kbd>Space</neo-kbd> on its checkbox.

```example checkbox_cards
width: 100%
min-height: max-content
```

## Examples: Datastar

### Tree selection

Parent nodes go [`indeterminate`](#attributes-indeterminate) when only some descendants are selected, [`checked`](#attributes-checked) when all are, and unchecked when none are. Each change posts to the server, which recomputes the parents and morphs the tree back into place.

```example checkbox_tree
min-height: max-content
script: sim/checkbox/tree.js
```
