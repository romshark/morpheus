# Sortable

Component `<neo-sortable>` is a drag-to-reorder container for its direct element children as a column, row, or grid. Pointer, touch, and a full keyboard contract operate the same list. A child marked `data-neo-sortable-handle` becomes the grip; absent that, the whole item is draggable. Give every item a stable `id` so [`neo-sortable-start`](#events-neo-sortable-start) / `-move` / `-end` events identify which item moved and its `from` / `to` position.

```playground
- sortable_default: Default
- sortable_list: Sortable list
- sortable_whole: Whole-item drag
- sortable_nodrag: Drag-free control
- sortable_row: Horizontal row
- sortable_grid: Grid
- sortable_unbounded: Unbounded
- sortable_scrollable: Scrollable parent
- sortable_easing: Custom move easing
- sortable_placeholder: Custom placement indicator
- sortable_disabled: Disabled
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `orientation` | `"vertical" \| "horizontal" \| "grid"`, observed | `"vertical"` | Constrains pointer travel and the reorder axis. `vertical` is a column, `horizontal` a row, `grid` a 2-D auto-fill grid. |
| `disabled` | `boolean`, observed | `false` | Freezes reordering and removes the keyboard grip (grips become `tabindex=-1`). |
| `unbounded` | `boolean` | `false` | By default the floating dragged element is clamped to the host's bounding box so an item can't be dragged outside the list (the lower bound takes precedence if an item is larger than the host). `unbounded` opts out, letting it follow the pointer anywhere on the page. |
| `easing` | `string` | `theme easing` | Transition for the displaced (non-dragged) items as they glide to their new slot. When absent, the theme easing (`--neo-easing`) applies at `--neo-sortable-move-duration`. An empty string means no animation (instant). A bare duration (`220ms`) pairs with `--neo-easing`; a full pair (`220ms ease-in-out`) is used verbatim. |
| `tolerate-reorder` | `boolean` | `false` | Controls how an in-flight drag survives an external morph (e.g. a Datastar fat-morph). By default only a no-op morph (same item ids, same per-id content, same order of the other rows) keeps a drag alive. `tolerate-reorder` loosens that to the same id set, which treats an order-only morph as a no-op and continues the gesture. Any added, removed, or swapped id still cancels the drag. |

### States

| Name | Description |
| --- | --- |
| `:state(active)` | Set while a reorder is in flight, whether pointer- or keyboard-driven. |
| `:state(pointer)` | Set while the in-flight reorder is pointer-driven; carries the grabbing cursor, which a keyboard reorder must not. |

### Slots

| Name | Description |
| --- | --- |
| default | The sortable items, which are the host's direct element children. Give each a stable `id` (or `data-neo-sortable-id`) so the reorder events can name the moved item. Mark a child `data-neo-sortable-ignore` to exclude it from the set. |
| `[data-neo-sortable-item]` | Opts an item into the default styling (a bordered row with the handle leading). The Templ `SortableItem` wrapper adds it automatically; in raw HTML it is optional, drop it to style items yourself. |
| `[data-neo-sortable-handle]` | Optional drag grip inside an item. With a handle, only that subtree starts a drag; without one the whole item is the grip. |
| `[data-neo-sortable-nodrag]` | Marks a region inside a whole-item grip that must not start a drag. Pressing it interacts normally. Native controls (links, buttons, form fields, `contenteditable`) are already exempt; use this for anything else. Ignored when the item has an explicit `data-neo-sortable-handle`. |
| `template[data-neo-sortable-placeholder]` | Optional `<template>` whose content replaces the default dashed placement indicator (the gap shown where the dragged item will land). The gap keeps the dragged item's size; the slotted markup renders inside it. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-sortable-start` | `{ id: string, index: number }` | yes | Fires when a drag (pointer or keyboard pick-up) begins. `index` is the picked-up item's position. |
| `neo-sortable-move` | `{ id: string, from: number, to: number }` | yes | Fires on every reorder during the gesture. Item `id` moved from index `from` to index `to`. |
| `neo-sortable-end` | `{ id: string, from: number, to: number, changed: boolean, aborted?: boolean }` | yes | Fires when the drag ends (drop, cancel, or blur). `from` / `to` are the item's start and final positions; `changed` is false when they match or the gesture was cancelled. An external patch that aborts an in-flight drag sets `aborted: true` with `to: -1`. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-sortable-gap` | `0.5rem` | Gap between items. |
| `--neo-sortable-grid-min` | `7rem` | Minimum column width in `grid` orientation. |
| `--neo-sortable-move-duration` | `180ms` | Default glide duration for displaced items when the `easing` attribute is absent. |
| `--neo-sortable-radius` | `var(--page-radius, 0.5rem)` | Corner radius of items and the drop placeholder. |
| `--neo-sortable-drag-shadow` | `var(--neo-card-shadow)` | Box shadow on the lifted item. |
| `--neo-sortable-drag-ring` | `inset 0 0 0 2px var(--accent, #6366f1)` | Ring on the lifted item, kept legible on dark backgrounds. |
| `--neo-sortable-handle-color` | `var(--muted, currentColor)` | Handle color at rest. |
| `--neo-sortable-handle-hover-color` | `var(--page-fg, currentColor)` | Handle color on hover or focus. |
| `--neo-sortable-placeholder-color` | `color-mix(in srgb, var(--accent, #6366f1) 55%, transparent)` | Color of the dashed placement indicator. |

### Keyboard

Every reorder works without a pointer. Tab to a drag grip (each is a tab stop), press `Space` or `Enter` to pick the item up, then move it:

- `Space` / `Enter`: pick up the focused item, then drop it once it is in place.
- `Arrow` keys: move the held item 1 slot along the orientation; in a grid, `ArrowUp` / `ArrowDown` jump a whole row.
- `Home` / `End`: send the held item to the first or last position.
- `Tab` / blur: drop and commit the new order. `Escape` cancels and restores the original order.

The first move, every subsequent move, the final position, and cancellation are announced through an `aria-live` region; the moving item carries `aria-grabbed` and grips expose `aria-keyshortcuts`. A handle without a `role` gets `role="button"`. The [`disabled`](#attributes-disabled) attribute drops the grips from the tab order.

## Examples

### Sortable list

A vertical list with a leading drag handle on each row. Only the handle is the grip. Text inside the row stays selectable and any buttons keep working.

```example sortable_list
width: 20rem
min-height: max-content
min-width: 12rem
```

### Whole-item drag

With no `data-neo-sortable-handle` child, the entire item is the grip. Press anywhere on a row and drag.

```example sortable_whole
width: 20rem
min-height: max-content
min-width: 10rem
```

### Drag-free control

The whole row is the grip, yet each `<neo-switch>` still toggles because its wrapper is marked `data-neo-sortable-nodrag`. Pressing it never starts a drag. Native controls are exempt automatically; custom elements need the marker. Toggle a switch, then drag a row by its label.

```example sortable_nodrag
width: 22rem
min-height: max-content
min-width: 14rem
```

### Horizontal row

[`orientation="horizontal"`](#attributes-orientation) lays the items out in a row and constrains the drag to the horizontal axis.

```example sortable_row
width: 24rem
min-height: max-content
min-width: 18rem
```

### Grid

[`orientation="grid"`](#attributes-orientation) reorders in 2 dimensions. The dragged tile drops into the nearest slot, and arrow keys step a row at a time.

```example sortable_grid
width: 24rem
min-height: max-content
min-width: 11rem
```

### Unbounded

By default the dragged item is clamped to the list's own box. A drag toward an edge stops at the boundary. [`unbounded`](#attributes-unbounded) opts out, letting the item follow the pointer freely over the rest of the page.

```example sortable_unbounded
width: 20rem
min-height: max-content
min-width: 10rem
```

### Scrollable parent

20 rows in an `overflow: auto` box. The lifted item is clamped to the scroll viewport, and the grip keeps `touch-action: none` so dragging a handle reorders while dragging the row body still scrolls the list.

```example sortable_scrollable
width: 20rem
min-height: max-content
min-width: 12rem
```

### Custom move easing

The [`easing`](#attributes-easing) attribute tunes how the displaced items glide. Here a slow [`easing="420ms ease-in-out"`](#attributes-easing) makes the reflow obvious; an empty [`easing=""`](#attributes-easing) would turn it off and snap instantly.

```example sortable_easing
width: 20rem
min-height: max-content
min-width: 11rem
```

### Custom placement indicator

A `<template data-neo-sortable-placeholder>` child replaces the default dashed gap. The gap keeps the dragged item's size; the slotted markup renders inside it, here a tinted "Drop here" bar.

```example sortable_placeholder
width: 20rem
min-height: max-content
min-width: 11rem
```

### Disabled

[`disabled`](#attributes-disabled) freezes reordering. Pointer drags do nothing, the grips drop out of the tab order, and the handles dim to read as inert.

```example sortable_disabled
width: 20rem
min-height: max-content
min-width: 12rem
```

## Examples: Datastar

### Morphing during interaction

A Datastar app can fat-morph the page mid-drag. The server may reorder or replace the items under a `<neo-sortable>` while the user holds a row. Pick up an item (drag it, or press `Space`) while autoplay runs to see each outcome:

- **Same items**: the morph re-emits the same ids, content, and order. Nothing changes. The dragged row re-links to its morphed node and the drag is untouched.
- **Different order**: same ids, reordered. With [`tolerate-reorder`](#attributes-tolerate-reorder) the kit reconciles the new order in place and the drag survives; the held row keeps its grip.
- **Different items**: the morph swaps an `id` in or out. The kit can't map the in-flight drag onto the new set. It cancels the drag and lets the server's order stand.

Tolerating an order-only morph needs [`tolerate-reorder`](#attributes-tolerate-reorder). In the strict default, reordering the other rows already counts as a change and cancels the drag.

```playground
id: sortable-morph-playground
autoplay: true
- sortable_morph_same: Initial
- sortable_morph_same: Same items
- sortable_morph_reorder: Different order
- sortable_morph_different: Different items
```
