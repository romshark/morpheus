# WCAG 2.2 contrast report

2026-11-17, commit `702fc16` plus the uncommitted contrast fixes. Themes in `internal/site/static/theme-*.css`, component styles in `web/lib`.

## Summary

All 5 themes now pass every measured color pair of WCAG 2.2 AA in light and dark mode. 0 of the 400 measured values fail, against 8 to 24 failing pairs per theme and mode before the fixes.

The fixes add 3 theme tokens, wire the components to them, and change 18 existing theme colors. The closest margins are:

- the default light danger button, 4.56:1 against 4.5
- the selected-tab ring against the tab list, 3.13:1 against 3 (matrix dark)
- muted text in a focused menu row, 4.64:1 against 4.5 (default light)

The ratios are computed, not measured in a browser. Neither axe nor a screen reader was run.

## Before the fixes

| Group | Def L | Def D | Sun L | Sun D | Oce L | Oce D | Mat L | Mat D | Ros L | Ros D |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1.4.3 Text contrast (4.5:1) | 5 | 2 | 4 | 0 | 11 | 1 | 0 | 12 | 2 | 2 |
| 1.4.11 Non-text contrast (3:1) | 8 | 6 | 11 | 7 | 9 | 6 | 7 | 9 | 9 | 6 |
| 1.4.11 Focus indicators (3:1) | 2 | 1 | 5 | 1 | 3 | 2 | 1 | 3 | 3 | 3 |
| Total | 15 | 9 | 20 | 8 | 23 | 9 | 8 | 24 | 14 | 11 |

There were 2 causes:

- **Component CSS:** control edges, state fills and the menu focus fill were fixed alpha mixes of theme tokens (`--btn-border`, `--page-fg` at 6% to 32%), at 1.06:1 to 2.73:1 in every theme.
- **Theme colors:**
  - The sunshine light accent `#fad000` was 1.43:1 on its page and also drew the focus outline.
  - The matrix dark `--muted: #0a3018` was 1.39:1.
  - The ocean light primary buttons were 3.68:1.
  - The default dark and ocean dark danger buttons were 2.77:1 and 3.76:1.

## Changes

### Theme tokens

The kit reads 3 new theme tokens. `_base.css`, which ships in every bundle, gives `--control-border` its default. The components read `--accent-strong` and `--focus-ring` with fallbacks, so an `--accent` redeclared on a subtree still reaches them. Every theme sets `--control-border` in both its light and dark block, because a token missing from a theme's dark block falls back to that theme's light block.

| Token | Default | Use |
|---|---|---|
| `--accent-strong` | unset, falls back to `--accent` | The accent drawn as an edge or thin fill on the page: checked edges, slider and progress fill, slider thumb edge, active carousel dot, checked button-group segment, info alert icon and border |
| `--focus-ring` | unset, falls back to `--accent-strong` | Every focus outline and ring |
| `--control-border` | `--page-fg` at 50% (light), 40% (dark) | Edge of the unchecked checkbox, radio and switch, slider and progress rail ring, empty rating star, text field, select and combobox border, inactive carousel dot, pressed toggle edge, selected tab ring and resizable handle |

`--btn-border` keeps drawing the decorative hairlines of cards, popovers and buttons, where 1.4.11 does not apply.

### Components

- **Switch:** the unchecked switch is an outlined track (`--btn-bg`) with a filled thumb (`--control-border`). The checked thumb takes `--accent-fg`. New tokens are `--neo-switch-border`, `--neo-switch-border-on` and `--neo-switch-thumb-on`.
- **Slider and progress:** the rail is empty (`--neo-slider-track-bg: transparent`) with a 1px `--control-border` ring (`--neo-slider-track-shadow`). A dark rail would leave the fill under 3:1 against it.
- **Focus rings:** checkbox, radio, switch, slider and revealable draw a solid ring or outline in `--focus-ring` instead of `--accent` at 45% or 50%. Focused menu items and the submenu back row get a 2px inset ring.
- **Pressed and selected state:** the pressed `<neo-toggle>` gets a `--control-border` edge, also inside `<neo-toggle-group>`. The selected `<neo-tab>` gets an inset ring. The checked `<neo-buttongroup>` segment gets an `--accent-strong` edge.
- **Text:** alert titles take the alert text color instead of an 82% accent mix. Alert descriptions, card descriptions and menu shortcuts take `--muted` instead of `--page-fg` alpha. The combobox retry button takes `--link`.
- **Rating:** the filled star is `light-dark(#b45309, #f59e0b)`. The empty star takes `--control-border`.
- **Carousel:** dot centers stay at least 24px apart, the spacing exception of 2.5.8.

