# TODO

## BUGS

`internal/cmd/fileserve` served `/static/sim/**` with no `Cache-Control` (fixed 2026-08-08):
- Pages are `no-cache` but their simulator handlers were not, so an ordinary reload could pair fresh markup with a stale simulator. It affected every sim-driven demo, not just the kanban page. Worth a regression test on `setCacheControl`; the package has none.
- Not the cause of the Brave skeleton-on-reload report, which was a lost ready signal. Kept because the mismatch is a real hazard either way.

`internal/cmd/gen/datasim.js` misreported two things about SSE (fixed 2026-08-09), and has no tests:
- A client abort closed the response body instead of erroring it, so a consumer could not tell an abort from the server ending the stream. Datastar tells them apart: it keeps a stream reopenable after an abort but drops its `visibilitychange` listener on a clean end. Every simulated stream therefore died for good the first time its tab went to the background. Real `fetch` rejects the body on abort; `abortWriter` now does too.
- Each frame timed its latency from the front of the write queue, not from when the handler wrote it, so a stream emitting faster than one frame per latency fell further behind on every frame. Frames written together now arrive together.

Kanban demo (2026-08-07):
- The simulated second user can move a card while another client is mid-drag. The drag survives (the shell freezes morphs), but the drop then races the peer's write. Real presence would pin a grabbed card server-side.
- Cards are whole-item drag grips, so the kit puts `touch-action: none` on the whole card. Touch-scrolling a column has to start on a gap between cards. A handle avoids this; the trade was made deliberately.
- The board is a fixed-height frame (`--kb-board-height`, default 34rem) and only a column's card list scrolls. neo-elastic is on the cards alone; a column wrapped in one animated its height on load and could not coexist with a scrolling list, which has nothing to animate.

CSS-only motion: `neo-sortable` converted (2026-08-09), `neo-carousel` and `neo-tabs` still on the `easing` attribute:
- The attribute was a JS mini-language (`"220ms ease-in-out"` split by regex) written to an inline `style`, which beats any media query. Verified: before the change, `prefers-reduced-motion: reduce` left the sortable reorder glide running at full duration. `neo-sortable.css` had no reduced-motion rule and could not have had a working one.
- Sortable now marks a moving item with `[data-neo-sortable-moving]` (+ `[data-neo-sortable-docking]`) and the stylesheet owns the transition, keyed on `--neo-easing`, `--neo-sortable-move-duration`, `--neo-sortable-dock-duration`. Reduced motion works.
- `neo-carousel` cannot use CSS transitions at all: it animates `scrollLeft` on a rAF loop. Equivalent fix is to drop the attribute and read `--neo-easing` plus a duration property via `getComputedStyle`, which its `#resolveEasing` half does already.
- `neo-tabs` uses `[easing]` as a **presence gate** in six selectors (`neo-tabs[easing] > neo-tabpanel`, the slide variants), not only as a timing value. Removing it needs a replacement opt-in for "animate panels" before the timing can move to properties. Decide that first.
- `--neo-duration-scale` has no global default or global reduced-motion rule in `web/lib`; only `theme-matrix` sets it to 0. Every component composing `calc(x * var(--neo-duration-scale, 1))` therefore ignores reduced motion outside that theme.

templ parses a text node that begins with `for` / `if` / `switch` as a Go control statement, so prose after a closing tag cannot start with one. Cost an hour on `page_sortable.templ`; worth a note in the templ skill.

`data-attr:checked` uses the bare-boolean form in `internal/site/site.templ:1006` (`simToggle`):
- The doc-page skill and `web/lib/neo-*` require `$sig ? 'true' : 'false'` plus a write-back; a bare `$sig` makes Datastar remove the attribute on false, which the command contract reads as "keep current state". Every settings-panel toggle goes through this helper. Verify whether the write-back masks it, and align the helper either way.

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

Styles that never apply (fixing changes rendering or API):

- Unsure: `sidebar_resizable.css`, `sidebar_mixed_breakpoints.css`, `sidebar_touch_dismiss.css` collapse the `neo-resizable` wrapper on a closed/overlay sidebar but don't hide its `[data-neo-resizable-handle]`. The handle may stay visible at the edge.
- `landing.css:2276-2277` sets `--neo-button-padding-inline/-block`; neo-button reads only `--neo-button-padding`. Tree action buttons get default padding.
- `--neo-card-horizontal-collapse` (`neo-card.css:17`) has no effect, the `@container` at `:219` is literal 28rem. `page_card.templ:128,199` documents it as tunable.
- `--neo-alert-title-line-size` (`neo-alert.css:37`) is never read; documented at `page_alert.templ:153`.
- `--page-max-width` (`_base.css:38`) ships in `morpheus.css`, only site `style.css` reads it.
- `--page-font-family`: no kit rule reads it, only site `style.css`. `_base.css:40-42` claims it swaps the kit font.
- `--neo-size-panel`, `--neo-size-content` (`_layout.css:20-21`) undocumented; layout page has no CSS var table.

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
