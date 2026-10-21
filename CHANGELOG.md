# Changelog

This file records the notable changes of each release in the format of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The release workflow publishes the section of a version as its GitHub release notes. The changelog starts after v0.1.0, the first release.

## [Unreleased]

### Added

#### Components

- Add `<neo-aura>`, a decorative light around the element it wraps: a ring with a rotating light and a glow behind it. Custom properties set the light and its motion. The ring follows the corner radius of the wrapped element, and `disabled` turns the light off. `neo.Aura` renders it from Templ.

### Changed

#### Templ wrappers

- Require templ v0.3.1070 in the `neo` and `datastar` packages. Upgrade the templ CLI to the same version and regenerate. This version reads `@` after a space in text as a component call, and renders the line break after a call without children as a space: check text next to component calls.

[Unreleased]: https://github.com/romshark/morpheus/compare/v0.1.0...HEAD
