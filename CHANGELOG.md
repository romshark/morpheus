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

[Unreleased]: https://github.com/romshark/morpheus/compare/v0.1.0...HEAD
