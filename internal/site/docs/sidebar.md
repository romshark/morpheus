# Sidebar

Component `<neo-sidebar>` is a responsive navigation rail. At or below the [`overlay-breakpoint`](#attributes-overlay-breakpoint) width (50rem default) it switches to a fixed overlay with a backdrop; dismiss via the header X, backdrop click, or <neo-kbd>Esc</neo-kbd>.

```playground
height: 28rem
min-width: 32rem
- sidebar_default: Default
- sidebar_mixed_breakpoints: Mixed breakpoints
- sidebar_resizable: Resizable widths
- sidebar_touch_dismiss: Touch-dismiss
- sidebar_minimized: Minimized rail
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean`, reflected, observed | `false` | Whether the sidebar is expanded. |
| `side` | `"left" \| "right"` | `left` | Edge of the viewport the sidebar attaches to. |
| `manual` | `boolean` | `false` | Disable auto-open at wide layouts. |
| `overlay` | `boolean` | `false` | Always render as a fixed overlay. |
| `overlay-breakpoint` | `string`, observed | `"50rem"` | CSS length at or below which the sidebar acts as an overlay. |
| `touch-dismiss` | `"off" \| CSS length` | `on` | Drag-to-close gesture in overlay mode. On by default; set `touch-dismiss="off"` (or `"false"` / `"no"` / `"none"`) to disable. The default close threshold is 1/2 the host's width; pass a CSS length (e.g. `120`, `120px`, or `40%`) to pin it explicitly. Touches that start on a horizontally-scrollable child or on an element that owns a horizontal gesture (range input, slider, resizable handle, color field, or any `[data-neo-sidebar-touch-ignore]` descendant) are ignored. |

### States

| Name | Description |
| --- | --- |
| `:state(overlay)` | Set while the sidebar renders as a fixed overlay, which happens when `overlay` is pinned or the parent's width sits at or below `overlay-breakpoint`. Page CSS branches its shell layout on this. |
| `:state(dragging)` | Set while a touch-dismiss drag is in flight. |

### Slots

| Name | Description |
| --- | --- |
| `[data-neo-sidebar-header]` | Top section. |
| `[data-neo-sidebar-content]` | Scrollable middle section. |
| `[data-neo-async-placeholder]` | Resting content inside `[data-neo-sidebar-content]`; snapshotted on connect and restored on close so each open loads fresh. |
| `[data-neo-sidebar-footer]` | Bottom section. |
| `[data-neo-sidebar-minimized]` | Compact wide-mode closed state. |
| `[data-neo-sidebar-close]` | Any descendant carrying this attribute closes the sidebar on click. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-sidebar-open` |  | yes | Fires when the sidebar opens. |
| `neo-sidebar-close` |  | yes | Fires when the sidebar closes. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-sidebar-width` | `16rem` | Open column width. |
| `--neo-sidebar-bg` | `var(--btn-bg)` | Background color. |
| `--neo-sidebar-fg` | `var(--btn-fg)` | Text color. |
| `--neo-sidebar-border-color` | `var(--btn-border)` | Edge border color. |
| `--neo-sidebar-padding` | `round(calc(var(--page-spacing, 0.25rem) * 3), 1px)` | Padding of header, content, and footer sections. |
| `--neo-sidebar-gap` | `round(calc(var(--page-spacing, 0.25rem) * 2), 1px)` | Gap within header and footer rows. |
| `--neo-sidebar-transition-duration` | `calc(200ms * var(--neo-duration-scale, 1))` | Open / close animation duration. |
| `--neo-sidebar-minimized-width` | `3.5rem` | Width of the minimized wide-mode rail. |
| `--neo-sidebar-z-index` | `60` | Stacking index in overlay mode; the backdrop sits 1 below. |
| `--neo-sidebar-backdrop-bg` | `rgba(0, 0, 0, 0.45)` | Overlay backdrop color. |

## Examples

Both sidebars use the global `50rem` threshold by default; the [`overlay-breakpoint`](#attributes-overlay-breakpoint) attribute overrides it per instance. With a left nav and a right drawer both in-flow, push the drawer into overlay mode sooner (larger breakpoint) while keeping the nav in-flow longer (smaller breakpoint).

### Mixed breakpoints

The preview has a left nav at [`overlay-breakpoint="30rem"`](#attributes-overlay-breakpoint) and a right settings drawer at [`overlay-breakpoint="50rem"`](#attributes-overlay-breakpoint), the same strategy the doc-app frame uses. Drag the frame's right handle to try it.

- Above 50rem both stay in-flow.
- Between 30rem and 50rem only the right one becomes a drawer (toggle it with the gear button).
- Below 30rem both are drawers.

```example sidebar_mixed_breakpoints
min-height: max-content
```

Wrap the sidebar in a `<neo-resizable>` and set [`--neo-sidebar-width`](#css-variables-neo-sidebar-width) from `--neo-resizable-width` so the sidebar follows the wrapper's width. The wrapper's `min-width` / `max-width` set the drag bounds (here 12rem to 22rem). Drag the inner edge of either sidebar to try it.

### Resizable widths

When the preview crosses the overlay breakpoint, or when either sidebar is closed, the resizable wrappers release their flex space. The sidebars keep the last resized width when they reopen or become drawers. Use the menu and info buttons below to bring them back.

```example sidebar_resizable
min-height: max-content
```

### Touch-dismiss

Mobile-style drag-to-close, on by default in overlay mode. A single-touch horizontal swipe in the closing direction follows the finger; release past the threshold or a fast flick closes, otherwise it snaps back.

- The threshold defaults to 1/2 the host's width; pass a CSS length (here [`touch-dismiss="120px"`](#attributes-touch-dismiss)) to pin it, or [`touch-dismiss="off"`](#attributes-touch-dismiss) to opt out.
- Try the preview on a touchscreen, or with browser device-toolbar touch emulation.

The gesture stands down for descendants that own a horizontal gesture of their own, such as horizontally scrollable containers, range inputs, sliders, resizable handles, color fields, or any element marked `[data-neo-sidebar-touch-ignore]`. It only engages in overlay mode (it has no meaning for the in-flow wide-mode column). The `<neo-slider>` in the panel below demonstrates this. Dragging the slider thumb horizontally never closes the sidebar.

```example sidebar_touch_dismiss
min-height: max-content
```

## Examples: Datastar

### Async loading

Load content on every open. Mark the resting content with [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder). The sidebar snapshots it on connect and restores it on close, which makes every open load fresh (same slot pattern as `<neo-dialog>` and `<neo-drawer>`).

- Open emits [`neo-sidebar-open`](#events-neo-sidebar-open); wire `data-on:neo-sidebar-open` to post and morph the returned panel into the [`[data-neo-sidebar-content]`](#slots-data-neo-sidebar-content) slot (matched by id).
- The [`neo-sidebar-close`](#events-neo-sidebar-close) handler only aborts the in-flight request; the host resets the placeholder.

```example sidebar_async_loading
min-height: max-content
script: sim/sidebar/async.js
simulator: delay
```

### Async load with failure swap

Async load that shows a failure state and a retry button when the request keeps failing.

- The loader lives in the sidebar's [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder) slot and close/reopen restores it; on success the server morphs `<div id="<host-id>-body">` in place.
- Once Datastar exhausts its retry budget, a failure view with a `[data-neo-popover-async-retry]` button replaces the content without closing the sidebar.
- Same failure-swap contract as [PopoverAsync](popover.md#async-load-with-failure-swap).

```example sidebar_async_failure
min-height: max-content
script: sim/sidebar/asyncfail.js
simulator: errors
tabs: templ css script
```
