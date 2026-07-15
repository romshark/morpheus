# TODO

## BUGS

neo-toast-close fires only on manual close (2026-07-07):
- `web/lib/neo-toast/neo-toast.ts:212` dispatches `neo-toast-close` only from `#onCloseClick` (the × button). Auto-dismiss (timer), swipe-to-dismiss, and `NeoToast.dismiss()` remove the toast via `neo-toaster.ts` `#removeToast` (`web/lib/neo-toaster/neo-toaster.ts:825`) without emitting any event, so consumers cannot observe non-manual dismissals. Convention is one close/dismiss event on every removal. Fix: dispatch `neo-toast-close` for every dismissal cause (e.g. from `#removeToast`).

neo-avatars custom-overflow subtree blanked (2026-07-04):
- `neo-avatars.ts` `#setDefaultOverflowLabel` (`web/lib/neo-avatars/neo-avatars.ts:174`) blanks a custom overflow's whole subtree via `textContent = ""` when no `[data-neo-avatars-overflow-count]` descendant exists. Any custom overflow template lacking a count target loses its content. Consider guarding the default-label path when the overflow is custom.

`.ts` source audit (2026-06-28) vs DESIGN.md + .claude/skills + CLAUDE.md (verified):

No-em-dash convention (memory feedback_no_em_dashes) - broad sweep needed:
- `web/lib` `*.ts`: 233 comment lines across 44 files use em dashes. `web/site` `*.ts`: 42 lines across 8 files.
- `web/lib/neo-combobox/neo-combobox.ts:751` sets `aria-label` to an em-dash-separated search label; the em dash lands in the spoken accessible name, not just a comment.
- En-dash (`–`) also in `web/lib/neo-spinner/neo-spinner.ts` and `web/lib/neo-slider-range/neo-slider-range.ts`.

- 🤔 landing: different color from background (fixed, but there's still these weird trails from the glow effect of the matrix rain - ghosting)
- Focus of links is not accent color
Carousel doc page:
  - live example and simple example "No touch": buttons are are not vertically centered.
  - example "Card deck": broken incorrect styles.
  - examples "Autoplay + loop", "Custom navigation styling", "100 slides" and "Custom easing" - preview resizable are too short in height by default.

Server simulator:

- 🤔 non-OK response ignores handler delay (INVESTIGATION: in that case network latency should be used)

Slider:

- (+ range slider) tooltip kind of broken?

Spinner:

- 🚧 in reduced motion mode it should still have some motion?

Carousel:

- Active status set on carousel and on slides, e.g. check landing page example.

# NICE TO HAVE:

- NavGroup: Grid diagonal navigation (nice to have? I'm not sure this would be good).
- Landing: sign up example: different bar color respectively to the password strength (e.g. Excellent green, below Sufficient red)
- Icon for a11y reduced motion: replace with a better one, e.g. like in Apple OS
- Landing: sign up example: input group email domain selection: smaller dropdown with - adjusted to content?
- Styling: page background: more grayish for light and maybe black for dark
- Tooltip arrows, poiting to source element
- Doc-page caveat alerts (verified gaps, same pattern as the tooltip/tabs alerts; reuse `.demo-callout` + `@neo.AlertAttrs`):
  - Clipcopy (warning): copy needs a secure context (HTTPS/localhost) - `neo-clipcopy.ts:31` gates on `window.isSecureContext`, insecure-context `execCommand` fallback can fail -> fires `neo-clipcopy-error`. page_clipcopy doesn't mention it.
  - Resizable (warning): not resizable via keyboard; pointer-drag only (zero keydown handling), small touch targets - a11y gap, page says nothing.
  - Carousel (info, medium): scroll animation / autoplay smoothing suppressed under prefers-reduced-motion (`neo-carousel.ts:115`); page only mentions it in one prop description.
- Carousel, with multiple per view, e.g. 3: when second last is active and scroll transition is over, then it's not possible to activate/go to the last slide. The validator is only checking available scroll, but not the selected slides.
- how to access notifications via keyboard nav?
- Resizable: keyboard interaction, currently not possible
- button & link size attribute
- add button variant icon: equal padding, square shaped
- neo-layout doesn't currently console-warn on invalid attribute values like `<neo-layout gap="2rem">` because it's a CSS-only component; maybe we can have a `morpheus-debug.js` which adds a bit to the bundle size but provides additional feedback on correctness?

## Investigate:

- Maybe `func AsyncPlaceholder() templ.Attributes` shouldn't be an attribute generator.
