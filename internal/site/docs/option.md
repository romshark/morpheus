# Option

Component `<neo-option>` is an option-data carrier, not a rendered or interactive element. It holds a single selectable value and its label for a control to read and render. Place it inside a [`<neo-select>`](select.md), [`<neo-combobox>`](combobox.md), [`<neo-datalist>`](datalist.md), or [`<neo-textinput>`](text-input.md) suggestion list. The consuming control owns the trigger, listbox, keyboard, and selection; the option renders nothing on its own.

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` |  | The value the control reports as selected when this option is chosen. Falls back to `data-neo-value`, then to an empty string. An option with `value=""` serves as a clear or placeholder entry. |
| `label` | `string` |  | The option's plain-text label, used for type-to-search matching and as the trigger face when set (otherwise the control clones the option's body onto the trigger). Defaults to the content's trimmed text; set it when the body is rich markup or the searchable text should differ from the visible row. |
| `disabled` | `boolean` |  | Marks the option non-selectable and skips it during keyboard navigation. When the attribute is absent, `aria-disabled="true"` is honored the same way. An explicit `disabled="false"` takes precedence and re-enables the option. |

### Slots

| Name | Description |
| --- | --- |
| default | The option's rendered content, any markup from plain text to a rich multi-line row (avatar, name, detail). The control shows it as the listbox row and, by default, clones it onto the trigger when the option is selected. When the `label` attribute is absent, the plain-text label used for type-to-search falls back to this content's text. |
