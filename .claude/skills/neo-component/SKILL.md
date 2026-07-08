---
name: neo-component
description: Use when creating or editing the custom-element TypeScript sources under `web/lib`.
paths:
  - "web/lib/**/*.ts"
  - "web/lib/*.ts"
---

These files implement the custom elements, so the component design rules in [DESIGN.md](../../../DESIGN.md) (repo root) apply: morph safety, the attribute contract, light and shadow DOM, styling, and accessibility. This skill holds the implementation details for satisfying them in the TypeScript.

## Reading and reflecting attributes

- Read a boolean with the shared command reader: `boolCommand` for the raw `true`/`false`/`null`, or `boolAttr(host, name, default)` for a config knob. Never use bare `hasAttribute`; it can't tell `x="false"` from an absent attribute.
- Interactive-state attributes (`open`, `checked`, ...): keep an internal intent field and reflect it back to the attribute through a guarded writer (a `#reflecting` flag) so the reflected write isn't read back as a command. `neo-popover`'s `open` is the reference implementation.

## Surviving morph attribute stripping

A morph strips any attribute the component set at runtime that the server template doesn't carry (role, tabindex, ARIA). A self-targeted `MutationObserver` detects the strip and re-applies through `setAttrIfChanged` / `removeAttrIfPresent`, which are idempotent so a no-op pass produces no records and the observer settles instead of looping. See `observeManagedAttrs`.

## Getters, methods, private state

- Use a getter for a value that behaves like a property: cheap, pure, derived from existing state, taking no arguments, safe to read repeatedly. Use a method when the operation takes parameters, has side effects, is async, is expensive, or represents an action.
- Hold private state in `#private` class fields. JavaScript enforces them at runtime, not only the type checker.

## Comments in template-literal strings

Shadow markup and CSS live inside a template-literal (backtick) string, assigned to `innerHTML` or passed to `replaceSync`. The JS minifier treats that string as opaque, so a `/* … */` or `<!-- … -->` comment inside it ships verbatim in `min/bundle.js`.

Never comment inside the template string. Move the rationale to real `//` TS comments directly above the template-literal declaration, each anchored by its selector or element so it stays findable. Real comments minify out; the _why_ still lives at the source.

## Documentation lives in the doc page, not the source

A component's public surface (attributes, slots, events, `[data-neo-*]` hooks, markup shape) is documented once, in its `internal/site/page_*.templ` doc page. Do not restate it as a doc-style head comment in the `.ts`; the duplicate drifts out of sync. Keep only slim implementation "why" notes: invariants, browser quirks, the reason a construct exists. Utility modules with no doc page are exempt.
