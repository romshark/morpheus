# Elastic

Component `<neo-elastic>` is a block container that animates its height whenever its content changes size. Content that a morph swaps, a list that grows and content that loads later all animate without extra code. For interactive expanding and collapsing, use [`<neo-collapsible>`](collapsible.md).

```playground
- elastic_default: Default
- elastic_bigger: Bigger content
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean`, observed | `true` | Open by default. Set `open="false"` to animate the host to 0px tall and make the content `inert`. |
| `reset-on-collapse` | `boolean` | `false` | Swap content for [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder) after the collapse transition. |

### Slots

| Name | Description |
| --- | --- |
| `[data-neo-async-placeholder]` | Replacement content shown after collapse when [`reset-on-collapse`](#attributes-reset-on-collapse) is set. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-elastic-start` | `{ from: number, to: number }` | yes | Fires at the start of a height transition. |
| `neo-elastic-end` | `{ height: number }` | yes | Fires once the height transition ends. |

### Parts

| Name | Description |
| --- | --- |
| `::part(content)` | Wrapper around the children in the shadow root. The host measures it and animates to its height. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-elastic-duration` | `calc(300ms * var(--neo-duration-scale, 1))` | Duration of the height transition. |

## Examples

### Toggle reveal

The accordion case. While the inner is `display: none` the content measures 0 and the host collapses; on reveal it animates back to the natural content height. The button just flips the inner's `hidden` attribute; the host re-measures on its own.

```example elastic_toggle_reveal
min-height: max-content
```

## Examples: Datastar

Datastar morph patches that swap or re-render the inner content animate the height shift automatically; Elastic's ResizeObserver / MutationObserver re-pin on every reflow, which makes any server-driven content swap read as a smooth transition without per-demo wiring.

### Morphing during interaction

A Datastar fat-morph can grow or shrink the content inside a `<neo-elastic>` mid-view. The host stays mounted across each morph and animates from the old height to the new one, no per-demo wiring. Autoplay cycles the states below to simulate the morphs.

```playground
id: elastic-morph-playground
autoplay: true
- elastic_morph_initial: Initial
- elastic_morph_taller: Taller content
- elastic_morph_shorter: Shorter content
```

### Growing list

A Datastar morph patch replaces the inner `<ul>` with a fresh count of items. The content re-measures on every replacement and the host transitions between the old and new heights.

```example elastic_growing_list
min-height: max-content
script: sim/elastic/list.js
```

### Content swap

Besides expanding from 0 height, the host shrinks or grows between 2 differently sized blocks. Whatever the content measures, the host transitions to. Re-toggling mid-flight retargets the latest height instead of finishing the old one.

```example elastic_content_swap
min-height: max-content
```

### Async placeholder

Combine [`reset-on-collapse`](#attributes-reset-on-collapse) with a [`<template data-neo-async-placeholder>`](#slots-data-neo-async-placeholder) to reload content through the placeholder. Opening reveals the skeleton and posts to the server, which morphs the loaded panel into the slot; collapsing reinstates the skeleton after the transition. The next open then loads fresh. Closing aborts an in-flight request. Load details, collapse, then reopen.

```example elastic_async_placeholder
min-height: max-content
script: sim/elastic/async.js
```
