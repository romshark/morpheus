# Changelog

This file records the notable changes of each release in the format of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The release workflow publishes the section of a version as its GitHub release notes. The changelog starts after v0.1.0, the first release.

## [Unreleased]

### Changed

#### Components

- Fire `neo-toast-close` on every close of a toast, not only on a close-button click. `detail.reason` names the cause: `close`, `action`, `timeout`, `swipe`, `dismiss` or `remove`. To handle only close-button clicks, check `detail.reason === "close"`.
- Pulse the opacity of an indeterminate `<neo-spinner>` under reduced motion. Its static starburst looked the same as a stalled page.

### Fixed

#### Components

- Show the `not-allowed` cursor on a disabled `<neo-button>`. The button showed the cursor of the element behind it, and a `title` on it never showed.
- Stop the hover and press styles on a disabled `<neo-toggle>`, `<neo-tab>` and `<neo-option>`, on the handles of a disabled `<neo-sortable>` and on the button of a disabled file input.
- Collapse the `<neo-toaster>` stack when the pointer leaves after a click on a close button. The stack stayed expanded, with every auto-dismiss timer paused, until a click outside the toaster.
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

[Unreleased]: https://github.com/romshark/morpheus/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/romshark/morpheus/compare/v0.1.0...v0.2.0
