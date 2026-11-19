# Progress

Component `<neo-progress>` is the read-only sibling of `<neo-slider>`. It shares the rail, fill, and anchor-mark styling and the `--neo-slider-*` tokens, but has no thumb, keyboard, or editable readout.

```playground
- progress_default: Default
- progress_marks: Marks with labels
- progress_dense_marks: Dense mark labels
- progress_bare_rail: Bare rail
- progress_indeterminate: Indeterminate
- progress_ping_pong: Custom indeterminate animation
- progress_vertical: Vertical
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number`, reflected, observed |  | Clamped to \[min, max\]. |
| `min` | `number`, observed | `0` | Lower bound. |
| `max` | `number`, observed | `100` | Upper bound. |
| `label` | `string`, observed |  | Plain-text caption. |
| `unit` | `string`, observed |  | Plain-text suffix on the value display. |
| `hide-value` | `boolean`, observed | `false` | Suppress the value display. |
| `vertical` | `boolean`, observed | `false` | Switch to vertical orientation. |
| `indeterminate` | `boolean`, observed | `false` | Looping animation for unknown-duration tasks. |
| `easing` | `string`, observed |  | CSS transition shorthand for the fill animation. |

### Slots

| Name | Description |
| --- | --- |
| `[data-neo-progress-mark]` | Anchor mark at a numeric value, optionally with a label child. |

### Parts

| Name | Description |
| --- | --- |
| `::part(header)` | Row holding the label, value, and unit. |
| `::part(label)` | Label text. |
| `::part(output)` | Wrapper around the value and unit. |
| `::part(value)` | Value text. |
| `::part(unit)` | Unit suffix after the value. |
| `::part(track)` | The rail behind the fill. |
| `::part(fill)` | Painted progress segment. |
| `::part(marks)` | Container for anchor-mark labels below the track. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-progress-fill-bg` | `var(--neo-slider-fill-bg, var(--accent))` | Fill color. |
| `--neo-progress-fill-transition` | `none` | Transition applied to the fill when the value changes. |
| `--neo-progress-indeterminate-duration` | `calc(1.4s * var(--neo-duration-scale, 1))` | Cycle duration of the indeterminate animation. |

## Examples

### Marks with labels

As on the slider, `<span data-neo-progress-mark="...">` children render an anchor dot at the value plus a label beneath. The dot and label flip to their active colour once the bar's value reaches them.

```example progress_marks
min-height: max-content
```

### Dense mark labels

Labels that overlap or sit less than `1ch` apart collapse automatically. Hover a hidden label or its nearby rail position to reveal it. The highest active mark stays visible as the value moves.

```example progress_dense_marks
width: 20rem
min-height: max-content
```

### Bare rail

Omit [`label`](#attributes-label) and set [`hide-value`](#attributes-hide-value) to drop the header entirely. The marks row still hides itself when no mark carries a label, which leaves just the bar.

```example progress_bare_rail
min-height: max-content
```

### Indeterminate

Set [`indeterminate`](#attributes-indeterminate) and a 35% segment slides along the rail in a loop for unknown-duration tasks. The [`value`](#attributes-value) attribute is ignored while it's on, and the track drops its `aria-valuenow` so AT announces it as indeterminate. Honours `prefers-reduced-motion`.

```example progress_indeterminate
min-height: max-content
```

### Custom indeterminate animation

The rail lives in the shadow root. Reach the fill across the boundary with [`::part(fill)`](#parts-fill), then override `animation` from a per-instance class to swap the kit's default left-to-right loop for any custom keyframe. This one widens the segment to 1/2 the rail and ping-pongs from end to end.

```example progress_ping_pong
min-height: max-content
```

### Vertical

Set [`vertical`](#attributes-vertical) to rotate the bar. Min sits at the bottom, max at the top. Use it for capacity meters where the height of the fill maps to the quantity.

```example progress_vertical
min-height: max-content
```

## Examples: Datastar

### Morphing during interaction

A Datastar app can fat-morph the page at any moment; a server reporting progress just re-emits the bar with a new [`value`](#attributes-value). The painted rail lives in the component's shadow root. A morph of the light host only changes the [`value`](#attributes-value) attribute and never touches the fill node, letting the [`easing`](#attributes-easing) transition ease the fill to the new value. Autoplay cycles the states below, with no signals or morph hints, and the fill eases backward from 40% to 0% on the wrap just the same.

```playground
id: progress-morph-playground
autoplay: true
- progress_morph_0: 0%
- progress_morph_30: 30%
- progress_morph_40: 40%
```

### Server-driven downloads

Clicking *Download* opens an SSE connection to `/progress/download`. Each `sse.patchSignals` bumps the value signal by 25% on a 1-second beat; the bar's `data-attr:value` binding renders the change without re-emitting the host. A final patch flips the bar's [`label`](#attributes-label) through the same signal; its `data-attr:label` binding renders "Done ✓" inside the component's frame. The rail is in the shadow root, which is why the success state uses the label attribute rather than a separate status row.

```example progress_download
min-height: max-content
script: sim/progress/download.js
```
