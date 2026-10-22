# Changelog

This file records the notable changes of each release in the format of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The release workflow publishes the section of a version as its GitHub release notes. The changelog starts after v0.1.0, the first release.

## [Unreleased]

### Added

#### Components

- Add `<neo-aura>`, a decorative light around the element it wraps: a ring with a rotating light and a glow behind it. Custom properties set the light and its motion. The ring follows the corner radius of the wrapped element, and `disabled` turns the light off. `neo.Aura` renders it from Templ.

### Changed

#### Templ wrappers

- Require templ v0.3.1070 in the `neo` and `datastar` packages. Upgrade the templ CLI to the same version and regenerate. This version reads `@` after a space in text as a component call, and renders the line break after a call without children as a space: check text next to component calls.

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
- Hide `<neo-tooltip>` content with `open="false"` before the script loads. The `neo` wrapper renders that attribute for `Open: neo.Set(false)`. Content in the markup, such as an element marked with `neo.TooltipContent`, showed until the script loaded.

[Unreleased]: https://github.com/romshark/morpheus/compare/v0.1.0...HEAD
