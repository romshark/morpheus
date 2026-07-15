![Static Badge](https://img.shields.io/badge/version-pre--alpha%20v0.1.0-yellow?style=for-the-badge)

# Morpheus

Morpheus is an open alpha web component UI kit. It provides 48 components and 5 utility components, and targets server-driven architectures.

## Motivation

Morpheus targets a server-centric stack of Go, [Templ](https://github.com/a-h/templ), and [Datastar](https://data-star.dev). [basecoatui](https://basecoatui.com) covers much of this stack but has limits: its [combobox](https://basecoatui.com/components/combobox/) cannot be patched from the server without corrupting internal JavaScript state, a fix that has been on its roadmap for some time.

Morpheus is a proof of concept of a web component UI kit that is easy to patch from the server through what Datastar calls ["fat morphs"](https://data-star.dev/guide/the_tao_of_datastar/#in-morph-we-trust): a single page template is re-rendered and the HTML is sent over SSE to be morph-patched onto the existing DOM. It is designed from scratch for server-driven architectures, with other use cases in mind. Morph-based patching also exists in other ecosystems, such as:

- [Alpine.js morph plugin](https://alpinejs.dev/plugins/morph)
- [HTMX Idiomorph extension](https://htmx.org/extensions/idiomorph/)
- [Hotwire Turbo](https://turbo.hotwired.dev/handbook/page_refreshes)
- [Laravel Livewire](https://livewire.laravel.com/docs/morphing).

For the architecture and the reasoning behind these choices, see [DESIGN.md](DESIGN.md).

## Developing

Prerequisites:
- [Go](https://go.dev/dl/) (minimum version in [go.mod](go.mod))
- [Templ](https://templ.guide/)
- [golangci-lint](https://golangci-lint.run/)
- [Templier](https://github.com/romshark/templier)
- Node.js (for esbuild).

Commands:

- `make gen`: full build (install js deps, bundle JS/CSS, run `templ generate`, render the static site into `./dst`).
- `make watch`: incremental rebuilds with live-reload via [templier](https://github.com/romshark/templier).
- `make bundle-size`: report raw/gzip/brotli sizes of the shippable JS + CSS.
- `make clean`: remove `./dst` and generated bundles.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

## FAQ

See [FAQ.md](FAQ.md).
