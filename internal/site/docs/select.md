# Select

Component `<neo-select>` is a single-select dropdown of [`<neo-option>`](option.md) / [`<neo-optgroup>`](optgroup.md) children, built for a short list known up front. Type a few letters to jump to a match. For long or server-side lists, or for multiple selection, use [`<neo-combobox>`](combobox.md).

```playground
height: 26rem
- select_default: Default
- select_disabled_control: Disabled control
- select_disabled: Disabled options
- select_grouped: Grouped options (time zones)
- select_clearable: Clearable with empty slot
- select_rich_options: Rich options
- select_compact_preview: Compact preview (label override)
- select_custom_trigger_face: Custom trigger face
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string`, reflected, observed |  | Selected option value. Empty clears the selection. |
| `name` | `string` |  | Form field name. The control is form-associated. With a `name` set it submits its value in a native `<form>` like a `<select>`, resets with the form, and is barred from submission while disabled. |
| `size` | `"sm" \| "lg"` |  | Control-size step: `sm` compact, `lg` large. Omit for the default size. |
| `disabled` | `boolean`, observed | `false` | Makes the control non-interactive. The trigger drops out of the tab order and ignores clicks and keys, and an open panel closes. |
| `placeholder` | `string`, observed |  | Trigger text when nothing is selected. |
| `list` | `string`, observed |  | References a shared [`<neo-datalist>`](datalist.md) by its `id` (like native `<input list>`) to source the options. Inline [`<neo-option>`](option.md) children (or an inline datalist) take precedence. |
| `async` | `boolean` | `false` | On every open, clear the listbox, re-show the `[data-neo-async-placeholder]` slot, and fire `neo-select-load` so a wired loader re-fetches. Without `async`, a select with a `[data-neo-async-placeholder]` child fires `neo-select-load` only on the first open (options empty) and caches across opens; `neo-popover-open` is independent, and always fires when the panel opens. |
| `clearable` | `boolean` | `false` | `Backspace` / `Delete` clears the selection. |
| `caret` | `string`, observed | `"chevrons-up-down"` | Name of the trigger's caret icon. Resolved through [`<neo-icon>`](icon.md) and follows the active icon theme. Set `caret=""` (empty) to hide the caret entirely. |
| `typeahead` | `true \| false` | `true` | Type-to-search over the options. With typeahead on, Space feeds the buffer; set `typeahead="false"` and Space activates the focused option instead. |
| `typeahead-timeout` | `number` | `500` | Typeahead idle reset duration in milliseconds. |
| `typeahead-match` | `"substring" \| "prefix"` | `"substring"` | How the typeahead buffer matches option labels. |
| `placement` | `string`, observed | `"bottom-start"` | Anchor placement of the panel. The listbox positions the panel with the same helper as [`<neo-popover>`](popover.md); see its placement values. |
| `screen-offset` | `string`, observed |  | Viewport edge margin and the panel's scrollable max size. |
| `follow-scroll` | `"always" \| "until-trigger-invisible"`, observed | `unset` | When absent, close on outside scroll. Set to `always` to stay anchored during scroll. Set to `until-trigger-invisible` to close once the trigger leaves the viewport. |
| `clamp-placement` | `boolean`, observed | `false` | Default is strict placement (panel anchored at the exact point, content scrolls); set this to opt into re-anchoring the panel position so it stays inside the viewport when content would overflow. |
| `min-fit-height` | `CSS length \| "content"`, observed | `"content"` | Minimum vertical slot the strict placement requires; below the threshold the panel auto-flips to the opposite primary axis when the other side has more room. `content` resolves from the panel's scroll height on each positioning pass. |
| `min-fit-width` | `CSS length \| "content"`, observed | `"content"` | Same as `min-fit-height` but for the horizontal axis. `content` resolves from the panel's scroll width. Use `0` to disable the horizontal auto-flip. |
| `min-open-height` | `CSS length`, observed | `2rem` | Minimum usable vertical slot required to remain open after placement and auto-flip. If the bounded slot is smaller, the listbox closes instead of rendering a cramped panel. Use `0` to disable. |
| `min-open-width` | `CSS length`, observed | `2rem` | Same as `min-open-height` but for horizontal space. Use `0` to disable. |
| `popover-fit-content` | `boolean` | `false` | The listbox tracks the trigger width by default; set this to size the panel to the option rows instead (e.g. a glyph-only trigger in a [`<neo-input-group>`](input-group.md)). Capped by `--neo-popover-max-width` and the viewport. |
| `hover` | `boolean` | `false` | Open the panel on trigger hover without moving focus; close after the pointer leaves both trigger and panel. Mouse only; touch falls back to click. While set, clicking the trigger always shows the panel instantly and never toggles it shut, which keeps a way in for touch and keyboard users. |
| `hover-open-delay` | `integer (ms)` | `100` | Milliseconds the pointer must rest on the trigger before `hover` opens the panel. Filters incidental cursor crossings. Does not apply to click. |
| `hover-close-delay` | `integer (ms)` | `200` | Milliseconds to wait after the pointer leaves both trigger and panel before `hover` closes the panel. Long enough to bridge the gap between them. |

