# Slider range

Component `<neo-slider-range>` is a 2-handle slider picking a `[min, max]` range. The fill spans between the thumbs; each drags independently and is clamped against the other so the low handle can't pass the high handle. Clicking the rail moves the nearer thumb to the click point. Both endpoints have a contenteditable readout with the same number-only input filter as `<neo-slider>`.

```playground
- slider_range_default: Default
- slider_range_decimal: Decimal step
- slider_range_dense_marks: Dense mark labels
- slider_range_negative: Negative range
- slider_range_easing: Custom easing
- slider_range_stars: Custom anchor + thumb
- slider_range_vertical: Vertical temperature
- slider_range_bare: Bare rail (no header)
- slider_range_disabled: Disabled
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value-min` | `number`, reflected, observed |  | Lower bound. Normalized against `value-max`. |
| `value-max` | `number`, reflected, observed |  | Upper bound. |
| `min` | `number`, observed | `0` | Lower bound. |
| `max` | `number`, observed | `100` | Upper bound. |
| `step` | `number`, observed | `1` | Increment between snap points; each mark adds one unless [`static-marks`](#attributes-static-marks) is set. |
| `label` | `string`, observed |  | Plain-text caption. |
| `unit` | `string`, observed |  | Plain-text suffix; rendered after the upper bound. |
| `hide-value` | `boolean`, observed | `false` | Suppress the value-pair display. |
| `hide-tooltip` | `boolean`, observed | `false` | Suppress the hover bubbles. |
| `vertical` | `boolean`, observed | `false` | Switch to vertical orientation. |
| `disabled` | `boolean`, observed | `false` | Non-interactive state. |
| `static-marks` | `boolean`, observed | `false` | Make marks non-interactive. |
| `easing` | `string`, observed |  | CSS transition shorthand for the thumbs. |

### States

| Name | Description |
| --- | --- |
| `:state(dragging)` | Set while a pointer drag is in flight; suppresses the `easing` transition so the thumb tracks the cursor. |
| `:state(pointer-focus)` | Set from a pointer press until the next key press or until focus leaves; hides the thumbs' focus ring. |

### Slots

| Name | Description |
| --- | --- |
| `[data-neo-slider-mark]` | Anchor mark at a numeric value, optionally with a label child. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-slider-range-input` | `{ min: number, max: number }` | yes | Fires on every value change during a pointer drag. Keyboard nav commits via change instead. |
| `neo-slider-range-change` | `{ min: number, max: number }` | yes | Fires when the interaction commits. |

### Parts

| Name | Description |
| --- | --- |
| `::part(header)` | Row holding the label, output, and unit. |
| `::part(label)` | Label text. |
| `::part(output)` | Wrapper around the min value, separator, and max value. |
| `::part(value-min)` | Editable lower-bound value field. |
| `::part(value-max)` | Editable upper-bound value field. |
| `::part(separator)` | Glyph between the 2 value fields. |
| `::part(unit)` | Unit suffix after the values. |
| `::part(track)` | The rail the thumbs travel along. |
| `::part(fill)` | Painted segment between the 2 thumbs. |
| `::part(thumb-min)` | Lower-bound drag handle. |
| `::part(thumb-max)` | Upper-bound drag handle. |
| `::part(marks)` | Container for anchor-mark labels below the track. |

## Examples

### Decimal step

[`step="0.1"`](#attributes-step) snaps both values to 1 decimal place. The `.` key is allowed in the value fields because the step is non-integer. Marks show the dB scale's reference points; the active range lights up the marks it covers.

```example slider_range_decimal
min-height: max-content
```

### Dense mark labels

Labels that overlap or sit less than `1ch` apart collapse automatically. Hover a hidden label to reveal it. When both active extremes compete for the same space, the label closest to either thumb stays visible. Equal distances prefer the high label; hover or focus the lower thumb to prefer the low label instead.

```example slider_range_dense_marks
width: 20rem
min-height: max-content
```

### Negative range

When [`min`](#attributes-min) is below 0 both value fields accept a leading `-`. Useful for symmetric ranges like time offsets or pan positions.

```example slider_range_negative
min-height: max-content
```

### Custom easing

Set [`easing`](#attributes-easing) to animate the thumbs and fill between committed values. Click the rail or nudge with the keyboard to see the transition; dragging still tracks the pointer directly.

```example slider_range_easing
min-height: max-content
```

### Vertical temperature

Set [`vertical`](#attributes-vertical) to rotate the layout. The low value sits at the bottom and the high value at the top; pointer dragging follows the vertical rail. Marks light up when the active range covers them.

```example slider_range_vertical
width: 18rem
height: 20rem
min-height: 20rem
max-height: 32rem
```

### Bare rail (no header)

Omit [`label`](#attributes-label) and set [`hide-value`](#attributes-hide-value) to drop the entire header row. The thumbs still focus on <neo-kbd>Tab</neo-kbd> and the value bubbles still pop on hover/press, which keeps the control operable.

```example slider_range_bare
min-height: 6rem
```

### Disabled

Pointer and keyboard input are ignored, the thumbs leave the tab order, and the host gets a 50% opacity overlay.

```example slider_range_disabled
min-height: max-content
```

### Custom anchor + thumb

Like the single slider, a `<template data-neo-slider-anchor>` and `<template data-neo-slider-thumb>` are cloned into every dot and into both thumbs. Here the range picks a span of star ratings. Each anchor is an outline `<neo-icon name="star">` that becomes a filled accent dot while it sits inside the selected band, and both thumbs are filled stars. The cloned glyph is a shadow boundary too deep for page CSS to restyle. An active anchor paints its dot from its own masked background instead.

```example slider_range_stars
width: 26rem
min-height: max-content
```

## Examples: Datastar

### Morphing during interaction

A Datastar app can fat-morph the page at any moment, and a server narrowing or widening the band just re-emits the range with new [`value-min`](#attributes-value-min) / [`value-max`](#attributes-value-max) attributes. The rail, both thumbs, and the fill live in the component's shadow root. A morph of the bare light host only changes those 2 attributes and never touches the thumb or fill nodes, which lets the [`easing`](#attributes-easing) transition ease the band to its new bounds. Autoplay cycles the states below, with no signals or morph hints, and the band glides from Low to Medium to High just the same.

```playground
id: slider-range-morph-playground
autoplay: true
- slider_range_morph_low: Low
- slider_range_morph_medium: Medium
- slider_range_morph_high: High
```
