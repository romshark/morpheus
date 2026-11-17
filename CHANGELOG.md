# Changelog

This file records the notable changes of each release in the format of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The release workflow publishes the section of a version as its GitHub release notes. The changelog starts after v0.1.0, the first release.

## [Unreleased]

### Fixed

#### Components

- Size the SVG that `neo.Icon` inlines into a `<neo-icon>` by `--neo-icon-size` before the script loads. It was 24px until then and changed size on upgrade.

## [0.5.0] - 2026-11-17

### Added

#### Components

- Add `<neo-otp>`, a code input with 1 box per character for one-time codes and PINs. `neo.OTP` renders it from Templ.
- Add `<neo-odometer>`, which animates changes to a number by rolling its digits. `neo.Odometer` renders it from Templ.
- Escape a slot character in the `mask` of `<neo-textinput>` and `<neo-otp>` with `\`, as in `\#` for a literal `#`. A `\` in an existing mask now escapes the character after it; write `\\` for a literal backslash.
- Step a `<neo-textinput>` number field (`format="number"` or `type="number"`) by `step` within `min` and `max`, with ArrowUp and ArrowDown, or PageUp and PageDown for 10 steps. The new `stepper` attribute adds increment and decrement buttons, and `increment-icon` and `decrement-icon` swap their icons. A masked field with `stepper` or `scrub` steps the digit group at the caret, like a native time field, within `min` and `max` written in mask form.
- Add `scrub="horizontal|vertical"` to a `<neo-textinput>` number field, a handle that steps the value when dragged. `scrub-side="start|end"` places it, `scrub-sensitivity` sets its steps per pixel and `scrub-icon` swaps its icon.
- Show a pulsing skeleton in a `<neo-icon>` while its SVG loads. The `loading` custom state (`neo-icon:state(loading)`) marks it.
- Translate the generated controls' labels with `dismiss-label` on `<neo-toast>` (`dismissLabel` in `NeoToast.show()`), `back-label` on `<neo-submenu>`, `search-label` on `<neo-combobox>`, `more-label` on `<neo-breadcrumb>`, `slide-label` on `<neo-carousel>`, `previous-label`, `next-label` and `page-label` on `<neo-pagination>`, and `increment-label` and `decrement-label` on `<neo-textinput>`. `{n}` stands for the number.

#### Templ wrappers

- Add `Stepper`, `IncrementIcon`, `DecrementIcon`, `Scrub`, `ScrubIcon`, `ScrubSide`, `ScrubSensitivity`, `Min`, `Max` and `Step` to `neo.TextInputOpts`.
- Add the label fields `DismissLabel` to `neo.ToastOpts`, `BackLabel` to `neo.SubMenuOpts`, `SearchLabel` to `neo.ComboboxOpts`, `MoreLabel` to `neo.BreadcrumbOpts`, `SlideLabel` to `neo.CarouselOpts`, `PreviousLabel`, `NextLabel` and `PageLabel` to `neo.PaginationOpts`, and `IncrementLabel` and `DecrementLabel` to `neo.TextInputOpts`.

### Changed

#### Components

- Hide the browser's spin buttons in `<neo-textinput type="number">`. Set `stepper` for the kit's buttons.

#### Templ wrappers

- Require templ v0.3.1118 in the `neo` and `datastar` packages. Upgrade the templ CLI to the same version and regenerate.

### Fixed

#### Components

