# Lightbox

Component `<neo-lightbox>` is an overlay that expands arbitrary content from one or more triggers. Mark each opener with `[data-neo-lightbox-trigger]` and the body with `[data-neo-lightbox-content]`; the host owns the open / close animation, focus, the backdrop, and <neo-kbd>Esc</neo-kbd> dismissal. By default it uses the top layer to cover the viewport; `contained` confines the overlay to the host's own box.

```playground
- lightbox_default: Default
- lightbox_content: Arbitrary content
- lightbox_container: Scoped to container
- lightbox_hover: Hover to open
- lightbox_gallery: Image gallery
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean`, reflected, observed | `false` | Open state. |
| `contained` | `boolean`, observed | `false` | Where the overlay renders. Default promotes it to the top layer covering the viewport; `contained` confines it to the host's own box, which becomes the positioned containing block. |
| `hover` | `boolean` | `false` | Open on trigger hover (mouse only). Click still opens, instantly, for touch and keyboard. |
| `hover-open-delay` | `integer (ms)` | `100` | Delay before a hover opens the overlay. |
| `hover-close-delay` | `integer (ms)` | `200` | Delay before a hover closes it after the pointer leaves both trigger and surface. |
| `dismissible` | `boolean`, observed | `true` | Set `false` to disable backdrop-press and <neo-kbd>Esc</neo-kbd> dismissal. |
| `transition` | `"zoom" \| "fade" \| "none"` | `"zoom"` | Entry / exit style. `zoom` morphs the surface from the opening trigger's position and size (a FLIP) and back into it on close; `fade` is a centered scale + opacity; `none` is instant. The backdrop fades in every mode. Honors reduced motion. Read when the overlay opens. A change while it is open applies on the next open. |

### Slots

| Name | Description |
| --- | --- |
| `[data-neo-lightbox-trigger]` | Opens the overlay. Repeat on any number of children; all open the same surface. |
| `[data-neo-lightbox-content]` | Arbitrary HTML projected into the overlay surface. |
| `[data-neo-lightbox-close]` | Any descendant of the content; clicking it dismisses the overlay. |
| `[data-neo-lightbox-title]` | Names the dialog; the surface's `aria-labelledby` points at it. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-lightbox-open` | `{ trigger }` | yes | Fires when the overlay opens. `trigger` is the activating element. |
| `neo-lightbox-close` |  | yes | Fires when the overlay closes. |

### Parts

| Name | Description |
| --- | --- |
| `::part(backdrop)` | The dimmed layer behind the surface. |
| `::part(surface)` | The centered dialog panel. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-lightbox-overlay-bg` | `rgba(0, 0, 0, 0.72)` | Backdrop color. |
| `--neo-lightbox-overlay-blur` | `0px` | Backdrop blur radius. |
| `--neo-lightbox-surface-bg` | `transparent` | Surface background. |
| `--neo-lightbox-color` | `var(--page-fg, #111827)` | Surface text color. |
| `--neo-lightbox-radius` | `0` | Surface corner radius. |
| `--neo-lightbox-surface-padding` | `0` | Surface padding. |
| `--neo-lightbox-shadow` | `none` | Surface shadow. |
| `--neo-lightbox-max-width` | `90vw` | Surface width cap. |
| `--neo-lightbox-max-height` | `90vh` | Surface height cap. |
| `--neo-lightbox-screen-offset` | `1rem` | Gap kept around the overlay. |
| `--neo-lightbox-enter-duration` | `calc(200ms * var(--neo-duration-scale, 1))` | Open / close animation duration. |
| `--neo-lightbox-enter-scale` | `0.94` | Start scale for the `fade` transition. |
| `--neo-lightbox-z-index` | `50` | Overlay stacking when `contained`. |

## Examples

### Image

A thumbnail opens its full-size image on the top layer over a dimmed backdrop. By default the image zooms out of the thumbnail and shrinks back into it on close (the `transition="zoom"` FLIP). Press the backdrop, the close button, or <neo-kbd>Esc</neo-kbd> to dismiss.

```example lightbox_default
min-height: max-content
```

### Arbitrary content

The content slot takes any HTML, not just images. This one is a panel with a heading, a description list, and its own close button. A `[data-neo-lightbox-title]` gives the dialog its accessible name.

```example lightbox_content
min-height: max-content
```

### Scoped to a container {#scoped-to-container}

`contained` confines the overlay to the host's box instead of the viewport. Here the panel covers just this card. The host becomes the positioned containing block.

```example lightbox_container
min-height: max-content
```

### Hover to open

With `hover` the overlay opens on pointer enter and closes after the pointer leaves both trigger and surface. Click still opens it, instantly, for touch and keyboard. Hover the button to see it.

```example lightbox_hover
min-height: 18rem
```

## Examples: Datastar

### Image gallery

Every thumbnail opens the same overlay, which holds a `<neo-carousel>` of the full images. A `$gallery_active` signal tracks the last thumbnail clicked. Each trigger sets it (`data-on:click`), and the carousel binds to it (`data-attr:value`) and writes back on navigation. The photo you click opens first and the signal stays in sync as you swipe.

```example lightbox_gallery
min-height: max-content
```
