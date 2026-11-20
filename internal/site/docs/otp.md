# OTP

Component `<neo-otp>` is a code input with 1 box per character, for one-time codes, PINs and similar keys. [`mask`](#attributes-mask) sets the boxes and what each one accepts. A single native input underneath handles paste, autofill and screen readers.

```playground
- otp_default: Default
- otp_groups: Groups
- otp_rules: Character rules
- otp_placeholder: Placeholder
- otp_pin: PIN
- otp_rtl: Right-to-left
- otp_disabled: Disabled
- otp_sizes: Sizes
- otp_custom_props: Custom properties
- otp_parts: Styling parts
- otp_check: Client-side check
- otp_reveal: Show and hide
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `mask` | `string`, observed | `"######"` | 1 box per slot, in the [`<neo-textinput>` mask](text-input.md#reference) grammar. Other characters become separators, and a space becomes a gap. `\` makes a slot character a separator, as in `##\###`. |
| `value` | `string`, reflected, observed |  | Typed characters, without separators. Setting it fills or clears the field, even while focused. |
| `name` | `string` |  | Form field name. |
| `placeholder` | `string`, observed |  | 1 character per empty box, or 1 for all of them. |
| `conceal` | `boolean`, observed | `false` | Shows `--neo-otp-conceal-glyph` in place of each character and exposes the field as a password. |
| `autosubmit` | `boolean` | `false` | Submits the form once all boxes are filled. |
| `size` | `"sm" \| "lg"` |  | Control size. Omit for the default. |
| `disabled` | `boolean`, observed | `false` | Not interactive and left out of form data. |
| `readonly` | `boolean`, observed | `false` | Focusable and submitted, but not editable. |
| `required` | `boolean`, observed | `false` | Requires a value. A partly filled field is always invalid. |
| `dir` | `"ltr" \| "rtl"`, observed | `"ltr"` | Box order. The boxes run left to right also in a right-to-left page, as digits do in Arabic and Hebrew text. Set `rtl` for a code in a right-to-left script. |
| `autocomplete` | `string`, observed | `"one-time-code"` | Use `off` for PINs. |
| `inputmode` | `string`, observed |  | Defaults to `numeric` when every slot is `#`, otherwise `text`. |
| `autocapitalize` | `string`, observed |  | Defaults to `characters` when every letter slot is upper case, otherwise `off`. |
| `aria-label` | `string`, observed |  | Accessible name. `aria-labelledby` and a `<label>` work too. |
| `aria-describedby` | `string`, observed |  | Description, such as an error message. |
| `aria-invalid` | `"true" \| "false"`, observed |  | `true` draws the boxes in `--neo-otp-invalid-color`. |

### States

| Name | Description |
| --- | --- |
| `:state(complete)` | All boxes are filled. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| [`input`](https://html.spec.whatwg.org/multipage/indices.html#event-input) |  | yes | Standard input event, on every edit. |
| `neo-otp-input` | `{ value: string }` | yes | The value changed. |
| `neo-otp-change` | `{ value: string }` | yes | An edit filled the last box or changed a full value. |

### Parts

| Name | Description |
| --- | --- |
| `::part(slot)` | Each box. |
| `::part(group-start)` | The first box of a group between separators. |
| `::part(group-end)` | The last box of a group between separators. |
| `::part(filled)` | A box with a character. |
| `::part(active)` | The box at the caret while focused. |
| `::part(separator)` | A mask separator. |
| `::part(placeholder)` | A placeholder character. |
| `::part(conceal)` | The glyph in a filled box with `conceal`. |
| `::part(caret)` | The caret in an empty box. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-otp-slot-width` | `var(--neo-control-height)` | Box width. |
| `--neo-otp-gap` | `calc(var(--page-spacing) * 2)` | Space between boxes. |
| `--neo-otp-invalid-color` | `var(--danger-bg)` | Box border color when `aria-invalid="true"`. |
| `--neo-otp-conceal-glyph` | `"\2022"` | Glyph for each concealed character, as a `content` value such as `"\2217"`, a centered asterisk. The default is a bullet. |

### Editing

- Each box takes 1 character its mask slot allows. Other keys are ignored.
- The value has no gaps. Clicking an empty box moves the caret to the first empty one.
- Typing over a filled box replaces it.
- `Backspace` and `Delete` remove the character at the caret and shift the rest left. On an empty box, `Backspace` removes the previous one. With mixed rules, shifted characters that no longer fit are dropped.
- Paste and autofill skip characters no box accepts. A full code replaces the value.
- `Enter` submits the form.

## Examples

### Groups

Non-slot characters in [`mask`](#attributes-mask), such as `-`, split the boxes into groups and are drawn between them. `\` makes a slot character a separator, here `#`. A space splits without a glyph. None ends up in the value.

```example otp_groups
min-height: max-content
```

### Character rules

`A` takes a letter or digit and upper-cases it. Type *ab12* to see it.

```example otp_rules
min-height: max-content
```

### Placeholder

A single character fills every empty box. A longer [`placeholder`](#attributes-placeholder) sets 1 character per box.

```example otp_placeholder
min-height: max-content
```

### PIN

[`conceal`](#attributes-conceal) shows dots, or the glyph in [`--neo-otp-conceal-glyph`](#css-variables-neo-otp-conceal-glyph). [`autocomplete="off"`](#attributes-autocomplete) stops the browser from suggesting codes from text messages.

```example otp_pin
min-height: max-content
```

### Right-to-left

The boxes run left to right even in a right-to-left page, as digits do in Arabic text. Set [`dir="rtl"`](#attributes-dir) on the element for a code in a right-to-left script. The arrow keys follow the screen.

```example otp_rtl
min-height: max-content
```

### Disabled

Dimmed, not focusable and left out of form data.

```example otp_disabled
min-height: max-content
```

## Customization

### Sizes

Boxes are as tall as a button of the same [`size`](#attributes-size).

```example otp_sizes
min-height: max-content
```

### Custom properties

[`--neo-otp-slot-width`](#css-variables-neo-otp-slot-width) and [`--neo-otp-gap`](#css-variables-neo-otp-gap) set the box width and spacing, and `font-size` scales the height with the text. [`--neo-otp-conceal-glyph`](#css-variables-neo-otp-conceal-glyph) swaps the PIN dot.

```example otp_custom_props
min-height: max-content
```

### Styling parts

`::part()` restyles the boxes. Click a box to see the active one.

- The first field keeps only a bottom border. Filled boxes take the accent color, and the active box a thicker line.
- The second joins each group into 1 block. `group-start` and `group-end` mark its outer boxes, which keep the rounded corners.

```example otp_parts
min-height: max-content
```

## Examples: Datastar

### Client-side check

A signal set on [`neo-otp-input`](#events-neo-otp-input) shows whether the code is right, with no server request. A wrapping `<label>` names the field. Type *123456* or any other code.

```example otp_check
min-height: max-content
```

### Show and hide

A toggle bound to [`conceal`](#attributes-conceal) reveals the PIN.

```example otp_reveal
min-height: max-content
```