### Slots

| Name | Description |
| --- | --- |
| default | [`<neo-option>`](option.md) and [`<neo-optgroup>`](optgroup.md) children. Alternatively, set `list` to source them from a shared [`<neo-datalist>`](datalist.md). |
| `[data-neo-async-placeholder]` | Custom skeleton shown while options load. Presence of this slot also marks the select as lazy-by-default. The kit shows it on opens with no options, then caches options across opens once they arrive. |
| `[slot=trigger]` | Owns the trigger face. Leave it absent and the kit fills it client-side by cloning the selected option's body (so its CSS styles it and the trigger grows to fit); provide one (e.g. patched from a server) and the kit yields, rendering exactly your content. |
| `[data-neo-option-trigger]` | Optional per-[`<neo-option>`](option.md) child holding a compact trigger face distinct from the option's rich list row. Hidden in the list; cloned into the trigger when that option is selected. Falls back to the option's `label` (plain text), then its full body. Shared with [`<neo-combobox>`](combobox.md). |
| `[data-neo-select-empty]` | The empty-state trigger face. Its body is cloned into the trigger when nothing is selected. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-select-change` | `{ value: string \| null, label: string \| null }` | yes | Fires after the selection changes. |
| `neo-select-load` | `none` | yes | Fires when options need fetching, on every open with `async` or on a lazy select's first open. Wire a loader to it (e.g. a Datastar `@post`). Call `el.reload()` to re-fire it. Distinct from `neo-popover-open`, which always fires on open. |

### Parts

| Name | Description |
| --- | --- |
| `::part(label)` | Trigger label showing the current selection. |
| `::part(caret)` | Trigger caret icon. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-select-min-width` | `12rem` | Minimum trigger width. |
| `--neo-select-list-padding` | `calc(var(--page-spacing, 0.25rem) * 1)` | Padding inside the options panel. The combobox options panel and the text input suggestions panel use it too. |
| `--neo-select-list-gap` | `var(--neo-select-list-padding)` | Gap between option rows and between option groups in the same 3 panels. |
| `--neo-select-option-radius` | `max(0px, calc(var(--neo-popover-radius) - var(--neo-popover-border-width) - var(--neo-select-list-padding)))` | Option row corner radius. The default keeps the row corners concentric with the panel's. Combobox options and text input suggestions use it too. |
| `--neo-select-option-padding` | `calc(var(--page-spacing, 0.25rem) * 1.5) calc(var(--page-spacing, 0.25rem) * 2.5)` | Option row padding. |
| `--neo-select-option-gap` | `calc(var(--page-spacing, 0.25rem) * 2)` | Gap between the items in an option row, such as an icon and its label. The select and combobox trigger labels use it too. |
| `--neo-select-option-hover-bg` | `color-mix(in srgb, var(--accent) 16%, transparent)` | Background of a hovered option row. |
| `--neo-select-option-selected-bg` | `var(--accent)` | Background of a selected option row. |
| `--neo-select-option-selected-color` | `var(--accent-fg)` | Text color of a selected option row. |

## Examples

### Disabled options

