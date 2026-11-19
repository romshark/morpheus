# Icon

Component `<neo-icon>` is an inline SVG icon. The host pulls the configured icon set's SVG body in so `stroke="currentColor"` resolves against the parent's CSS `color`. Size from [`--neo-icon-size`](#css-variables-neo-icon-size) or `width` / `height` on the host. A `neo-theme-change` event re-fetches the glyph so a themed user sees the theme's own SVG, not the one the server inlined.

```playground
- icon_default: Default
- icon_gallery: Gallery
- icon_sizes: Sizes
- icon_current_color: Inherits text colour
- icon_in_button: In buttons
- icon_inline_prose: Inline in prose
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string`, observed |  | Icon filename stem in the configured icon set (e.g. `heart` resolves to `/static/icons/heart.svg`). |
| `base` | `string`, observed |  | Override the icon directory; defaults to the `--neo-icon-base` CSS custom property (which itself defaults to `/static/icons`). |

### States

| Name | Description |
| --- | --- |
| `:state(loading)` | Set while the SVG loads and the host has none to show. The host shows a pulsing skeleton after `--neo-placeholder-delay`, as it does before the upgrade when the server inlined no SVG. Restyle it with `neo-icon:state(loading)::before`. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-icon-base` | `"/static/icons"` | Icon directory, as a quoted string. The `base` attribute overrides it per icon. |
| `--neo-icon-size` | `1em` | Glyph width and height. |

## Examples

### Gallery

A sample of the bundled Lucide set. The full set lives under `/static/icons/` as one SVG per name; drop new files in and the host picks them up without a rebuild.

```example icon_gallery
min-height: max-content
```

### Sizes

The host reads [`--neo-icon-size`](#css-variables-neo-icon-size) as its width and height. Set the var inline (or on an ancestor) to scale the glyph without touching the SVG.

```example icon_sizes
min-height: max-content
```

### Inherits text colour

Because Lucide glyphs use `stroke="currentColor"`, the icon inherits the parent's CSS `color`. Wrap the host in any coloured ancestor to retint it without writing variant-specific CSS.

```example icon_current_color
min-height: max-content
```

### In buttons

Drop a `<neo-icon>` as the first child of `<neo-button>`. The button's flex layout supplies the gap, and the icon inherits the button's font colour so it retints with the variant.

```example icon_in_button
min-height: max-content
```

### Inline in prose

The host is `display: inline-flex` with a `1em` default size. It sits on the text baseline and tracks the surrounding font size without nudging the line box.

```example icon_inline_prose
min-height: max-content
```
