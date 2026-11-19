# Text input

Component `<neo-textinput>` is a wrapper around a native `<input>` with live formatting such as [`mask`](#attributes-mask), [`format="number"`](#attributes-format), and composable transforms like [`numeric-only`](#attributes-numeric-only) and [`case="upper"`](#attributes-case). Reach for it when the displayed value should differ from the typed one; a bare `<input>` is the right answer otherwise. The native field lives in the element's shadow root. The light DOM stays empty and a server can re-render the host without disturbing the live field. Slot `<neo-option>` children to add server-driven autocomplete suggestions with built-in keyboard navigation.

```playground
- text_input_default: Default
- text_input_card_mask: Card-style mask
- text_input_mixed_mask: Mixed mask
- text_input_phone: Phone
- text_input_date: Date
- text_input_number: Number
- text_input_number_eu: Number (EU)
- text_input_stepper: Stepper
- text_input_scrub: Scrub
- text_input_stepper_custom: Stepper customization
- text_input_scrub_custom: Scrub customization
- text_input_disabled: Disabled
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` |  | Form field name. |
| `type` | `string`, observed | `"text"` | Standard `<input>` type. |
| `value` | `string`, observed |  | Current value. For `format="number"`, reads and writes the canonical numeric string (sign + digits + `.`); thousands separators and the localized decimal mark are presentation only. |
| `placeholder` | `string`, observed |  | Hint text shown when empty. |
| `disabled` | `boolean`, observed | `false` | Non-interactive state. |
| `readonly` | `boolean`, observed | `false` | Value cannot be edited but stays focusable and submittable. |
| `required` | `boolean`, observed | `false` | Form validation requires a non-empty value. |
| `size` | `"sm" \| "lg"` |  | Control-size step: `sm` compact, `lg` large. Omit for the default size. |
| `mask` | `string`, observed |  | Static template. Slots are `#` digit, `U` letter to upper, `l` letter to lower, `A` alnum to upper, `a` alnum to lower, `X` alnum (case preserved), and `*` any char. Other chars are literal, and `\` makes the next one literal, as in `\#`. Cased slots accept either case and coerce on insert. |
| `format` | `"number"`, observed |  | Right-anchored thousands grouping for numeric input. Makes the field a number field, like `type="number"`. |
| `min` | `number`, observed |  | Lowest value a step reaches in a number field. In a masked field it is written in mask form, as in `00:00`, and bounds each digit group. |
| `max` | `number`, observed |  | Highest value a step reaches in a number field. In a masked field it is written in mask form, as in `23:59`, and bounds each digit group. |
| `step` | `number \| "any"`, observed | `1` | Step size in a number field. ArrowUp and ArrowDown take 1 step, PageUp and PageDown take 10, unless suggestions are slotted. A value off the step grid (based at `min`, else 0) snaps to it first. `any` steps by 1 without a grid. In a masked field it applies to the last digit group. |
| `stepper` | `boolean`, observed | `false` | Show increment and decrement buttons in a number field. A `type="number"` field never shows the browser's spin buttons. In a masked field, `stepper` or `scrub` makes the field step the digit group at the caret, like a native time field. Empty groups fill with their minimum. |
| `increment-icon` | `string`, observed |  | Name of the increment button's icon, an up chevron by default. Resolved through [`<neo-icon>`](icon.md) and follows the active icon theme. |
| `decrement-icon` | `string`, observed | `"chevron-down"` | Name of the decrement button's icon. Resolved through [`<neo-icon>`](icon.md) and follows the active icon theme. |
| `increment-label` | `string`, observed | `"Increase"` | Accessible name of the increment button. |
| `decrement-label` | `string`, observed | `"Decrease"` | Accessible name of the decrement button. |
| `scrub` | `"horizontal" \| "vertical"`, observed |  | Show a drag handle in a number field, at the start by default. Dragging it steps the value along the axis, toward the end of the line or upward to increase. A bare `scrub` is horizontal. An unsupported value is ignored with a console warning. |
| `scrub-side` | `"start" \| "end"`, observed | `"start"` | Side of the field the scrub handle sits on. At `end` it sits before the stepper. Follows the text direction. An unsupported value falls back to `start` with a console warning. |
| `scrub-sensitivity` | `number`, observed | `0.5` | Steps per pixel of scrub drag. `1` is twice the default speed, `0.25` half. Shift takes 10 times as many. A value that isn't a positive number falls back to the default with a console warning. |
| `scrub-icon` | `string`, observed |  | Name of the scrub handle's icon, chevrons along the axis by default. Resolved through [`<neo-icon>`](icon.md). |
| `prefix` | `string`, reflected, observed |  | Leading literal preserved across clears. |
| `decimal-places` | `number`, observed | `-1` | Decimal-place cap for `format="number"`; -1 unbounded. |
| `decimal-mark` | `"." \| ","`, observed | `"."` | Decimal separator character. |
| `thousands-separator` | `string`, observed | `","` | Grouping separator inserted every 3 digits. |
| `numeric-only` | `boolean`, observed | `false` | Drop non-digit input. |
| `case` | `"upper" \| "lower"`, observed | `""` | Force the displayed value to the given case. Free-form only; ignored when `mask` is set; use cased mask letters (`U`, `A`, `l`, `a`) instead. An unsupported value is ignored with a console warning. |
| `submit-raw` | `boolean`, observed | `false` | Form submission uses the unformatted value. Always on for `format="number"`; thousands separators never appear in the submitted value. |
| `open` | `boolean`, reflected, observed | `false` | Suggestions popover state using the shared command contract. `open="true"` opens, `open="false"` closes, and an omitted attribute leaves client state unchanged. Client-open state is reflected as bare `open`. A fat morph that omits the attribute does not close the popover. |
| `placement` | `string`, observed | `"bottom-start"` | Suggestion popover placement relative to the field. The popover honors the same positioning surface as `<neo-select>` (`placement`, `screen-offset`, `follow-scroll`, `clamp-placement`, `min-fit-height`/`min-fit-width`, `min-open-height`/`min-open-width`, `popover-fit-content`) plus the `--neo-popover-*` custom properties. Applies only when the `suggestions` slot is in use. |
| `popover-fit-content` | `boolean` | `false` | The suggestions panel tracks the field width by default; set this to size the panel to the suggestion rows instead. Capped by `--neo-popover-max-width` and the viewport. Applies only when the `suggestions` slot is in use. |
| `list` | `string`, observed |  | References a shared [`<neo-datalist>`](datalist.md) by its `id` (like native `<input list>`) to source the autocomplete `suggestions`. Inline suggestion options take precedence. |

### States

| Name | Description |
| --- | --- |
| `:state(scrubbing)` | Set while a scrub drag is in flight. |

### Slots

| Name | Description |
| --- | --- |
| `suggestions` | Slotted `<neo-option>` children turn the field into an autocomplete with a listbox of suggestions. The field stays free text. The value is whatever's typed; options are hints. Bare `<neo-option>` children are assigned to this slot automatically. Same option API as `<neo-select>` (`value`, `label`, `disabled`, rich content). A `[data-neo-empty-results]` child is a non-selectable status row that keeps the popover open with 0 options (same contract as `<neo-combobox>`). The server may patch the slot at any time; patching it empty (no options and no status row) closes the popover. The field gains `role="combobox"` whenever suggestions exist or the popover is open; focus never leaves it (ArrowDown/Up move `aria-activedescendant`). Alternatively, set `list` to source these options from a shared datalist. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| [`input`](https://html.spec.whatwg.org/multipage/indices.html#event-input) |  | yes | Standard input event. |
| [`change`](https://html.spec.whatwg.org/multipage/indices.html#event-change) |  | yes | Standard change event. |
| `neo-textinput-input` | `{ value: string, rawValue: string }` | yes | Mirrors `input` with both formatted and raw values in detail. |
| `neo-textinput-change` | `{ value: string, rawValue: string }` | yes | Mirrors `change`. |
| `neo-textinput-select` | `{ value: string, label: string }` | yes | A suggestion was committed (click or Enter). `value` is the option's value, `label` its visible text. |

### Parts

| Name | Description |
| --- | --- |
| `::part(stepper)` | Column holding the stepper buttons. |
| `::part(increment)` | Increment button. |
| `::part(decrement)` | Decrement button. |
| `::part(scrub)` | Scrub drag handle. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-input-min-width` | `12rem` | Default field width. A `width` on the element overrides it. |
| `--neo-textinput-stepper-width` | `1.5em + inset` | Width of the stepper column. |
| `--neo-textinput-stepper-inset` | `30% of the end radius` | End padding of the stepper buttons, which keeps the icons clear of a rounded field end. |
| `--neo-textinput-scrub-width` | `1.75em` | Width of the scrub handle. |

## Examples

### Card-style mask

In [`mask`](#attributes-mask), `#` is a digit slot and the spaces between groups are literal delimiters.

- Spaces appear at the right positions as you type.
- Backspace at a delimiter deletes the preceding digit. The literal never has to be skipped manually.

```example text_input_card_mask
width: 26rem
min-height: max-content
```

### Mixed mask

A [`mask`](#attributes-mask) can mix letter, digit, and literal slots. Cased slots (`U`, `l`, `A`, `a`) accept either case and coerce on insert; use `X` to keep the typed case.

```example text_input_mixed_mask
width: 26rem
min-height: max-content
```

### Phone

Parentheses, space, and dash are all literals in the [`mask`](#attributes-mask).

```example text_input_phone
width: 26rem
min-height: max-content
```

### Date

A `##/##/####` mask shapes the digits but doesn't validate calendar logic (Feb 30 is accepted); pair it with the native `pattern` attribute when stricter checks are needed.

```example text_input_date
width: 26rem
min-height: max-content
```

### Number

[`format="number"`](#attributes-format) applies right-anchored thousands grouping with optional decimals. The [`prefix`](#attributes-prefix) attribute pins a literal at the start.

```example text_input_number
width: 26rem
min-height: max-content
```

### Number (EU)

European notation from the same number format, with [`decimal-mark=","`](#attributes-decimal-mark) and a period [`thousands-separator`](#attributes-thousands-separator).

```example text_input_number_eu
width: 26rem
min-height: max-content
```

### Stepper

A number field steps its value by [`step`](#attributes-step) within [`min`](#attributes-min) and [`max`](#attributes-max). [`stepper`](#attributes-stepper) adds increment and decrement buttons.

- ArrowUp and ArrowDown take 1 step, PageUp and PageDown take 10.
- Hold a button to repeat. It disables at [`min`](#attributes-min) or [`max`](#attributes-max).

```example text_input_stepper
width: 26rem
min-height: max-content
```

### Scrub

[`scrub`](#attributes-scrub) adds a drag handle at the start of a number field. Dragging it steps the value, 1 step per 2px by default; [`scrub-sensitivity`](#attributes-scrub-sensitivity) sets the steps per pixel.

- [`scrub="horizontal"`](#attributes-scrub) increases toward the end of the line, [`scrub="vertical"`](#attributes-scrub) increases upward.
- Shift takes 10 steps per 2px. The field fires [`input`](#events-input) per step and [`change`](#events-change) on release.

```example text_input_scrub
width: 26rem
min-height: max-content
```

### Stepper customization

`::part()` styles the stepper and the scrub handle. [`--neo-textinput-stepper-width`](#css-variables-neo-textinput-stepper-width) and [`--neo-textinput-scrub-width`](#css-variables-neo-textinput-scrub-width) set their widths.

- The quantity widens the stepper and fills both buttons with the accent color.
- The price pads the stepper and rounds each button into a tile. Its vertical scrub handle is a matching tile with a banknote from [`scrub-icon`](#attributes-scrub-icon) that darkens while [`:state(scrubbing)`](#states-scrubbing) is set.
- The font size lays the buttons out in a row with `flex-direction: row-reverse`, which puts decrement first, and swaps the chevrons via [`decrement-icon`](#attributes-decrement-icon) and [`increment-icon`](#attributes-increment-icon).
- The time steps the hours or the minutes, whichever group holds the caret, between [`min="00:00"`](#attributes-min) and [`max="23:59"`](#attributes-max). Its [`mask="##:##"`](#attributes-mask) makes it a text field, not a number field.

```example text_input_stepper_custom
width: 26rem
min-height: max-content
```

### Scrub customization

[`scrub-side="end"`](#attributes-scrub-side) moves the handle to the end of the field, before the stepper if there is one. [`scrub-icon`](#attributes-scrub-icon) swaps its icon, here for a percent sign. [`scrub-sensitivity="0.25"`](#attributes-scrub-sensitivity) halves the drag speed to 1% per 4px.

```example text_input_scrub_custom
width: 26rem
min-height: max-content
```

### Disabled

[`disabled`](#attributes-disabled) and [`readonly`](#attributes-readonly) pass through to the inner field. [`disabled`](#attributes-disabled) fades the host and blocks all interaction; [`readonly`](#attributes-readonly) leaves the value selectable but immutable.

```example text_input_disabled
width: 26rem
min-height: max-content
```

## Examples: Datastar

### Suggestion states

Slotted suggestions are server state. A Datastar morph can swap the set at any time and the field reconciles in place. Switch states to compare.

- **Initial** has no suggestions; **Suggestions**, **Disabled**, and **Rich** morph in plain rows, [`disabled`](#attributes-disabled) rows, then rich rows (icon plus a short description). The typed value is untouched.
- **No results** shows a non-selectable `[data-neo-empty-results]` status row, keeping the popover open with 0 options instead of closing.
- The [`open`](#attributes-open) attribute forces the popover open so each state shows without focusing the preview; normally suggestions appear on focus.

```playground
id: text-input-suggest-playground
height: 22rem
- text_input_suggest_initial: Initial
- text_input_suggest_filled: Suggestions
- text_input_suggest_disabled: Disabled
- text_input_suggest_rich: Rich
- text_input_suggest_empty: No results
```

### Autocomplete

Slot `<neo-option>` children to turn the field into an autocomplete. The user can submit free text as typed, with server-supplied suggestions and built-in keyboard navigation.

- Each debounced keystroke posts the query; the server morphs matching `<neo-option>` rows into the [`suggestions`](#slots-suggestions) slot, a `[data-neo-empty-results]` row when nothing matches, or nothing to close the popover.
- Focus stays in the field; ArrowDown / ArrowUp move the highlight, Enter or click fills it, Escape closes. Options keep the `<neo-option>` API (`value`, `label`, `disabled`, rich content).
- Constrain the value to a fixed set instead? [`<neo-combobox>`](combobox.md) is the constrained-selection version.

```example text_input_autocomplete
min-height: 22rem
script: sim/textinput/suggest.js
simulator: delay
```
