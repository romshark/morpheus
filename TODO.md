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

Stale comments (2026-10-24 comment sweep; the comment contradicts the code):
- `web/lib/_base.css:3`: says components render in light DOM. slider-range, spinner, textarea, toaster and tree render internals in shadow DOM.
- `web/lib/neo-alert/neo-alert.css:131`: describes a 2px stroke and the variant tone. The rule only sets `border-color: CanvasText`.
- `web/lib/neo-card/neo-card.css:29`: describes clipping children to the rounded corners. The rule has no `overflow: hidden`.
- `web/lib/neo-carousel/neo-carousel.ts:12`: says the dots container comes after the slot. The template puts it first (:17-19).
- `web/lib/neo-carousel/neo-carousel.ts:873`: says `#scrollLock` suppresses mid-scroll `updateDotsFromScroll`. `#onTrackScroll` calls it while locked (:797).
- `web/lib/neo-dialog/neo-dialog.css:5`: says theme files override `--neo-dialog-*`. None does.
- `web/lib/neo-menu/neo-menu.css:2`: says the author picks any trigger element. `#bindStructure` accepts only `neo-button` or `neo-contextmenu`.
- `web/lib/neo-pagination/neo-pagination.ts:375`: says `template.innerHTML` is always `""`. It serializes the template content.
- `web/lib/neo-progress/neo-progress.css:6`: says the track has `role="progressbar"`. `#render` sets it on the host.
- `web/lib/neo-radio-group/neo-radio-group.ts:7`: says the observer watches `disabled`/`value` only. `attributeFilter` also has `tabindex`.
- `web/lib/neo-radio-group/neo-radio-group.ts:77,185`: cite `refresh()`'s getAttribute reads. `#refresh` reads `#valueIntent`.
- `web/lib/neo-radio-group/neo-radio-group.css:55`: says a mask clips the dot. The rule uses `border-radius: 50%`.
- `web/lib/neo-resizable/neo-resizable.css:28`, `web/lib/neo-sortable/neo-sortable.css:46`: say selection is locked site-wide. The rules cover the host subtree only.
- `web/lib/neo-revealable/neo-revealable.ts:412`: cites `area * 0.22`. The code uses 0.05 (inline) and 0.007 (media).
- `web/lib/neo-select/neo-select.css:34`: says a real neo-button replaces the placeholder. The trigger is a shadow `<button>`.
- `web/lib/neo-sidebar/neo-sidebar.css:7`: says the backdrop goes on `<body>`. `#ensureBackdrop` uses `parentElement ?? document.body`.
- `web/lib/neo-sidebar/neo-sidebar.css:2,27`: nothing reads `--neo-sidebar-overlay-breakpoint`. The JS reads the `overlay-breakpoint` attribute and the CSS hardcodes 50rem.
- `web/lib/neo-slider/neo-slider.css:10`: says a `<neo-tooltip>` wraps the thumb. The code uses a `[data-neo-tooltip-host]` div and `TooltipController`.
- `web/lib/neo-slider-range/neo-slider-range.ts:667`: says a drag would rewrite 8 attributes. `#syncAriaMeta` sets 12.
- `web/lib/neo-toaster/neo-toaster.ts:391`: names `this.toasts`. The field is `#toasts`.
- `web/lib/neo-toaster/neo-toaster.ts:527`: names `neo-toast-dismiss`. The event is `neo-toast-close`.
- `datastar/datastar.go:723`: says the failed template goes into the listbox's navgroup. The code writes into `<id>-options`, the neo-datalist.
- `internal/site/examples/combobox_async.templ:24`, `popover_async.templ:20`, `select_async.templ:21`: say the swap needs a retry mode other than `never`. The `popoverAsyncOnFetch` doc says the finished-after-error path covers `retry: 'never'`.
- `web/build.ts:3`, `.gitignore:11`: name `build.mjs`. The script is `build.ts`.
- `web/build.ts:95`: calls the kit bundle an IIFE. `commonBuildOptions` sets `format: "esm"`.
- `web/site/landing.ts:1`: says the output is `../site/static/landing.js`. `build.ts` writes `../min/landing.js`.
- `web/site/landing-sim.ts:80`: names Idiomorph. Datastar 1.0 uses its own morph.
- `internal/site/site.templ:1032`: `assigneeOptions` doc says navgroup. The element is a `<neo-datalist>`.
- `internal/site/static/style.css:715`: names the preceding section "Accessibility". In `site.templ` it is Playgrounds.
- `internal/site/static/theme-rose.css:48`: credits a `morpheus.css` `r: calc(...)` rule. It is in `neo-spinner.css`, which `morpheus.css` does not import.
- `internal/site/page_index.templ:847`: says `data-motion`/`data-contrast` scope the simulation. The switches toggle `data-pref-*` on `<html>` (:1487).
- `internal/site/page_index.templ:3450`: says "display:contents trigger". `landing.css:2289` makes the contextmenu `display: contents` and the trigger `display: flex`.
- `internal/site/page_dialog.templ:296`: `dialogSimulator` doc omits `/dialog/asyncload/`, which the script registers.
- `internal/site/page_sidebar.templ:233`: `sidebarSimulator` doc names 1 handler module. It loads async.js and asyncfail.js.

Doc-site prose (2026-10-24 comment sweep):
- `internal/site/page_sidebar.templ`: the intro and the `overlay-breakpoint` description say "below" the breakpoint. `neo-sidebar.ts:115` overlays at or below it.
- `internal/site/page_theming.templ:219`: mentions a "Tokens demo". No demo on the page has that name.
- `internal/site/page_index.templ:301`: quotes "Let the server drive it". The h2 at :323 says "Let the server drive your UI".
- `internal/site/examples/layout_overview.templ:5`: says "no custom CSS". `layout_overview.css` sets `flex-basis`. The `page_layout.templ` intro says "no page-specific CSS", but several layout examples ship CSS.

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
