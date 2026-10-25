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
