# Switch

Component `<neo-switch>` is a 2-state on/off control rendered as a sliding pill. Participates in a wrapping `<label>` like a native checkbox.

```playground
- switch_default: Default
- switch_states: States
- switch_small: Small size
- switch_disabled: Disabled
- switch_with_label: With label
- switch_settings_group: Settings group
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `checked` | `boolean`, reflected, observed | `false` | Mirrored to `aria-checked`. |
| `disabled` | `boolean`, observed | `false` | Non-interactive state. |
| `size` | `"sm"` |  | Compact size. Omit for the default size. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-switch-change` | `{ checked: boolean }` | yes | Fires after a click or `Space` / `Enter` activation. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-switch-width` | `2rem` | Track width. Drops to `1.5rem` at `size="sm"`. |
| `--neo-switch-height` | `1.15rem` | Track height. Drops to `0.875rem` at `size="sm"`. |
| `--neo-switch-thumb-size` | `1rem` | Thumb diameter. Drops to `0.75rem` at `size="sm"`. |
| `--neo-switch-track-radius` | `999px` | Track corner radius. Defaults to a pill. |
| `--neo-switch-thumb-radius` | `50%` | Thumb corner radius. Defaults to a circle. |
| `--neo-switch-border-width` | `1px` | Border width. Surfaced so the checked travel stays symmetric. |
| `--neo-switch-track-off` | `var(--btn-border)` | Track color when unchecked. |
| `--neo-switch-track-on` | `var(--accent)` | Track color when checked. |
| `--neo-switch-thumb` | `var(--btn-bg)` | Thumb color. |
| `--neo-switch-transition-duration` | `calc(150ms * var(--neo-duration-scale, 1))` | Duration of the track and thumb transitions. |

## Examples

### States

Both states, each paired with a visible label via a wrapping `<label>`. Click the pill or the text, or focus with <neo-kbd>Tab</neo-kbd> and toggle with <neo-kbd>Space</neo-kbd>.

```example switch_states
min-height: max-content
```

### Small size

The [`size="sm"`](#attributes-size) variant has a 1.5rem x 0.875rem track and 0.75rem thumb, for dense rows where the default 2rem pill would dominate.

```example switch_small
min-height: max-content
```

### Disabled

[`disabled`](#attributes-disabled) blocks pointer events, drops the host from the tab order, and fades it to 50% opacity. Both states stay distinct so the value is still readable.

```example switch_disabled
min-height: max-content
```

### With label

Wrapping a switch in a `<label>` makes the whole row clickable. The host forwards clicks on its closest `<label>` ancestor and moves focus to itself, keeping the keyboard target in sync.

```example switch_with_label
min-height: max-content
```

### Settings group

A typical settings panel. Each row is its own `<label>`, with the switch pinned to the right and the description on the left. The disabled row still shows its current value but resists interaction.

```example switch_settings_group
width: 100%
min-height: max-content
```
