# TODO

## BUGS

- Unsure: landing: different color from background (fixed, but there's still these weird trails from the glow effect of the matrix rain - ghosting)
- Focus of links is not accent color
Carousel doc page:
  - live example and simple example "No touch": buttons are not vertically centered.
  - example "Card deck": broken incorrect styles.
  - examples "Autoplay + loop", "Custom navigation styling", "100 slides" and "Custom easing" - preview resizable are too short in height by default.

Server simulator:

- Unsure: non-OK response ignores handler delay (INVESTIGATION: in that case network latency should be used)

Slider:

- (+ range slider) tooltip kind of broken?

Carousel:

- Active status set on carousel and on slides, e.g. check landing page example.

neo-avatars-change skips most changes (2026-10-24):
- `web/lib/neo-avatars/neo-avatars.ts:235,239`: `#adapt` returns inside `try` when a visible count fits, which skips `#emitChange()` at :244. The event fires only when no count fits. Fix: `break` out of the fit search instead of returning.

Leftovers from the 2026-10-24 comment sweep (code, not prose):
- `web/lib/neo-sidebar/neo-sidebar.css:24` declares `--neo-sidebar-overlay-breakpoint`, which nothing reads. The doc row is removed. Delete the declaration or make the CSS read it.
- `web/lib/neo-pagination/neo-pagination.ts` `serializeTemplate` round-trips through a `<div>`. `tpl.innerHTML` already serializes the template content.
- `internal/site/examples/layout_align_items.css`: `border: 1px solid --accent` is invalid (no `var()`), so the boxes have no border.

Theme fonts (2026-10-24):
- `min/theme-ocean.css` and `min/theme-matrix.css` load fonts from `/static/fonts/*.woff2`, a doc-site path. From jsDelivr (README install) it resolves to `cdn.jsdelivr.net/static/fonts/...`, which does not exist. `min/` has no fonts. The bundle builder and `morpheus bundle` leave both themes out for this (`internal/bundle/version.go` `themes`).

# Nice to have

- NavGroup: Grid diagonal navigation (nice to have? I'm not sure this would be good).
- Landing: sign up example: different bar color respectively to the password strength (e.g. Excellent green, below Sufficient red)
- Icon for a11y reduced motion: replace with a better one, e.g. like in Apple OS
- Landing: sign up example: input group email domain selection: smaller dropdown with - adjusted to content?
- Styling: page background: more grayish for light and maybe black for dark
- Tooltip arrows, pointing to source element
- Doc-page caveat alerts (verified gaps, same pattern as the tooltip/tabs alerts; reuse `.demo-callout` + `@neo.AlertAttrs`):
  - Clipcopy (warning): copy needs a secure context (HTTPS/localhost) - `neo-clipcopy.ts:31` gates on `window.isSecureContext`, insecure-context `execCommand` fallback can fail -> fires `neo-clipcopy-error`. page_clipcopy doesn't mention it.
  - Resizable (warning): not resizable via keyboard; pointer-drag only (no keydown handling), small touch targets - a11y gap, page says nothing.
  - Carousel (info, medium): scroll animation / autoplay smoothing suppressed under prefers-reduced-motion (`neo-carousel.ts:115`); page only mentions it in 1 prop description.
- Carousel, with multiple per view, e.g. 3. When the second last is active and scroll transition is over, then it's not possible to activate/go to the last slide. The validator is only checking available scroll, but not the selected slides.
- how to access notifications via keyboard nav?
- Resizable: keyboard interaction, currently not possible
- button & link size attribute
- add button variant icon: equal padding, square shaped
- neo-layout doesn't currently console-warn on invalid attribute values like `<neo-layout gap="2rem">` because it's a CSS-only component; maybe we can have a `morpheus-debug.js` which adds a bit to the bundle size but provides additional feedback on correctness?

## Investigate:

- Maybe `func AsyncPlaceholder() templ.Attributes` shouldn't be an attribute generator.