### Theme colors

| Theme and mode | Token | Before | After | Pair, before and after |
|---|---|---|---|---|
| default light | `--muted` | `oklch(0.556 0 0)` | `oklch(0.52 0 0)` | on the tab list, 4.16 and 4.85 |
| default light | `--danger-hover-bg` | red at 0.9 alpha | `oklch(0.505 0.213 27.518)` | button text, 4.32 and 6.15 |
| default dark | `--danger-fg` | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` | button text, 2.77 and 6.84 |
| default, no-JS dark | `--danger-*`, `--control-border` | missing | dark values | |
| sunshine light | `--accent-strong` | `#fad000` (via `--accent`) | `#9a6700` | focus ring and edges, 1.43 and 4.66 |
| sunshine light | `--muted` | `#776f5a` | `#6b6450` | on the tab list, 4.24 and 5.01 |
| sunshine dark | `--muted` | `#9f9478` | `#a89d82` | in a focused menu row, 4.47 and 5.00 |
| ocean light | `--accent` | `#0891b2` | `#0e7490` | primary button text, 3.68 and 5.36 |
| ocean light | `--accent-hover` | `#0e7490` | `#155e75` | hover text, 5.36 and 7.27 |
| ocean light | `--muted` | `#64748b` | `#52627a` | on the tab list, 4.05 and 5.28 |
| ocean light | `--link-visited` | `#5b7c99` | `#4a6580` | 4.11 and 5.69 |
| ocean dark | `--danger-bg` | `#ef4444` | `#dc2626` | button text, 3.76 and 4.83 |
| ocean dark | `--danger-hover-bg` | `#dc2626` | `#b91c1c` | hover text, 4.83 and 6.47 |
| matrix dark | `--accent` | `#1f7a42` | `#2da55a` | primary button text, 3.75 and 6.35 |
| matrix dark | `--accent-hover` | `#2da55a` | `#45c072` | hover text, 6.35 and 8.65 |
| matrix dark | `--muted` | `#0a3018` | `#2b9e57` | on the page, 1.39 and 5.87 |
| matrix dark | `--link-visited` | `#1f7a42` | `#2b9e57` | 3.75 and 5.87 |
| matrix dark | `--danger-bg`, `-fg`, `-hover-bg` | `#b91c1c`, `#fee2e2`, `#7f1d1d` | `#ef4444`, `#1a0007`, `#f87171` | OTP invalid border, 2.92 and 5.02 |

The `--control-border` share of `--page-fg` is the lowest that clears 3:1 on the page, on `--btn-bg` and against the tab list, rounded up:

| | Def L | Def D | Sun L | Sun D | Oce L | Oce D | Mat L | Mat D | Ros L | Ros D |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `--page-fg` share | 50% | 40% | 52% | 42% | 64% | 42% | 45% | 66% | 54% | 45% |

## Scope and method

- **Variants:** default, sunshine, ocean, matrix and rose, each in light and dark mode. Matrix draws both modes on `#000a04`. Its "light" mode is the bright phosphor look and "dark" the dimmed one.
- **Token resolution:** follows the site's stylesheet order (`site.templ:23-41`, which loads `morpheus.css`, then `theme-default.css`, then the theme files) and the `.light` or `.dark` class on `<html>`.
  - default light: `:root`
  - default dark: `:root` + `:root.dark`
  - theme light: `:root` + `:root.theme-X`
  - theme dark: `:root` + `:root.dark` + `:root.theme-X` + `:root.theme-X.dark`

  `var()` references resolve against the same merged set, as the browser resolves them on `<html>`.
- **Pairs:** each pair is a foreground and the surface under it, as the component CSS composes them. Translucent colors are composited onto that surface before measuring. OKLCH converts to sRGB through the OKLab reference matrices. This conversion gives `oklch(0.556 0 0)` = `#737373` and `oklch(0.577 0.245 27.325)` = `#e7000b`.
- **Rating star:** `light-dark()` follows `color-scheme`, which is dark in both matrix modes.
- **Criteria:**
  - 1.4.3 Contrast (Minimum), 4.5:1. No measured text counts as large.
  - 1.4.11 Non-text Contrast, 3:1, for control edges, state indicators and focus indicators.
  - 2.5.8 Target Size (Minimum), for the carousel dots only.
- **Not covered:**
  - nothing was rendered in a browser, and neither axe nor a screen reader was run
  - hover states (outside 1.4.11) and disabled states (exempt)
  - the color field gradient and its thumb
  - images and text anti-aliasing
  - the target size of the 18.4px checkbox and radio, which pass 2.5.8 only through a wrapping label or enough spacing

