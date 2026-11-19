# If network

Component `<neo-if-network>` is a connection gate. It shows its content only while the browser is online ([`online`](#attributes-online)) or offline ([`online="false"`](#attributes-online)), and switches when the connection changes. To require a platform too, nest it in [`<neo-if-platform>`](if-platform.md).

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `online` | `boolean`, observed | `unset` | The connection state to show in. `online` shows while online, `online="false"` while offline, and unset in both. Offline is reliable; online only means the device is on a network, not that the server is reachable. |
| `delay` | `number` | `0` | Milliseconds a connection change must last before the content switches. A shorter drop shows nothing. The state on page load applies at once. |

### Slots

| Name | Description |
| --- | --- |
| default | Shown only in the connection state `online` selects. |

## Examples

### Connection status

One branch per connection state tells the user whether their changes reach the server.

- Because the `role="status"` wrapper stays on the page, screen readers announce the branch that appears. A live region must be on the page before its content changes.
- [`online`](#attributes-online) only means the device is on a network. A server that is down still counts as online.
- [`delay="2000"`](#attributes-delay) switches only after the connection has changed for 2 seconds. A shorter drop shows nothing.
- In DevTools, set `Network` throttling to `Offline` and wait 2 seconds to see the other branch.

```example if_network_status
min-height: max-content
class: demo-stage-flow
```
