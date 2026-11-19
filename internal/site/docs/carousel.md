# Carousel

Component `<neo-carousel>` is a scroll-snap carousel over a native `<neo-carousel-track>` with `<neo-carousel-slide>` children. Scrolling runs on the compositor via `overflow + scroll-snap-type`; JS only wires prev / next, keyboard, and active-slide tracking. Add `<neo-button data-neo-carousel-prev>` / `<neo-button data-neo-carousel-next>` to opt into arrow controls and the boolean [`dots`](#attributes-dots) attribute to opt into the dot pagination (rendered in the host's shadow root).

```playground
height: 14rem
- carousel_default: Default
- carousel_multi: Multiple slides per view
- carousel_auto: Intrinsic widths
- carousel_custom_dots: Custom navigation styling
- carousel_autoplay: Autoplay + loop
- carousel_easing: Custom easing
- carousel_vertical: Vertical
- carousel_no_touch: No touch
- carousel_many_slides: 100 slides
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string`, reflected, observed |  | Active slide value. Falls back to the first slide when unset. An external patch sets the slide instantly (jump); a fat morph that drops it is no command, and the current slide stays. The carousel's own navigation always animates. |
| `orientation` | `"horizontal" \| "vertical"`, observed | `horizontal` | Layout axis. Vertical mode uses y-axis scrolling and up / down arrow keys. |
| `per-view` | `number \| "auto"`, observed | `1` | Visible slides per view. Use `auto` to keep each slide's intrinsic size. |
| `spacing` | `length`, observed |  | Gap between slides; accepts any CSS length. |
| `align` | `"start" \| "center" \| "end"`, observed | `start` | Where the active slide snaps inside the viewport. |
| `loop` | `boolean`, observed | `false` | Wrap prev / next and autoplay past the ends. |
| `touch` | `true \| false`, observed | `true` | Native gesture scrolling. Set `touch="false"` to disable it; buttons and keyboard navigation still work. |
| `autoplay` | `number (ms)`, observed |  | Milliseconds between automatic advances. Unset disables autoplay; use `paused` or a `data-neo-carousel-pause` button to suspend. |
| `autoplay-step` | `number`, observed | `1` | Slides advanced per autoplay tick. Only applies when `per-view` is greater than 1. |
| `paused` | `boolean`, reflected, observed | `false` | Suspends autoplay without removing the interval. Toggled by `data-neo-carousel-pause` buttons and by <neo-kbd>Space</neo-kbd> while the host is focused. |
| `aria-label` | `string` |  | Accessible name for the carousel region. |
| `easing` | `string`, observed |  | Timing for programmatic scrolls. Use a duration (`"600ms"`) or duration plus timing function. Falls back to theme `--neo-easing` and respects reduced motion. |
| `animate-patch` | `boolean` | `false` | Animate external `value` patches (using `easing`) instead of jumping. Read per patch. Set it alongside `value` to glide one transition, omit it to jump the next. |
| `highlight-active` | `boolean` | `false` | Opt-in visibility styling. Off-screen slides dim to `--neo-carousel-slide-inactive-opacity` and visible slides remain opaque. The kit also writes `data-neo-carousel-slide-visibility` for custom styling. |
| `click-nav` | `boolean` | `false` | Click a slide to activate it. Interactive content inside slides keeps its normal click behavior. |
| `drag-nav` | `boolean` | `false` | Mouse / pen drag scrolls the track. Touch keeps native scrolling; ignored when `touch="false"`. |
| `auto-activate` | `boolean` | `false` | Arrow keys on a focused dot also commit the slide during the focus move (mirrors neo-tabs). Without it, arrow keys are focus-only and <neo-kbd>Enter</neo-kbd> / <neo-kbd>Space</neo-kbd> commits. |
| `dots` | `boolean` | `false` | Renders the dot tablist in the host's shadow root. Position / style via `::part(dots)` and `::part(dot)`; customize per-dot inner markup with `<template data-neo-carousel-dot>`. |
| `slide-label` | `string`, observed | `"Go to slide {n}"` | Accessible name of each dot. `{n}` stands for the slide number. |
| `step` | `number` |  | Slides advanced per prev / next / arrow press. Defaults to `per-view` so each press exposes a whole new visible group; set to 1 (or any N) for finer stepping. |

### Slots

| Name | Description |
| --- | --- |
| default | Track, slides, and optional navigation controls. |
| `<template data-neo-carousel-dot>` | Optional. Cloned into each dot button for custom inner markup; the kit still owns the button styling (focus, aria-current, `data-neo-carousel-dot-visibility`). |
| `[data-neo-carousel-prev]` | Previous-slide trigger. |
| `[data-neo-carousel-next]` | Next-slide trigger. |
| `[data-neo-carousel-pause]` | Toggles `paused`; mirrors state via `aria-pressed` and disables when autoplay is unset. |
| `[data-neo-carousel-when-playing]` | Child of `[data-neo-carousel-pause]` shown while playing (button not pressed); the kit hides it when paused. |
| `[data-neo-carousel-when-paused]` | Child of `[data-neo-carousel-pause]` shown while paused (button pressed); the kit hides it while playing. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-carousel-change` | `{ value: string, index: number }` | yes | Fires after the active slide changes. `index` is zero-based. |

### Parts

| Name | Description |
| --- | --- |
| `::part(dots)` | Dot tablist container in the shadow root. Position and lay it out from the page. |
| `::part(dot)` | Each dot button. |
| `::part(dot-partial)` | Added to a dot whose slide is partially visible. |
| `::part(dot-full)` | Added to a dot whose slide is fully visible. |
| `::part(dot-current)` | Added to the active dot. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-carousel-spacing` | `1rem` | Gap between slides. |
| `--neo-carousel-track-radius` | `var(--page-radius, 0)` | Track corner radius. |
| `--neo-carousel-focus-ring` | `var(--accent, currentColor)` | Track focus-visible outline color. |
| `--neo-carousel-dot-size` | `0.55rem` | Dot diameter. |
| `--neo-carousel-dot-gap` | `0.4rem` | Gap between dots. |
| `--neo-carousel-dot-bg` | `color-mix(in srgb, var(--page-fg) 25%, transparent)` | Inactive dot color. |
| `--neo-carousel-dot-active-bg` | `var(--accent, currentColor)` | Active dot color. |
| `--neo-carousel-dot-radius` | `999px` | Dot corner radius. |
| `--neo-carousel-slide-inactive-opacity` | `0.55` | Off-screen slide opacity under `highlight-active`. Set to 1 to disable dimming. |
| `--neo-carousel-slide-transition` | `200ms var(--neo-easing, ease-out)` | Slide opacity transition under `highlight-active`. |

## Examples

### Multiple slides per view {#multi-item}

Show more than one slide with [`per-view="N"`](#attributes-per-view). Use [`spacing`](#attributes-spacing) to set the gap.

```example carousel_multi
width: 100%
height: 14rem
min-height: max-content
```

### Intrinsic widths {#auto-width}

Use [`per-view="auto"`](#attributes-per-view) when slides should keep their own widths.

```example carousel_auto
height: 14rem
min-height: max-content
```

### Card deck

Card slides with center snap, mouse drag, click navigation, and visible-slide highlighting.

```example carousel_cards
width: 100%
min-height: max-content
class: card-deck-example
```

### Custom navigation styling {#custom-dots}

Dots live in the host's shadow root. Reach them from the page via [`::part(dots)`](#parts-dots) (the tablist container) and [`::part(dot)`](#parts-dot) (each button); the kit also mirrors state into named parts ([`::part(dot-partial)`](#parts-dot-partial), [`::part(dot-full)`](#parts-dot-full), [`::part(dot-current)`](#parts-dot-current)) so you can style the 3 visibility states and the active dot. Here a scoped `<style>` block turns the buttons into bars.

```example carousel_custom_dots
width: 100%
height: 14rem
```

### Autoplay + loop {#autoplay}

Set [`autoplay="3000"`](#attributes-autoplay) to advance on a timer. Add [`loop`](#attributes-loop) and an optional pause button.

```example carousel_autoplay
height: 14rem
```

### Custom easing {#easing}

Use [`easing`](#attributes-easing) to customize programmatic scrolls. Durations can also reuse the theme easing.

```example carousel_easing
width: 100%
height: 14rem
```

### Vertical

Set [`orientation="vertical"`](#attributes-orientation) to get a y-axis carousel. Give the host a height.

```example carousel_vertical
width: 18rem
height: 14rem
```

### No touch {#touch}

Use [`touch="false"`](#attributes-touch) when gestures should belong to slide content. Buttons and keyboard still work.

```example carousel_no_touch
width: 100%
height: 12rem
```

### 100 slides {#many-slides}

For large slide sets, skip dots and use buttons, wheel, or touch navigation.

```example carousel_many_slides
width: 100%
height: 14rem
```
