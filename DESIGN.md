# Morpheus Design

Architectural decisions and their rationale.

Related docs:

- [README.md](README.md): motivation and component map.
- [FAQ.md](FAQ.md): frequently asked questions.
- [CLAUDE.md](CLAUDE.md): working rules for AI agents (writing, attribute, and accessibility checklists).
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution workflow.
- The docs site: per-component reference.

## Morph Safety

The server renders a full page template and morph-patches it over the live DOM. [Datastar](https://data-star.dev), the hypermedia framework the kit's docs and examples use, calls this a "fat morph", and it can arrive at any time. A morph may replace, reorder, remove, or re-insert any part of a component's markup while the custom element instance stays in place.

Requirement: a component must keep its current client state across a morph to avoid UX degradation. The server is the source of truth for content; the component is the source of truth for transient interaction state.

Every decision in this document derives from this requirement.

## Custom Elements

Components are custom elements (`<neo-*>`), driven declaratively through markup. No imperative API is exposed for normal use. Two kinds:

- **Behavioral**: JavaScript custom elements that read and reflect HTML attributes and dispatch DOM events. The rest of this document (the attribute contract, morph reconciliation, accessibility wiring) governs these.
- **CSS-only**: pure styling with no JavaScript (for example, card, badge, alert, avatar, skeleton). They carry no client state, so a morph can replace them freely and they need none of the JS reconciliation below.

Framework-agnostic: Datastar is the documented integration, but HTMX, Alpine, React, or plain JS use the same attributes and events.

Each behavioral component assumes that, at any time:

1. Light-DOM content can change (from a morph).
2. The parent bounding box can resize dynamically.
3. It is driven declaratively from a template render being patched in, not through imperative JavaScript.

## Attribute Contract

A boolean attribute is a command, not a presence flag:

| Attribute state            | Meaning                                     |
| -------------------------- | ------------------------------------------- |
| absent / removed           | no command; keep current state (or default) |
| `x="false"`                | command false                               |
| present `x`, or `x="true"` | command true                                |

Attributes fall into two categories by whether the component writes them:

- Interactive state (`open`, `checked`, `value`, `expanded`, `page`): the component sets it in response to user interaction and reflects it to the attribute, so CSS and the DOM mirror the state.
- Configuration (`flip`, `hover`, `disabled`, `loop`): the component only reads it, never writes it.

Either kind can also be driven from outside at runtime (author markup, a server morph, or a framework binding).

Attribute names are positive (`flip`, not `no-flip`), so a double negative never arises.

Disclosure state uses one attribute name, `open`, on every component that shows and hides content or a surface. `expanded` is used only where the state maps to `aria-expanded` on a `tree` or `treeitem`.

The layout axis is the `orientation` enum: `horizontal` and `vertical` on components that arrange items along it (e.g. radio-group, toggle-group, tabs, carousel), plus `grid` on those that also lay out in two dimensions (e.g. navgroup, sortable). A single-value component with no items to arrange (e.g. slider, slider-range, progress) instead takes a positive `vertical` boolean, defaulting to horizontal. Where no behavior branches on the axis, `orientation` is a display attribute, not tracked state.

Rendering context, whether a surface floats over the page or sits in flow, is a positive boolean naming the non-default pole, like `vertical` for the axis: `overlay` on a component that renders in flow by default (sidebar), `contained` on one that floats by default (lightbox, toaster). It is not a shared `scope="screen|container"` enum, because a component's default is not always one of two plain values (sidebar has no always-contained mode, only a responsive switch by width).

Rationale: a morph that re-emits markup without an attribute must not change state the server did not set. A new element uses the default; an existing element keeps its current value.

## Events

A behavioral component reports user actions and state changes through DOM events. Every event name follows one pattern: `neo-<tag>-<verb>`. The prefix is the component's own element tag in full, so `<neo-dialog>` fires `neo-dialog-open` and `<neo-resizable>` fires `neo-resizable-start`, never an abbreviated stem.

The one exception is `<neo-keys>`, a generic key-chord dispatcher with no single action to name: it fires a fixed `neo-keys` event, and you tell chords apart through the event `detail` or trigger an element directly with `for`.

Events bubble, so an ancestor can handle them by delegation. An event that must cross a shadow boundary is also composed.

Verbs mirror native DOM events where one fits, so an author who knows the DOM can predict them. Add a new verb only when the platform has none. The shared vocabulary:

- `open` / `close`: a surface is shown or removed (dialog, drawer, popover, menu, toast).
- `change`: a committed value or selection changed (tabs, pagination, select, slider).
- `input`: a live value mid-interaction, before commit, paired with `change` on controls that preview continuously (slider, rating, text input).
- `toggle`: a single event for an inline two-state disclosure, carrying the new state in its detail (tree item, revealable).
- `start` / `end`: the bounds of a continuous gesture, with an optional continuous verb between them (`move` for reordering, `resize` for sizing) (sortable, resizable, elastic).
- `navigate`: roving focus moved inside a navigation group that holds no selected value (navgroup). It is not `change`, because moving focus is not a committed selection.

An event's `detail` names the changed state after the component's own attribute, so the key a handler reads is the key it would set (`value`, `page`, `checked`, `expanded`). An event about one element also carries `item`, the element itself; an event about a set names the set (`shown` / `hidden`).

Rationale: one scheme lets an author predict an event without checking each component's reference, and stops components inventing synonyms for one action. The full-tag prefix ties every event to the element that fired it.

## Light DOM and Shadow DOM

- Component content stays in light DOM so the morph can reconcile it against the server template. Content inside a shadow root is not reachable by the morph.
- Shadow DOM holds only what the morph must not touch: live-region announcers, structural styles, internal nodes the server never renders.

A morph can replace the host or its children at any time, so:

- Initialization is idempotent; a re-insert must not initialize twice.
- The component finds the child elements it operates on by querying the live DOM when it needs them, not by holding a cached reference, because a morph can swap a child for an equivalent new node and strand the old reference.
- Attributes the component sets at runtime (role, tabindex, ARIA) get stripped by a morph and must be re-applied, idempotently.
- Morph targets carry stable ids so the morph pairs nodes correctly.

## Slots

Three mechanisms customize a component's content.

**Shadow slots.** A behavioral component with internal structure keeps that structure in its shadow root and exposes named `<slot>`s for the parts an author fills (`icon`, `title`, `description`, `action`, `trigger`, ...), plus a default slot for the primary content. Authors customize by placing light-DOM children and targeting a slot with `slot="name"`; an unfilled slot can render fallback content. Slotted content stays in light DOM, so a morph still reconciles it; only the shadow scaffolding around the slots is beyond the morph's reach.

**Template slots.** When the component generates content itself, an author supplies an inert `<template data-neo-<component>-<part>>` light-DOM child as a blueprint (the sortable drop placeholder, each carousel dot, a custom pagination control). The component clones the template's content into the nodes it creates, as many times as needed. The template renders nothing on its own; it only defines what the component stamps out.

**Async placeholder.** Server-driven content often arrives in a later morph (lazy select options, a fetched dialog body, etc.). Until it does, the component shows the loading content an author marks with `[data-neo-async-placeholder]` (a live element, or a `<template>` for content the component instantiates). With none supplied, the component falls back to a default skeleton. When the real content lands in a later morph, it replaces the placeholder.

## Styling

- Style hooks are `[data-neo-<component>-<part>]` attribute marks, not CSS classes, so they survive a morph like any other attribute.
- Theming uses CSS custom properties: `--neo-*` component tokens over `--page-*` page tokens. A theme overrides variables, not selectors.
- The text and box row controls (button, toggle, text input, textarea, select, combobox) share one `size` scale, so a small or large button, input, and select still line up in the same row. Each step derives from the page spacing unit, so a theme's density change carries through every size. Small fixed-glyph controls (checkbox, radio, switch, rating, kbd) and the 2D color field carry their own sizing.
- CSS that keys on a configuration boolean treats the explicit false form as off, not just absence.
- Components respond to forced-colors, `prefers-reduced-motion`, text scaling, and target-size requirements, and do not encode meaning in color alone.

## Layering

Three layers:

- `web/lib`: the TypeScript custom elements. All client-side behavior is here.
- `neo`: Templ wrappers that render the element markup for Go + Templ. They may run server-side render logic (conditional attributes, inlined icon SVG), but add no client-side behavior.
- `datastar`: the same wrappers, wired for Datastar + Templ.

Custom elements contain no framework-specific code. Morph hints belong to the template and page layer, not the custom elements.

## Modularity

The kit ships as a single default bundle, fine to use as-is (cached once from a CDN). Trimming it to only the components a deployment uses is an optional optimization, not a requirement. Components are not all independent: some depend on others (for example, neo-breadcrumb creates a neo-popover for its overflow menu).

- A trimmed bundle contains the chosen components plus their transitive dependencies (other components and shared internals).
- A component can be dropped only when nothing else in the bundle depends on it; cutting unused components cuts bundle size.
- A component needs no setup beyond being in the bundle the page loads: its elements activate themselves, with no per-component registration or initialization call.
- A `<neo-*>` used in markup but missing from the bundle must log a console warning naming the component, not fail silently.

## Safety

A component must surface misuse to the developer rather than fail silently.

- Incorrect usage (an unknown or unsupported attribute value, a missing required child, a deprecated pattern) logs a `console.warn` naming the component and the problem. A value a component does not support is unsupported even when another component accepts it.
- Severe abuse (a broken invariant, an unsupported or unsafe configuration) logs a `console.error`.
- These diagnostics are developer-facing: they inform, but do not throw or break the page.

## Accessibility

A custom element has no built-in semantics, so each interactive component wires them explicitly.

Required for every interactive component:

- Correct accessible role, name, value, and state.
- Follow the relevant WAI-ARIA [APG](https://www.w3.org/WAI/ARIA/apg/) pattern; do not invent roles or attributes.
- Use ARIA only for semantics, and keep ARIA state synced with visual and internal state.
- Mirror state attributes to their ARIA equivalents (for example, `checked` to `aria-checked`).
- Do not rely on CSS state alone; assistive tech reads semantics, not classes.
- Implement the full APG keyboard contract, not only `Enter`.
- Logical focus order, visible `:focus-visible`, predictable focus movement.
- No keyboard traps unless intentionally modal-like with a valid escape path.
- Interactive host: `tabindex="0"`. Disabled host: `tabindex="-1"`.
- On re-enable, restore the caller-supplied `tabindex`; do not hard-code `"0"`.
- Never blanket `outline: none` without an equivalent focus ring.
- Expose labels, descriptions, errors, loading, empty, disabled, and validation states.
- Announce meaningful dynamic changes without noisy or duplicate updates.
- Respect reduced motion, forced colors, text scaling, zoom, contrast, no color-only meaning, pointer-independent use, and touch target size.

A wrapping `<label>` does not name a custom element as it names a native `<input>`. If the host has no `aria-label` or `aria-labelledby`, derive `aria-label` from the label's text. The same applies to composites that consume a visible label.

## Declarative Control

Normal use is declarative: set attributes, nest children, listen for events. No imperative setup call is required, so the server template stays the single source of truth.

A few components expose optional public methods for special cases (for example, snapshotting layout before a known reorder morph). They are not needed for normal use.

## Component States

Loading, empty, disabled, and validation states are part of each component's defined surface. The loading state uses the async placeholder (see [Slots](#slots)).

## No Backward Compatibility Before v1.0.0

Morpheus is pre-release software. Renames, moves, and deletions are made in place, updating all call sites in the same change. Old URLs, identifier aliases, exported shims, and legacy branches are not retained. This policy will change when the kit stabilizes for public release.