- Reserve the upgraded size of a `<neo-progress>`, `<neo-pagination>`, `<neo-otp>` or `<neo-textarea>` (`rows` up to 10) before its script loads, and size a `<neo-spinner>` by `--neo-spinner-size` before then. They were 0px tall, the spinner 1em, and grew on upgrade.
- Reserve the upgraded size of a `<neo-slider>` or `<neo-slider-range>` before its script loads. It was 0px tall until then, or showed its mark labels as plain text, and grew on upgrade.
- Apply `collapse-at` (up to 10) and `overflow-count` to a `<neo-avatars>` before its script loads. The row showed every avatar until then, with its overflow template as an empty circle, and changed width on upgrade.
- Reserve the line height of a `<neo-kbd>` before its key glyph renders. It was 1 line shorter until the script loaded, which moved the content after it, such as the links below a button holding a shortcut, down by 1px.
- Give the links in the overflow menu of a `<neo-breadcrumb>` the role `menuitem`. As `link` children of `role="menu"` they failed the axe and Lighthouse check `aria-required-children`.
- Give a `<neo-sortable>` drag handle without a `role` the role `button`. As a focusable `<span>` with no role, its `aria-label` failed the axe and Lighthouse check `aria-prohibited-attr`.
- Move the keyboard-reorder announcer of `<neo-sortable>` out of the element, to a `<neo-announcer>` at the end of `<body>` or of the open modal `<dialog>`. Inside the element it was a child that `role="list"` does not allow, which failed the axe and Lighthouse check `aria-required-children`.
- Keep the roving tab stop of a `<neo-navgroup>` on its `<neo-button>`, `<neo-checkbox>`, `<neo-switch>` and `<neo-toggle>` items. Arrow keys moved focus but not the tab stop, and in some load orders every item stayed a tab stop.
- Restore the `tabindex` of a `<neo-switch>` or `<neo-toggle>` when `disabled` is removed. It stayed `-1`, which left the control out of the tab order.
- Size a `<neo-skeleton variant="circle">` or `variant="line"` by a `width` or `height` set from a class. The variant defaults overrode it, and a circle in a flex row rendered at 0x0.
- Follow a right-to-left `dir` in `<neo-tabs>`, `<neo-radio-group>`, `<neo-toggle-group>`, `<neo-buttongroup>`, `<neo-tree>`, `<neo-menu>`, `<neo-submenu>`, `<neo-carousel>`, `<neo-sortable>`, `<neo-slider>`, `<neo-slider-range>`, `<neo-progress>`, `<neo-switch>`, `<neo-pagination>` and `<neo-input-group>`. Left and Right arrows moved the wrong way, and fills, thumbs, rounded corners and chevrons stayed left to right.
- Mirror the `*-start` and `*-end` placements of popovers, selects, comboboxes, menus and text input suggestions in a right-to-left context. They aligned to the left edge.
- Size a `<neo-textinput>` by a `width` set on it. `--neo-input-min-width` (12rem) was a floor that left a narrower field overflowing the element, and kept the field from shrinking in a narrow `<neo-input-group>`. It is now the width when none is set.
- Keep the decimal point of a `value` set on a `<neo-textinput format="number">` with `thousands-separator="."`. The value "1234.56" showed as "123.456" and read back as "123456".
- Align ArrowUp and ArrowDown in a `<neo-textinput>` without suggestions with native fields, which move the caret to the start or end, or select with Shift.
- Keep the form value of a `<neo-textinput type="email">` in step when `case`, `prefix` or `numeric-only` changes the typed text. A capital letter in a `case="lower"` field threw an error and left the form value behind.
- Keep the caret after a character typed right after the `prefix` of a `<neo-textinput>` that reformats it. The caret jumped into the prefix.
- Keep the scroll of `<neo-textinput>` suggestions across a reposition, such as a window resize. A list shorter than the viewport jumped to the top.
- Place popovers, tooltips, menus, selects, comboboxes and text input suggestions in the visible area of a pinch-zoomed page. An open panel slid away from its trigger during a pinch, and one opened while zoomed landed outside the zoomed area.

## [0.4.0] - 2026-11-13

### Added

#### Components

- Add `<neo-autohide>`, a sticky bar that hides on scroll down and returns on scroll up. `neo.Autohide` renders it from Templ.

### Fixed

#### Components

- Style an `<a data-neo-link>` without `variant`, which `neo.Link` renders when `Variant` is unset, as a plain link. It had the button shadow and the hover lift.

## [0.3.3] - 2026-11-04

### Added

#### Components

- Add `--neo-select-list-gap`, the gap between the rows of the option panels in `<neo-select>`, `<neo-combobox>` and `<neo-textinput>` and inside `<neo-optgroup>`. It defaults to `--neo-select-list-padding`.
- Add `--neo-menu-gap`, the gap between the rows of `<neo-menu>`, `<neo-contextmenu>` and `<neo-submenu>` panels. It defaults to `--neo-menu-padding`.
- Add `--neo-tabs-list-gap`, the gap between tabs. It defaults to `--neo-tabs-list-padding`.
- Add `--neo-sortable-radius`, the corner radius of `<neo-sortable>` items and the drop placeholder. It defaults to `--page-radius`.

### Changed

#### Components

- Space option rows by `--neo-select-list-gap` (0.25rem) instead of `--neo-navgroup-gap` (0.5rem), equal to the panel padding. Set `--neo-select-list-gap: calc(var(--page-spacing) * 2)` on `:root` to restore the old spacing.
- Space menu rows by `--neo-menu-gap` (0.25rem) instead of a fixed 0.05rem, equal to the panel padding. Separators drop their 0.25rem margin, which the gap replaces. Set `--neo-menu-gap: 0.05rem` on `:root` to restore the old row spacing.
- Default `--neo-tabs-list-padding` to `--page-spacing` instead of a fixed 0.25rem. Themes that change `--page-spacing` now change the tablist padding and the gap between tabs.

### Removed

#### Components

