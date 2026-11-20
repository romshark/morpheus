# Toggle group

Component `<neo-toggle-group>` is a cluster of [`<neo-toggle>`](toggle.md) children sharing a selection model. Each child toggle remains independent. The group [`value`](#attributes-value) is a comma-separated list of the pressed child values. For singular segmented choices, use [`<neo-buttongroup>`](button-group.md).

Use toggle group for independent on/off controls, such as Bold + Italic. Use button group for a single selected value, such as Day / Week / Month.

```playground
- toggle_group_default: Default
- toggle_group_formatting: Formatting toolbar
- toggle_group_alignment: View options
- toggle_group_vertical: Vertical
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string`, reflected, observed | `""` | Comma-separated active child values. A child value must not contain a comma; the separator is unescaped. Use `neo-buttongroup` for a single selected value. |
| `orientation` | `"horizontal" \| "vertical"` | `horizontal` | Layout axis only. All 4 arrow keys move focus regardless of orientation. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-toggle-group-change` | `{ value: string, values: string[] }` | yes | Fires after the selection changes. |

## Examples

### Formatting toolbar

Each toggle flips independently; the group's [`value`](#attributes-value) is a comma-separated list of the pressed children's own `value` attributes.

```example toggle_group_formatting
min-height: max-content
```

### View options

The group allows any combination of values. For exclusive choices, use [`<neo-buttongroup>`](button-group.md).

```example toggle_group_alignment
min-height: max-content
```

### Vertical

[`orientation="vertical"`](#attributes-orientation) only changes layout; selection semantics are unchanged and any of the 4 arrow keys move focus.

```example toggle_group_vertical
min-height: max-content
```
