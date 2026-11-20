# Theming

Themes are plain CSS. Every component reads a small set of `:root` custom properties; switching theme or mode just toggles a class on `<html>`.

Open the settings sidebar and flip theme or mode. The whole preview updates at once.

```example theming_preview
min-height: max-content
tabs: none
```

Each chip's fill is `var(--<name>)`. The grid tracks theme swaps with no JS.

```example theming_swatches
min-height: max-content
tabs: none
```

### Default theme

The full default palette as it ships in `theme-default.css`, with every variable a custom theme can override:

```css ../static/theme-default.css
```

### How it works

Every visual choice depends on 2 class hooks on `<html>`:

- `theme-<name>`: the palette. No `theme-*` class means the kit's default.
- `light` / `dark`: the colour mode. No class lets `prefers-color-scheme` pick from the OS. A no-JS visit still respects dark mode.

Each palette is 1 file (e.g. `theme-ocean.css`) with a `:root.theme-ocean` rule for light and a `:root.theme-ocean.dark` rule for dark overrides. Structural defaults (`--page-radius`, `--page-spacing`, `--page-font-family`) live in `morpheus.css`; themes only redeclare what they change.

The kit doesn't style `<body>`. Components inherit its font and text color. Apply the page tokens in your own CSS to follow the theme:

```css ../examples/theming_body.css
```

### Switching at runtime

The kit has no theme component. Anything that writes the 2 classes works. This site's picker is a Datastar component holding 2 signals (`$_theme`, `$_mode`); a `data-effect` writes the classes to `document.documentElement` and persists them to `localStorage`.

### System mode

Mode also accepts `"system"`. The saved value stays `"system"` while `<html>` has whichever of `light` or `dark` matches the OS. A `matchMedia` listener re-resolves on OS flips; explicit `"light"` or `"dark"` are never overridden.

### Best practice

- Apply the classes from an inline `<script>` at the top of `<head>`, before stylesheets, for no FOUC once your framework hydrates.
- Keep the default palette on bare `:root` (no class) so a pre-JS render still looks right.
- Pair every `:root.theme-X` with a `:root.theme-X.dark` that only overrides what dark mode changes. The cascade carries the rest.
- Touch the structural vars (`--page-radius`, `--page-spacing`, `--page-font-family`) only when a theme wants a different feel.
- Set `color-scheme` so native controls and scrollbars match.

### Kit-wide variables {#kit-variables}

These apply across components. Set them on `:root` or on any ancestor.

| Name | Default | Description |
| --- | --- | --- |
| `--page-radius` | `0.625rem` | Base corner radius. Component radius tokens default to it. |
| `--page-spacing` | `0.25rem` | Base spacing unit. Component paddings and gaps are multiples of it. |
| `--neo-control-height` | `calc(1em + 2 * round(calc(var(--page-spacing, 0.25rem) * 2), 1px) + 2px)` | Height of single-line controls, which keeps a button, input and select lined up in a row. The `size` attribute changes it. |
| `--neo-duration-scale` | `1` | Multiplier on every kit animation and transition duration. `prefers-reduced-motion: reduce` sets it to `0`. |
| `--neo-easing` | `unset` | Easing of kit transitions. Unset, each rule uses its own curve, mostly `ease` or `ease-out`. |
| `--neo-duration-hover` | `calc(120ms * var(--neo-duration-scale, 1))` | Duration of hover color and border transitions. |
| `--neo-disabled-overlay` | `none` | Background image painted over disabled controls, such as a hatch pattern. |
| `--neo-disabled-overlay-mask` | `none` | Mask over the disabled overlay of tabs, such as a gradient that fades it out at the edges. |
| `--neo-placeholder-delay` | `200ms` | Delay before a component that hasn't upgraded yet shows its placeholder. A component that upgrades within it shows none. |
| `--neo-placeholder-fade` | `240ms` | Fade-in duration of that placeholder. |