- Remove `--page-max-width` from `morpheus.css`, since no component uses it. If your own styles use it, define it yourself with `:root { --page-max-width: 64rem; }`.
- Remove `--neo-alert-title-line-size`. No rule read it, and setting it had no effect.
- Remove `--neo-card-horizontal-collapse`. Setting it had no effect, because CSS can't read a custom property in a container query. A horizontal `<neo-card>` still collapses below 28rem.

### Fixed

#### Components

- Space the rows of the `<neo-breadcrumb>` overflow menu by its panel padding. They were 0.5rem apart and 0.25rem from the border. The panel padding now follows `--page-spacing`.
- Inset the `<input type="color">` swatch from the field border in Firefox. It was drawn flush with the border.
- Round `<neo-sortable>` items and the drop placeholder by `--page-radius`. They read the undefined `--neo-radius` and stayed 0.5rem in every theme. If you set `--neo-radius`, set `--neo-sortable-radius` instead.
- Apply `--neo-textarea-border-width` to `<neo-textarea>`. It always drew a 1px border.

## [0.3.2] - 2026-11-03

### Added

#### Components

- Add `--neo-select-list-padding`, the padding of the option panels in `<neo-select>`, `<neo-combobox>` and `<neo-textinput>`. It defaults to `--page-spacing` and replaces a fixed `0.25rem`.

### Fixed

#### Components

- Keep popup rows concentric with their panel in `<neo-select>`, `<neo-combobox>`, `<neo-textinput>`, `<neo-menu>`, `<neo-contextmenu>` and `<neo-breadcrumb>`, and the `<input type="color">` swatch with its field. The corner gaps were uneven.
- Drop the 2px floor of `--neo-tabs-tab-radius`. A tablist with a radius under 6px got tabs rounder than concentric, such as 2px tabs in a square tablist.
- Round all 4 corners of the only `<neo-toggle>` in a vertical `<neo-toggle-group>`. Its top corners were square.
- Set `--page-radius: 0px` in `theme-matrix.css`. The unitless `0` gave some `<neo-aura>` rings square corners. Use `0px` in your own themes too.

## [0.3.1] - 2026-10-29

### Changed

#### Templ wrappers

- Require templ v0.3.1100 in the `neo` and `datastar` packages. Upgrade the templ CLI to the same version and regenerate. This version replaces the string value of a spread attribute whose name starts with `on`, such as `online`, unless it is a `templ.ComponentScript`.

## [0.3.0] - 2026-10-25

### Added

#### Components

- Offer `theme-ocean.css` and `theme-matrix.css` in the bundle builder and `morpheus bundle -themes`.

### Changed

#### Components

- Fire `neo-toast-close` on every close of a toast, not only on a close-button click. `detail.reason` names the cause: `close`, `action`, `timeout`, `swipe`, `dismiss` or `remove`. To handle only close-button clicks, check `detail.reason === "close"`.
- Pulse the opacity of an indeterminate `<neo-spinner>` under reduced motion. Its static starburst looked the same as a stalled page.

### Removed

#### Components

- Remove `--neo-sidebar-overlay-breakpoint`, which had no effect. Set the `overlay-breakpoint` attribute instead.

### Fixed

#### Components

- Show the `not-allowed` cursor on a disabled `<neo-button>`. The button showed the cursor of the element behind it, and a `title` on it never showed.
- Stop the hover and press styles on a disabled `<neo-toggle>`, `<neo-tab>` and `<neo-option>`, on the handles of a disabled `<neo-sortable>` and on the button of a disabled file input.
- Collapse the `<neo-toaster>` stack when the pointer leaves after a click on a close button. The stack stayed expanded, with every auto-dismiss timer paused, until a click outside the toaster.
- Stop `theme-ocean.css` and `theme-matrix.css` from requesting fonts from `/static/fonts/`, a doc-site path that returns 404 elsewhere. The themes still name Nunito and VT323 first. To use them, host the fonts and declare their `@font-face`.
- Render the `<template data-neo-pagination-prev>` and `<template data-neo-pagination-next>` content of a `<neo-pagination>` that is on the page before the bundle loads. It showed the default chevrons.
- Fire `neo-avatars-change` whenever `<neo-avatars>` changes which avatars it shows. It fired only when no avatar fit.
- Take the colours of `<neo-button>`, `<neo-popover>` and `<neo-option>` from the theme. Outside the doc site they used fixed colours, such as a blue primary button and white buttons and popovers in dark mode.

## [0.2.0] - 2026-10-24

### Added

#### Components

