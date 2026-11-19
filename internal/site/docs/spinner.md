# Spinner

Component `<neo-spinner>` is a circular loading indicator with 2 modes. **Indeterminate** rotates a partial ring during work of unknown duration; **determinate** draws an arc filled to `(value - min) / (max - min)`, the round counterpart of `<neo-progress>`. Sized off [`--neo-spinner-size`](#css-variables-neo-spinner-size) (defaults to `1em`) and inherits `currentColor`. The ring lives in an open shadow root; customize its `ring`, `track`, `arc`, and `sun` parts with `::part()`.

```playground
- spinner_playground_default: Default
- spinner_default: Indeterminate
- spinner_determinate: Determinate (progress ring)
- spinner_labeled: Labelled, with value tooltip
- spinner_sizes: Sizes
- spinner_color: Inherits parent color
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number`, reflected, observed |  | When present (and without `indeterminate`), the ring is determinate. Clamped to `[min, max]`. |
| `min` | `number`, observed | `0` | Lower bound of the determinate range. |
| `max` | `number`, observed | `100` | Upper bound of the determinate range. |
| `indeterminate` | `boolean`, observed | `false` | Force the spinning mode even when a `value` is set. A spinner with neither `value` nor this attribute is indeterminate by default. |
| `label` | `string`, observed |  | Accessible name. When set (or in determinate mode) the host reports `role="progressbar"` with the matching `aria-value*`; a bare unlabelled indeterminate spinner stays decorative. |
| `easing` | `string`, observed |  | Animate the arc between value commits. Same shorthand as [`<neo-progress>`](progress.md)'s `easing`. A bare duration (`200ms`) pairs with `--neo-easing`; a full value is used verbatim. Suppressed under reduced motion. |

### Parts

| Name | Description |
| --- | --- |
| `::part(ring)` | The SVG element holding the track and arc. |
| `::part(track)` | Faint full-circle backing ring. |
| `::part(arc)` | The currentColor stroke that spins or fills to the value. |
| `::part(sun)` | 8-ray starburst shown under reduced motion. Pulses its opacity in indeterminate mode. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-spinner-size` | `1em` | Outer diameter. |
| `--neo-spinner-duration` | `0.8s` | Rotation period in indeterminate mode. |
| `--neo-spinner-ring-width` | `3` | Stroke width in the 24-unit viewBox. |
| `--neo-spinner-track-color` | `color-mix(in srgb, currentColor 20%, transparent)` | Backing-ring color. |
| `--neo-spinner-arc-transition` | `0s linear` | Transition applied to the arc between value commits in determinate mode. |

## Examples

### Indeterminate

A bare `<neo-spinner>` with no [`value`](#attributes-value) stays decorative and CSS-driven; pair it with adjacent status text.

```example spinner_default
min-height: max-content
```

### Determinate (progress ring) {#determinate}

A faint track with a `currentColor` arc filled by [`value`](#attributes-value). No text is drawn on the ring; the value goes to `aria-valuenow`, and a wrapping `<neo-tooltip>` can surface it visually (see below).

```example spinner_determinate
min-height: max-content
```

### Live progression {#animated-progress}

The ring is just an attribute; set [`value`](#attributes-value) from anything (SSE, a `fetch` progress callback, a timer) and the arc sweeps to it. [`easing`](#attributes-easing) tweens the arc between commits (same syntax as `<neo-progress>`); this one is wired to a 60 ms ticker.

```example spinner_animated
min-height: max-content
```

### Labelled, with value tooltip {#labelled-progressbar}

With a [`label`](#attributes-label) the host reports `role="progressbar"` with `aria-valuemin` / `aria-valuemax` / `aria-valuenow`, which makes it a real, announced progress indicator, not just a decorative glyph. `Tooltip` wraps it in a `<neo-tooltip>` so the value (with `Unit`) appears on hover or focus, never painted on the ring. Color follows `currentColor`.

```example spinner_labeled
min-height: max-content
```

### Sizes

Set the visual size with the [`--neo-spinner-size`](#css-variables-neo-spinner-size) custom property. It defaults to `1em` so a bare spinner inherits the surrounding line-height naturally; override it inline (or via a wrapper class) to get any other size without touching the markup.

```example spinner_sizes
min-height: max-content
```

### Inherits parent color

The spinner's stroke is `currentColor`. Wrapping it in any element with a `color` recolours both modes. Theme tokens like `var(--accent)` work too. The demo below shows an indeterminate spin and 3 determinate rings at 25%, 66%, 100%, each in a different parent colour.

```example spinner_color
min-height: max-content
```

Under `prefers-reduced-motion: reduce`, the indeterminate spinner swaps the rotating arc for an 8-ray *sun starburst* (the canonical lucide `loader` glyph) that slowly pulses its opacity. That keeps it visually distinct from a determinate ring sitting at ~75%, which is what the frozen 3/4 arc would look like otherwise, and shows the work is still running without rotation. An opacity change is not motion animation according to [WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html). The determinate ring keeps its fill and only drops its commit tween. Values jump rather than sweep. The kit's [`--neo-spinner-duration`](#css-variables-neo-spinner-duration) token sits on its own (not routed through the global `--neo-duration-scale`) so the spin isn't accidentally stopped when other kit motion is dialed down.

## Examples: Datastar

### Morphing during interaction

A Datastar app can fat-morph the page at any moment, switching between unknown progress and server-reported percentages. Each state re-emits only the bare host. The SVG ring lives in the component's shadow root. The morph leaves the existing arc in place. The [`easing`](#attributes-easing) transition sweeps between determinate values, while the indeterminate state switches the same arc back to its rotating animation. Autoplay cycles through all 5 states below with no signals or morph hints.

```playground
id: spinner-morph-playground
autoplay: true
- spinner_morph_indeterminate: Indetermined
- spinner_morph_0: 0%
- spinner_morph_30: 30%
- spinner_morph_70: 70%
- spinner_morph_100: 100%
```
