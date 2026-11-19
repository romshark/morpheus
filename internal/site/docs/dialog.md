# Dialog

Component `<neo-dialog>` is a modal dialog wrapping the platform `<dialog>` element. The host wires trigger, close, and aria plumbing; the browser owns top-layer rendering, focus trap, scroll lock, and Esc. No portal. Markup stays in light DOM so kit CSS themes it directly.

```playground
height: 24rem
- dialog_default: Default
- dialog_non_dismissible: Non-dismissible
- dialog_custom_surface: Custom surface
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean`, reflected, observed | `false` | Controls modal visibility. |
| `dismissible` | `true \| false` | `true` | Backdrop click and `Esc` close the dialog. Set `dismissible="false"` to require an explicit close. |

### Slots

| Name | Description |
| --- | --- |
| default | A `<dialog>` with optional `[data-neo-dialog-header]`, `[data-neo-dialog-body]`, `[data-neo-dialog-footer]` children. |
| `[data-neo-dialog-trigger]` | Element that opens the dialog on click. |
| `[data-neo-async-placeholder]` | Loading skeleton swapped in while the body morphs in. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-dialog-open` |  | yes | Fires when the dialog opens. |
| `neo-dialog-close` |  | yes | Fires when the dialog closes. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-dialog-bg` | `var(--page-bg, #ffffff)` | Dialog surface background. |
| `--neo-dialog-color` | `var(--page-fg, #111827)` | Dialog text color. |
| `--neo-dialog-border-color` | `var(--btn-border, rgba(0, 0, 0, 0.08))` | Border color. |
| `--neo-dialog-border-width` | `1px` | Border width. |
| `--neo-dialog-radius` | `calc(var(--page-radius, 0.25rem) * 1.5)` | Corner radius. |
| `--neo-dialog-padding` | `calc(var(--page-spacing, 0.25rem) * 6)` | Inner padding of the dialog box. |
| `--neo-dialog-shadow` | `0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 10px 15px -3px rgba(0, 0, 0, 0.1)` | Box shadow of the dialog box. |
| `--neo-dialog-min-width` | `18rem` | Minimum width of the dialog box. |
| `--neo-dialog-max-width` | `32rem` | Maximum width of the dialog box. |
| `--neo-dialog-screen-offset` | `1rem` | Minimum gap between the dialog box and the viewport edge. |
| `--neo-dialog-enter-duration` | `calc(180ms * var(--neo-duration-scale, 1))` | Open and close transition duration. |
| `--neo-dialog-overlay-bg` | `rgba(0, 0, 0, 0.55)` | Backdrop dim color behind the dialog. |
| `--neo-dialog-overlay-blur` | `0px` | Backdrop blur applied to the page behind the dialog. |
| `--neo-dialog-blur` | `0px` | Surface blur applied as a `backdrop-filter` on the dialog box for a frosted-glass effect with a translucent background. |

## Examples

### Non-dismissible

For must-decide flows, set [`dismissible="false"`](#attributes-dismissible). Backdrop clicks and <neo-kbd>Esc</neo-kbd> are then ignored and the user must pick an action. Pair it with a clearly destructive primary button.

```example dialog_non_dismissible
min-height: max-content
```

### Custom surface

Theme the surface by setting `--neo-dialog-*` tokens inline on the host.

- Here a dark translucent panel with an 18px backdrop blur over a heavier overlay dim.
- Holds up in light and dark modes. The dialog stays dark and the blurred page reads through the glass either way.

```example dialog_custom_surface
min-height: max-content
```

## Examples: Datastar

### Morphing during interaction

A Datastar app can fat-morph an open dialog's body at any moment; the dialog stays mounted and open and focus survives.

- A `<neo-elastic>` wrapper around the body animates the dialog's height between the 2 layouts.
- Autoplay cycles the states below to simulate the server-driven morphs.

```playground
id: dialog-morph-playground
autoplay: true
- dialog_morph_initial: Initial
- dialog_morph_different: Different content
```

Load the body on every open. A [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder) child holds skeleton bars; opening posts to the server, whose response morph-patches real content in to replace it.

- On close the host reinstates the placeholder. Each open shows it again until the new request resolves.
- `requestCancellation` aborts an in-flight request when the user closes mid-load.

### Async loading

```example dialog_async_loading
width: 100%
min-height: 6rem
max-height: 24rem
simulator: delay
```

### Async load with failure swap

Async load that shows a failure state and a retry button when the request keeps failing.

- The loader lives in the dialog's [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder) slot, and close/reopen restores it. On success the server morphs `<div id="<host-id>-body">` in place.
- Once Datastar exhausts its retry budget, a failure view with a `[data-neo-popover-async-retry]` button replaces the body without closing the dialog.
- Same failure-swap contract as [PopoverAsync](popover.md#async-load-with-failure-swap).

<template id="dialogAsyncDemo-success-template">
<div id="dialogAsyncDemo-body" class="dialog-async-slot dialog-async-loaded"><h3>Roman Scharkov</h3>
<p class="dialog-async-meta">Creator of Morpheus · <code>roman.scharkov@example.com</code></p>
<p>Builds Morpheus, the server-driven web component kit this site is built with.</p>
<h3>Daniel Scharkov</h3>
<p class="dialog-async-meta">Co-maker of Morpheus · <code>daniel.scharkov@example.com</code></p>
<p>Works on Morpheus with his brother Roman; the two ship it together.</p>
</div>
</template>

```example dialog_async_failure
width: 100%
min-height: 6rem
max-height: 24rem
simulator: errors
tabs: templ css
```

Opening streams progress patches over time. Each patch morphs the steps wrapper inside a `<neo-elastic>`, which animates the dialog's height as rows are added.

The final patch swaps in a `<neo-button data-neo-dialog-close>` so the user can dismiss only after the simulated job finishes.

### Continuous patching

```example dialog_continuous_patching
min-height: max-content
```

<script type="module" src="/static/sim/dialog/demos.js"></script>