- Add `<neo-aura>`, a decorative light around the element it wraps. `neo.Aura` renders it from Templ.
- Add `<neo-if-network>`, which shows its content only while online or offline. `neo.IfNetwork` renders it from Templ.
- Add the bundler, which builds `morpheus.min.js` and `morpheus.min.css` with only the chosen components, and `theme-default.css` or other themes. Run it on the [bundle builder](https://romshark.github.io/morpheus/bundle-builder/) page or with `go run github.com/romshark/morpheus@<version> bundle -components select,dialog`.

### Changed

#### Components

- Replace `<neo-condition>` with `<neo-if-platform>`, which takes a boolean attribute per platform. Migrate `platform="apple"` to `macos ios` and `platform="linux"` to `linux android chromeos`; `x="false"` excludes a platform.

#### Templ wrappers

- Replace `neo.Condition` with `neo.IfPlatform`, and `ConditionOpts.Platform` with a `bool` field per platform.
- Replace `neo.PlatformApple` with `neo.PlatformMacOS` and `neo.PlatformIOS`. `neo.DetectPlatform` also returns `PlatformAndroid` and `PlatformChromeOS`.

- Require templ v0.3.1070 in the `neo` and `datastar` packages. Upgrade the templ CLI to the same version and regenerate. This version reads `@` after a space in text as a component call, and renders the line break after a call without children as a space. Check text next to component calls.
- Require Go 1.26.10 in the `neo` and `datastar` packages.

### Fixed

#### Components

- Name `<neo-switch>` from the text of a wrapping `<label>` when the switch has no `aria-label` or `aria-labelledby`, as `<neo-checkbox>` and `<neo-radio>` do.
- Restore the name that `<neo-checkbox>` and `<neo-radio>` take from a wrapping `<label>` after a morph removes their `aria-label`.
- Show `<neo-switch>` and `<neo-checkbox>` with `checked="false"` as unchecked before the script loads. The `neo` wrappers render that attribute for `Checked: neo.Set(false)`. These controls showed as checked until the script loaded, then animated to unchecked.
- Collapse `<neo-elastic>` with `open="false"` before the script loads. The `neo` wrapper renders that attribute for `Collapsed: neo.Set(true)`. The content showed at full height until the script loaded.
- Keep `<neo-sidebar>` with `open="false"` closed. The `neo` wrapper renders that attribute for `Open: neo.Set(false)`. The sidebar showed as open until the script loaded, and on wide layouts without `Manual` it stayed open.
- Conceal `<neo-revealable>` with `open="false"` before the script loads. The `neo` wrapper renders that attribute for `Open: neo.Set(false)`. The content was visible and in the accessibility tree until the script loaded, and stayed that way if the script never loaded.
- Reflect the open state on `<neo-dialog>`, `<neo-drawer>`, `<neo-popover>`, `<neo-menu>`, `<neo-submenu>`, `<neo-lightbox>` and `<neo-contextmenu>` rendered with `open="false"`, as `Open: neo.Set(false)` does. The element kept `open="false"` after the script loaded, also while open. Popover, menu and submenu showed their panel, and the triggers of popover, menu, submenu and lightbox reported `aria-expanded="true"`.
- Open `<neo-contextmenu>` rendered with `open`. It threw a `TypeError` and stayed closed.
- Bind `<neo-popover>`, `<neo-dialog>`, `<neo-drawer>`, `<neo-lightbox>` and `<neo-contextmenu>` when a blocking script loads the bundle before their markup. Their triggers did nothing.
- Hide `<neo-tooltip>` content with `open="false"` before the script loads. The `neo` wrapper renders that attribute for `Open: neo.Set(false)`. Content in the markup, such as an element marked with `neo.TooltipContent`, showed until the script loaded.
- Register `<neo-option>` and `<neo-optgroup>` in a bundle without `<neo-select>`. With `<neo-combobox>`, `<neo-datalist>` or `<neo-textinput>` and no `<neo-select>`, every option stayed hidden and the console reported both elements as missing from the bundle.
- Make `<neo-buttongroup>` a single-selection group when its `value` is set after it connects, as by a Datastar `data-attr:value` binding or a morph. The group stayed a plain button group. Clicks selected nothing, and it had no radio roles or arrow-key navigation.
- Stop warning that the styles of `<neo-avatar>`, `<neo-badge>` and the other CSS-only components are missing when such an element is not rendered, as in the option and trigger markup of `<neo-combobox>`. Chrome logged the warning with the full bundle loaded.
- Keep a `<neo-if-platform>` branch shown after a morph. `<neo-condition>` hid it.
- Warn in the console when `<a data-neo-link>` is used but its styles are missing from the loaded bundle, as for `<neo-*>` elements. A trimmed bundle without the link styles left these anchors unstyled without a warning.

#### Templ wrappers

- Pre-render `enter` and `delete` in `neo.Kbd` with the labels the client shows. They changed after the script loaded.

[Unreleased]: https://github.com/romshark/morpheus/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/romshark/morpheus/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/romshark/morpheus/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/romshark/morpheus/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/romshark/morpheus/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/romshark/morpheus/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/romshark/morpheus/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/romshark/morpheus/compare/v0.1.0...v0.2.0
