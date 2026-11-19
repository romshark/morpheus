# Toaster

Component `<neo-toaster>` is a stack of transient notifications. A single instance typically lives in the app shell; show toasts programmatically via the window-attached `NeoToast` API, or server-side by morph-patching [`<neo-toast>`](#slots-neo-toast) children into the toaster. Hover or click a toast to pause its auto-dismiss; <neo-kbd>×</neo-kbd> dismisses immediately.

```playground
height: 22rem
- toaster_default: Default
- toaster_variants: Variants
- toaster_title_desc: Title + description
- toaster_stack_dismiss: Stack + dismiss-all
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `position` | `"top-right" \| "top-left" \| "top-center" \| "bottom-right" \| "bottom-left" \| "bottom-center"` | `"bottom-right"` | Stack anchor relative to the viewport. |
| `contained` | `boolean` | `false` | Anchor to the nearest positioned ancestor instead of the viewport. Omit for fixed positioning. |
| `stack` | `number`, observed | `0` | `0` shows every live toast as a normal vertical stack. Positive values show that many full toasts, then up to 2 older toasts as hidden-behind peek cards; the rest appear when the toaster is hovered, focused, or clicked. |
| `touch-dismiss` | `"off" \| CSS length` | `on` | Touch swipe-to-dismiss is on by default. Set `touch-dismiss="off"` to disable, or pass a CSS length (for example `8ch`, `4rem`, or `40%`) to override the default threshold of 1/3 of the toast width, minimum 40px. |
| `<neo-toast> variant` | `"default" \| "success" \| "error" \| "warning" \| "info" \| "loading"` | `"default"` | Variant for a declarative toast child. Adds the matching icon/accent; `error` uses assertive live-region semantics. |
| `<neo-toast> duration` | `number` | `0` | Auto-dismiss delay in milliseconds for a declarative toast child. Positive values arm the timer; missing, 0, or negative values stay pinned. |
| `<neo-toast> dismissible` | `"false"` |  | Set to `false` on a declarative toast child to omit the close button and disable touch swipe dismissal for that toast. |
| `<neo-toast> dismiss-label` | `string`, observed | `"Dismiss notification"` | Accessible name of the close button. `NeoToast.show()` takes it as `dismissLabel`. |

### States

| Name | Description |
| --- | --- |
| `:state(expanded)` | Set while the stack is unfolded (hover, focus, or click). Dismiss timers are paused for as long as it holds. |

### Slots

| Name | Description |
| --- | --- |
| `<neo-toast>` | Declarative toast children. Each toast takes the slots `title`, `description`, `action`, and `icon`. The imperative API is `NeoToast.show({...})`. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-toast-close` | `{ reason: string, item: HTMLElement }` | yes | Fires on a `<neo-toast>` when it starts to close. `reason` is `"close"` (close button), `"action"` (action button of `NeoToast.show()`), `"timeout"` (`duration` elapsed), `"swipe"` (touch swipe), `"dismiss"` (`NeoToast.dismiss()`) or `"remove"` (the element was removed, for example by a morph). |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-toaster-z-index` | `1200` | Stacking order of the fixed toaster relative to the rest of the page. |
| `--neo-toaster-padding` | `1rem` | Inset between the toaster stack and the viewport edge. |
| `--neo-toaster-max-width` | `22rem` | Maximum width of a toast card. |
| `--neo-toaster-gap` | `10px` | Vertical gap between toasts in the expanded stack. |
| `--neo-toaster-stack-offset` | `14px` | Vertical offset between peek cards in the collapsed stack. |
| `--neo-toaster-stack-scale-step` | `0.05` | Scale reduction applied per peek card behind the freshest toast. |
| `--neo-toaster-transition` | `calc(400ms * var(--neo-duration-scale, 1)) var(--neo-easing, cubic-bezier(0.32, 0.72, 0, 1))` | Transition timing for toast transform and opacity. |
| `--neo-toaster-max-height` | `calc(100dvh - var(--neo-toaster-padding) - var(--neo-toaster-padding) + var(--neo-toast-shadow-bleed) + var(--neo-toast-shadow-bleed))` | Maximum height of the expanded scrollable stack. |
| `--neo-toast-bg` | `var(--btn-bg)` | Toast card background. |
| `--neo-toast-fg` | `var(--page-fg)` | Toast text color. |
| `--neo-toast-border` | `var(--btn-border)` | Toast border color. |
| `--neo-toast-radius` | `var(--page-radius, 0.5rem)` | Toast corner radius. |
| `--neo-toast-shadow` | `0 8px 24px -10px rgba(0, 0, 0, 0.22), 0 2px 4px -2px rgba(0, 0, 0, 0.08)` | Toast box shadow. |
| `--neo-toast-shadow-bleed` | `1.5rem` | Extra space reserved around the stack so the toast shadow is not clipped. |
| `--neo-toast-success` | `oklch(0.65 0.18 145)` | Accent color for the `success` variant icon. |
| `--neo-toast-error` | `var(--danger-bg)` | Accent color for the `error` variant icon. |
| `--neo-toast-warning` | `oklch(0.78 0.16 80)` | Accent color for the `warning` variant icon. |
| `--neo-toast-info` | `oklch(0.6 0.18 240)` | Accent color for the `info` variant icon. |

## Examples

### Show a toast (vanilla JS) {#vanilla-show-toast}

Without a framework, a plain `addEventListener('click', ...)` handler calls the toaster instance's `show()` method directly. The window-attached `NeoToast.show()` targets the page-wide singleton at the bottom-right of the viewport; for a contained preview, talk to the element. The toast inherits hover-to-pause, swipe-to-dismiss, and live-region semantics without any extra wiring.

```example toaster_vanilla
height: 16rem
min-height: max-content
```

## Examples: Datastar

The toaster also works declaratively. Drop [`<neo-toast>`](#slots-neo-toast) children into the host (server-side renders or patched in by Datastar SSE `datastar-patch-elements` events) and a `MutationObserver` picks them up, wires their lifecycle, and animates them in. Each demo below ships the exact handler under *Server script*; see also the [SSE events reference](https://data-star.dev/reference/sse_events).

Touch dismissal is on by default. Set [`touch-dismiss="off"`](#attributes-touch-dismiss) to opt out or a CSS length like [`touch-dismiss="8ch"`](#attributes-touch-dismiss) to override the threshold. Individual toasts with `dismissible="false"` skip the close button and the swipe gesture. [`contained`](#attributes-contained) anchors the toaster to its parent. Previewed toasts paint inside the demo frame.

### Triggers the app-shell toaster

```example toaster_app_shell
width: 100%
min-height: 6rem
max-height: 18rem
script: sim/toaster/app-shell.js
```

### Patch: append a toast

An SSE patch-elements event with `mode: "append"` drops a new [`<neo-toast>`](#slots-neo-toast) into the toaster's stack. The new card is the freshest in the stack and auto-dismisses after its `duration` (3 s here).

```example toaster_patch_append
height: 20rem
min-height: max-content
script: sim/toaster/patch-append.js
```

### Patch: replace all

An `mode: "inner"` patch on the stack wrapper replaces every child. Existing toasts get destroyed (the `MutationObserver` fires on each removal and runs the leave animation) and the new batch animates in. The Pin button is its own `mode: "append"` endpoint that seeds something for Replace to overwrite.

```example toaster_patch_replace
height: 22rem
min-height: max-content
script: sim/toaster/patch-replace.js
```

### Patch: update 1 toast {#patch-update-one-toast}

The toaster is SSR'd with 1 pinned toast and [`stack="1"`](#attributes-stack) (single visible toast). Clicking *Update title* streams an SSE patch-elements event keyed by the title node's id (`#patch-update-toast-title`). The toast element keeps its identity (and its dismissal timer); only the inner text changes.

```example toaster_patch_update
height: 20rem
min-height: max-content
script: sim/toaster/patch-update.js
```

### Loading + async patch

The `loading` variant defaults to duration 0 (persistent) and renders a `<neo-spinner>` instead of a static icon. These buttons use Datastar actions. The simulator patches a loading toast immediately, waits on the server side, then morphs that same toast to the final success or error state.

```example toaster_loading_async
min-height: max-content
script: sim/toaster/app-shell.js
```

### Action button

Action buttons can be rendered by the server too. This example patches a toast with an *Undo* button whose click is a Datastar action; the undo request then appends a related confirmation toast with its own unique id.

```example toaster_action_button
height: 22rem
min-height: max-content
script: sim/toaster/action.js
```

### Variants

Only the icon picks up the variant accent. The card itself stays neutral. `error` raises the live-region politeness to `assertive` so screen readers announce it immediately.

```example toaster_variants
min-height: max-content
```

### Title + description

Pass an object with both `title` and `description` to get a 2-line layout. Description text uses the muted colour and a smaller size, which keeps the title the primary label.

```example toaster_title_desc
min-height: max-content
```

### Stack + dismiss-all

`NeoToast.dismiss()` with no argument closes every active toast at once. Use it for a "clear all" button, or to wipe a backlog between scenarios.

```example toaster_stack_dismiss
min-height: max-content
```
