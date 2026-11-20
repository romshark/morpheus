# Menu

Component `<neo-menu>` is a keyboard-navigable dropdown menu. Author a trigger plus a flat list of `<neo-menuitem>` / `<neo-submenu>` / `<hr>` children; the host wraps them into a fly-out panel and owns hover, focus, ArrowRight / ArrowLeft submenu navigation, Esc, and a global [`shortcut`](#menuitem-attributes-shortcut) binding per item. <neo-kbd>⌘</neo-kbd>+<neo-kbd>S</neo-kbd> works from anywhere on this page.

```playground
height: 24rem
- menu_default: Default
- menu_push_mode: Push mode
- menu_open_above: Open above
- menu_disabled_rows: Disabled rows
```

### \<neo-menu> {.api-element}

A triggerless menu panel. Nest it directly inside a `<neo-button>` (the button becomes the dropdown trigger). The trigger can also be a context menu. Nest it in a [`<neo-contextmenu>`](context-menu.md) and it opens at the pointer instead. Its children are the rows; it wraps them into a self-contained fly-out and owns hover, focus, ArrowRight-to-enter / ArrowLeft-to-exit, and a global keyboard [`shortcut`](#menuitem-attributes-shortcut) per item. From a button host, click or focus the button and press <neo-kbd>Enter</neo-kbd> / <neo-kbd>Space</neo-kbd> / <neo-kbd>↓</neo-kbd> to open; outside-click, focus loss, or <neo-kbd>Esc</neo-kbd> closes.

## Reference

### Attributes {#menu-attributes}

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean`, reflected, observed | `false` | Controls visibility. |
| `placement` | `string`, observed | `"bottom-start"` | Anchor position relative to the trigger; same values as `<neo-popover>`. |
| `mode` | `"auto" \| "cascade" \| "push"`, observed | `"auto"` | Submenu presentation. `cascade` flies out to the side (desktop). `push` replaces the parent panel with a back row (mobile). `auto` picks based on `(hover: none) and (pointer: coarse), (max-width: 36rem)`. The resolved push mode sets [`:state(push)`](#menu-states-push). |
| `screen-offset` | `string`, observed |  | Minimum margin between the panel and viewport edge; inherited by descendant `<neo-submenu>`s via the `--neo-menu-screen-offset` CSS cascade. |
| `clamp-placement` | `boolean`, observed | `false` | Opt out of the default strict placement. The menu panel re-anchors its position to keep itself inside the viewport when content would otherwise overflow, instead of staying glued to the configured side and shrinking `max-width`/`max-height`. Inherited by descendant `<neo-submenu>`s unless they set their own value. |
| `min-fit-height` | `CSS length \| "content"`, observed | `"content"` | Minimum vertical slot the strict placement requires. If the slot at the configured side is shorter and the opposite side has more room, the menu auto-flips (e.g. `bottom-start` to `top-start`). `content` resolves from the menu panel's scroll height on each positioning pass. Inherited by descendant `<neo-submenu>`s via the `--neo-menu-min-fit-height` CSS cascade. |
| `min-fit-width` | `CSS length \| "content"`, observed | `"content"` | Same as `min-fit-height` but for the horizontal axis (`left-*`/`right-*`). `content` resolves from the panel's scroll width. Use `0` to disable the horizontal flip. |

### States {#menu-states}

| Name | Description |
| --- | --- |
| `:state(push)` | Set while [`mode`](#menu-attributes-mode) resolves to `push`. |

### Slots {#menu-slots}

| Name | Description |
| --- | --- |
| `host` | Parent `<neo-button>` or `<neo-contextmenu>`. The button becomes the trigger; the context menu opens the panel at the pointer. There is no trigger child. |
| default | Children (`<neo-menuitem>`, `<neo-submenu>`, or `<hr>` separators) are wrapped into the fly-out panel on connect. |

### Events {#menu-events}

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-menu-open` |  | yes | Fires when the menu opens. |
| `neo-menu-close` |  | yes | Fires when the menu closes. |
| `neo-menuitem-select` | `{ value: string \| null }` | yes | Fires when any descendant `<neo-menuitem>` activates. The root menu auto-closes after. |

### CSS variables {#menu-css-variables}

| Name | Default | Description |
| --- | --- | --- |
| `--neo-menu-bg` | `var(--btn-bg)` | Panel background. |
| `--neo-menu-color` | `var(--page-fg)` | Panel text color. |
| `--neo-menu-border-color` | `var(--btn-border)` | Panel border color. |
| `--neo-menu-border-width` | `1px` | Panel border width. |
| `--neo-menu-radius` | `var(--page-radius, 0.625rem)` | Panel corner radius. |
| `--neo-menu-padding` | `calc(var(--page-spacing, 0.25rem) * 1)` | Padding around the panel rows. |
| `--neo-menu-gap` | `var(--neo-menu-padding)` | Gap between the panel rows. |
| `--neo-menu-shadow` | `0 1px 2px rgba(0, 0, 0, 0.06), 0 8px 28px rgba(0, 0, 0, 0.18)` | Panel box shadow. |
| `--neo-menu-min-width` | `12rem` | Panel minimum width. |
| `--neo-menu-z-index` | `1200` | Panel stacking order. |
| `--neo-menu-item-radius` | `max(0px, calc(var(--neo-menu-radius) - var(--neo-menu-border-width) - var(--neo-menu-padding)))` | Row corner radius. The default keeps the row corners concentric with the panel's. |
| `--neo-menu-item-padding-y` | `calc(var(--page-spacing, 0.25rem) * 1.5)` | Vertical padding of a row. |
| `--neo-menu-item-padding-x` | `calc(var(--page-spacing, 0.25rem) * 2.5)` | Horizontal padding of a row. |
| `--neo-menu-item-hover-bg` | `color-mix(in srgb, var(--page-fg) 8%, transparent)` | Background of the focused row. |
| `--neo-menu-item-active-bg` | `color-mix(in srgb, var(--page-fg) 12%, transparent)` | Background of an open submenu's trigger row. |
| `--neo-menu-shortcut-color` | `color-mix(in srgb, var(--page-fg) 55%, transparent)` | Color of the trailing shortcut hint and submenu chevron. |
| `--neo-menu-separator-color` | `color-mix(in srgb, var(--page-fg) 12%, transparent)` | Color of an `<hr>` separator. |
| `--neo-menu-separator-width` | `1px` | Thickness of an `<hr>` separator. |

### \<neo-menuitem> {.api-element}

A leaf row inside a menu or submenu. Activates on click, <neo-kbd>Enter</neo-kbd>, <neo-kbd>Space</neo-kbd>, or a global [`shortcut`](#menuitem-attributes-shortcut) binding; emits [`neo-menuitem-select`](#menu-events-neo-menuitem-select) and the enclosing menu collapses the chain.

### Attributes {#menuitem-attributes}

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` |  | Identifier carried in the `neo-menuitem-select` event detail. |
| `disabled` | `boolean`, observed | `false` | Non-interactive state. Skips the focus ring, swallows clicks, and ignores the bound `shortcut`. |
| `shortcut` | `string`, observed |  | Global hotkey, e.g. `Mod+S`, `Cmd+K`, `Shift+Alt+P`. `Mod` resolves to ⌘ on macOS, Ctrl elsewhere. Renders a trailing kbd-styled hint and registers a document-level keydown that synthesizes activation. Suppressed when the user is typing into an `<input>`, `<textarea>`, or contentEditable. |

### Slots {#menuitem-slots}

| Name | Description |
| --- | --- |
| default | Item label. May contain text, icons, or any other markup. |

### Events {#menuitem-events}

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-menuitem-select` | `{ value: string \| null }` | yes | Fires on click, `Enter`, `Space`, or shortcut activation. The enclosing menu listens and closes the chain. |

### \<neo-submenu> {.api-element}

A nested fly-out. Place it as a child of `<neo-menu>` or another `<neo-submenu>`; the host auto-renders the trigger row from [`label`](#submenu-attributes-label), and the element's children become the panel. Opens on hover, click, or <neo-kbd>→</neo-kbd>; <neo-kbd>←</neo-kbd> closes and returns focus to the trigger row.

### Attributes {#submenu-attributes}

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string`, observed |  | Required. Trigger row text. The host auto-renders the row + chevron. |
| `back-label` | `string`, observed | `"Back"` | Accessible name of the back row in push mode. |
| `open` | `boolean`, reflected, observed | `false` | Controls fly-out visibility. |
| `placement` | `string`, observed | `"right-start"` | Anchor position relative to the trigger row. |
| `disabled` | `boolean`, observed | `false` | Disables the entire branch. The trigger row is unfocusable and hover/click does not open it. |
| `screen-offset` | `string`, observed |  | Minimum margin between the panel and viewport edge; inherits from the ancestor `<neo-menu>` unless set directly. |
| `clamp-placement` | `boolean`, observed | `false` | Opt out of the default strict placement and re-anchor the submenu panel position to fit. The ancestor `<neo-menu>`'s value is also honored. Usually only the root needs to set it. |
| `min-fit-height` | `CSS length \| "content"`, observed | `"content"` | Minimum vertical slot the strict placement requires; inherits from the ancestor `<neo-menu>` unless set directly. |
| `min-fit-width` | `CSS length \| "content"`, observed | `"content"` | Same as `min-fit-height` but for the horizontal axis. |

### Slots {#submenu-slots}

| Name | Description |
| --- | --- |
| default | Children (`<neo-menuitem>`, nested `<neo-submenu>`, or `<hr>` separators) are wrapped into the fly-out panel on connect. |

### Events {#submenu-events}

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-submenu-open` |  | yes | Fires when the fly-out opens. |
| `neo-submenu-close` |  | yes | Fires when the fly-out closes. |

## Examples

### Push mode

Submenus replace the root panel rather than fly out to the side, with a synthesized back row. This is the native mobile pattern and the default for narrow viewports (`(hover: none) and (pointer: coarse)` or `(max-width: 36rem)`) when [`mode`](#menu-attributes-mode) is left at its default `auto`. Forced here to preview on desktop.

```example menu_push_mode
min-height: 24rem
```

### Open above

Anchor the panel at `top-start`. Strict placement is the default. The panel stays glued to `top-*`, shrinks its `max-height` to the slot above the trigger, and scrolls the items inside. Submenu fly-outs inherit. Toggle [`clamp-placement`](#menu-attributes-clamp-placement) on to opt into the alternative, where the menu re-anchors below the trigger when there isn't enough room above.

```example menu_open_above
min-height: 24rem
```

### Disabled rows

Disabled items skip the focus ring, swallow clicks, and ignore their bound shortcut. The submenu's own `disabled` attribute disables the entire branch.

```example menu_disabled_rows
min-height: 24rem
```

## Examples: Datastar

### Morphing during interaction

A Datastar app can fat-morph the page at any moment. The rows under a `<neo-menu>` may then appear, disappear, or flip to [`disabled`](#menuitem-attributes-disabled) while the menu is open. Autoplay cycles the states below to simulate those server-driven morphs. Open the menu and watch it reconcile in place. The trigger and panel stay mounted, the menu stays open, and focus survives.

```playground
id: menu-morph-playground
autoplay: true
height: 24rem
- menu_morph_initial: Initial
- menu_morph_disabled: Disabled options
- menu_morph_more: More options
```
