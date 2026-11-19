# Link

Component `<a data-neo-link>` is the kit's styled anchor, a plain native `<a>` that behaves exactly like a normal link (focus, keyboard activation, middle-click, `:visited`); the [`data-neo-link`](#attributes-data-neo-link) hook is all the kit's CSS keys on. The default variant reads as an inline prose link; the button variants make the anchor look exactly like [`<neo-button>`](button.md) so it can stand in for a button when the destination is a URL.

```playground
- link_default: Default
- link_variants: Variants & states
- link_prose: Inline in prose
- link_cta: Call to action
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `data-neo-link` | `boolean` |  | Styling hook. Marks a native `<a>` for the kit's link styling; the wrapper adds it automatically, but raw HTML must include it to opt in. |
| `href` | `string` |  | Link target. Omitted attribute renders a placeholder the browser doesn't treat as a link. |
| `variant` | `"default" \| "button-default" \| "button-primary" \| "button-secondary" \| "button-ghost" \| "button-danger"` | `"default"` | Visual style. `default` is an inline prose anchor; the rest adopt `<neo-button>` styling. |
| `target` | `string` |  | Native browsing-context target (`_blank`, `_self`, a named context). |
| `rel` | `string` |  | Space-separated link-type tokens (`noopener`, `noreferrer`, `nofollow`, ...). |
| `download` | `string` |  | Triggers a save-as instead of navigation; the value is the suggested filename. |
| `hreflang` | `string` |  | BCP-47 language tag of the linked resource. Hint only, consumed by AT and translation tools. |
| `referrerpolicy` | `string` |  | How much of the current URL is sent in the `Referer` header on follow. Empty inherits the document policy. |
| `aria-disabled` | `boolean` | `false` | `<a>` has no native `disabled`; the wrapper stamps `aria-disabled="true"` + `tabindex="-1"` so AT and keyboard nav skip it. The kit's CSS owns the visual state. |

### Slots

| Name | Description |
| --- | --- |
| default | Link content, such as text, a `<neo-icon>`, or arbitrary markup. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| [`click`](https://www.w3.org/TR/uievents/#event-type-click) |  | yes | Native anchor activation; also fires on `Enter`. |

## Examples

### Variants & states

The inline `default` anchor, the 5 button-styled variants (`button-default`, `button-primary`, `button-secondary`, `button-ghost`, `button-danger`), and the disabled state.

```example link_variants
min-height: max-content
```

### Inline in prose {#inline-prose}

The default variant is tuned to sit inside running text, with accent colour, underline, and a focus ring that doesn't disturb the line box.

```example link_prose
min-height: max-content
```

### Call to action

A button-styled link makes a navigation read as a primary action. Pair [`target="_blank"`](#attributes-target) with [`rel="noopener noreferrer"`](#attributes-rel) on external destinations to get the cross-origin tab-isolation guarantee.

```example link_cta
min-height: max-content
```
