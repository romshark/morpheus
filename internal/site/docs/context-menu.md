# Context menu

Component `<neo-contextmenu>` is a right-click menu built from the same `<neo-menuitem>` and `<neo-submenu>` rows as [`<neo-menu>`](menu.md). Mark the focusable element with `data-neo-contextmenu-trigger`; everything else inside becomes the menu panel. Opens via the keyboard context-menu key and <neo-kbd>Shift</neo-kbd>+<neo-kbd>F10</neo-kbd> as well.

```playground
id: contextmenu-playground
height: 30rem
- context_menu_default: Default
- context_menu_simple: Simple
- context_menu_nested: Nested
- context_menu_custom: Custom content
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean`, reflected, observed | `false` | Open state. Usually controlled by the host after a right-click or keyboard context-menu invocation. |
| `mode` | `"auto" \| "cascade" \| "push"`, observed | `"auto"` | Nested submenu strategy. Matches `neo-menu`, with cascade on roomy pointers and push on narrow or touch-first contexts. |
| `screen-offset` | `CSS length`, observed | `8px` | Minimum distance between the panel and viewport edge. |
| `clamp-placement` | `boolean`, observed | `false` | Allows the panel to re-anchor from the pointer when needed to remain visible. |
| `min-fit-height` | `CSS length \| "content"`, observed | `"content"` | Strict-placement flip threshold inherited by submenus. |
| `min-fit-width` | `CSS length \| "content"`, observed | `"content"` | Strict-placement flip threshold inherited by submenus. |

### Slots

| Name | Description |
| --- | --- |
| `[data-neo-contextmenu-trigger]` | Required descendant (any depth, but not inside a nested `<neo-menu>` or `<neo-contextmenu>`) that receives the `contextmenu` and keyboard handlers. The first match is used. |
| `<neo-menu>` | Exactly 1 required `<neo-menu>` child holding the rows. It supplies all menu behavior; the context menu only opens it at the pointer. 0 or multiple warn in the console. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-contextmenu-open` |  | yes | Fires when the menu opens. |
| `neo-contextmenu-close` |  | yes | Fires when the menu closes. |
| `neo-menuitem-select` |  | yes | Bubbles from selected child rows with `{ value }`. |

## Examples

### Simple

A context menu wraps one trigger surface and a set of menu rows. The trigger stays in the page; the rows move into the generated floating panel.

```example context_menu_simple
min-height: 20rem
```

### Nested

Context menus can be nested inside another trigger surface. Right-clicking the inner target opens its own menu without also opening the parent menu.

```example context_menu_nested
min-height: 24rem
```

### Custom content

Because the trigger is regular light DOM and the panel uses the same menu CSS variables, a scoped stylesheet can handle custom target surfaces, icon rows, widths, and danger treatments.

```example context_menu_custom
min-height: 20rem
```
