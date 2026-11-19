# Slider

Component `<neo-slider>` is a labelled numeric slider with a contenteditable value readout. Hover, focus, or press the thumb to pop a `neo-tooltip` showing the current value. Clicking the readout lets the user type a number; non-numeric keystrokes are dropped at `beforeinput`. On blur or <neo-kbd>Enter</neo-kbd>, the typed value is parsed, clipped to `[min, max]`, and snapped to [`step`](#attributes-step).

```playground
- slider_default: Default
- slider_marks: Marks with labels
- slider_dense_marks: Dense mark labels
- slider_clip: Clipping to range
- slider_decimal: Decimal step + dots only
- slider_easing: Custom easing
- slider_stars: Custom anchor + thumb
- slider_value_bar: Value bar
- slider_static_marks: Static marks
- slider_bare_rail: Bare rail (no header)
- slider_vertical: Vertical
- slider_negative: Negative range
- slider_disabled: Disabled
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number`, reflected, observed |  | Current value. Clamped and snapped to `step`. |
| `min` | `number`, observed | `0` | Lower bound. |
| `max` | `number`, observed | `100` | Upper bound. |
| `step` | `number`, observed | `1` | Increment between snap points. |
| `label` | `string`, observed |  | Plain-text caption. |
| `unit` | `string`, observed |  | Plain-text suffix on the value display. |
| `hide-value` | `boolean`, observed | `false` | Suppress the editable value display. |
| `hide-tooltip` | `boolean`, observed | `false` | Suppress the hover-bubble. |
| `vertical` | `boolean`, observed | `false` | Switch to vertical orientation. |
| `disabled` | `boolean`, observed | `false` | Non-interactive state. |
| `marks-only` | `boolean`, observed | `false` | Constrain navigation to mark values only. |
| `static-marks` | `boolean`, observed | `false` | Make marks non-interactive. |
| `easing` | `string`, observed |  | CSS transition shorthand for the thumb. |

### States

| Name | Description |
| --- | --- |
| `:state(dragging)` | Set while a pointer drag is in flight; suppresses the `easing` transition so the thumb tracks the cursor. |

### Slots

| Name | Description |
| --- | --- |
| `[data-neo-slider-mark]` | Anchor mark at a numeric value, optionally with a label child. |
| `[data-neo-slider-anchor]` | Custom anchor template. |
| `[data-neo-slider-thumb]` | Custom thumb template. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-slider-input` | `{ value: number }` | yes | Fires on every value change during a pointer drag, with the live value before commit. |
| `neo-slider-change` | `{ value: number }` | yes | Fires on commit (drag end, mark click, keyboard, or edit), only if the value changed. Bind this too for mark clicks and keyboard. |

### Parts

| Name | Description |
| --- | --- |
| `::part(header)` | Row holding the label, value, and unit. |
| `::part(label)` | Label text. |
| `::part(output)` | Wrapper around the value and unit. |
| `::part(value)` | Editable value field. |
| `::part(unit)` | Unit suffix after the value. |
| `::part(track)` | The rail the thumb travels along. |
| `::part(fill)` | Painted segment from the start to the thumb. |
| `::part(thumb)` | Drag handle. |
| `::part(marks)` | Container for anchor-mark labels below the track. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-slider-track-height` | `0.375rem` | Rail thickness. |
| `--neo-slider-track-radius` | `999px` | Rail corner radius. |
| `--neo-slider-track-bg` | `var(--btn-border)` | Rail color. |
| `--neo-slider-track-image` | `linear-gradient(var(--neo-slider-track-bg), var(--neo-slider-track-bg))` | Rail image layer. Set directly to paint a gradient rail. |
| `--neo-slider-track-shadow` | `none` | Outset ring around the rail. Set to `0 0 0 1px currentColor` under high contrast. |
| `--neo-slider-fill-bg` | `var(--accent)` | Filled segment color. |
| `--neo-slider-vertical-track-length` | `12rem` | Rail length in vertical orientation. |
| `--neo-slider-thumb-size` | `1rem` | Thumb diameter. |
| `--neo-slider-thumb-radius` | `50%` | Thumb corner radius. |
| `--neo-slider-thumb-bg` | `var(--btn-bg)` | Thumb background. |
| `--neo-slider-thumb-border` | `var(--accent)` | Thumb border color. |
| `--neo-slider-thumb-border-width` | `2px` | Thumb border width. |
| `--neo-slider-thumb-shadow` | `0 1px 2px rgba(0, 0, 0, 0.15)` | Thumb shadow. |
| `--neo-slider-anchor-size` | `0.375rem` | Anchor-mark dot diameter. Set to `0` to suppress the default dot. |
| `--neo-slider-anchor-radius` | `50%` | Anchor-mark dot corner radius. |
| `--neo-slider-anchor-bg` | `var(--page-bg)` | Anchor-mark dot fill. |
| `--neo-slider-anchor-border` | `var(--neo-slider-track-bg)` | Anchor-mark dot border color. |
| `--neo-slider-anchor-active-bg` | `var(--page-bg)` | Anchor-mark dot fill at or below the current value. |
| `--neo-slider-anchor-active-border` | `var(--accent)` | Anchor-mark dot border color at or below the current value. |
| `--neo-slider-mark-label-color` | `var(--muted)` | Mark-label text color. |
| `--neo-slider-mark-label-active-color` | `var(--page-fg)` | Mark-label text color at or below the current value. |
| `--neo-slider-mark-label-font-size` | `0.75rem` | Mark-label font size. |
| `--neo-slider-marks-margin-top` | `0.4rem` | Gap between the track and the marks row. |
| `--neo-slider-label-color` | `var(--page-fg)` | Header label color. |
| `--neo-slider-value-color` | `var(--page-fg)` | Value text color. |
| `--neo-slider-unit-color` | `var(--muted)` | Unit text color. |
| `--neo-slider-focus-ring` | `color-mix(in srgb, var(--accent) 50%, transparent)` | Focus outline color. |
| `--neo-slider-hit-area` | `max(var(--neo-slider-thumb-size), 1.75rem)` | Pointer target size across the track. |
| `--neo-slider-thumb-offset-x` | `-50%` | Thumb shift along a horizontal track. `-50%` centers the thumb on the value. |
| `--neo-slider-thumb-offset-y` | `50%` | Thumb shift along a vertical track. `50%` centers the thumb on the value. |

## Examples

### Marks with labels

Each `<span data-neo-slider-mark="...">` child renders an anchor dot on the rail at that value plus a label beneath. The dot and label flip to their active colour once the slider's value reaches them, mirroring how the rail's fill grows. Marks outside `[min, max]` are skipped silently.

```example slider_marks
min-height: max-content
```

### Dense mark labels

Labels that overlap or sit less than `1ch` apart collapse automatically. Hover a hidden label to reveal it. The highest active mark stays visible as the value moves and identifies the current stage on the rail.

```example slider_dense_marks
width: 20rem
min-height: max-content
```

### Clipping to range

Click the value, type a new number, and press <neo-kbd>Enter</neo-kbd> (or click away). Try entering `9` below. The slider clips it to `10` on commit. `500` clips to `200`. Letters and other unexpected characters never enter the field.

```example slider_clip
width: 26rem
min-height: max-content
```

### Decimal step + dots only

[`step="0.1"`](#attributes-step) snaps the value to 1 decimal place. The value display and the value bubble both show `3.4`, not `3.4000000000000004`. The `.` key is allowed in the value field to opt into a non-integer step. Empty-bodied marks render dots without labels, useful for a bare step indicator.

```example slider_decimal
width: 26rem
min-height: max-content
```

### Custom easing

Set [`easing`](#attributes-easing) to animate the thumb and fill between committed values. This one uses a quick elastic curve so clicks on the rail and keyboard nudges settle with a small rubber-band snap; dragging still tracks the pointer directly.

```example slider_easing
width: 26rem
min-height: max-content
```

### Custom anchor + thumb

Drop `<template data-neo-slider-anchor>` and/or `<template data-neo-slider-thumb>` children, and their contents are cloned into the rendered anchor wrappers and the draggable thumb on every render. The example below turns the slider into a 5-star rating. Each anchor is an outline `<neo-icon name="star">` that becomes a filled accent dot once it sits at or below the current value, and the thumb is a larger filled star that glides between them. The cloned glyph lives a shadow boundary too deep for page CSS to restyle. An active anchor paints its solid dot from the dot's own masked background instead. Stars are clickable like any other anchor. A tap on the third star sets the rating to 3.

```example slider_stars
width: 26rem
min-height: max-content
```

### Value bar

Restyle the rail into a filled value bar with the readout centred over it, in the style of a Blender number field.

- A tall rail comes from [`--neo-slider-track-height`](#css-variables-neo-slider-track-height); the fill ([`--neo-slider-fill-bg`](#css-variables-neo-slider-fill-bg)) reads as a flat surface over it.
- [`::part(header)`](#parts-header) is positioned absolutely over the rail to centre the value. [`hide-tooltip`](#attributes-hide-tooltip) drops the redundant thumb bubble, and the readout is display-only because the header overlays the rail.
- [`::part(thumb)`](#parts-thumb) hides the thumb marker so the fill's right edge is the position indicator; the thumb stays as an invisible keyboard target with a focus ring.

```example slider_value_bar
width: 26rem
min-height: max-content
```

### Static marks

Set [`static-marks`](#attributes-static-marks) when the marks should be purely decorative. The click handler bails out, the cursor stays as the default arrow over both the dots and the labels, and the dots drop their `pointer-events` so a click on a dot passes through to the rail underneath like any other rail click.

```example slider_static_marks
width: 26rem
min-height: max-content
```

### Bare rail (no header)

Omit the [`label`](#attributes-label) attribute and set [`hide-value`](#attributes-hide-value) to drop the entire header row. The thumb still focuses on <neo-kbd>Tab</neo-kbd> and the value bubble still pops on hover/press, which keeps the control operable. This is the variant for inline placements where the value is shown elsewhere or doesn't need to be edited as text.

```example slider_bare_rail
width: 26rem
min-height: max-content
```

### Vertical

Set [`vertical`](#attributes-vertical) to rotate the mental model without rotating the DOM. The minimum value sits at the bottom, the maximum at the top, and pointer dragging follows the vertical rail. This example uses a thermometer-like temperature range so the direction reads naturally.

```example slider_vertical
width: 18rem
height: 20rem
min-height: max-content
```

### Negative range

When [`min`](#attributes-min) is below 0 the value field accepts a leading `-`. The fill grows from the left edge to the current value (the slider doesn't draw a zero-anchored bipolar fill).

```example slider_negative
width: 26rem
min-height: max-content
```

### Disabled

Pointer and keyboard interaction are blocked, the host fades to 50% opacity, and the value field becomes non-editable.

```example slider_disabled
width: 26rem
min-height: max-content
```

## Examples: Datastar

### Morphing during interaction

A Datastar app can fat-morph the page at any moment, and a server reporting a new position just re-emits the slider with a new [`value`](#attributes-value). The rail and thumb live in the component's shadow root. A morph of the bare light host only changes the [`value`](#attributes-value) attribute and never touches the thumb or fill nodes, which lets the [`easing`](#attributes-easing) transition ease them to the new value. Autoplay cycles the states below, with no signals or morph hints, and the thumb glides between 0%, 30%, and 100% just the same.

```playground
id: slider-morph-playground
autoplay: true
- slider_morph_0: 0%
- slider_morph_30: 30%
- slider_morph_100: 100%
```
