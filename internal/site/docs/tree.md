# Tree

Component `<neo-tree>` is a disclosure tree with collapsible subtrees. Click a row or press `Enter` / `Space` on a focused branch to toggle. Expand/collapse uses the kit's `--neo-easing` / `--neo-duration-scale` tokens, which lets each theme pace it on its own.

```playground
- tree_default: Default
- tree_file_system: File system
- tree_single_root: Single root, all collapsed
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `expanded` | `boolean`, reflected, observed | `false` | Branch disclosure state on `<neo-tree-item>`. |

### Slots

| Name | Description |
| --- | --- |
| default | Nested `<neo-tree-item>` children inside `<neo-tree>`. |
| `[data-neo-tree-label]` | Row content of a `<neo-tree-item>`. |
| `[data-neo-tree-text]` | Label text inside `[data-neo-tree-label]`; fills the row and truncates with an ellipsis. |
| `[data-neo-tree-actions]` | Trailing action controls inside `[data-neo-tree-label]`; pinned to the row's end and don't shrink. |
| `slot="icon"` | Optional leading icon for a `<neo-tree-item>` row, projected before the label. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-tree-item-toggle` | `{ expanded: boolean, id: string, item: HTMLElement }` | yes | Fires when a branch expands or collapses. |

### Parts

| Name | Description |
| --- | --- |
| `::part(row)` | Each item's row, holding the chevron and the slotted label. |
| `::part(children)` | Wrapper around a branch's nested items, animated open and closed. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-tree-row-padding` | `calc(var(--page-spacing, 0.25rem) * 1.25) calc(var(--page-spacing, 0.25rem) * 2)` | Padding inside each row. |
| `--neo-tree-row-gap` | `calc(var(--page-spacing, 0.25rem) * 2)` | Gap between the chevron, label, and actions in a row. |
| `--neo-tree-indent` | `calc(var(--page-spacing, 0.25rem) * 5)` | Indentation added per nesting level. |
| `--neo-tree-row-radius` | `var(--page-radius, 0.25rem)` | Corner radius of a row's hover and focus background. |
| `--neo-tree-row-hover-bg` | `rgba(127, 127, 127, 0.12)` | Row background on hover. |
| `--neo-tree-chevron-size` | `0.85rem` | Chevron icon size. |
| `--neo-tree-duration` | `calc(200ms * var(--neo-duration-scale, 1))` | Expand and collapse animation duration. |

## Examples

### File system

In the canonical shape, the first level and 1 nested branch start expanded and the rest collapsed. Click any branch to watch the disclosure animate.

```example tree_file_system
min-height: max-content
```

### Categories (deep nesting)

6 levels under a single expanded root, with uniform per-level indentation. Click a collapsed inner branch to see the chevron rotate.

```example tree_categories
min-height: max-content
```

### Single root, all collapsed

Every branch starts closed, confirming the disclosure handle draws on the first row before any state is touched.

```example tree_single_root
min-height: max-content
```

### File explorer in a sidebar

Compose rich rows from an icon, text, and trailing actions. Wrapped in a `<neo-sidebar>` so the actions hug the content edge at any width.

- The folder / file icon is authored; the kit doesn't infer it.
- [`[data-neo-tree-text]`](#slots-data-neo-tree-text) marks the row text so it consumes the available width.
- [`[data-neo-tree-actions]`](#slots-data-neo-tree-actions) pins trailing controls (here an inert eye button) to the tree's right edge.

```example tree_explorer
width: 32rem
min-height: max-content
```

## Examples: Datastar

### Async loading (Datastar morph)

Load branch children lazily on first open. Each unloaded branch renders a skeleton placeholder as its only child.

- Opening a branch bubbles [`neo-tree-item-toggle`](#events-neo-tree-item-toggle) to the root `<neo-tree>`, whose action posts the opened item's id.
- The server patches that one `<neo-tree-item>` back with its real children.

```example tree_async
min-height: max-content
script: sim/tree/loadnode.js
simulator: delay
```

### Bookmarks library

Each leaf carries a star button that toggles a Datastar signal local to the button, with no server round-trip. The button's `data-attr:data-neo-active` binding flips the icon to the accent colour when the signal is true. The row layout is the same icon + text + actions split as the file-explorer demo above.

```example tree_bookmarks
min-height: max-content
```

<script id="lazy-tree-data" type="application/json">[{"path":"src","label":"src","children":[{"path":"src/components","label":"components","children":[{"path":"src/components/Button.tsx","label":"Button.tsx"},{"path":"src/components/Card.tsx","label":"Card.tsx"},{"path":"src/components/Modal.tsx","label":"Modal.tsx"}]},{"path":"src/hooks","label":"hooks","children":[{"path":"src/hooks/useDebounce.ts","label":"useDebounce.ts"},{"path":"src/hooks/useMediaQuery.ts","label":"useMediaQuery.ts"}]},{"path":"src/App.tsx","label":"App.tsx"}]},{"path":"docs","label":"docs","children":[{"path":"docs/intro.md","label":"intro.md"},{"path":"docs/guide","label":"guide","children":[{"path":"docs/guide/setup.md","label":"setup.md"},{"path":"docs/guide/usage.md","label":"usage.md"}]},{"path":"docs/api.md","label":"api.md"}]},{"path":"tests","label":"tests","children":[{"path":"tests/unit","label":"unit","children":[{"path":"tests/unit/parser.test.ts","label":"parser.test.ts"},{"path":"tests/unit/router.test.ts","label":"router.test.ts"}]},{"path":"tests/integration.test.ts","label":"integration.test.ts"}]}]
</script>
