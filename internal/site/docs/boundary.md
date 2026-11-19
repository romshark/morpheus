# Boundary

Component `<neo-boundary>` is a logical scoping region for overlays. An overlay inside it ([`<neo-popover>`](popover.md), [`<neo-menu>`](menu.md), [`<neo-select>`](select.md), [`<neo-combobox>`](combobox.md), or [`<neo-textinput>`](text-input.md) suggestions) treats the boundary as its local document and viewport. Its [`scope`](#attributes-scope) attribute is a space-separated token list that defaults to `"dismiss positioning"`. By default, outside clicks and focus do not dismiss the overlay, and its panel clamps to the region instead of the viewport. Setting [`scope`](#attributes-scope) replaces that default. Add a token to opt into a scope or drop one to turn it off. The `scroll` token lets independent scrollers outside the region move without closing the overlay; `stacking` layers the region's overlays inside it rather than the document root. Both are off by default. The element is layout-neutral (`display: contents`) until stacking gives it a box, and never clips a panel. `Escape` and trigger toggles always close an overlay.

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `scope` | `"dismiss" \| "positioning" \| "scroll" \| "stacking" (space-separated)` | `"dismiss positioning"` | Space-separated list of the scopes this region applies. Setting it replaces the default (`dismiss positioning`) entirely. List every scope you want; omit a token to fall back to the document / viewport default for it, and `scope=""` scopes nothing. With `dismiss`, a pointer or focus event outside the boundary does not close an overlay inside it (only events inside the boundary but outside the overlay do). With `positioning`, overlay panels clamp and flip against this region's box (the union of the boundary's laid-out descendant rects) instead of the viewport. With `scroll`, an independent scroll container outside this region can move without closing an embedded overlay; a scroll inside the region, or on an ancestor scroller that carries the region, still dismisses. With `stacking`, the region establishes a local stacking context (`isolation: isolate`) so its overlays layer inside it, not the document root; this is the one scope that drops `display: contents` for a box. |

### Slots

| Name | Description |
| --- | --- |
| default | The content the boundary scopes. Each overlay inside reads its nearest `<neo-boundary>` ancestor (via `closest("neo-boundary")`) and obeys that boundary's scopes only. Rules are not inherited. A closer boundary that turns a scope off falls back to the document or viewport default for that scope, not to an outer boundary. Scoping is purely logical (composed-path containment) and non-visual. A fixed or top-layer panel still counts as inside through its host even though it paints outside the boundary's box. |

## Examples

### Scoped dismiss

2 regions, each a `<neo-boundary>`. Open an overlay in one, then click or open something in the other. The first stays open because each boundary scopes dismiss to itself. Without boundaries, the second interaction would close the first.

```example boundary_scoped_dismiss
min-height: 16rem
```

### Positioning containment

Open the popover. The panel clamps and flips against the dashed region instead of the viewport. The trigger sits at the region's bottom edge, and the panel flips above it to stay inside. Set [`scope="dismiss"`](#attributes-scope) to clamp to the viewport instead.

```example boundary_positioning
min-height: 16rem
```

### Scroll scope

The Account menu is an embedded widget inside a scrollable panel; its boundary adds the `scroll` token ([`scope="dismiss positioning scroll"`](#attributes-scope)). Open the menu, then scroll the panel around it. Because that scroller carries the boundary itself, the popover closes instead of floating through the container. Independent scrollers outside the boundary can move without dismissing it.

```example boundary_scroll
min-height: 18rem
```

### Stacking scope

Stacking scope is opt-in. The right widget adds the `stacking` token to establish a local stacking context, which layers its overlays inside the region instead of the document root. Both widgets open the same popover (global `z-index: 1000`) across a host overlay at `z-index: 100`.

- Left (default): no stacking context. The panel outranks the host overlay and paints over it.
- Right (`stacking`): the panel is confined to the region's context, and the host overlay paints over it instead.

Open both popovers to compare. Enabling stacking gives the region a box (`isolation: isolate`), the one scope that drops `display: contents`.

```example boundary_stacking
min-height: 18rem
```

### Nested boundaries {#nested}

The closest boundary defines the rules; they are not inherited. The inner boundary uses [`scope="positioning"`](#attributes-scope) (no dismiss). Its popover closes on any outside click (document scope), even though the outer boundary enables dismiss scoping. A closer boundary that turns a scope off falls back to the document or viewport default, never to the outer boundary. Open the popover, then click outside it to see it close.

```example boundary_nested
min-height: 24rem
```
