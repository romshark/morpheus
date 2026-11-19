# Datalist

Component `<neo-datalist>` is an option-data container, not a rendered or interactive element. Modeled on native `<datalist>`, it carries `<neo-option>` / `<neo-optgroup>` data that control components like [`<neo-select>`](select.md), [`<neo-combobox>`](combobox.md), or [`<neo-textinput>`](text-input.md) suggestions read. Place a datalist inside a control as its option source, or give it an [`id`](#attributes-id) and point one or more controls at it with `list="<id>"`, exactly like `<input list>`.

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string`, observed |  | Names the datalist so controls can reference it. A control opts in with `list="<id>"` (like native `<input list>`); one id can feed several controls. Omit it for an *inline* datalist placed inside a single control. An inline datalist (or a control's own authored options) always takes precedence over a referenced external one. |

### Slots

| Name | Description |
| --- | --- |
| default | `<neo-option>` and `<neo-optgroup>` option data, the same children a `<neo-select>` / `<neo-combobox>` takes. The element is not interactive; the consuming control reads this data and owns the trigger, listbox, keyboard, and selection. Patching these children re-syncs every control the datalist feeds. |

## Examples

### Shared across controls

One `<neo-datalist id="...">` supplies the same options to every control whose `list="<id>"` references it.

- A control opts in with `list` set to the datalist's [`id`](#attributes-id), just like native `<input list>`. One id can feed many controls.
- The datalist itself renders nothing; each control reads it and renders it its own way, Select and Combobox as listbox options and Text input as free-text suggestions. Selection stays per-control.
- Patching the datalist (server morph, edit) updates every control it feeds, with no per-control patch.

```example datalist_shared
height: 20rem
min-height: max-content
max-height: 20rem
```
