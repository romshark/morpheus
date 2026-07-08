# API Improvements

Cross-component audit of the custom-element APIs (`web/lib`) and their Templ wrappers (`neo`, `datastar`) for naming and functionality inconsistencies, plus adherence to DESIGN.md, CLAUDE.md, and the `neo-component` / `templ` skills.

Scope: the public API surface (attributes, events, methods, slots, data-marks, and `*Opts` fields).

Severity tags: **[High]** contract break or real gap, **[Med]** inconsistency a user will hit, **[Low]** internal or cosmetic.

The resolved findings (sections 1 through 3, 4.2, and 5) have been applied and removed. The open items remain below.

## 4. Functionality gaps

4.4. **[Low] `readonly` exists only on `neo-rating`.** rating has both `readonly` and `disabled`; the other value control, slider, has only `disabled`. Decide whether value controls support `readonly` uniformly.

4.5. **[Low] Guard-flag field name differs internally.** buttongroup uses `#applyingValue`; slider, slider-range, progress, spinner, carousel use `#reflectingValue`; overlays use `#reflecting`/`#reflectingOpen`. Not public API, but the value-reflection pattern reads more clearly with one name.

## 5. Patterns DESIGN.md should document

DESIGN.md covers the attribute command contract, morph safety, slots, and accessibility, but several pervasive conventions live only in code. Documenting them would prevent the drift the resolved sections addressed.

5.1. **Templ wrapper API shape.** The `neo` layer has a strong convention (`Foo(opts)`, `FooAttrs(opts, attrs)`, `FooOpts` struct; sub-parts as `FooPart` / `FooPartAttrs`; `*Set` companion bools for emitting explicit zeros; shared enum types `Side`, `Placement`, `Orientation`). DESIGN.md Layering mentions the wrappers exist but not their shape. Document the field-naming rules: field name matches its attribute, positive names, `No<Attr>` for false-emission.

5.2. **Value-state reflection contract.** The Attribute Contract table covers boolean commands. The parallel contract for `value` and numeric state (keep-on-absent, reflect through a guarded flag, reflect own state for CSS) is implemented by slider, slider-range, progress, spinner, select, combobox, carousel, buttongroup, tabs, pagination but described only in `command.ts`. Add a short paragraph so the pattern is a documented requirement, not folklore.

5.3. **Standard part-mark vocabulary.** DESIGN.md Slots mentions `[data-neo-<component>-<part>]` marks generically. The shared part names (`trigger`, `close`, `content`, `header`, `body`, `footer`, `title`, `description`) recur across dialog, drawer, sidebar, lightbox, popover, card, alert. Enumerating the standard vocabulary, and stating whether a trigger mark is required, would fix the inconsistent trigger handling (dialog requires `[data-neo-dialog-trigger]`, drawer makes it optional, tooltip uses a positional first child with no mark, sidebar has none).

5.4. **Shared hover-to-open config cluster.** popover, lightbox, and the listbox base share `hover`, `hover-open-delay`, `hover-close-delay`, `follow-scroll`, `trigger-action`. Documenting this as one named config group would let tooltip align its `open-delay` / `close-delay` and prevent future surfaces from renaming the knobs.

5.5. **Required interactive-control states.** DESIGN.md Component States lists loading, empty, disabled, validation as "part of each component's defined surface" but does not require `disabled` on every interactive control. Tighten to require host `disabled` on all interactive controls.