Mark an option unavailable with [`disabled`](#attributes-disabled). It renders muted, is skipped by arrow-key navigation, and can't be selected.

```example select_disabled
min-height: 24rem
```

### Disabled control

Set [`disabled`](#attributes-disabled) on the host to make the whole control non-interactive. The trigger leaves the tab order, ignores clicks and keys, and renders faded. An open panel closes. Distinct from disabling individual options.

```example select_disabled_control
min-height: 6rem
```

### Native form submission

The select is form-associated. Give it a [`name`](#attributes-name) and it submits its value in a plain `<form>`, no framework binding. Pick a plan and submit to see the posted value.

```example select_form
min-height: 20rem
```

### Grouped options (time zones)

Group related options under labeled headers by wrapping them in `<neo-optgroup label="...">`.

- The group header is not focusable; arrow keys step across groups.
- Each option's `label` gives the trigger clean text even when the option body is rich markup.

```example select_grouped
min-height: 24rem
```

### Clearable with empty slot

Let the user clear the selection back to an empty state.

- [`clearable`](#attributes-clearable) makes Backspace or Delete on the trigger drop the selection.
- Tag an empty `<neo-option value="">` with [`[data-neo-select-empty]`](#slots-data-neo-select-empty) to serve as both a selectable "none" row and the trigger face shown once cleared.

```example select_clearable
min-height: 24rem
```

### Rich options {#rich-options-avatars}

Options carry multi-line bodies (avatar, name, title). With no `label` override, the trigger clones the selected option's body to match the listbox row.

```example select_rich_options
min-height: 24rem
```

### Compact preview (label override)

Show a compact label on the trigger while the list keeps the rich card. Set each option's `label` and the trigger uses it instead of cloning the body.

```example select_compact_preview
min-height: 24rem
```

### Custom trigger face

Show a compact custom face on the trigger, distinct from the option's full list row.

- A [`[data-neo-option-trigger]`](#slots-data-neo-option-trigger) child is cloned onto the trigger when its option is selected; the list keeps the full card.
- It sits between a plain-text `label` and cloning the whole body, and works the same on `<neo-combobox>`.

```example select_custom_trigger_face
min-height: 24rem
```

### Long list

A long option list fits between the trigger and the viewport edge and scrolls inside the popover.

- Strict placement (the default) keeps the panel anchored and scrolls its content.
- Set [`clamp-placement`](#attributes-clamp-placement) to re-anchor the panel's position so it fits instead.

```example select_long_list
min-height: 24rem
boundary: dismiss
```

### Auto-flip threshold

Strict placement flips the panel to the opposite side when its preferred side is too short.

- If the slot is shorter than [`min-fit-height`](#attributes-min-fit-height) (default `content`) and the opposite side has more room, the listbox flips there.
- Here [`min-fit-height`](#attributes-min-fit-height) is `8rem`. When the trigger sits low in the viewport the listbox flips from `bottom-start` to `top-start`. Scroll it down to see it.

```example select_auto_flip
boundary: dismiss
```

## Examples: Datastar

### Morphing during interaction

A Datastar fat-morph can replace the option list while the user is interacting; the select reconciles in place.

- Options can appear, disappear, or flip to [`disabled`](#attributes-disabled) with the popover open.
- The element stays mounted, the popover stays open, and the selection survives. Autoplay cycles the states below to simulate the morphs.

```playground
id: select-morph-playground
autoplay: true
height: 26rem
- select_morph_default: Default
- select_morph_more: Add more options
- select_morph_disabled: Disable some options
```

### Async load

Fetch options from the server on every open with [`async`](#attributes-async).

- Each open fires [`neo-select-load`](#events-neo-select-load); wire `data-on:neo-select-load` to post.
- The server morphs an options fragment into `#<host-id>-options`; the [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder) shows until it arrives.
- With [`clearable`](#attributes-clearable), Backspace clears the selection and the next open reloads.
- Flip `server unreachable` or a 4xx/5xx `server response status` to see the placeholder stay put when the request never lands.

```example select_async_spinner
min-height: 24rem
script: sim/select/async-spinner.js
simulator: errors
```

### Lazy load

Fetch options once, on first open, then reuse them.

- Add a [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder) without [`async`](#attributes-async). The first open fires [`neo-select-load`](#events-neo-select-load).
- Loaded options are cached; later opens reuse them with no refetch. The option state is the only source of truth, with no guard signal needed.
- A server reset that re-emits the placeholder puts the select back into the "needs load" state.

```example select_lazy
min-height: 24rem
script: sim/select/lazy.js
simulator: delay
```

### Async load with failure swap

Async load that shows a failure state and a retry button when the request keeps failing.

- On a failed request Datastar retries per its retry config; after retries are exhausted, a failure template replaces the [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder).
- A `[data-neo-popover-async-retry]` button re-runs the load without closing the panel.
- The placeholder stays the source. Reopening shows the loading view again.

```example select_async_failure
min-height: 24rem
simulator: errors
tabs: templ css
```

<template id="demo-assignee-select-alt-options-template">
<neo-datalist id="demo-assignee-select-alt-options"><neo-option value="jane">Jane Doe</neo-option><neo-option value="arturo">Arturo Reyes</neo-option><neo-option value="priya">Priya Shah</neo-option><neo-option value="kenji">Kenji Nakamura</neo-option><neo-option value="lena">Lena Voss</neo-option><neo-option value="omar">Omar El-Hassan</neo-option><neo-option value="yuki">Yuki Tanaka</neo-option></neo-datalist>
</template>

<template id="selectAsyncDemo-options-template">
<neo-datalist id="selectAsyncDemo-options"><neo-option value="jane">Jane Doe</neo-option><neo-option value="arturo">Arturo Reyes</neo-option><neo-option value="priya">Priya Shah</neo-option><neo-option value="kenji">Kenji Nakamura</neo-option><neo-option value="lena">Lena Voss</neo-option><neo-option value="omar">Omar El-Hassan</neo-option><neo-option value="yuki">Yuki Tanaka</neo-option></neo-datalist>
</template>

<script type="module" src="/static/sim/select/asyncload.js"></script>
