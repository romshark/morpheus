# Button group

Component `<neo-buttongroup>` is a segmented row (or column) of `<neo-button>` children. Setting [`value`](#attributes-value) on the host promotes it into a radiogroup with the matching child as the selected option.

Use button group for one selected value. Use [`<neo-toggle-group>`](toggle-group.md) when multiple independent toggles may be on at the same time.

```playground
id: buttongroup-playground
- buttongroup_default: Default
- buttongroup_horizontal: Horizontal
- buttongroup_vertical: Vertical
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string`, reflected, observed |  | Selected child value. Switches the host into segmented (radiogroup) mode, giving it a single roving tab stop with arrow-key focus movement. Absent, the buttons are independent tab stops with no selection or arrow navigation. |
| `orientation` | `"horizontal" \| "vertical"` | `horizontal` | Layout axis. |
| `auto-activate` | `boolean` |  | Arrow keys commit the selection in addition to moving focus. |

### Slots

| Name | Description |
| --- | --- |
| default | [`<neo-button>`](button.md) children. Mark the active one in segmented mode with a matching `value`. Use [`<neo-toggle-group>`](toggle-group.md) for multiple independent on/off choices. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-buttongroup-change` | `{ value: string }` | yes | Fires after the selection changes in segmented mode. |

## Examples

### Horizontal

A visual-only row, then a segmented radiogroup.

- Without [`value`](#attributes-value) the buttons share borders only. There is no selection state, and each is its own tab stop with no arrow-key navigation.
- Setting [`value`](#attributes-value) on the host and a matching `value` on one button makes it a radiogroup with a single roving tab stop where arrow keys and Home / End move focus between buttons. Add [`auto-activate`](#attributes-auto-activate) to commit the selection as focus moves.

```example buttongroup_horizontal
min-height: max-content
```

### Vertical

Same segmented behaviour stacked in a column; keyboard arrows follow the layout direction.

```example buttongroup_vertical
min-height: max-content
```
