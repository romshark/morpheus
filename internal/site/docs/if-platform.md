# If platform

Component `<neo-if-platform>` is a platform gate. It shows its content only on the operating systems its attributes select, and hides it elsewhere. Use it only for what CSS can't check. CSS `@media` already handles touch, dark mode, and the like. To gate on the connection state, use [`<neo-if-network>`](if-network.md).

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `macos` | `boolean`, observed | `unset` | macOS. |
| `ios` | `boolean`, observed | `unset` | iOS and iPadOS, including iPadOS Safari, which reports a Mac. |
| `windows` | `boolean`, observed | `unset` | Windows. |
| `linux` | `boolean`, observed | `unset` | Desktop Linux. Android and ChromeOS have their own attributes. |
| `android` | `boolean`, observed | `unset` | Android. |
| `chromeos` | `boolean`, observed | `unset` | ChromeOS. |

### Slots

| Name | Description |
| --- | --- |
| default | Shown only on the platforms the attributes select (see [Platform rules](#platform-rules)). |

### Platform rules

Each platform attribute is a [boolean command](server-driven.md#command-patches) the server can set:

- Platforms set true are an OR, since a device has 1 platform. `<neo-if-platform macos linux>` shows on either.
- `x="false"` hides the content on `x`. `<neo-if-platform windows="false">` shows everywhere but Windows.
- With no platform attribute the content shows everywhere.
- A misspelled attribute is ignored. `<neo-if-platform macso>` shows everywhere.

## Examples

### Platform branch

Each branch carries platform-specific wording and shows only on its OS. You're seeing the one for your system. iOS and Android match no branch.

```example if_platform_branch
min-height: max-content
class: demo-stage-flow
```

> [!NOTE]
> This static demo shows only your own OS's branch, and swaps it in after the script loads, a brief flash. A templ server avoids that. Pass the request user agent to `IfPlatformOpts.UserAgent` and the matching branch renders up front, with no flash. To preview another OS here, open DevTools, go to `Network conditions` and then `User agent client hints`, set `Platform`, and reload.

### Multiple platforms

Set several platforms to show on any of them. Here one branch covers the Ctrl platforms, the other the Command platforms.

```example if_platform_multiple
min-height: max-content
class: demo-stage-flow
```

### Exclude platforms

Download links per store. Phones get their app store, and the branch with `ios="false" android="false"` covers every other platform.

```example if_platform_exclude
min-height: max-content
class: demo-stage-flow
```
