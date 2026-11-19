# Persist

Component `<neo-persist>` is a behavioural primitive that snapshots properties of the element it targets (via [`for`](#attributes-for), or its first child by default) to [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) on the listed events and restores them on connect. Renders as `display: contents` so the wrapped child stays a direct flex / grid item of its parent.

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `key` | `string` |  | [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) key. Required. |
| `props` | `string` |  | Whitespace-separated property names to persist. |
| `on` | `string` |  | Whitespace-separated events that trigger a snapshot. |
| `for` | `string` |  | Target element id. Defaults to first child. |
| `session` | `boolean` | `false` | Use `sessionStorage` instead of `localStorage`. |

### Slots

| Name | Description |
| --- | --- |
| default | Target element. Extras are warned and ignored. |

## Examples

### Scroll position (localStorage)

The simplest case. Snapshots `scrollTop` on every `scroll` event into `localStorage` under the configured key, then restores it on the next connect. The site sidebar uses the same wiring.

```example persist_scroll
min-height: max-content
```

### Textarea draft (sessionStorage)

Passing [`session`](#attributes-session) switches the backing store to `sessionStorage`, scoping the snapshot to the current tab. Type a draft, reload the page, and it comes back; close the tab and it's gone.

```example persist_textarea
min-height: max-content
```

### Multiple properties

Value plus the user-resized size (`style.width` / `style.height`) on the `<neo-textarea>` host. Property names accept dot paths. Nested fields like `style.width` are snapshotted directly. The childless `<neo-persist for="...">` form targets an existing element by id rather than wrapping it.

```example persist_multi
min-height: max-content
```

### Video

Persists `currentTime`, `volume`, and `muted`. The player resumes where the viewer left off with the same volume and mute state. Source: *Sintel* trailer (Blender, CC BY 3.0).

```example persist_video
min-height: max-content
```
