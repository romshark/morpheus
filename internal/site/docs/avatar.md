# Avatar

Component `<neo-avatar>` is a style-only frame for one avatar image or fallback. Shares shape tokens with [`<neo-avatars>`](avatars.md) so a theme renders standalone avatars and avatar groups round, square, or hexagonal together.

```playground
- avatar_default: Default
- avatar_image: Image
- avatar_fallback: Fallback
```

## Reference

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

## Examples

### Image

Set `src` plus an `alt` to cover the common portrait case. The image is cropped to the frame with `object-fit: cover`.

```example avatar_image
width: 8rem
height: 8rem
min-height: 6rem
max-height: 20rem
class: avatar-demo-stage
```

### Fallback

Omit `src` and give the default slot initials, an icon, or another compact placeholder. Add an `aria-label` when the fallback text is abbreviated.

```example avatar_fallback
width: 16rem
height: 6rem
min-height: 6rem
max-height: 16rem
class: avatar-demo-stage
```
