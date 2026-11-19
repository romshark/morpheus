# Compare

Component `<neo-compare>` stacks 2 layers, such as 2 versions of a photo, and splits them with a divider. Dragging the divider shows more of 1 layer and less of the other.

```playground
- compare_default: Default
- compare_vertical: Vertical
- compare_captions: Captions
- compare_redesign: HTML layers
- compare_customized: Customized
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number`, reflected, observed | `50` | Divider position in percent from the start edge, clamped to `min` and `max`. |
| `min` | `number`, observed | `0` | Lowest divider position, 0 to 100. |
| `max` | `number`, observed | `100` | Highest divider position, 0 to 100. Below `min`, the divider stays at `min`. |
| `vertical` | `boolean`, observed | `false` | Stacks the before layer above the after layer, with a horizontal divider. |
| `disabled` | `boolean`, observed | `false` | Ignores pointer and keyboard input. |
| `recenter` | `boolean` | `true` | A double-click or double-tap on the handle moves the divider to the center. `recenter="false"` turns it off. |
| `divider-label` | `string`, observed | `Divider position` | Accessible name of the handle. |

### States

| Name | Description |
| --- | --- |
| `:state(dragging)` | Set while a pointer drags the divider. The divider then moves without a transition. |
| `:state(grabbed)` | Set while the handle is held: from a press on the handle, or from the start of a drag elsewhere. |

### Slots

| Name | Description |
| --- | --- |
| `before` | The layer on the start side, or on top when vertical. |
| `after` | The layer on the end side, or below when vertical. |
| `handle` | Content of the handle, 2 arrows by default. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-compare-input` | `{ value: number }` | yes | Fires on each move of a pointer drag. |
| `neo-compare-change` | `{ value: number }` | yes | Fires when a drag ends, a click or a key moves the divider, only if the value changed. |

### Parts

| Name | Description |
| --- | --- |
| `::part(before)` | Box of the before layer, clipped at the divider. |
| `::part(after)` | Box of the after layer, clipped at the divider. |
| `::part(divider)` | The line at the divider position. |
| `::part(handle)` | The focusable knob on the divider. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-compare-tilt` | `0deg` | Clockwise tilt of the divider. The range stretches by the tilt, which keeps 0 and 100 showing 1 layer fully. |
| `--neo-compare-divider-width` | `2px` | Width of the divider line. |
| `--neo-compare-divider-color` | `var(--btn-bg)` | Color of the divider line and of the handle background. |
| `--neo-compare-shadow` | `0 0 4px rgb(0 0 0 / 0.35)` | Shadow of the divider and the handle. |
| `--neo-compare-handle-size` | `2.5rem` | Diameter of the handle. |
| `--neo-compare-handle-radius` | `50%` | Corner radius of the handle. |
| `--neo-compare-handle-grab-scale` | `1.15` | Scale of the handle while it is held. |
| `--neo-compare-handle-grab-shadow` | `0 4px 12px rgb(0 0 0 / 0.4)` | Shadow of the handle while it is held. |
| `--neo-compare-grab-duration` | `150ms` | Duration of the handle lift and drop, multiplied by `--neo-duration-scale`. |
| `--neo-compare-handle-bg` | `var(--neo-compare-divider-color)` | Handle background. |
| `--neo-compare-handle-fg` | `var(--btn-fg)` | Color of the handle arrows. |
| `--neo-compare-handle-border` | `var(--btn-border)` | Color of the 1px handle border. |
| `--neo-compare-focus-ring` | `var(--focus-ring, var(--accent))` | Color of the handle focus outline. |
| `--neo-compare-duration` | `200ms` | Duration of a move that isn't a drag, multiplied by `--neo-duration-scale`. |
| `--neo-compare-easing` | `var(--neo-easing, ease)` | Easing of a move that isn't a drag. |

### Interaction

- A drag anywhere on the element moves the divider. A drag that starts on the handle keeps the handle under the pointer.
- A click moves the divider to the pointer. A double-click or double-tap on the handle moves it to the center, unless [`recenter`](#attributes-recenter) is `false`.
- The handle lifts while held and drops back on release.
- On a touch screen, a swipe across the axis scrolls the page.
- The handle is a slider. Arrow keys move the divider 1% the way they point, 10% with <neo-kbd key="shift">Shift</neo-kbd>, and to the limit they point at with <neo-kbd key="mod">Ctrl</neo-kbd>. <neo-kbd>PageUp</neo-kbd> and <neo-kbd>PageDown</neo-kbd> move it 10%, <neo-kbd>Home</neo-kbd> and <neo-kbd>End</neo-kbd> to [`min`](#attributes-min) and [`max`](#attributes-max).
- The before layer is on the start side, which is the right side in a right-to-left page.
- With reduced motion, the divider moves without a transition.

## Examples

### Vertical

[`vertical`](#attributes-vertical) puts the before layer on top and moves the divider up and down.

```example compare_vertical
min-height: max-content
```

### Captions

A layer holds any content. Here each layer is an image with a caption, and the divider clips the caption with the image.

```example compare_captions
min-height: max-content
```

### HTML layers

The layers need not be images. Here both layers hold the same page, a search bar over an order summary, styled with an old design and a new one. The layers are `inert`, which keeps their mock controls out of the tab order and lets a press on them drag the divider.

```example compare_redesign
min-height: max-content
```

### Customized

The [`handle`](#slots-handle) slot replaces the arrows, here with a grip icon. [`--neo-compare-tilt`](#css-variables-neo-compare-tilt) tilts the line, [`::part(divider)`](#parts-divider) dashes it, and [`::part(handle)`](#parts-handle) reshapes the handle, which [`:state(grabbed)`](#states-grabbed) stretches while it is held. Custom properties set the line width and the handle colors, and [`min`](#attributes-min) and [`max`](#attributes-max) keep the divider off the edges.

```example compare_customized
min-height: max-content
```

## Examples: Datastar

### Morphing the content

The states swap the images and carry no [`value`](#attributes-value). A morph replaces the images, and the divider stays where it was. Drag the divider, then switch the state.

```playground
id: compare-morph-playground
- compare_morph_1: Jar 4
- compare_morph_2: Jar 6
```

### Server-set position

Each button posts to the server, which renders the whole element with a new [`value`](#attributes-value). The morph changes only that attribute, and the divider eases to it. Drag the divider, then press a button.

```example compare_server
min-height: max-content
script: sim/compare/position.js
```
