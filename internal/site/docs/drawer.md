# Drawer

Component `<neo-drawer>` is a modal side-sheet on the platform `<dialog>`. Same browser-owned modal lifecycle as [`<neo-dialog>`](dialog.md), anchored to one of 4 viewport edges via [`side`](#attributes-side) (`right` default, `left` / `top` / `bottom`) and animated in with a slide transform. Dismiss via backdrop, Esc, or swipe toward the anchored edge; set [`dismissible="false"`](#attributes-dismissible) to force an explicit button choice.

```playground
height: 20rem
- drawer_default: Default
- drawer_sides: Sides
- drawer_frost_glass: Frost glass
- drawer_non_dismissible: Non-dismissible
- drawer_scrolling_body_playground: Scrolling body
- drawer_touch_dismiss: Touch-dismiss
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean`, reflected, observed | `false` | Controls drawer visibility. |
| `side` | `"right" \| "left" \| "top" \| "bottom"`, observed | `right` | Edge the drawer slides in from. |
| `dismissible` | `true \| false` | `true` | Backdrop click and `Esc` close the drawer. Set `dismissible="false"` to require an explicit close. |
| `touch-dismiss` | `"off" \| CSS length` | `on` | Drag-to-close gesture. On by default; set `touch-dismiss="off"` (or `"false"` / `"no"` / `"none"`) to disable. The default close threshold is 50% of the panel's relevant dimension along the swipe axis; pass a CSS length (e.g. `120`, `120px`, or `40%`) to pin it explicitly. Touches that start on a same-axis scrollable child or on an element that owns a same-axis gesture (range input, slider, resizable handle, color field, or any `[data-neo-drawer-touch-ignore]` descendant) are ignored. Disabled when `dismissible="false"`. |

### States

| Name | Description |
| --- | --- |
| `:state(dragging)` | Set while a touch-dismiss drag is in flight. |

### Slots

| Name | Description |
| --- | --- |
| default | A `<dialog>` with optional `[data-neo-drawer-header]`, `[data-neo-drawer-body]`, `[data-neo-drawer-footer]` children. |
| `[data-neo-drawer-title]` | Accessible name for the drawer; its id wires the dialog's `aria-labelledby`. |
| `[data-neo-drawer-description]` | Accessible description; its id wires the dialog's `aria-describedby`. |
| `[data-neo-drawer-trigger]` | Element that opens the drawer on click. |
| `[data-neo-drawer-close]` | Element that closes the drawer on click (matched via `closest`; a descendant works too). |
| `[data-neo-async-placeholder]` | Loading skeleton swapped in while the body morphs in. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-drawer-open` |  | yes | Fires when the drawer opens. |
| `neo-drawer-close` |  | yes | Fires when the drawer closes. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-drawer-width` | `22rem` | Panel width for the `left` and `right` sides. |
| `--neo-drawer-height` | `16rem` | Panel height for the `top` and `bottom` sides. |
| `--neo-drawer-enter-duration` | `calc(220ms * var(--neo-duration-scale, 1))` | Slide and fade transition duration. Surface colors, border, shadow, and padding reuse the `--neo-dialog-*` tokens. |

## Examples

### Sides

Same markup, different [`side`](#attributes-side). The panel anchors to that edge and slides in along the matching axis; width vs height defaults swap automatically.

```example drawer_sides
min-height: max-content
```

### Frost glass

Theme the surface by setting `--neo-dialog-*` tokens inline on the host.

- The drawer reuses the dialog's surface tokens. Any recipe that frosts a centred dialog frosts the side sheet too.
- Here a 22px backdrop blur on the surface plus a 6px overlay blur read through both layers as a deep frosted scene.

```example drawer_frost_glass
min-height: max-content
```

### Non-dismissible

For must-decide flows where dismissing implicitly would be ambiguous, set [`dismissible="false"`](#attributes-dismissible) on the host. Backdrop click and Esc then do not close the drawer, and the user must pick a button.

```example drawer_non_dismissible
min-height: max-content
```

### Scrolling body

The body region scrolls independently while the header and footer stay pinned, common for a settings drawer with many fields.

```example drawer_scrolling_body
min-height: max-content
```

### Touch-dismiss

Mobile-style drag-to-close, on by default. A single-touch swipe in the closing direction follows the finger; release past the threshold or a fast flick closes, otherwise it snaps back.

- Axis follows [`side`](#attributes-side). Left/right drawers take horizontal swipes, top/bottom vertical.
- The threshold defaults to 50% of the panel's relevant dimension; pass a CSS length (here [`touch-dismiss="120px"`](#attributes-touch-dismiss)) to pin it, or [`touch-dismiss="off"`](#attributes-touch-dismiss) to opt out.
- Try the preview on a touchscreen, or with browser device-toolbar touch emulation.

The gesture stands down for descendants that own a same-axis gesture of their own (same-axis scrollable containers, range inputs, sliders, resizable handles, color fields, or any element marked `[data-neo-drawer-touch-ignore]`), and is disabled when [`dismissible="false"`](#attributes-dismissible). Dragging the `<neo-slider>` thumb horizontally in the panel below never closes the drawer.

```example drawer_touch_dismiss
min-height: max-content
```

### Opened from a dialog {#from-dialog}

Open a drawer from inside a dialog. The dialog's *Connected devices…* button triggers a nested `<neo-drawer>` that slides in over the modal. Both overlays are open together; each keeps the page behind it from scrolling while its own content scrolls. Open the dialog, then click *Connected devices…*.

```example drawer_from_dialog
min-height: max-content
```

## Examples: Datastar

Load the body on every open. A [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder) child holds skeleton bars; opening posts to the server, whose response morph-patches real content in to replace it.

- On close the host reinstates the placeholder after the slide-out finishes (so it doesn't flash through the closing panel). Each open shows it again until the next response resolves.
- The editor below is bound to the `drawer_async_html` signal the server reads at request time; edit it to change the next response.

### Async loading

```example drawer_async_loading
width: 100%
min-height: 6rem
max-height: 20rem
simulator: delay
```

### Async load with failure swap

Async load that shows a failure state and a retry button when the request keeps failing.

- The loader lives in the drawer's [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder) slot, and close/reopen restores it. On success the server morphs `<div id="<host-id>-body">` in place.
- Once Datastar exhausts its retry budget, a failure view with a `[data-neo-popover-async-retry]` button replaces the body without closing the drawer.
- Same failure-swap contract as [PopoverAsync](popover.md#async-load-with-failure-swap).

<template id="drawerAsyncDemo-success-template">
<div id="drawerAsyncDemo-body" class="drawer-async-slot drawer-async-loaded"><h3>Roman Scharkov</h3>
<p class="drawer-async-meta">Creator of Morpheus · <code>roman.scharkov@example.com</code></p>
<p>Builds Morpheus, the server-driven web component kit this site is built with.</p>
<h3>Daniel Scharkov</h3>
<p class="drawer-async-meta">Co-maker of Morpheus · <code>daniel.scharkov@example.com</code></p>
<p>Works on Morpheus with his brother Roman; the two ship it together.</p>
</div>
</template>

```example drawer_async_failure
width: 100%
min-height: 6rem
max-height: 20rem
simulator: errors
tabs: templ css
```

<script type="module" src="/static/sim/drawer/demos.js"></script>
