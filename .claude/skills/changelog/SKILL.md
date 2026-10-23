---
name: changelog
description: Write CHANGELOG.md entries, including Security entries, and release a version. Use when adding a changelog entry or releasing.
paths:
  - "CHANGELOG.md"
---

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The release workflow publishes each tag's section as its GitHub release notes and fails when it's missing. `TestChangelogReleases` validates version headings.

- Add user-visible changes to the shippable kit under `## [Unreleased]` in the same commit: the custom elements, their CSS and tokens, and the `neo` and `datastar` packages. Omit `docs`, `test`, `refactor`, `chore` and `ci`.
- Sort entries into `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed` and `Security`.
- Within a section, group entries under `####` subheadings by where the change applies, in this order: `Components` for the custom elements, their CSS and the bundle; `Templ wrappers` for the `neo` and `datastar` packages. Leave out a subheading with no entries.
- Use imperative entries like commit titles: `Add <neo-aura>`. Say enough for users to determine whether they are affected.
- A `Security` entry follows [Security entries](#security-entries).
- A breaking change gives the migration steps.
- To release, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, insert an empty `## [Unreleased]` and update the compare links. Set `VERSION` and the version pins in `README.md` (the CDN URLs and `go run`) to `vX.Y.Z`, rebuild `/min/` (its banner carries the version), commit, then tag `vX.Y.Z` and push the tag.

# Security entries

A security entry lets users determine exposure and remediation:

- State who can read or do what to whom: "markup in an option label runs as script", not "an XSS issue".
- Describe affected pages with terms users can find in their markup.
- Give exact affected versions, verified against the release history.
- Give upgrade steps. Include a workaround or say there is none.
- Link the GHSA or CVE when one exists.

Leave severity labels, CVSS scores and exploit steps to the advisory.
