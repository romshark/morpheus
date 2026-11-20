# Toggle

Component `<neo-toggle>` is a button with a sticky on/off pressed state. Same visual styling as [`<neo-button>`](button.md) but a click flips `aria-pressed`, as in the toolbar "Bold" / "Italic" control. Cluster several inside [`<neo-toggle-group>`](toggle-group.md) to build single- or multi-select toolbars.

```playground
- toggle_default: Default
- toggle_variants: Variants
- toggle_sizes: Sizes
- toggle_pressed: Pressed
- toggle_disabled: Disabled
- toggle_with_icon: With icon
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `pressed` | `boolean`, reflected, observed | `false` | On/off state. Mirrored to `aria-pressed`. |
| `disabled` | `boolean`, observed | `false` | Non-interactive state. |
| `variant` | `"primary" \| "secondary" \| "ghost" \| "danger"` |  | Visual style. Omit for the default neutral styling. |
| `size` | `"sm" \| "lg"` |  | Control-size step: `sm` compact, `lg` large. Omit for the default size. |
| `value` | `string` |  | Selection value inside a [`<neo-toggle-group>`](toggle-group.md). The group reports pressed children as a comma-separated `value`. |

### Slots

| Name | Description |
| --- | --- |
| default | Toggle content. An icon followed by a label is the common composition. |
| `[data-neo-toggle-off]` | Content shown only when the toggle is not pressed. Pair with `[data-neo-toggle-on]` to swap label and icon by state. |
| `[data-neo-toggle-on]` | Content shown only when the toggle is pressed. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-toggle-change` | `{ pressed: boolean }` | yes | Fires after a click or `Enter` / `Space` activation flips `pressed`. |

## Examples

### Variants

5 fills share the button colour tokens. Besides a neutral default there are `primary` (accent), `secondary` (muted), `ghost` (transparent), and `danger`. Click any toggle to flip its pressed state.

```example toggle_variants
min-height: max-content
```

### Sizes

[`size="sm"`](#attributes-size) tightens padding and font size for dense rows. Omit it for the default size.

```example toggle_sizes
min-height: max-content
```

### Pressed

The sticky on state, reflected to `aria-pressed="true"` so assistive technology reads the toggle correctly. The default variant gets a subtle inset fill; the coloured variants deepen.

```example toggle_pressed
min-height: max-content
```

### Disabled

[`disabled`](#attributes-disabled) blocks pointer events, drops the host from the tab order, and fades it. Both the off and pressed-disabled states stay readable so the value is still visible.

```example toggle_disabled
min-height: max-content
```

### With icon

A `<neo-icon>` as the first child is spaced from the label by the toggle's flex layout and inherits the current font colour. It recolours with the variant and pressed state.

```example toggle_with_icon
min-height: max-content
```

Mark up both [`[data-neo-toggle-off]`](#slots-data-neo-toggle-off) and [`[data-neo-toggle-on]`](#slots-data-neo-toggle-on) children and [`pressed`](#attributes-pressed) swaps which one paints, when the toggled state needs a different verb, icon, or both. Click to flip.

### Slot-driven on / off

```example toggle_slot
width: 100%
min-height: 6rem
max-height: 16rem
```
