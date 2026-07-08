# Sidebar Refactor Plan

## Goal

Reduce duplicated overlay, dialog, and focus-management code without hiding the behavior differences between `neo-sidebar`, `neo-drawer`, and `neo-dialog`.

`neo-sidebar` should not be merged into the native-dialog controller. It has responsive in-flow mode, a sibling backdrop, auto-open behavior, and child `inert` management. `neo-drawer` and `neo-dialog` are native top-layer modal surfaces. Shared helpers should stay small and explicit.

## Candidate Helpers

### Async placeholder restore

Extract the repeated `[data-neo-async-placeholder]` lifecycle from `neo-dialog`, `neo-drawer`, and `neo-sidebar`.

The helper should own:

- Capturing the placeholder parent and initial HTML once.
- Clearing a pending restore timer on reopen.
- Scheduling restore after a caller-provided transition duration.
- Skipping restore when `[open]` is present.
- Invalidating when the wrapper is patched away.
- Respecting `data-neo-async-no-restore`.
- Disconnect cleanup.

Suggested shape: `AsyncPlaceholderRestore`.

### Focus utilities

Extract basic tabbable discovery and Tab wrapping.

The helper should own:

- A shared focusable selector.
- Filtering disabled, `aria-disabled`, inert, and hidden elements.
- Focusing the first tabbable child or a fallback.
- Wrapping `Tab` / `Shift+Tab` inside a caller-provided root.

Suggested shape: `tabbables(root)`, `focusFirstTabbable(root, fallback, opts)`, and `trapTab(e, root)`.

### Focused descendant recovery

Extract the id-based focus reseat logic used after a morph re-creates a native dialog surface.

The helper should own:

- Recording the focused descendant id on `focusin`.
- Clearing it when focus leaves the host.
- Re-focusing the matching descendant after recovery.

Suggested shape: `FocusedDescendantTracker`.

### Native dialog lifecycle

Keep `native-dialog.ts` focused on native `<dialog>` behavior shared by `neo-dialog` and `neo-drawer`.

Possible additions:

- A shared scroll lock with caller-provided hit testing.
- Shared `showModal()` recovery helpers.
- Shared `cancel` / non-dismissible Escape handling.
- Shared backdrop press-release tracking. `DialogBackdropClickTracker` already covers this.

Avoid making this helper own component-specific events, async slot restore, or trigger semantics.

### Dialog ARIA wiring

Extract the repeated trigger and dialog ARIA sync from `neo-dialog` and `neo-drawer`.

The helper should own:

- `aria-haspopup="dialog"`.
- `aria-controls`.
- `aria-expanded`.
- Dialog `role="dialog"` when absent.
- `aria-modal="true"`.
- Title and description id generation and wiring.

Suggested shape: `syncNativeDialogA11y({ trigger, dialog, open, idPrefix, titleSelector, descriptionSelector })`.

## Order

1. Extract focus utilities. Use them in `neo-sidebar` first, then consider `neo-lightbox` and popover follow-up work.
2. Extract async placeholder restore. Use it in `neo-sidebar`, `neo-drawer`, and `neo-dialog`.
3. Extract focused descendant recovery for `neo-dialog` and `neo-drawer`.
4. Move more native-dialog lifecycle code only after the smaller helpers settle.
5. Extract dialog ARIA wiring last, after behavior is stable.

## Constraints

- Keep helpers morph-safe and idempotent.
- Keep runtime ARIA and `tabindex` writes morph-resilient when they are set on component hosts.
- Preserve each component's public events and attribute semantics.
- Do not merge sidebar wide-mode behavior with native dialog modal behavior.
- Run `pnpm run check-all` from `web/` after each step.
