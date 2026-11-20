---
name: neo-component
description: Use when creating or editing the custom-element TypeScript sources under `web/lib`.
paths:
  - "web/lib/**/*.ts"
  - "web/lib/*.ts"
---

These files implement the custom elements and follow the design rules in [DESIGN.md](../../../DESIGN.md). This skill covers how to meet those rules in TypeScript.

## Reading and reflecting attributes

Read booleans with `boolCommand` or `boolAttr`. A bare `hasAttribute` can't tell `x="false"` from a missing attribute.

Keep interactive state such as `open` in an internal field, and reflect it to the attribute through a guarded writer. The guard keeps the component from reading its own write back as a command.

## Attribute ownership

Each attribute on a server-rendered element has a single owner. A morph keeps what the server template renders and strips everything else.

- **Server**: `id`, `class`, `style`, `slot`, configuration, `[data-neo-*]` part marks, and any accessible name the author writes. The component only reads these.
- **Server and component**: interactive state. The server sends it as a command, and the component reflects it.
- **Component**: `role`, `tabindex`, `aria-roledescription`, ARIA state and references, and a derived `aria-label`. The component re-applies these on every sync and after a morph, and writes a default like `role` only where the server rendered none.
- **No attribute**: state the component works out at runtime, like a drag in progress, is a custom state (`:state(dragging)`), never an attribute.

Nodes the component generates, and everything in its shadow root, are its own, `id` and `style` included. Prefix a generated `id` with `neo-<tag>-`.

### `id`

Never write `id` on a server-rendered element. A morph pairs elements by `id`, and a changed one makes it replace the element and lose its state. On a generated or shadow node, suppress the `no-id-write` lint rule and name the node in the reason.

### References between elements

Link `aria-controls`, `aria-labelledby`, `aria-describedby` and `aria-activedescendant` with `setAriaRef`, and treat them as managed attributes. A target with an `id` gets an IDREF. A target without one gets ARIA element reflection, never a generated `id`.

A reference can't point into a shadow root from outside it. Point at the slotted light-DOM content instead, or leave the reference out. From inside a shadow root out to the light DOM, only element reflection works.

### Per-instance CSS values

Per-instance CSS values go in the shadow root's `:host` rule from `attachHostStyle`, or in the `style` of a generated node. They never go in the host's `style` or in a document sheet keyed on an `id`. Set each value with `setProperty` rather than building rule text, where 1 malformed value can void the declarations after it.

Mark client state that page CSS must not undo, like a dragged size, as important. Leave values mirrored from configuration attributes at normal priority, which lets page CSS override them.

A value that depends only on configuration attributes can instead live in a shared document sheet keyed on those attributes. Defaults for missing configuration attributes belong in CSS, not in a write.

### State on page-rendered children

A child that is a kit element keeps its state in its own custom state set. The host writes nothing on any other page-rendered child. To hide one, it leaves the child out of its slot (see [Shadow root for a light-DOM host](#shadow-root-for-a-light-dom-host)).

## Internal state

Runtime-derived state that CSS reads goes in the element's custom state set through `setState`, never in an attribute. Attach `ElementInternals` once, in the constructor, and read state back from the component's own fields rather than from the DOM.

State on a child kit element lives in that child's internals and is set through a method on the child. A generated node may carry a state attribute instead, because a morph removes the node and the component rebuilds it.

## Shadow root for a light-DOM host

A host whose children stay in the light DOM gets a shadow root from `attachSlotRoot` when it needs per-instance CSS or state on its children. Assign every child, authored or generated, with `assignChildren` on connect and on every `childList` change. An unassigned child doesn't render.

## Surviving morph attribute stripping

Restore managed attributes after a morph with `observeManagedAttrs`, and write them with `setAttrIfChanged`, which keeps the observer from looping on its own writes.

An `aria-label` derived from a wrapping `<label>` through `nameFromLabel` counts as managed. Manage only attributes the platform or assistive tech reads. Anything only CSS reads is a custom state.

## Children that arrive after connect

A component that needs its children to bind retries with `retryWhileParsing` while the document is still parsing. It warns about a missing child only once `stillParsing()` is false.

## Code

- Use a getter for a cheap, pure value with no arguments, and a method for anything with arguments, side effects, real cost or async work.
- Keep private state in `#private` fields.
- Don't put comments inside template-literal markup or CSS, because they ship verbatim in the bundle. Comment above the declaration instead.
- The doc page documents the public surface. Source files keep only short "why" comments, not doc-style head comments that restate it.
