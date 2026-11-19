# Alert

Component `<neo-alert>` is a CSS-only message surface for status, warning, and error callouts. Compose an optional [`[data-neo-alert-icon]`](#slots-data-neo-alert-icon) with a [`[data-neo-alert-title]`](#slots-data-neo-alert-title), [`[data-neo-alert-description]`](#slots-data-neo-alert-description), and [`[data-neo-alert-actions]`](#slots-data-neo-alert-actions); add a `role` based on how assertively the message should be announced.

```playground
- alert_default: Default
- alert_with_actions: With actions
- alert_variants: Variants
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"info" \| "success" \| "warning" \| "danger"` |  | Visual tone. Omit for the neutral default. |

### Slots

| Name | Description |
| --- | --- |
| `[data-neo-alert-icon]` | Optional leading icon column. Decorative. Mark it `aria-hidden="true"` so assistive tech skips the glyph. |
| `[data-neo-alert-content]` | Content column for the title, description, and actions. |
| `[data-neo-alert-title]` | Alert title heading. Bolder weight, no default margin. |
| `[data-neo-alert-description]` | Supporting message text. Muted colour, no default margin. |
| `[data-neo-alert-actions]` | Optional action row below the description. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-alert-padding-y` | `calc(var(--page-spacing, 0.25rem) * 4)` | Vertical padding. |
| `--neo-alert-padding-x` | `calc(var(--page-spacing, 0.25rem) * 4)` | Horizontal padding. |
| `--neo-alert-gap` | `calc(var(--page-spacing, 0.25rem) * 3)` | Gap between the icon and content columns. |
| `--neo-alert-content-gap` | `calc(var(--page-spacing, 0.25rem) * 1.5)` | Gap between title, description, and actions. |
| `--neo-alert-action-gap` | `calc(var(--page-spacing, 0.25rem) * 2)` | Gap between controls in the actions row. |
| `--neo-alert-radius` | `var(--page-radius, 0.5rem)` | Corner radius. |
| `--neo-alert-border-width` | `1px` | Border width. |
| `--neo-alert-neutral-accent` | `var(--page-fg)` | Accent color for the neutral default tone. |
| `--neo-alert-info-accent` | `var(--accent)` | Accent color for the `info` tone. |
| `--neo-alert-success-accent` | `oklch(0.55 0.14 145)` | Accent color for the `success` tone. |
| `--neo-alert-warning-accent` | `oklch(0.68 0.16 70)` | Accent color for the `warning` tone. |
| `--neo-alert-danger-accent` | `var(--danger-bg)` | Accent color for the `danger` tone. |
| `--neo-alert-neutral-bg` | `color-mix(in srgb, var(--neo-alert-neutral-accent) 5%, transparent)` | Background for the neutral default tone. |
| `--neo-alert-info-bg` | `color-mix(in srgb, var(--neo-alert-info-accent) 8%, transparent)` | Background for the `info` tone. |
| `--neo-alert-success-bg` | `color-mix(in srgb, var(--neo-alert-success-accent) 9%, transparent)` | Background for the `success` tone. |
| `--neo-alert-warning-bg` | `color-mix(in srgb, var(--neo-alert-warning-accent) 10%, transparent)` | Background for the `warning` tone. |
| `--neo-alert-danger-bg` | `color-mix(in srgb, var(--neo-alert-danger-accent) 9%, transparent)` | Background for the `danger` tone. |
| `--neo-alert-neutral-border-color` | `color-mix(in srgb, var(--neo-alert-neutral-accent) 18%, transparent)` | Border color for the neutral default tone. |
| `--neo-alert-info-border-color` | `color-mix(in srgb, var(--neo-alert-info-accent) 28%, transparent)` | Border color for the `info` tone. |
| `--neo-alert-success-border-color` | `color-mix(in srgb, var(--neo-alert-success-accent) 28%, transparent)` | Border color for the `success` tone. |
| `--neo-alert-warning-border-color` | `color-mix(in srgb, var(--neo-alert-warning-accent) 32%, transparent)` | Border color for the `warning` tone. |
| `--neo-alert-danger-border-color` | `color-mix(in srgb, var(--neo-alert-danger-accent) 30%, transparent)` | Border color for the `danger` tone. |
| `--neo-alert-accent` | `var(--neo-alert-neutral-accent)` | Active accent color, resolved from the current variant. |
| `--neo-alert-bg` | `var(--neo-alert-neutral-bg)` | Active background, resolved from the current variant. |
| `--neo-alert-color` | `var(--page-fg)` | Body text color. |
| `--neo-alert-border-color` | `var(--neo-alert-neutral-border-color)` | Active border color, resolved from the current variant. |
| `--neo-alert-description-color` | `color-mix(in srgb, var(--neo-alert-color) 70%, transparent)` | Description text color. |
| `--neo-alert-title-size` | `0.95rem` | Title font size. |
| `--neo-alert-title-line-height` | `1.35` | Title line height. |
| `--neo-alert-title-weight` | `600` | Title font weight. |
| `--neo-alert-icon-size` | `1.1rem` | Icon glyph size. |
| `--neo-alert-icon-margin-top` | `0.25rem` | Top margin aligning the icon with the title. |

## Examples

### Variants

The neutral default, `info`, `success`, `warning`, and `danger` cover common callout severities.

```example alert_variants
width: 42rem
min-height: max-content
min-width: 18rem
```

### With actions

Put controls in a [`[data-neo-alert-actions]`](#slots-data-neo-alert-actions) row when the alert should offer an immediate next step.

```example alert_with_actions
width: 34rem
min-height: max-content
min-width: 18rem
```
