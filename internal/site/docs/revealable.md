# Revealable

Component `<neo-revealable>` is a spoiler that obscures children behind an animated grain veil until the user activates it (click, <neo-kbd>Enter</neo-kbd>, or <neo-kbd>Space</neo-kbd>). Re-conceals after [`rehide-after`](#attributes-rehide-after) ms and whenever the content is patched, important for server-driven UIs so a morph that swaps the secret never flashes it. While concealed the content is `inert` and `aria-hidden`. The secret never leaks to assistive tech and focus can't enter it. Honours `prefers-reduced-motion`.

```playground
- revealable_default: Default
- revealable_sticky: Text spoiler
- revealable_image: Image spoiler
- revealable_blur_image: Blurred image spoiler
- revealable_section: Section spoiler
- revealable_styled: Custom styling
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean`, reflected, observed | `false` | Set/remove (or use the `open` JS property / `reveal()` / `conceal()` / `toggle()`) to control it. |
| `rehide-after` | `number`, observed | `0` | Milliseconds before auto re-conceal after a reveal. `0` or absent keeps it revealed until re-activated. |
| `variant` | `"inline" \| "media"`, observed |  | Obscure treatment. Inferred from the host's height when absent (media when tall, inline when short). The applied value is [`:state(inline)`](#states-inline) or [`:state(media)`](#states-media). |
| `density` | `number`, observed | `1` | Particle-count multiplier, clamped to 0.3-3. |
| `blur-content` | `boolean`, observed | `false` | Media variant only: tease the shape with a heavy blur instead of hiding it outright. No effect on text (already hidden, and blurring it would waste a composite). |

### States

| Name | Description |
| --- | --- |
| `:state(inline)` | Set while the inline treatment applies, from `variant` or inferred. |
| `:state(media)` | Set while the media treatment applies, from `variant` or inferred. |

### Slots

| Name | Description |
| --- | --- |
| default | The content to obscure, such as text, an image, or a whole subtree. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-revealable-toggle` | `{ open: boolean }` | yes | Fires when the content is revealed or concealed; `detail.open` is the new state. Conceal also fires from the `rehide-after` timer and the content-patch auto-hide. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-revealable-radius` | `var(--page-radius, 0.375rem)` | Corner radius of the host and cover. |
| `--neo-revealable-blur` | `14px` | Blur radius applied to media content while concealed. |
| `--neo-revealable-veil` | `color-mix(in srgb, var(--page-fg) 26%, var(--page-bg))` | Frosted cover color. |
| `--neo-revealable-focus-ring` | `color-mix(in srgb, var(--accent) 45%, transparent)` | Focus outline color. |
| `--neo-revealable-particle-color` | `currentColor` | Grain color painted onto the cover canvas. |

## Examples

### Text spoiler

The default (inline) variant draws fine grain in the element's own text colour, sized to the run. Once revealed it stays revealed; set [`rehide-after`](#attributes-rehide-after) to auto-conceal.

```example revealable_sticky
min-height: max-content
```

### Image spoiler

[`variant="media"`](#attributes-variant) lays a veil plus sparser particles over a block. Here [`rehide-after="4000"`](#attributes-rehide-after) re-covers it 4s after reveal and after all interactions and focus are gone.

```example revealable_image
min-height: max-content
```

### Blurred image spoiler {#blurred-image}

[`blur-content`](#attributes-blur-content) keeps the image visible but heavily blurred. The composition teases without giving the subject away, a softer mode than the fully-veiled image above.

```example revealable_blur_image
min-height: max-content
```

### Section spoiler

Any subtree works. [`blur-content`](#attributes-blur-content) also blurs the hidden block. The shape teases without giving the text away.

```example revealable_section
min-height: max-content
```

### Custom styling

Cover and grain are CSS custom properties, not attributes. Override [`--neo-revealable-veil`](#css-variables-neo-revealable-veil) (panel background) and [`--neo-revealable-particle-color`](#css-variables-neo-revealable-particle-color) (grain) per instance via inline style, or theme-wide.

```example revealable_styled
min-height: max-content
```
