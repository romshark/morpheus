# Radio group

Component `<neo-radio-group>` is a set of mutually-exclusive `<neo-radio>` options. The host owns selection and roving-tabindex. Activation is manual by default (like `<neo-tabs>`). Arrow keys move focus and `Enter` / `Space` commit; add [`auto-activate`](#attributes-auto-activate) to select on arrow. Wrap a radio in a `<label>` to make the whole row clickable.

```playground
- radio_group_default: Default
- radio_group_horizontal: Horizontal
- radio_group_rich_rows: Rich rows
- radio_group_disabled: Disabled
- radio_group_auto_activate: Auto-activate
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string`, reflected, observed |  | Selected radio value. Set to empty string to clear. |
| `disabled` | `boolean`, observed | `false` | Disables every nested `<neo-radio>`. |
| `orientation` | `"horizontal" \| "vertical"` | `vertical` | Layout axis. |
| `auto-activate` | `boolean` | `false` | By default activation is manual. Arrow keys move focus and `Enter` / `Space` commit the selection (like `<neo-tabs>`). Set `auto-activate` to select a radio as soon as an arrow key focuses it. |

### Slots

| Name | Description |
| --- | --- |
| default | `<neo-radio>` children, typically wrapped in `<label>`. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-radio-group-change` | `{ value: string }` | yes | Fires after the selection changes. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-radio-size` | `1.15rem` | Radio diameter. Drops to `0.875rem` at `size="sm"`. |
| `--neo-radio-border-width` | `1px` | Border width. |
| `--neo-radio-border` | `var(--btn-border)` | Border color when unchecked. |
| `--neo-radio-bg` | `transparent` | Background when unchecked. |
| `--neo-radio-checked-bg` | `var(--accent)` | Background when checked. |
| `--neo-radio-checked-border` | `var(--accent)` | Border color when checked. |
| `--neo-radio-dot-color` | `var(--accent-fg)` | Color of the inner dot. |
| `--neo-radio-dot-scale` | `0.45` | Inner dot size as a fraction of the radio. |
| `--neo-radio-transition-duration` | `calc(120ms * var(--neo-duration-scale, 1))` | Duration of the background and dot transitions. |
| `--neo-radio-group-gap` | `calc(var(--page-spacing, 0.25rem) * 2)` | Gap between radios in the group. |

## Examples

### Horizontal

With [`orientation="horizontal"`](#attributes-orientation) the group lays out on a single row, wrapping if it overflows. Suited to short binary or trinary choices.

```example radio_group_horizontal
min-height: max-content
```

### Rich rows

Each radio's body can be multi-line markup. The radio sits in its own column while the label column holds a title plus a muted caption, as on a plan-picker settings page.

```example radio_group_rich_rows
min-height: max-content
```

### Disabled

[`disabled`](#attributes-disabled) on the host disables every nested radio and skips them in arrow navigation, regardless of per-radio state. The selected value is preserved. The form still submits a meaningful answer if the gate later opens.

```example radio_group_disabled
min-height: max-content
```

### Auto-activate

With [`auto-activate`](#attributes-auto-activate) an arrow key selects the focused radio immediately, the classic radio-group behaviour. By default arrows only move focus and `Enter` / `Space` commit. A click selects in both modes.

```example radio_group_auto_activate
min-height: max-content
```
