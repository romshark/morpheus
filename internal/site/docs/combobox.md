# Combobox

Component `<neo-combobox>` is a dropdown with a search field, built for long lists and for options the server generates on demand. It filters loaded options as you type, or, with [`live-search`](#attributes-live-search), asks the server for matches on each keystroke. For a short list known up front, use [`<neo-select>`](select.md).

```playground
height: 26rem
- combobox_default: Default
- combobox_disabled_control: Disabled control
- combobox_grouped: Grouped options
- combobox_multiple: Multiple selection
- combobox_rich_options: Rich options
- combobox_custom_trigger_face: Custom trigger face
- combobox_multi_face: Multi-select chips
- combobox_open_above: Open above
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string`, reflected, observed |  | Selected value(s); comma-separated when `multiple` is set. In `multiple` mode an option value must not contain a comma; the separator is unescaped. |
| `name` | `string`, observed |  | Form field name. The control is form-associated. With a `name` set it submits its value in a native `<form>`, resets with the form, and is barred from submission while disabled. With `multiple` it submits one entry per selected value under the same name, like `<select multiple>`. |
| `size` | `"sm" \| "lg"` |  | Control-size step, `sm` compact or `lg` large. Omit for the default size. |
| `disabled` | `boolean`, observed | `false` | Makes the control non-interactive. The trigger drops out of the tab order and ignores clicks and keys, and an open panel closes. |
| `placeholder` | `string`, observed |  | Trigger text when nothing is selected. |
| `list` | `string`, observed |  | References a shared [`<neo-datalist>`](datalist.md) by its `id` (like native `<input list>`) to source the options. Inline `<neo-option>` children (or an inline datalist) take precedence. |
| `search-placeholder` | `string`, observed | `"Search…"` | Hint shown in the search input. |
| `search-label` | `string`, observed | `"Search"` | Accessible name of the search input. With an `aria-label` on the host, the default is that label followed by ": search". |
| `multiple` | `boolean`, observed | `false` | Allow multi-selection; `value` becomes a comma-separated list. |
| `clearable` | `boolean` | `false` | `Backspace` / `Delete` on the focused (closed) trigger clears the selection back to the empty state. |
| `caret` | `string`, observed | `"chevrons-up-down"` | Name of the trigger's caret icon. Resolved through `<neo-icon>` and follows the active icon theme. Set `caret=""` (empty) to hide the caret entirely. |
| `async` | `boolean` | `false` | On every open, clear the listbox, re-show the `[data-neo-async-placeholder]` slot, and fire `neo-combobox-load` so a wired loader re-fetches. Without `async`, a combobox with a `[data-neo-async-placeholder]` child fires `neo-combobox-load` only on the first open (options empty) and caches across opens; `neo-popover-open` is independent; it always fires when the panel opens. |
| `live-search` | `boolean` | `false` | Reload options on every keystroke. |
| `search-debounce` | `number` | `0` | Milliseconds to coalesce keystrokes before running the local filter / live-search loading reset and dispatching `neo-combobox-search`. `0` dispatches on every keystroke. |
| `placement` | `string`, observed | `"bottom-start"` | Anchor placement of the panel. The listbox positions the panel with the same helper as [`<neo-popover>`](popover.md); see its placement values. |
| `screen-offset` | `string`, observed |  | Viewport edge margin and the panel's scrollable max size. |
| `follow-scroll` | `"always" \| "until-trigger-invisible"`, observed | `unset` | When absent, close on outside scroll. Set to `always` to stay anchored during scroll. Set to `until-trigger-invisible` to close once the trigger leaves the viewport. |
| `clamp-placement` | `boolean`, observed | `false` | Default is strict placement (panel anchored at the exact point, content scrolls); set this to opt into re-anchoring the panel position so it stays inside the viewport when content would overflow. |
| `min-fit-height` | `CSS length \| "content"`, observed | `"content"` | Minimum vertical slot the strict placement requires; below the threshold the panel auto-flips to the opposite primary axis when the other side has more room. `content` resolves from the panel's scroll height on each positioning pass. |
| `min-fit-width` | `CSS length \| "content"`, observed | `"content"` | Same as `min-fit-height` but for the horizontal axis. `content` resolves from the panel's scroll width. Use `0` to disable the horizontal auto-flip. |
| `min-open-height` | `CSS length`, observed | `2rem` | Minimum usable vertical slot required to remain open after placement and auto-flip. If the bounded slot is smaller, the listbox closes instead of rendering a cramped panel. Use `0` to disable. |
| `min-open-width` | `CSS length`, observed | `2rem` | Same as `min-open-height` but for horizontal space. Use `0` to disable. |
| `popover-fit-content` | `boolean` | `false` | The listbox tracks the trigger width by default; set this to size the panel to the option rows instead. Capped by `--neo-popover-max-width` and the viewport. |
| `hover` | `boolean` | `false` | Open the panel on trigger hover without moving focus; close after the pointer leaves both trigger and panel. Mouse only; touch falls back to click. While set, clicking the trigger always shows the panel instantly and never toggles it shut, so that touch and keyboard users keep a way in. |
| `hover-open-delay` | `integer (ms)` | `100` | Milliseconds the pointer must rest on the trigger before `hover` opens the panel. Filters incidental cursor crossings. Does not apply to click. |
| `hover-close-delay` | `integer (ms)` | `200` | Milliseconds to wait after the pointer leaves both trigger and panel before `hover` closes the panel. Long enough to bridge the gap between them. |

### Slots

| Name | Description |
| --- | --- |
| default | `<neo-option>` and `<neo-optgroup>` children. Alternatively, set `list` to source them from a shared [`<neo-datalist>`](datalist.md). |
| `[data-neo-async-placeholder]` | Shown in the listbox whenever there are no options. The kit clones the slot under the search field; when the slot is absent, a default `<neo-spinner>` stands in. |
| `[slot=trigger]` | Owns the trigger face. Leave it absent and the kit fills it client-side by cloning the selected option's body (so its CSS styles it and the trigger grows to fit); provide one (e.g. patched from a server) and the kit yields, rendering exactly your content. |
| `[data-neo-option-trigger]` | Optional per-`<neo-option>` child with a compact trigger face distinct from the option's rich list row. Hidden in the list; cloned into the trigger when that option is selected. Falls back to the option's `label` (plain text), then its full body. Shared with `<neo-select>`. |
| `[data-neo-combobox-empty]` | The empty-state trigger face, cloned into the trigger when nothing is selected. Hidden in the list. |
| `[data-neo-empty-results]` | Overrides the default *No results* hint when the listbox ends up empty after filtering or after an external load returned no options. Any `[data-neo-empty-query]` descendants get their `textContent` set to the current search input each time the slot is mounted, which lets authors render messages like `No results for "<span data-neo-empty-query></span>"`. A response can also ship one inline as an option-list child. |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-combobox-change` | `{ value, label } or { values, labels }` | yes | Fires after the selection changes. Multiple-mode payload uses array fields. |
| `neo-combobox-search` | `{ query: string }` | yes | Fires on every search-input change; `detail.query` carries the current text. For server-driven live search, copy it into a signal in the handler (the element binds no framework attribute itself). |
| `neo-combobox-load` | `none` | yes | Fires when options need fetching (every open with `async`, or a lazy combobox's first open). Wire a loader to it (e.g. a Datastar `@post`). Call `el.reload()` to re-fire it. Distinct from `neo-popover-open`, which always fires on open. |

### Parts

| Name | Description |
| --- | --- |
| `::part(label)` | Trigger label showing the current selection. |
| `::part(caret)` | Trigger caret icon. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-combobox-min-width` | `var(--neo-select-min-width, 12rem)` | Minimum trigger width. |
| `--neo-combobox-search-padding` | `calc(var(--page-spacing, 0.25rem) * 2) calc(var(--page-spacing, 0.25rem) * 3)` | Padding around the search field. |
| `--neo-combobox-search-divider` | `color-mix(in srgb, currentColor 12%, transparent)` | Divider color between the search field and the options list. |
| `--neo-combobox-search-divider-width` | `1px` | Divider width between the search field and the options list. |

## Examples

### Disabled control

Set [`disabled`](#attributes-disabled) on the host to make the whole control non-interactive. The trigger leaves the tab order, ignores clicks and keys, and renders faded. An open panel closes. Distinct from disabling individual options.

```example combobox_disabled_control
width: 20rem
min-height: 6rem
```

### Native form submission

The combobox is form-associated. Give it a [`name`](#attributes-name) and it submits in a plain `<form>`, no framework binding. In [`multiple`](#attributes-multiple) mode it posts one entry per selected value under the same name, like `<select multiple>`. Submit to see the posted values.

```example combobox_form
width: 20rem
min-height: 26rem
```

### Grouped options

Group related options under labeled headers by wrapping them in `<neo-optgroup label="...">`.

- The group header is not focusable; arrow keys step across groups.
- Each option's `label` keeps the trigger and search clean text, even when the option body is rich markup.
- Searching hides a whole group once all its options drop out. Type *tokyo* to watch the others collapse.

```example combobox_grouped
width: 20rem
min-height: 26rem
```

### Multiple selection

Pick several options at once with [`multiple`](#attributes-multiple).

- Clicking an option toggles it and keeps the popover open; single-select replaces and closes.
- [`value`](#attributes-value) is a comma-separated list and [`neo-combobox-change`](#events-neo-combobox-change) carries `{values, labels}`.
- A [`[data-neo-empty-results]`](#slots-data-neo-empty-results) child replaces the no-match row; `[data-neo-empty-query]` inside it echoes the typed text. Type *xyz* to see it.

```example combobox_multiple
width: 20rem
min-height: 26rem
class: demo-combobox-stretch
```

### Rich options {#rich-options-avatars}

Options carry rich multi-line bodies (avatar, name, title) that also render in the trigger.

- The selected option's body is cloned into the trigger, which grows to fit it.
- Search matches each option's `label` or text.
- [`[data-neo-combobox-empty]`](#slots-data-neo-combobox-empty) is the face shown when nothing is selected; [`clearable`](#attributes-clearable) lets Backspace or Delete on the trigger clear the selection.
- A server can swap the trigger face by patching a `slot="trigger"` child.

```example combobox_rich_options
min-height: 26rem
```

### Custom trigger face

Show a compact face on the trigger, separate from the full row in the list.

- A [`[data-neo-option-trigger]`](#slots-data-neo-option-trigger) child is cloned onto the trigger; the rest of the option stays the list row.
- [`[data-neo-combobox-empty]`](#slots-data-neo-combobox-empty) is the empty face. Press Backspace on the trigger to clear and show it.

```example combobox_custom_trigger_face
min-height: 26rem
```

### Multi-select chips

[`multiple`](#attributes-multiple) with per-option faces. Each pick becomes a chip on the trigger.

- A chip uses the option's [`[data-neo-option-trigger]`](#slots-data-neo-option-trigger) face, or falls back to its text.
- Chips wrap and the trigger grows. Drag the stage narrower to watch them reflow.

```example combobox_multi_face
width: 34rem
min-height: 26rem
min-width: 16rem
class: demo-combobox-stretch
```

### Open above

Open the panel above the trigger with [`placement="top-start"`](#attributes-placement).

- The search input stays pinned next to the trigger (bottom of the panel), even as placement flips.
- ArrowUp moves to the nearest option (last in the DOM); ArrowDown wraps to the first.

```example combobox_open_above
min-height: 26rem
style: align-items: flex-end;
```

## Examples: Datastar

### Morphing during interaction

A Datastar fat-morph can replace the option list while the user is interacting; the combobox reconciles in place.

- Options can appear, disappear, or flip to [`disabled`](#attributes-disabled) with the popover open.
- The element stays mounted, the popover stays open, and the selection survives. Autoplay cycles the states below to simulate the morphs.

```playground
id: combobox-morph-playground
autoplay: true
height: 26rem
- combobox_morph_default: Default
- combobox_morph_more: Add more options
- combobox_morph_disabled: Disable some options
```

### Async load

Fetch options from the server on every open with [`async`](#attributes-async).

- Each open fires [`neo-combobox-load`](#events-neo-combobox-load); wire `data-on:neo-combobox-load` to post.
- The server morphs an options fragment into `#<host-id>-options`.
- [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder) fills the listbox until options arrive; the search field stays usable.

```example combobox_async
min-height: 26rem
script: sim/combobox/async-load.js
simulator: delay
```

### Lazy load

Fetch options once, on first open, then reuse them.

- Add a [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder) without [`async`](#attributes-async). The first open then fires [`neo-combobox-load`](#events-neo-combobox-load).
- Loaded options are cached; later opens reuse them with no refetch.

```example combobox_lazy
min-height: 26rem
script: sim/combobox/lazy-once.js
simulator: delay
```

### Live search (server-driven)

Let the server filter on every keystroke instead of matching locally, with [`live-search`](#attributes-live-search).

- Each keystroke re-shows the placeholder and refetches; wire `data-on:neo-combobox-search` to re-post.
- The event's `event.detail.query` holds the typed text; copy it into a signal the server reads.
- The server returns the matching options, or a [`[data-neo-empty-results]`](#slots-data-neo-empty-results) child when nothing matches.

```example combobox_live_search
min-height: 26rem
script: sim/combobox/search.js
```

### Async load with failure swap

Async load that shows a failure state and a retry button when the request keeps failing.

- On a failed request Datastar retries per its retry config; after retries are exhausted, a failure template replaces the [`[data-neo-async-placeholder]`](#slots-data-neo-async-placeholder).
- A `[data-neo-popover-async-retry]` button re-runs the load without closing the panel.
- Because the placeholder stays the source, reopening shows the loading view again.

```example combobox_async_failure
min-height: 26rem
script: sim/combobox/asyncload.js
simulator: errors
tabs: templ css script
```
