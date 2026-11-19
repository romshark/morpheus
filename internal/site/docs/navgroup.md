# Navgroup

Component `<neo-navgroup>` is a roving-tabindex keyboard navigation host. Arrow keys move focus across children marked `data-neo-navgroup-item`; <neo-kbd>Tab</neo-kbd> enters and leaves as a single stop. [`orientation`](#attributes-orientation) picks the axis (horizontal, vertical, or 2D grid); [`columns`](#attributes-columns) fixes the grid column count; [`wrap`](#attributes-wrap) opts into edge wrapping; [`typeahead`](#attributes-typeahead) opts into focus by printable key. No implicit ARIA role; author `role` and `aria-label` to fit the semantics.

> [!NOTE]
> ### This is keyboard navigation
>
> Focus an item, then the arrow keys <neo-kbd-group><neo-kbd>←</neo-kbd><neo-kbd>→</neo-kbd><neo-kbd>↑</neo-kbd><neo-kbd>↓</neo-kbd></neo-kbd-group> plus <neo-kbd>Home</neo-kbd> / <neo-kbd>End</neo-kbd> and typeahead. With a pointer the demos are just buttons; the behavior is only observable from the keyboard.

```playground
- navgroup_default: Default
- navgroup_toolbar: Toolbar
- navgroup_vertical: Vertical
- navgroup_grid: Grid
- navgroup_media: Media controls
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `orientation` | `"horizontal" \| "vertical" \| "grid"`, observed | `horizontal` | Layout axis. `grid` measures rendered columns unless `columns` is set. |
| `columns` | `number`, observed |  | Optional fixed grid column count. |
| `wrap` | `boolean` | `false` | Arrow-key focus wraps at the edges. |
| `typeahead` | `boolean` | `false` | Printable keys focus matching items. Labels are read from `data-neo-navgroup-label`, `aria-label`, `label`, then text content. |
| `typeahead-timeout` | `number` | `500` | Idle reset duration in milliseconds. |
| `typeahead-match` | `"substring" \| "prefix"` | `"substring"` | How the buffered query is matched against item labels. |

### Slots

| Name | Description |
| --- | --- |
| default | Children that carry the `data-neo-navgroup-item` attribute. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-navgroup-navigate` | `{ index: number, item: HTMLElement }` | yes | Fires when roving focus moves to an item via keyboard navigation. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-navgroup-gap` | `calc(var(--page-spacing, 0.25rem) * 2)` | Gap between items. |
| `--neo-navgroup-columns` | `1` | Column count in `grid` orientation. JS mirrors the `columns` attribute into this property. |

## Examples

### Toolbar

A horizontal row of formatting buttons with [`wrap`](#attributes-wrap) on, which makes arrow keys cycle past either edge. `role="toolbar"` and `aria-label` turn the group into a single labelled landmark for assistive tech.

```example navgroup_toolbar
min-height: max-content
```

### Vertical

Same component, axis flipped to match a stacked list. Up/down arrows move focus, [`wrap`](#attributes-wrap) keeps the cursor inside the group when it reaches either end.

```example navgroup_vertical
min-height: max-content
```

### Grid

Set [`orientation="grid"`](#attributes-orientation) with a [`columns`](#attributes-columns) count and arrow keys move in 2 dimensions. [`wrap`](#attributes-wrap) wraps both axes. A Right at the end of a row jumps to the start of the next row.

```example navgroup_grid
min-height: max-content
```

### Media controls

Disabled items stay in place so the toolbar's visual order is preserved, but arrow keys skip over them. They're dropped from the roving focus set and can't be activated. Useful for media controls where the available actions change with playback state.

```example navgroup_media
min-height: max-content
```