## Results

Values are contrast ratios. The column prefixes are Def default, Sun sunshine, Oce ocean, Mat matrix and Ros rose. The suffix L is light mode and D is dark mode.

### 1.4.3 Text contrast (4.5:1)

| Pair | Used by | Def L | Def D | Sun L | Sun D | Oce L | Oce D | Mat L | Mat D | Ros L | Ros D |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Body text | page-fg on page-bg | 19.79 | 18.96 | 16.94 | 15.93 | 8.87 | 17.14 | 14.72 | 6.35 | 14.23 | 13.51 |
| Muted on page | help text, placeholder, breadcrumb, slider marks | 5.51 | 7.63 | 5.64 | 7.01 | 5.82 | 11.80 | 6.35 | 5.87 | 7.30 | 10.08 |
| Muted on popup or card | optgroup label, menu shortcut, card description | 5.51 | 6.91 | 5.89 | 6.18 | 6.20 | 9.33 | 5.77 | 5.52 | 8.02 | 8.27 |
| Muted on focused menu row | menu shortcut | 4.64 | 5.59 | 5.01 | 5.00 | 5.43 | 7.52 | 4.85 | 5.01 | 6.81 | 7.05 |
| Muted on tab list | inactive neo-tab | 4.85 | 6.82 | 5.01 | 6.18 | 5.28 | 10.55 | 5.83 | 5.56 | 6.47 | 9.06 |
| Muted on input-group addon | neo-input-group addon | 5.06 | 6.27 | 5.44 | 5.59 | 5.80 | 8.42 | 5.33 | 5.27 | 7.40 | 7.67 |
| Link | neo-link, prose, combobox retry | 5.17 | 7.79 | 4.66 | 12.64 | 5.57 | 10.89 | 15.65 | 15.65 | 5.72 | 7.08 |
| Link hover |  | 6.70 | 10.98 | 6.63 | 14.25 | 7.09 | 13.57 | 16.78 | 16.78 | 7.30 | 10.08 |
| Link visited |  | 5.70 | 10.72 | 5.98 | 9.83 | 5.69 | 12.77 | 6.35 | 5.87 | 7.18 | 10.83 |
| Default button | btn-fg on btn-bg | 19.79 | 17.16 | 17.68 | 14.04 | 9.46 | 13.56 | 13.36 | 5.97 | 15.64 | 11.08 |
| Default button hover | btn-fg on btn-hover-bg | 18.15 | 14.48 | 15.90 | 12.34 | 8.24 | 10.39 | 11.49 | 5.52 | 13.02 | 8.79 |
| Primary button | accent-fg on accent; selected option, current page | 17.16 | 14.22 | 11.86 | 11.86 | 5.36 | 7.41 | 13.36 | 6.35 | 4.70 | 5.81 |
| Primary button hover | accent-fg on accent-hover | 12.96 | 11.51 | 13.37 | 13.37 | 7.27 | 9.24 | 14.21 | 8.65 | 6.29 | 8.27 |
| Secondary button | page-fg on fg 10% | 15.93 | 15.23 | 13.83 | 12.61 | 7.52 | 13.87 | 12.41 | 5.75 | 11.62 | 11.08 |
| Danger button | danger-fg on danger-bg | 4.56 | 6.84 | 4.71 | 4.71 | 4.83 | 4.83 | 5.43 | 5.33 | 6.32 | 4.71 |
| Danger button hover | danger-fg on danger-hover-bg | 6.15 | 5.68 | 6.79 | 6.79 | 6.47 | 6.47 | 6.51 | 7.25 | 8.24 | 6.32 |
| Tooltip | neo-tooltip | 17.16 | 18.96 | 12.07 | 14.40 | 7.60 | 15.45 | 14.72 | 5.97 | 11.47 | 13.51 |
| Toggle pressed | btn-fg on fg 18% | 13.21 | 11.71 | 11.62 | 9.83 | 6.55 | 10.83 | 10.01 | 5.12 | 9.77 | 8.90 |
| Alert neutral, title | page-fg on the alert tint | 17.80 | 17.33 | 15.33 | 14.38 | 8.18 | 15.67 | 13.74 | 6.08 | 12.89 | 12.40 |
| Alert neutral, description | muted on the alert tint | 4.95 | 6.98 | 5.11 | 6.33 | 5.36 | 10.79 | 5.93 | 5.62 | 6.61 | 9.25 |
| Alert info, title | page-fg on the alert tint | 16.82 | 16.40 | 15.32 | 13.68 | 7.98 | 15.22 | 12.97 | 5.89 | 12.62 | 12.19 |
| Alert info, description | muted on the alert tint | 4.68 | 6.60 | 5.10 | 6.02 | 5.23 | 10.48 | 5.60 | 5.44 | 6.47 | 9.09 |
| Alert success, title | page-fg on the alert tint | 17.68 | 17.75 | 15.16 | 14.75 | 7.95 | 15.98 | 13.76 | 5.94 | 12.76 | 12.73 |
| Alert success, description | muted on the alert tint | 4.92 | 7.15 | 5.05 | 6.49 | 5.21 | 11.00 | 5.94 | 5.48 | 6.54 | 9.49 |
| Alert warning, title | page-fg on the alert tint | 17.91 | 17.10 | 15.38 | 14.08 | 8.05 | 15.55 | 13.38 | 5.78 | 12.97 | 11.99 |
| Alert warning, description | muted on the alert tint | 4.98 | 6.89 | 5.13 | 6.19 | 5.28 | 10.70 | 5.78 | 5.33 | 6.65 | 8.95 |
| Alert danger, title | page-fg on the alert tint | 16.87 | 17.37 | 14.88 | 14.95 | 7.73 | 16.47 | 14.01 | 6.00 | 12.35 | 12.56 |
| Alert danger, description | muted on the alert tint | 4.69 | 6.99 | 4.96 | 6.58 | 5.07 | 11.33 | 6.05 | 5.54 | 6.33 | 9.37 |

