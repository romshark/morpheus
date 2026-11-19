# Avatars

Component `<neo-avatars>` is an overlapping row of avatar images. Authored avatars stay in light DOM so server patches can append, replace, or remove them. The host folds extras into a `+N` circle when [`collapse-at`](#attributes-collapse-at) is exceeded, and reduces the visible count further whenever the row no longer fits its container.

```playground
- avatars_default: Default
- avatars_basic: Fixed collapse
- avatars_responsive: Responsive collapse
- avatars_overflow: Virtual overflow
- avatars_clickable: Clickable overflow
- avatars_photos: Photographic images
- avatars_links: Links
```

## Reference

### \<neo-avatar> {.api-element}

Style-only frame for one avatar image or fallback. Use it standalone or as a direct child of `<neo-avatars>`.

### Slots {#avatar-slots}

| Name | Description |
| --- | --- |
| default | Avatar content. Usually an `<img>`, but fallback initials or an icon work too. |

### CSS variables {#avatar-css-variables}

| Name | Default | Description |
| --- | --- | --- |
| `--neo-avatar-size` | `2.25rem` | Avatar width and height. |
| `--neo-avatar-radius` | `9999px` | Corner radius. |
| `--neo-avatar-clip-path` | `none` | Clip path applied to the frame. |
| `--neo-avatar-filter` | `none` | Filter applied to the frame. |
| `--neo-avatar-bg` | `color-mix(in srgb, var(--page-fg) 8%, transparent)` | Fallback background fill. |
| `--neo-avatar-color` | `var(--page-fg)` | Fallback text color. |
| `--neo-avatar-border-width` | `0` | Border width. |
| `--neo-avatar-border-color` | `var(--page-bg, #ffffff)` | Border color. |
| `--neo-avatar-font-size` | `0.8125rem` | Fallback initials font size. |
| `--neo-avatar-font-weight` | `650` | Fallback initials font weight. |

### \<neo-avatars> {.api-element}

Responsive overlapping avatar group with generated overflow.

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `collapse-at` | `number`, observed | `0` | Maximum authored avatars to keep visible before generating the overflow circle. Omit or set to `0` for no author cap; responsive fitting still collapses as needed. |
| `overflow-count` | `number`, observed | `0` | Additional server-known people not present as avatar children. Added to hidden child count in the generated `+N` circle. |
| `aria-label` | `string` | `"Avatars"` | Accessible label for the avatar group. |

### Slots

| Name | Description |
| --- | --- |
| default | Avatar elements. Prefer direct `<neo-avatar>` children, or direct anchors/buttons containing a `<neo-avatar>`. |
| `template[data-neo-avatars-overflow]` | Optional overflow template. The first element is cloned as the generated overflow circle when hidden avatars exist; descendants marked `data-neo-avatars-overflow-count` receive the current hidden count. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-avatars-change` | `{ shown: string[], hidden: string[] }` | yes | Fires when the shown/hidden split changes. `shown` and `hidden` are the ids of the visible vs. overflow-hidden `<neo-avatar>` children; avatars without an id are omitted. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-avatars-overlap` | `0.75rem` | Horizontal overlap between adjacent avatars. |
| `--neo-avatars-radius` | `var(--neo-avatar-radius)` | Corner radius of group children. |
| `--neo-avatars-clip-path` | `var(--neo-avatar-clip-path)` | Clip path applied to non-avatar children. |
| `--neo-avatars-filter` | `var(--neo-avatar-filter)` | Filter applied to non-avatar children. |
| `--neo-avatars-bg` | `var(--neo-avatar-bg)` | Background fill of group children. |
| `--neo-avatars-border-width` | `2px` | Border width separating overlapping avatars. |
| `--neo-avatars-border-color` | `var(--page-bg, #ffffff)` | Border color separating overlapping avatars. |
| `--neo-avatars-overflow-bg` | `color-mix(in srgb, var(--page-fg) 8%, var(--page-bg))` | Background fill of the generated `+N` circle. |
| `--neo-avatars-overflow-color` | `var(--page-fg)` | Text color of the generated `+N` circle. |
| `--neo-avatars-overflow-font-size` | `0.8125rem` | Font size of the generated `+N` circle. |
| `--neo-avatars-overflow-font-weight` | `650` | Font weight of the generated `+N` circle. |
| `--neo-avatars-focus-ring` | `var(--accent, currentColor)` | Focus ring color for clickable avatars. |
| `--neo-avatars-popover-z-index` | `1300` | Stacking order of the `+N` overflow popover. |

## Examples

### Fixed collapse

[`collapse-at`](#attributes-collapse-at) caps the visible authored avatars before responsive fitting applies. Here the row keeps 5 images visible at wide widths and folds the rest into `+N`.

```example avatars_basic
width: 22rem
height: 5rem
min-height: 4rem
max-height: 16rem
min-width: 8rem
class: avatar-demo-stage
```

### Responsive collapse

Omit [`collapse-at`](#attributes-collapse-at) to let the row show everything at wide widths. Drag the preview narrower and the host hides trailing avatars into the overflow circle until the row fits.

```example avatars_responsive
width: 19rem
height: 5rem
min-height: 4rem
max-height: 16rem
min-width: 8rem
class: avatar-demo-stage
```

### Virtual overflow {#server-known-overflow}

[`overflow-count`](#attributes-overflow-count) adds people that are not present as image children. The generated circle combines that number with any children hidden by [`collapse-at`](#attributes-collapse-at) or by responsive fitting.

```example avatars_overflow
width: 22rem
height: 5rem
min-height: 4rem
max-height: 16rem
min-width: 8rem
class: avatar-demo-stage
```

### Clickable overflow

Add a `<template data-neo-avatars-overflow>` child to replace the generated inert circle. The host clones the template only when overflow exists and writes the hidden count into any `data-neo-avatars-overflow-count` descendant.

```example avatars_clickable
width: 22rem
height: 18rem
min-height: 4rem
max-height: 16rem
min-width: 8rem
class: avatar-demo-stage
```

### Photographic images

Raster files (`.jpg`, `.png`, ...) drop in the same way as the styled SVG illustrations. The host's clip / radius / border tokens crop the photo to the theme's avatar shape, and `object-fit: cover` keeps the subject centred when the source aspect ratio differs from the square frame.

```example avatars_photos
width: 12rem
height: 5rem
min-height: 4rem
max-height: 16rem
min-width: 8rem
class: avatar-demo-stage
```

### Links

Direct children may be anchors or buttons with a `<neo-avatar>` inside. The focus ring belongs to the clickable avatar, while the generated overflow circle stays inert.

```example avatars_links
width: 22rem
height: 5rem
min-height: 4rem
max-height: 16rem
min-width: 8rem
class: avatar-demo-stage
```
