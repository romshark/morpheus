# Contributing to Morpheus

Thank you for your interest in contributing to Morpheus, the web component UI kit!
This guide will help you get started.

## Reporting Bugs

If you find a bug, please
[open an issue](https://github.com/romshark/morpheus/issues)
and include:

- A clear description of the problem and steps to reproduce the issue.
- Browser and its version.
- Ideally, a link to reproduction repo or [codepen](http://codepen.io/) (or similar),
  or a short screen recording (most useful for visual bugs).
- Expected vs. actual behavior.
- Relevant error messages or (browser console) logs.
- Go version and OS (if the bug is related to the static site generation).

## Proposing Changes

Before starting work on a new feature or significant change,
please [open an issue](https://github.com/romshark/morpheus/issues)
first to discuss your idea. This helps avoid duplicate effort
and ensures your contribution aligns with the project's direction.
Minor bug fixes and small improvements can go straight to a pull request.

## Getting Started

1. Fork the repository and clone your fork.
2. Create a feature branch from `main`.
3. Make your changes.
4. Run `make gen` (this runs linting, formatting checks, and tests).
5. Commit and push your branch.
6. Open a pull request against `main`.

For development setup, commands, code style, testing conventions,
and commit message format, see the
[Developing](README.md#developing) section in the README.

## Development

### Prerequisites

- [Go](https://go.dev/dl/) (see version in `go.mod`)
- [Templ](https://templ.guide/)
- [golangci-lint](https://golangci-lint.run/)

## License

By contributing, you agree that your contributions will be
licensed under the [MIT License](LICENSE).