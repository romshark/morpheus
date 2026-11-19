# Aura

Component `<neo-aura>` is a decorative light around the element it wraps. It has a ring in its padding with a light that rotates along it, and a blurred glow behind. Wrap one element that has an opaque background, such as a button, input, or card. Custom properties set the look and the motion. The light holds still under reduced motion and becomes a solid `Highlight` ring in forced-colors mode. The layers live in an open shadow root; style them with `::part()`.

```playground
- aura_default: Default
- aura_lights: Lights
- aura_pricing: Highlight one option
- aura_input: Form control
- aura_width: Ring width
- aura_color: Color and track
- aura_radius: Any element
- aura_disabled: Disabled
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean`, observed | `false` | Fades the light out and stops its animations. The wrapped element does not move because the aura keeps its padding, and it stays enabled. |

### Parts

| Name | Description |
| --- | --- |
| `::part(ring)` | The ring in the aura's padding. Masked to the padding, it never shows through the wrapped element. |
| `::part(glow)` | The 2 blurred layers behind the wrapped element, a tight glow and a wide halo. Hide them for a ring without a glow. |
| `::part(light)` | The gradient box inside the ring and inside each glow. It carries the rotation. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-aura-color` | `var(--accent, currentColor)` | Light color, used by the default `--neo-aura-gradient`. |
| `--neo-aura-gradient` | `conic-gradient(transparent 225deg, var(--neo-aura-color))` | The light. Any CSS image, rotated about the center of the aura. `cq` units in it measure the aura's box. |
| `--neo-aura-width` | `0.125rem` | Ring thickness, applied as the aura's padding. `0` leaves only the glow. |
| `--neo-aura-radius` | `measured` | Corner radius of the wrapped element, 1 value for all corners. Unset, the aura measures each corner of the element's computed `border-radius`, and measures again when the element changes, resizes, or is replaced. `<neo-buttongroup>`, `<neo-toggle-group>`, `<neo-select>`, `<neo-combobox>`, and `<neo-textinput>` draw their rounded box inside, not on the host; for them the aura reads their radius token. Set it to override. |
| `--neo-aura-spin-duration` | `6s` | 1 turn of the light. `0s` holds it still. |
| `--neo-aura-pulse-duration` | `0s` | 1 pulse of the glow. `0s` turns the pulse off. |
| `--neo-aura-track-color` | `transparent` | Ring color under the light. |

## Examples

### Lights

Each light is a set of custom properties on a class. Copy one from the CSS tab. [`--neo-aura-gradient`](#css-variables-neo-aura-gradient) holds the image, which rotates about the center of the aura. The glow recipe stops the rotation and pulses the glow instead.

```example aura_lights
min-height: max-content
```

### Highlight one option

Marks the recommended option in a set. The aura has no accessible role or name. State the emphasis in text as well, here with the `Most popular` badge.

```example aura_pricing
min-height: max-content
```

### Form control

The ring takes the corner radius of the element it wraps, here `<neo-input-group>`. The control keeps its own focus ring. Tab to the field to see it.

```example aura_input
min-height: max-content
```

### Ring width

[`--neo-aura-width`](#css-variables-neo-aura-width) sets the ring thickness, which is also the aura's padding. At `0` only the glow remains.

```example aura_width
min-height: max-content
```

### Color and track

[`--neo-aura-color`](#css-variables-neo-aura-color) colors the light; [`--neo-aura-track-color`](#css-variables-neo-aura-track-color) fills the ring under it.

```example aura_color
min-height: max-content
```

### Any element

The aura measures the corners of the element it wraps, kit component or not. The square image here needs no configuration. Set [`--neo-aura-radius`](#css-variables-neo-aura-radius) to override the measured value.

```example aura_radius
min-height: max-content
```

### Disabled

[`disabled`](#attributes-disabled) fades the light out and stops its animations. The wrapped element does not move because the aura keeps its padding, and it stays enabled. Flip the switch to see it.

```example aura_disabled
min-height: max-content
```
