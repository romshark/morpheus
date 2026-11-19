# Kbd

Component `<neo-kbd>` is a small inline keyboard-key indicator, a monospaced glyph in a subtle chip with a thin border and a 1px inset bottom shadow that suggests depth. Sized off the surrounding font so it nests cleanly inside button labels, trailing input slots, and prose. Compose multi-key shortcuts with `<neo-kbd-group>`, an inline-flex container with a small gap.

```playground
- kbd_default: Default
- kbd_aliases: Aliases
- kbd_variants: Variants and sizes
- kbd_combinations: Combinations
- kbd_inside_buttons: Inside buttons
- kbd_input_group: Inside an input group
- kbd_shortcut_table: Shortcut reference
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `key` | `string`, observed |  | Render the platform-correct glyph for a single key instead of slotted content (`mod` renders ⌘ on Apple, Ctrl elsewhere; `enter` renders ↩ / Enter). One key per chip; compose a shortcut from several in a `<neo-kbd-group>`; bind it with [`<neo-keys>`](keys.md). |
| `variant` | `"outline"` |  | Visual style. Omit for the default subtle chip. |
| `size` | `"sm"` |  | Compact size for dense rows. Omit for the default size. |

### Slots

| Name | Description |
| --- | --- |
| default | Glyph or short word. Ignored when `key` is set. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-kbd-padding-y` | `0.125rem` | Vertical padding. |
| `--neo-kbd-padding-x` | `0.4rem` | Horizontal padding. |
| `--neo-kbd-radius` | `0.3rem` | Corner radius. |
| `--neo-kbd-font-size` | `0.7em` | Glyph font size, relative to surrounding text. |
| `--neo-kbd-font-weight` | `500` | Glyph font weight. |
| `--neo-kbd-min-width` | `1.5em` | Minimum chip width that keeps single glyphs square. |
| `--neo-kbd-color` | `color-mix(in srgb, currentColor 70%, transparent)` | Glyph color. Derived from `currentColor` so a chip stays legible in a colored container. |
| `--neo-kbd-bg` | `color-mix(in srgb, currentColor 5%, transparent)` | Chip background. |
| `--neo-kbd-border-color` | `color-mix(in srgb, currentColor 18%, transparent)` | Border color. |
| `--neo-kbd-shadow` | `inset 0 -1px 0 0 color-mix(in srgb, currentColor 14%, transparent)` | Inset bottom shadow suggesting key depth. |

## Examples

### Platform-aware shortcuts

Pass a [`key`](#attributes-key) token instead of literal content and the chip renders the right glyph per OS.

A `<neo-kbd>` is one key; compose a shortcut from several inside a `<neo-kbd-group>`.

The glyph fills in after the bundle loads (you may see a brief flash on this static site). In a templ server, pass `KbdOpts.UserAgent` (`r.UserAgent()`) to pre-render it for the requesting OS; the client then reconciles.

```example kbd_platform_keys
min-height: max-content
```

### Aliases

[`key`](#attributes-key) accepts convenience aliases (`esc`, `space`, `up`/`down`/`left`/`right`, `del`, `plus`, `comma`) that resolve to the canonical glyph (`esc` renders ⎋ / Esc).

```example kbd_aliases
min-height: max-content
```

### Variants and sizes

[`variant="outline"`](#attributes-variant) drops the fill and shadow for a flatter look; [`size="sm"`](#attributes-size) is a compact variant for dense rows like menu items or table cells.

```example kbd_variants
min-height: max-content
```

### Combinations

Compose multi-key combinations with `<neo-kbd-group>`. The first row relies on the gap alone; the second slips literal "+" text between keys.

```example kbd_combinations
min-height: max-content
```

### Inside buttons

The kbd inherits the host font size and aligns to baseline. It drops in next to a button label with no extra wrapper.

```example kbd_inside_buttons
min-height: max-content
```

### Inside an input group

Paired with `<neo-input-group>` the kbd makes a clean trailing shortcut hint, the command-palette pattern most editors use for global search.

```example kbd_input_group
min-height: max-content
```

### Shortcut reference

Each row pairs an action label with its shortcut; the kbd's monospaced font and consistent min-width keep the column aligned with no extra layout code.

```example kbd_shortcut_table
min-height: max-content
```

The kbd sits on the text baseline and does not push surrounding lines apart, which suits shortcuts described in flowing copy. Press <neo-kbd size="sm">Esc</neo-kbd> to dismiss, or <neo-kbd-group><neo-kbd size="sm">⌘</neo-kbd><neo-kbd size="sm">/</neo-kbd></neo-kbd-group> to focus this page's search.
