# Resizable

Component `<neo-resizable>` is a wrapper that turns any content into a draggable box. The [`handles`](#attributes-handles) attribute picks which edges and corners get a drag handle; clamp the result with `min-/max-width` and `min-/max-height`, and snap to a pixel grid with [`step-horizontal`](#attributes-step-horizontal) and [`step-vertical`](#attributes-step-vertical). After the first drag the host owns size as inline styles. Double-click or double-tap a handle to reset its axis back to the natural size.

```playground
- resizable_state_default: Default
- resizable_corner: Bottom-right corner
- resizable_edges: Edges only
- resizable_all: All eight handles
- resizable_vertical: Vertical only
- resizable_horizontal: Horizontal only
- resizable_step: Step grid
- resizable_custom_icon: Custom handle icon
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `handles` | `string`, observed |  | Space-separated list: `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`. |
| `min-width` | `string`, observed |  | CSS length, mirrored to the inline `min-width` style. Omit for no minimum (`none` is invalid for `min-*`). |
| `max-width` | `string`, observed |  | CSS length or `none` (no maximum), mirrored to the inline `max-width` style. |
| `min-height` | `string`, observed |  | CSS length, mirrored to the inline `min-height` style. Omit for no minimum (`none` is invalid for `min-*`). |
| `max-height` | `string`, observed |  | CSS length or `none` (no maximum), mirrored to the inline `max-height` style. |
| `width` | `string`, observed |  | Initial width. |
| `height` | `string`, observed |  | Initial height. |
| `step-horizontal` | `number` |  | Snap width to a multiple of this many pixels while dragging. Omit for free resize. |
| `step-vertical` | `number` |  | Snap height to a multiple of this many pixels while dragging. Omit for free resize. |

### States

| Name | Description |
| --- | --- |
| `:state(resizing)` | Set while a handle drag is in flight. |
| `:state(handle-<dir>)` | Set alongside `resizing` for the handle being dragged (`handle-top`, `handle-bottom-left`, ...); the kit uses it to pick the resize cursor. |

### Slots

| Name | Description |
| --- | --- |
| default | Resizable content. |
| `[data-neo-resizable-icon]` | Custom glyph per direction. The attribute value names the handle (e.g. `bottom-right`). |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-resizable-start` |  | yes | Fires when a drag begins. |
| `neo-resizable-resize` | `{ width: number, height: number }` | yes | Fires on every frame during a drag. |
| `neo-resizable-end` |  | yes | Fires when the drag ends. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-resizable-handle-color` | `var(--muted, currentColor)` | Handle color at rest. |
| `--neo-resizable-handle-hover-color` | `var(--page-fg, currentColor)` | Handle color on hover or during a drag. |
| `--neo-resizable-handle-opacity` | `0.55` | Handle opacity at rest. |
| `--neo-resizable-handle-hover-opacity` | `1` | Handle opacity on hover or during a drag. |
| `--neo-resizable-handle-hover-bg` | `color-mix(in srgb, var(--page-fg) 5%, transparent)` | Handle background on hover or during a drag. |
| `--neo-resizable-edge-thickness` | `0.5rem` | Hit-area thickness of the edge handles. |
| `--neo-resizable-corner-size` | `1rem` | Hit-area size of the corner handles. |
| `--neo-resizable-icon-size` | `0.85rem` | Handle glyph size. |

## Examples

### Bottom-right corner

A single corner handle, as on a textarea, for when the surrounding layout pins 1 edge and only the opposite corner should grow.

```example resizable_corner
min-height: max-content
```

### Edges only

All 4 edge handles and no corners. Each axis moves independently and the cursor is always single-axis.

```example resizable_edges
min-height: max-content
```

### All 8 handles {#all-eight-handles}

Every edge and corner. The corners (NW-SE / NE-SW cursors) sit above the edges and take precedence where they overlap.

```example resizable_all
min-height: max-content
```

### Vertical only

A vertical sash. The layout fixes the host's width; only the bottom edge moves, which keeps the cursor at `ns-resize`.

```example resizable_vertical
min-height: max-content
```

### Horizontal only

A horizontal sash, symmetric to the vertical case. Only the right edge moves and the cursor stays `ew-resize`.

```example resizable_horizontal
min-height: max-content
```

### Step grid

[`step-horizontal`](#attributes-step-horizontal) and [`step-vertical`](#attributes-step-vertical) snap each axis to a multiple of their pixel value while dragging. The box resizes one grid cell at a time instead of continuously. Drag the corner over the grid to see it jump.

```example resizable_step
min-height: max-content
```

### Custom handle icon

Drop a child marked `data-neo-resizable-icon="<dir>"` and the host reuses it instead of injecting the default grip. Only the glyph changes; the handle wrapper, positioning, and cursor stay host-owned.

```example resizable_custom_icon
min-height: max-content
```
