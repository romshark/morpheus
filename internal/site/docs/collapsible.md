# Collapsible

Component `<neo-collapsible>` is a summary button that shows and hides the content below it. Elements that share a [`name`](#attributes-name) form a group, in which opening 1 closes the others. Unlike a native `<details>`, it preserves its state when morph-patched (stays open if it was opened) and can optionally be server-controlled through the [`open`](#attributes-open) attribute.

```playground
- collapsible_default: Default
- collapsible_accordion: Accordion
- collapsible_read_more: Read more
- collapsible_animated_trigger: Animated trigger
- collapsible_customized: Customized
- collapsible_sidebar: Sidebar
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean`, reflected, observed | `false` | Shows the content. |
| `name` | `string` |  | Group name. Opening the element closes the others with the same `name` in the document or shadow root. If several are rendered open, the last one stays open, and the console logs a warning. |

### Slots

| Name | Description |
| --- | --- |
| `summary` | Label of the summary button. Takes text and inline elements without links or controls, as a `<button>` does. |
| `summary-open` | Label of the summary button while open, in place of [`summary`](#slots-summary). Optional. |
| default | The content the element shows and hides. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-collapsible-toggle` | `{ open: boolean, item: HTMLElement }` | yes | Fires when a click, a key, find-in-page or the opening of a group member changes the state. A change of [`open`](#attributes-open) on the element doesn't fire it. |

### Parts

| Name | Description |
| --- | --- |
| `::part(summary)` | The button that holds the label and the icon. |
| `::part(icon)` | The chevron, turned 180deg while open. |
| `::part(panel)` | Box of the content, which animates its height. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-collapsible-duration` | `200ms` | Duration of the open and close transition, multiplied by `--neo-duration-scale`. |
| `--neo-collapsible-summary-padding` | `calc(var(--page-spacing) * 2) 0` | Padding of the summary button. |
| `--neo-collapsible-gap` | `calc(var(--page-spacing) * 2)` | Space between the label and the icon. |
| `--neo-collapsible-icon-size` | `1em` | Width and height of the icon. |
| `--neo-collapsible-icon-color` | `var(--muted)` | Color of the icon. |
| `--neo-collapsible-focus-ring` | `var(--focus-ring, var(--accent))` | Color of the summary focus outline. |

### Interaction

- A click on the summary, or <neo-kbd>Enter</neo-kbd> or <neo-kbd>Space</neo-kbd> on it, opens or closes the content.
- Closed content is out of the tab order and hidden from assistive tech. Closing moves focus from the content to the summary.
- Find-in-page matches closed content and opens the element, in browsers that support `hidden="until-found"`.
- Content that changes size while open resizes at once. Wrap it in [`<neo-elastic>`](elastic.md) to animate the change.
- With reduced motion, the content opens and closes without a transition.

## Examples

### Accordion

The 3 elements share [`name="shipping-faq"`](#attributes-name), and opening 1 closes the open one. The kit has no separate accordion component, because [`name`](#attributes-name) already gives this behavior.

```example collapsible_accordion
min-height: max-content
```

### Read more

Only the hidden text is in the element, and the preview stays outside. `flex-direction: column-reverse` on the element puts the panel above the summary, which keeps the button under the text it shows. The [`summary-open`](#slots-summary-open) slot holds the label while open, and `width: fit-content` on [`::part(summary)`](#parts-summary) keeps the chevron next to the label.

```example collapsible_read_more
min-height: max-content
```

### Animated trigger

Same structure as Read more, but the summary holds both labels, stacked in a grid. [`[open]:not([open="false"])`](#attributes-open) selectors move 1 out and the other in while the color fades from the link color to the muted color. The [`summary-open`](#slots-summary-open) slot can't do this, because it swaps the label without a transition. Open the element to see it.

```example collapsible_animated_trigger
min-height: max-content
```

### Customized

[`::part(summary)`](#parts-summary) puts the icon before the label, and [`::part(icon)`](#parts-icon) points the chevron at the label while closed. [Custom properties](#css-variables) slow the transition and set the padding and the icon color.

```example collapsible_customized
min-height: max-content
```

### Sidebar

Each nav section is a collapsible without a [`name`](#attributes-name), which lets several stay open. Buttons in a closed section are out of the tab order. [`::part(summary)`](#parts-summary) styles the summary as a section heading.

```example collapsible_sidebar
min-height: max-content
```

## Examples: Datastar

### Morphing the state and the content {#morphing-state-and-content}

Each state is a server render that a morph applies. The second state sets [`open="true"`](#attributes-open), which opens the element. The third keeps it and swaps the content for an alert, and the element stays open while the morph replaces the content. A [`<neo-elastic>`](elastic.md) around the content animates the height change.

```playground
id: collapsible-morph-playground
- collapsible_morph_1: Closed
- collapsible_morph_2: Opened
- collapsible_morph_3: Shipped
```
