# Tabs

Component `<neo-tabs>` is a tabbed interface. Clicking a `<neo-tab>` commits its [`value`](#attributes-value) to the host, which reveals the matching `<neo-tabpanel>`. Arrow keys move focus across tabs; activation is manual (<neo-kbd>Enter</neo-kbd> or <neo-kbd>Space</neo-kbd> commits). Set [`auto-activate`](#attributes-auto-activate) to opt into the selection-follows-focus pattern.

```playground
- tabs_default: Default
- tabs_icons: Icons + labels
- tabs_no_animation: No animation
- tabs_custom_animation: Custom animation
- tabs_underline: Custom styling
- tabs_auto_activate: Auto-activate
- tabs_vertical: Vertical
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string`, reflected, observed |  | Active tab value. |
| `orientation` | `"horizontal" \| "vertical"`, observed | `horizontal` | Layout axis. |
| `auto-activate` | `boolean` | `false` | Arrow keys commit the selection in addition to moving focus. |
| `easing` | `string`, observed |  | CSS transition shorthand for the panel swap. |
| `enter-animation` | `string`, observed |  | `@keyframes` name for the entering panel. |
| `exit-animation` | `string`, observed |  | `@keyframes` name for the exiting panel. |

### States

| Name | Description |
| --- | --- |
| `:state(forward)` | Set on `<neo-tabs>` when the new tab sits after the previous one; the built-in and author animations branch on it. |
| `:state(backward)` | Set on `<neo-tabs>` when the new tab sits before the previous one. |
| `:state(leaving)` | Set on the outgoing `<neo-tabpanel>` for the duration of its exit animation. |

### Slots

| Name | Description |
| --- | --- |
| default | `<neo-tablist>`, `<neo-tab>`, and `<neo-tabpanel>` children. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-tabs-change` | `{ value: string }` | yes | Fires after the active tab changes. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-tabs-list-bg` | `color-mix(in srgb, var(--page-fg) 6%, transparent)` | Tablist pill background. |
| `--neo-tabs-list-padding` | `calc(var(--page-spacing, 0.25rem) * 1)` | Padding inside the tablist pill. |
| `--neo-tabs-list-gap` | `var(--neo-tabs-list-padding)` | Gap between tabs. |
| `--neo-tabs-list-border-width` | `2px` | Tablist border width in forced-colors and high-contrast modes. |
| `--neo-tabs-radius` | `var(--page-radius, 0.5rem)` | Tablist corner radius. |
| `--neo-tabs-focus-outline-width` | `2px` | Focus outline width. |
| `--neo-tabs-focus-outline-offset` | `2px` | Focus outline offset. |
| `--neo-tabs-tab-radius` | `max(0px, calc(var(--neo-tabs-radius) - var(--neo-tabs-list-padding)))` | Tab corner radius. The default keeps the tab corners concentric with the tablist's. |
| `--neo-tabs-tab-padding-y` | `0.4rem` | Tab vertical padding. |
| `--neo-tabs-tab-padding-x` | `0.85rem` | Tab horizontal padding. |
| `--neo-tabs-tab-padding` | `var(--neo-tabs-tab-padding-y) var(--neo-tabs-tab-padding-x)` | Tab padding shorthand. |
| `--neo-tabs-edge-tab-padding-x` | `var(--neo-tabs-tab-padding-x)` | Horizontal padding of the first and last tab in forced-colors and high-contrast modes. |
| `--neo-tabs-tab-color` | `var(--muted, currentColor)` | Inactive tab text color. |
| `--neo-tabs-tab-hover-color` | `var(--page-fg, currentColor)` | Tab text color on hover. |
| `--neo-tabs-tab-active-bg` | `var(--page-bg, #ffffff)` | Active tab background. |
| `--neo-tabs-tab-active-color` | `var(--page-fg, currentColor)` | Active tab text color. |
| `--neo-tabs-tab-active-shadow` | `0 1px 2px color-mix(in srgb, var(--page-fg) 16%, transparent)` | Active tab shadow. |
| `--neo-tabs-focus-ring` | `var(--accent, currentColor)` | Focus outline color. |
| `--neo-tabs-panel-padding` | `0.85rem 0` | Panel padding. |

## Examples

### Icons + labels

Each `<neo-tab>` accepts arbitrary children. Drop in a `<neo-icon>` next to the label and the tab's flex layout aligns them with the same gap as a `<neo-button>`.

```example tabs_icons
min-height: max-content
```

### No animation

Omit [`easing`](#attributes-easing) and the panel swap is instant. This is the default; the examples below opt into transitions and keyframe animations.

```example tabs_no_animation
min-height: max-content
```

### Custom animation

Point [`enter-animation`](#attributes-enter-animation) and [`exit-animation`](#attributes-exit-animation) at author-defined `@keyframes`. The `tabs-tilt` set here branches on the host's [`:state(forward)`](#states-forward) / [`:state(backward)`](#states-backward) custom state (set when the active tab changes). The panel rotates and slides in from the side of travel.

```example tabs_custom_animation
min-height: max-content
```

### Custom styling

The `--neo-tabs-*` custom-property family swaps the default pill frame for any visual. Here a scoped `<style>` block sets those properties to turn the active pill into an accent-coloured underline, GitHub-style. Selection, keyboard navigation, and animation are unchanged.

```example tabs_underline
min-height: max-content
```

### Auto-activate

Set [`auto-activate`](#attributes-auto-activate) on the host so arrow keys commit the selection as focus moves, matching the classic WAI-ARIA radiogroup pattern. A click works as in a normal tab list.

```example tabs_auto_activate
min-height: max-content
```

### Vertical

Set [`orientation="vertical"`](#attributes-orientation) on the host. The tablist stacks, arrow-key axes flip to <neo-kbd>↑</neo-kbd>/<neo-kbd>↓</neo-kbd>, and the `aria-orientation` hint propagates to the tablist.

```example tabs_vertical
min-height: max-content
```
