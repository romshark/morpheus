# Clipcopy

Component `<neo-clipcopy>` is a wrapper that copies a value to the clipboard when its first child is clicked. The host sets [`:state(copied)`](#states-copied) after a copy, which CSS uses to swap the idle and copied labels.

```playground
- clipcopy_default: Default
- clipcopy_target: Icon + target ref
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` |  | Literal text to copy. Takes precedence over `for`. |
| `for` | `string` |  | Id of an element whose `textContent` is copied. |
| `copied-duration` | `number` | `1500` | Milliseconds [`:state(copied)`](#states-copied) stays set. |

### States

| Name | Description |
| --- | --- |
| `:state(copied)` | Set after a successful copy for `copied-duration` milliseconds. |

### Slots

| Name | Description |
| --- | --- |
| default | Trigger element. Children may use `[data-neo-clipcopy-idle]` and `[data-neo-clipcopy-copied]` to swap label content per state. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-clipcopy-copy` | `{ value: string }` | yes | Fires after a successful copy. |
| `neo-clipcopy-error` | `{ error: Error }` | yes | Fires when the clipboard write fails. |

## Examples

### Icon + target ref

The host reads the `textContent` of the `<code>` element pointed to by its [`for`](#attributes-for) attribute. The copied value tracks what the user sees on the page. Useful when the rendered text *is* the source of truth.

```example clipcopy_target
min-height: max-content
```
