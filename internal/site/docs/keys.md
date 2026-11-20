# Keys

Component `<neo-keys>` is a behavioural utility that binds keyboard shortcuts. While connected it installs a key listener on a target element (its parent by default) and removes it on disconnect. A matched chord dispatches a bubbling [`neo-keys`](#events-neo-keys) event. Renders as `display: contents` and shows nothing.

It depends on no framework. Configuration arrives through attributes ([`keys`](#attributes-keys), [`disabled`](#attributes-disabled), [`target`](#attributes-target)) and activation leaves through the dispatched event. That is the signals-down-to-attributes, events-up-to-expressions shape. A Datastar `data-attr:disabled` arms or disarms a binding and `data-on:neo-keys` runs an expression on a match, with no Datastar code inside the element.

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `keys` | `string`, observed |  | Chord spec. `+` joins a chord, `,` sequences steps, `\|` lists alternatives. Required. |
| `target` | `string`, observed | `parent` | Listener host, one of `parent`, `window`, `document`, or a CSS selector resolved with `querySelector`. |
| `for` | `string` |  | ID of an element to activate with `click()` when the shortcut matches. The `neo-keys` event is still dispatched. |
| `up` | `boolean`, observed | `false` | Match on `keyup` instead of `keydown`. |
| `repeat` | `boolean` | `false` | Allow auto-repeat (held key) to fire. |
| `prevent` | `true \| false` | `true` | Call `preventDefault()` on a match. Set `prevent="false"` to keep the default action. |
| `stop` | `boolean` | `false` | Call `stopPropagation()` on a match. |
| `in-input` | `boolean` | `false` | Also fire when focus is in a text-entry context. By default bare-key chords are suppressed there; modifier chords fire regardless. |
| `disabled` | `boolean` | `false` | Binding is inert while set. The reactive enable/disable hook. |
| `sequence-timeout` | `number` | `1000` | Milliseconds allowed between sequence steps. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-keys` | `{ combo, key, sequence, originalEvent }` | yes | A chord matched. `combo` is the matched alternative, `key` the `KeyboardEvent.key`, `sequence` the matched steps, `originalEvent` the source `KeyboardEvent`. |

### Expression syntax

A chord is 0 or more modifiers plus 1 key, joined with `+` (`mod+k`, `shift+?`, `alt+ArrowDown`). The 3 separators do not overlap.

| Separator | Meaning | Example |
| --- | --- | --- |
| `+` | Joins a modifier to a key within one chord. | `mod+k` |
| `,` | Sequences chords, pressed in order within [`sequence-timeout`](#attributes-sequence-timeout). | `g, i` |
| `\|` | Lists alternatives; any one fires. | `mod+k \| ctrl+k` |

`mod` resolves to `⌘` on Apple platforms and `Ctrl` elsewhere. A literal comma key is the `comma` alias, which keeps the separator from colliding with a key.

## Examples

### Scoped shortcut

Because the listener lives on the panel (the element's parent), `mod+s` only fires while focus is inside it. Default [`prevent`](#attributes-prevent) blocks the browser's own save dialog. Click away and the shortcut stops firing.

```example keys_scoped
min-height: max-content
```

### Sequence

A comma-separated chord list fires only after the steps arrive in order. 2 `<neo-keys>` elements share the panel, one per destination, each emitting on its own `g`-prefixed sequence.

```example keys_sequence
min-height: max-content
```

### Reactive disable

A signal is bound through `data-attr:disabled`; toggling it arms or disarms both bindings without re-rendering anything. Each binding lists an arrow and a vim-style alternative (`up | k`, `down | j`).

```example keys_reactive
min-height: max-content
```

### Global shortcuts

A [`target`](#attributes-target) of `window` (or a CSS selector) lifts the binding out of the parent scope so it fires page-wide, even when nothing in the demo is focused.

```example keys_global
min-height: max-content
```

### Trigger an element {#trigger-element}

[`for`](#attributes-for) names an element id; on a match the shortcut calls `click()` on it. A keyboard trigger then needs no event handler. Here `mod+i` opens a popover and `mod+o` a select.

```example keys_for
min-height: max-content
```
