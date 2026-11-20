# Odometer

Component `<neo-odometer>` is a number that animates each change by rolling its digits. Put the formatted number inside it as text, such as `$1,234.56`. When the text changes, the digits roll to the new value.

```playground
- odometer_default: Default
- odometer_formats_1: Formatted values
- odometer_scripts_1: Other digit scripts
- odometer_custom_props: Custom properties
- odometer_parts_1: Styling parts
```

## Reference

### Slots

| Name | Description |
| --- | --- |
| default | The number as text, formatted by the server. |

### Parts

| Name | Description |
| --- | --- |
| `::part(digit)` | A digit cell, which clips its rolling glyphs. |
| `::part(symbol)` | A separator or other character between the first and last digit. |
| `::part(prefix)` | The text before the first digit, such as a sign or currency. |
| `::part(suffix)` | The text after the last digit, such as a unit. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-odometer-duration` | `600ms` | Duration of a roll or width change, multiplied by `--neo-duration-scale`. |
| `--neo-odometer-easing` | `var(--neo-easing, cubic-bezier(0.16, 1, 0.3, 1))` | Easing of a roll or width change. |

### Rolling

- Decimal digits of any script roll. A plus or minus sign slides in and out. Other characters change in place.
- Characters line up from the end, which keeps the last digit in place. Added and removed digits slide in and out.
- Digits roll up when the absolute value grows and down when it shrinks. Keep the number of fraction digits fixed, because the direction compares the digits as written.
- A new value mid-roll continues from where the digits are.
- Empty text keeps the current number.
- Screen readers read the text but don't announce changes. To announce them, wrap the element in an `aria-live` region.
- With reduced motion, the number changes without a roll.

## Examples

### Formatted values

The server formats the number, here in US dollars. The currency sign stays in place, and a comma slides in past $999.99.

```playground
id: odometer-formats-playground
autoplay: true
- odometer_formats_1: $9.99
- odometer_formats_2: $12.49
- odometer_formats_3: $1,024.00
- odometer_formats_4: $987.65
```

### Other digit scripts

Arabic-Indic digits roll like ASCII ones. In a right-to-left paragraph the digits still read left to right, and the unit follows the paragraph.

```playground
id: odometer-scripts-playground
autoplay: true
- odometer_scripts_1: 987 km
- odometer_scripts_2: 1,002 km
- odometer_scripts_3: 1,234 km
```

## Customization

### Custom properties

[`--neo-odometer-duration`](#css-variables-neo-odometer-duration) and [`--neo-odometer-easing`](#css-variables-neo-odometer-easing) set the roll, here from signals. The duration matches the count interval, which turns the digits without a pause.

```example odometer_custom_props
min-height: max-content
```

### Styling parts

`::part()` styles the cells of each odometer.

- The visitor count puts each digit on a tile and mutes the separator and unit. The digits roll inside their tiles.
- The temperature underlines each digit, raises the unit and colors the sign, which slides in below 0.

```playground
id: odometer-parts-playground
autoplay: true
- odometer_parts_1: 12,480 / −4.5 °C
- odometer_parts_2: 12,481 / −0.5 °C
- odometer_parts_3: 12,509 / 2.0 °C
- odometer_parts_4: 13,002 / 11.5 °C
```

## Examples: Datastar

### Server-rendered total

Each button posts to the server, which formats the new total and morphs it into the odometer. Add a pass to see the comma slide in.

```example odometer_cart
min-height: max-content
script: sim/odometer/cart.js
```
