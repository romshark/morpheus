# Input group

Component `<neo-input-group>` is a layout wrapper that flushes leading and trailing addons (text, icons, buttons) against an `<input>` or `<neo-textinput>` under one merged border. DOM order decides placement; the group owns border, radius, and focus ring so the inner field drops its own.

```playground
- input_group_default: Default
- input_group_currency: Currency prefix
- input_group_search_icon: Search
- input_group_search_shortcut: Search with shortcut
- input_group_search_submit: Search with submit
- input_group_toolbar: Toolbar
- input_group_disabled: Disabled
```

## Reference

### Slots

| Name | Description |
| --- | --- |
| default | An `<input>` or `<neo-textinput>`, paired with optional addons. |
| `neo-icon` | A direct leading or trailing icon addon. |
| `span / neo-kbd / neo-kbd-group` | A direct passive text, unit, or shortcut addon. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-input-group-addon-padding` | `0 0.6rem` | Inline padding of text and button addons. |
| `--neo-input-group-addon-bg` | `color-mix(in srgb, var(--page-fg) 4%, transparent)` | Background fill distinguishing addons from the input surface. |

## Examples

### Currency prefix

A direct `<span>` addon gets a muted background while the group keeps one shared outer border. Click the addon and the caret lands in the input.

```example input_group_currency
width: 26rem
min-height: max-content
```

### Username + domain

Drop a `<neo-combobox>` in as a trailing addon to let the user pick from a short list of domains. The combobox's trigger adopts the addon background via a small demo-only override.

```example input_group_domain
width: 26rem
height: 15rem
min-height: max-content
```

### Range bounds

Several addons at once, with a `<neo-toggle>` flipping between *min* and *max* on the left and a stack of `<neo-select>`s on the right (mass unit + rate denominator). The inner input takes the remaining horizontal space.

```example input_group_range
width: 26rem
height: 17rem
min-height: max-content
```

### Comparison

A `<neo-select>` of comparison operators sits between 2 number-only `<neo-textinput>` fields, composing one condition. The operator is a fixed glyph-width column that opens on `hover`; the operands share the rest.

```example input_group_comparison
width: 26rem
height: 17rem
min-height: max-content
```

### Search

A direct `<neo-icon>` addon is recognized automatically and stays flush with no separator, leaving the icon as a subtle inline mark.

```example input_group_search_icon
width: 26rem
min-height: max-content
```

### Search with shortcut

Combine an icon addon with a trailing pair of `<neo-kbd>` chips inside a text addon.

```example input_group_search_shortcut
width: 26rem
min-height: max-content
```

### Search with submit

Pair an input with an action button (copy, submit, toggle visibility...). A direct `<neo-button>` automatically drops its border and radius so it sits flush.

```example input_group_search_submit
width: 26rem
min-height: max-content
```

### Toolbar

A window menubar. Each `<neo-button>` opens a `<neo-menu>` dropdown and the group merges them under one border.

```example input_group_toolbar
min-height: 16rem
min-width: 18rem
```

### Disabled

When the inner input goes disabled, the group mirrors that to its own `aria-disabled` and the whole assembly fades together.

```example input_group_disabled
width: 26rem
min-height: max-content
```
