# Textarea

Component `<neo-textarea>` is a native `<textarea>` (kept in the element's shadow root) with declarative manual-resize handles and auto-grow on either axis. Native textarea attributes (`rows`, `placeholder`, `maxlength`, [`value`](#attributes-value), ...) go on the host and are forwarded to the field; the field stays fully native (form participation, IME, selection). Because it lives in the shadow, a fat morph can re-render the host without disturbing the live field.

```playground
- textarea_default: Default
- textarea_disabled: Disabled
- textarea_manual_resize: Manual resize
- textarea_auto_grow_height: Auto-grow height
- textarea_auto_grow_width: Auto-grow width
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string`, observed |  | Field value, not the light-DOM text content. Writes update the field live unless it has focus. `value=""` clears; an absent attribute leaves the current value untouched. |
| `disabled` | `boolean`, observed | `false` | Disable the field. The host shows the disabled state and forwards it to the native field. |
| `size` | `"sm" \| "lg"` |  | Control-size step: `sm` compact, `lg` large. Omit for the default size. |
| `scale-horizontal` | `boolean`, observed | `false` | Show a manual resize handle on the X axis. |
| `scale-vertical` | `boolean`, observed | `false` | Show a manual resize handle on the Y axis. |
| `auto-resize-width` | `boolean \| length`, observed | `false` | Auto-grow the field on the X axis. Bare attribute grows without limit; a CSS length value caps the width. |
| `auto-resize-height` | `boolean \| length`, observed | `false` | Auto-grow the field on the Y axis. Bare attribute grows without limit; a CSS length value caps the height. |
| `(native passthrough)` | `none` |  | `rows`, `cols`, `placeholder`, `maxlength`, `readonly`, `disabled`, `required`, `wrap`, `aria-*`, ... are forwarded to the field. `name` submits via the form-associated host. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| [`input`](https://html.spec.whatwg.org/multipage/indices.html#event-input) |  | yes | Standard input event, bubbling from the native field. The host adds no custom events; listen for the native ones. |
| [`change`](https://html.spec.whatwg.org/multipage/indices.html#event-change) |  | yes | Standard change event, bubbling from the native field. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-textarea-bg` | `var(--neo-button-bg)` | Field background. |
| `--neo-textarea-color` | `var(--neo-button-color)` | Field text color. |
| `--neo-textarea-border-color` | `var(--neo-button-border-color)` | Border color. |
| `--neo-textarea-border-width` | `1px` | Border width. Text inputs and native `<input>` fields use it too. |
| `--neo-textarea-radius` | `var(--neo-button-radius)` | Corner radius. |
| `--neo-textarea-padding` | `calc(var(--page-spacing, 0.25rem) * 2) calc(var(--page-spacing, 0.25rem) * 3)` | Inner padding. |
| `--neo-textarea-focus-ring` | `var(--neo-button-focus-ring)` | Focus ring. |
| `--neo-textarea-min-width` | `16rem` | Minimum field width. |
| `--neo-textarea-min-height` | `4rem` | Minimum field height. |

## Examples

### Disabled

[`disabled`](#attributes-disabled) on the host disables the native field in the shadow root and applies the disabled surface state to the host.

```example textarea_disabled
min-height: max-content
```

### Manual resize

[`scale-vertical`](#attributes-scale-vertical) and [`scale-horizontal`](#attributes-scale-horizontal) on the host show the native resize handle on that axis. Without either, the field is fixed at its `rows`-derived size.

```example textarea_manual_resize
min-height: max-content
```

### Auto-grow height

Bare [`auto-resize-height`](#attributes-auto-resize-height) grows to fit the content with no upper bound; [`auto-resize-height="12rem"`](#attributes-auto-resize-height) caps the growth and reveals the scrollbar past that.

```example textarea_auto_grow_height
min-height: max-content
```

### Auto-grow width

[`auto-resize-width`](#attributes-auto-resize-width) stops the field from wrapping and grows it horizontally to the natural longest line, capped here at 20rem. Combine with [`auto-resize-height`](#attributes-auto-resize-height) to get a textarea that snaps in both axes.

```example textarea_auto_grow_width
min-height: max-content
```
