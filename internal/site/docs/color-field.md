# Color field

Component `<neo-color-field>` is a 2D saturation/value picker painted over a base hue, with pointer and arrow-key handle movement. The host reflects [`value`](#attributes-value) (hex); set [`hue`](#attributes-hue) to fix the base hue, or omit it and the kit derives one from [`value`](#attributes-value). The simplest usage is a single [`value="#rrggbb"`](#attributes-value).

```playground
- color_field_default: Default
- color_field_derived_hue: Derived hue
- color_field_explicit_hue: Explicit hue
- color_field_disabled: Disabled
- color_field_custom_size: Custom size
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string`, reflected, observed | `#2563eb` | Selected color as `#rrggbb`. |
| `hue` | `number`, observed |  | Base hue in degrees. If omitted, the hue is derived from `value`. |
| `disabled` | `boolean`, observed | `false` | Disables pointer and keyboard interaction. |
| `aria-label` | `string` | `Color field` | Accessible label for the 2D field control. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-color-field-input` | `{ value: string, hue: number, x: number, y: number }` | yes | Fires continuously while the handle moves. |
| `neo-color-field-change` | `{ value: string, hue: number, x: number, y: number }` | yes | Fires when a drag or keyboard move commits. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-color-field-width` | `14rem` | Field width. |
| `--neo-color-field-height` | `9rem` | Field height. |
| `--neo-color-field-radius` | `var(--page-radius, 0.5rem)` | Corner radius. |
| `--neo-color-field-handle-size` | `1rem` | Handle diameter. |
| `--neo-color-field-border-width` | `1px` | Border width. |
| `--neo-color-field-border-color` | `color-mix(in srgb, var(--page-fg) 16%, transparent)` | Border color. |
| `--neo-color-field-focus-ring` | `var(--accent, currentColor)` | Focus-visible outline color. |
| `--neo-color-field-shadow` | `none` | Box shadow of the field. |

## Examples

### Derived hue

The simplest form. Pass a [`value`](#attributes-value) hex and the host derives the base hue from it on connect. A freshly mounted picker shows the handle on the matching point of the saturation/value plane.

```example color_field_derived_hue
min-height: max-content
```

### Explicit hue

Set [`hue`](#attributes-hue) in degrees to override the derived value. Useful when the selected colour is desaturated (so the derived hue would be ambiguous) or when you want the field's gradient to stay anchored to a brand hue while the handle picks a tint.

```example color_field_explicit_hue
min-height: max-content
```

### Disabled

Pointer events are blocked, the handle is non-interactive, and the host fades to a muted state. The currently-selected colour still reads correctly.

```example color_field_disabled
min-height: max-content
```

### Custom size

The field reads its dimensions from the [`--neo-color-field-width`](#css-variables-neo-color-field-width) and [`--neo-color-field-height`](#css-variables-neo-color-field-height) custom properties. Any inline `style` or scoped CSS rule resizes the picker without changing markup.

```example color_field_custom_size
min-height: max-content
```

## Examples: Datastar

### Morphing during interaction

A Datastar fat-morph can change [`value`](#attributes-value), [`hue`](#attributes-hue), or [`disabled`](#attributes-disabled) mid-interaction.

- The host stays mounted and reconciles its handle position and disabled state in place, with no re-mount and no lost focus. Autoplay cycles the states below to simulate the morphs.
- The `cf_morph_value` signal mirrors the live color (seeded by each morph, updated on [`neo-color-field-input`](#events-neo-color-field-input)) and updates the hex readout below the field.

```playground
id: color-field-morph-playground
autoplay: true
- color_field_morph_initial: Initial
- color_field_morph_color: Different color
- color_field_morph_disabled: Disabled
```
