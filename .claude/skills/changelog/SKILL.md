---
name: changelog
description: Write CHANGELOG.md entries, including Security entries, and release a version. Use when adding a changelog entry or releasing.
paths:
  - "CHANGELOG.md"
---

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each tag's section becomes its GitHub release notes, and the release fails without one.

- Record user-visible changes to the shippable kit (the custom elements, their CSS and tokens, and the `neo` and `datastar` packages) under `## [Unreleased]`, in the same commit. Leave out `docs`, `test`, `refactor`, `chore` and `ci` changes.
- Sort entries into `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed` and `Security`.
- Within a section, group entries under `####` subheadings by where the change applies. `Components` (the custom elements, their CSS and the bundle) comes first, then `Templ wrappers` (the `neo` and `datastar` packages). Skip an empty subheading.
- Write entries in the imperative, like commit titles (`Add <neo-aura>`), with enough detail for users to tell whether they're affected.
- A breaking change includes migration steps.
- A `Security` entry follows [Security entries](#security-entries).

To release, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, add a new empty `## [Unreleased]` and update the compare links. Set `VERSION` and the version pins in `README.md` (the CDN URLs and `go run`) to `vX.Y.Z`, rebuild `/min/` (its banner carries the version), commit, then tag `vX.Y.Z` and push the tag.

# Security entries

A security entry tells users whether they're exposed and how to fix it.

- Say who can read or do what to whom. Write "markup in an option label runs as script", not "an XSS issue".
- Describe affected pages in terms users can find in their own markup.
- Give the exact affected versions, checked against the release history.
- Give upgrade steps, plus a workaround or a plain statement that there is none.
- Link the GHSA or CVE when one exists.

Leave severity labels, CVSS scores and exploit steps to the advisory.