### 1.4.11 Non-text contrast (3:1)

| Pair | Used by | Def L | Def D | Sun L | Sun D | Oce L | Oce D | Mat L | Mat D | Ros L | Ros D |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Control edge on page | checkbox, radio, switch, rail ring, empty star, field border, inactive dot, pressed toggle, resizable handle | 3.71 | 3.66 | 3.55 | 3.65 | 3.53 | 3.68 | 3.56 | 3.30 | 3.72 | 3.51 |
| Control edge on popup or card | the same, inside a card, dialog or popover | 3.71 | 3.71 | 3.59 | 3.59 | 3.64 | 3.54 | 3.62 | 3.26 | 3.84 | 3.18 |
| Tab ring vs tab list | selected neo-tab | 3.27 | 3.27 | 3.15 | 3.21 | 3.20 | 3.29 | 3.26 | 3.13 | 3.30 | 3.16 |
| Switch-off thumb on track | control-border on btn-bg | 3.71 | 3.71 | 3.59 | 3.59 | 3.64 | 3.54 | 3.62 | 3.26 | 3.84 | 3.18 |
| Accent-strong on page | checked edge, slider and progress fill, slider thumb edge, active dot, checked segment | 17.91 | 15.72 | 4.66 | 12.64 | 5.03 | 10.89 | 14.72 | 6.35 | 4.28 | 7.08 |
| Accent-strong on popup or card | the same, inside a card | 17.91 | 14.22 | 4.87 | 11.14 | 5.36 | 8.61 | 13.36 | 5.97 | 4.70 | 5.81 |
| Checkbox mark, switch-on thumb | accent-fg on accent | 17.16 | 14.22 | 11.86 | 11.86 | 5.36 | 7.41 | 13.36 | 6.35 | 4.70 | 5.81 |
| Rating star, filled | light-dark(#b45309, #f59e0b) on page-bg | 5.02 | 9.22 | 4.81 | 8.78 | 4.71 | 9.16 | 9.36 | 9.36 | 4.57 | 8.88 |
| Sortable handle | muted on page-bg | 5.51 | 7.63 | 5.64 | 7.01 | 5.82 | 11.80 | 6.35 | 5.87 | 7.30 | 10.08 |
| OTP invalid border | danger-bg on btn-bg | 4.76 | 6.19 | 4.71 | 3.53 | 4.83 | 3.22 | 4.94 | 5.02 | 6.32 | 3.32 |

### 1.4.11 Focus indicators (3:1)

| Pair | Used by | Def L | Def D | Sun L | Sun D | Oce L | Oce D | Mat L | Mat D | Ros L | Ros D |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Focus ring on page | every outline and ring | 17.91 | 15.72 | 4.66 | 12.64 | 5.03 | 10.89 | 14.72 | 6.35 | 4.28 | 7.08 |
| Focus ring on popup | option, menu item, tree row (inset) | 17.91 | 14.22 | 4.87 | 11.14 | 5.36 | 8.61 | 13.36 | 5.97 | 4.70 | 5.81 |

## Next steps

Check the rendered pages with axe in all 10 variants, and check the color field thumb on the light end of its gradient.
