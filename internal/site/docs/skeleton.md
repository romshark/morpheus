# Skeleton

### Variants

Component `<neo-skeleton>` is a gently-pulsing loading placeholder with optional [`variant`](#attributes-variant) presets (circle, text-height line). It has no intrinsic size. Set width and height in inline style or CSS so the placeholder matches the content that will replace it. By default it fades in after a short delay. Content that resolves quickly never flashes a skeleton; set [`immediate`](#attributes-immediate) to show it at once. The pulse honours `prefers-reduced-motion`.

```example skeleton_variants
min-height: max-content
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"" \| "circle" \| "line"` |  | Visual variant. Empty for a block placeholder, `circle` for a 1:1 round shape, `line` for an inline text-height bar. Pulse animation respects `prefers-reduced-motion`. |
| `immediate` | `boolean` |  | Show the placeholder at once. By default the skeleton fades in after a short delay so content that resolves quickly never flashes a skeleton. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-skeleton-bg` | `color-mix(in srgb, var(--page-fg) 10%, transparent)` | Base placeholder color. |
| `--neo-skeleton-bg-pulse` | `color-mix(in srgb, var(--page-fg) 20%, transparent)` | Peak color at the midpoint of the pulse. |
| `--neo-skeleton-radius` | `var(--page-radius, 0.25rem)` | Corner radius. |
| `--neo-skeleton-duration` | `1.4s` | Pulse animation duration. |
| `--neo-skeleton-default-height` | `1rem` | Height of a block placeholder when none is set. |
| `--neo-skeleton-fade-delay` | `0.3s` | Anti-flash delay before the skeleton fades in. |
| `--neo-skeleton-fade-duration` | `0.4s` | Fade-in duration after the delay. |

## Examples

### Card placeholder

Compose a few skeletons inside a card frame to mimic the shape of a header, hero image, and a stack of body lines. Width percentages on the line skeletons give the row a natural, ragged-right look while the page is still loading.

```example skeleton_card
min-height: max-content
```

### Avatar row

The [`variant="circle"`](#attributes-variant) preset gives a 1:1 round placeholder for an avatar, paired with 2 stacked line skeletons for the name and a secondary detail. Useful in lists of users or comments while the real data resolves.

```example skeleton_avatar_row
min-height: max-content
```

### Inline placeholder

The [`variant="line"`](#attributes-variant) preset makes a skeleton sit on the text baseline so it can stand in for a word or short phrase mid-sentence. Size it in `em` units to track the surrounding font size.

```example skeleton_inline
min-height: max-content
```

## Examples: Datastar

### Morphing during interaction

Render the placeholder card on first paint, then fat-morph real content into the same card once the server responds. Autoplay alternates the 2 states below.

- The `<div class="skel-card">` root stays mounted across the morph; only its inner nodes swap, reconciling **Loading** into **Content loaded** and back.
- Each skeleton shares its class and text element with the content that replaces it. Both states measure the same, and the card doesn't shift.
- A response that lands inside the fade-in delay swaps straight to content with no skeleton flash; add [`immediate`](#attributes-immediate) to opt out.

```playground
id: skeleton-morph-playground
autoplay: true
- skeleton_morph_loading: Loading
- skeleton_morph_loaded: Content loaded
```
