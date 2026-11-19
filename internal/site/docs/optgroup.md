# Optgroup

Component `<neo-optgroup>` is an option-data carrier, not a rendered or interactive element. It groups its [`<neo-option>`](option.md) children under a heading the consuming control renders above them. Place it inside a [`<neo-select>`](select.md), [`<neo-combobox>`](combobox.md), or [`<neo-datalist>`](datalist.md). The group itself renders nothing; the control owns the listbox and draws the heading.

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` |  | The group heading the control renders above the contained options. A non-selectable separator, not an option value. |

### Slots

| Name | Description |
| --- | --- |
| default | The `<neo-option>` children that belong to the group. |
