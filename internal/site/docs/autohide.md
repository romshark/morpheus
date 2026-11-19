# Autohide

Component `<neo-autohide>` is a sticky bar that hides on scroll down and slides back on scroll up. It follows the nearest scroll container. Place it directly in the scrolling content, because a sticky element stops at the end of its parent. It hides only on a scroll that starts while it is stuck. Keyboard focus or an element with `open` inside, such as a popover or `<details>`, keeps it on screen. Set `scroll-padding-top` on the scroll container to the bar height to keep focused elements out from under it.

```playground
- autohide_default: Default
- autohide_bottom: Bottom tab bar
- autohide_banner: Below a banner
- autohide_scrolled: Style by state
- autohide_popover: Popover in the bar
- autohide_pin: Pin the bar
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom"`, observed | `top` | Edge the bar sticks to. |
| `tolerance` | `number`, observed | `8` | Pixels to scroll in 1 direction before the bar hides or shows. |
| `disabled` | `boolean`, observed | `false` | Stops hiding. Setting it shows a hidden bar. |
| `show-at-end` | `boolean`, observed | `true` | Shows the bar when the scroll reaches the end. Off, a hidden bottom bar leaves its slot empty there. |

### States

| Name | Description |
| --- | --- |
| `:state(hidden)` | Set while the bar is fully out of view. |
| `:state(scrolled)` | Set while the scroll container is scrolled away from its start. |

### Slots

| Name | Description |
| --- | --- |
| default | The bar. Give it the background and borders, not `<neo-autohide>`, which stays in place while the bar slides. Keyboard focus or an element with `open` inside keeps it on screen. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-autohide-toggle` | `{ hidden: boolean }` | yes | Fires when `:state(hidden)` changes. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-autohide-duration` | `calc(200ms * var(--neo-duration-scale, 1))` | Duration of the slide. |
| `--neo-autohide-z-index` | `40` | Stacking order over the content. |

## Examples

### Bottom tab bar

[`side="bottom"`](#attributes-side) sticks the bar to the bottom edge. Place it after the content. Scroll to see it.

```example autohide_bottom
min-height: max-content
```

### Below a banner

A bar below other content sticks at the top edge and stays until the next scroll down. Scroll past the banner, pause, then scroll on.

```example autohide_banner
min-height: max-content
```

### Style by state

[`:state(scrolled)`](#states-scrolled) adds a shadow. [`:state(hidden)`](#states-hidden) removes it, because a hidden bar's shadow still shows at the edge. Scroll to see it.

```example autohide_scrolled
min-height: max-content
```

### Popover in the bar

An open popover keeps the bar on screen. `follow-scroll="always"` keeps the popover open while the content scrolls. Open it and scroll to see it.

```example autohide_popover
min-height: max-content
```

## Examples: Datastar

### Pin the bar

A switch binds [`disabled`](#attributes-disabled) to a signal, which keeps the bar on screen while pinned. Flip the switch and scroll to see it.

```example autohide_pin
min-height: max-content
```
