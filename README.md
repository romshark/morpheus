![Static Badge](https://img.shields.io/badge/version-alpha%20v0.2.0-yellow?style=for-the-badge)
[![Requires Baseline 2024](https://img.shields.io/badge/requires-Baseline%202024-4285f4?style=for-the-badge)](#browser-support)

# Morpheus

Morpheus is an open alpha web component UI kit. It provides 49 components and 5 utility components, and targets server-driven architectures.

## Install

Load the base stylesheet, 1 theme stylesheet and the component bundle. [jsDelivr](https://www.jsdelivr.com) serves every tagged release straight from this repository.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/romshark/morpheus@v0.2.0/min/morpheus.css"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/romshark/morpheus@v0.2.0/min/theme-default.css"/>
<script type="module" src="https://cdn.jsdelivr.net/gh/romshark/morpheus@v0.2.0/min/bundle.js"></script>
```

Pin the tag. Floating refs such as `@latest` resolve to the newest matching tag and pull in breaking changes. To self-host, take the same files from [`/min/`](min) or from a [release](https://github.com/romshark/morpheus/releases).

To ship only the components a page uses, build a trimmed bundle on the [bundle builder](https://romshark.github.io/morpheus/bundle-builder/) page or with the `morpheus` command, which needs Go:

```sh
go run github.com/romshark/morpheus@v0.2.0 bundle -components select,dialog -o static/morpheus
```

Its `morpheus.min.js` and `morpheus.min.css` replace `bundle.js` and `morpheus.css`. It also writes `theme-default.css`, and `-themes` picks others, such as `-themes default,rose`. [Command line](https://romshark.github.io/morpheus/bundle-builder/#command-line) describes the command.

The Go module carries the templ wrappers (`neo.Select`, `datastar.ComboboxAsync`, and one per component):

```sh
go get github.com/romshark/morpheus
```

See [Getting started](https://romshark.github.io/morpheus/getting-started/) for the walkthrough.

## Motivation

Morpheus targets a server-centric stack of Go, [Templ](https://github.com/a-h/templ), and [Datastar](https://data-star.dev). [basecoatui](https://basecoatui.com) covers much of this stack but has limits. Its [combobox](https://basecoatui.com/components/combobox/) cannot be patched from the server without corrupting internal JavaScript state, a fix that has been on its roadmap for some time.

Morpheus is a proof of concept of a web component UI kit that is easy to patch from the server through what Datastar calls ["fat morphs"](https://data-star.dev/guide/the_tao_of_datastar/#in-morph-we-trust). A fat morph re-renders a single page template and sends the HTML over SSE to be morph-patched onto the existing DOM. It is designed from scratch for server-driven architectures, with other use cases in mind. Morph-based patching also exists in other ecosystems, such as:

- [Alpine.js morph plugin](https://alpinejs.dev/plugins/morph)
- [HTMX Idiomorph extension](https://htmx.org/extensions/idiomorph/)
- [Hotwire Turbo](https://turbo.hotwired.dev/handbook/page_refreshes)
- [Laravel Livewire](https://livewire.laravel.com/docs/morphing).

For the architecture and the reasoning behind these choices, see [DESIGN.md](DESIGN.md).

## Browser support

Morpheus targets [Baseline](https://web.dev/baseline) Newly available as of August 2024. Minimum versions:

| Browser        | Minimum |
| -------------- | ------- |
| Chrome / Edge  | 125     |
| Safari         | 17.5    |
| Firefox        | 129     |

There is no polyfill layer and no legacy fallback path. The kit uses the platform directly, and these features set the floor:

- [`@starting-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style) and [`transition-behavior: allow-discrete`](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior): enter and exit animations for surfaces that toggle `display`.
- [`:state()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:state) and [`CustomStateSet`](https://developer.mozilla.org/en-US/docs/Web/API/CustomStateSet): a component's internal state, kept out of the light DOM so a morph cannot strip it (see [Internal state](DESIGN.md#internal-state)).
- [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) and [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog): top-layer rendering, modal lifecycle, and light dismiss.
- [`:has()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:has), [container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries), and [`round()`](https://developer.mozilla.org/en-US/docs/Web/CSS/round): layout and sizing that reacts to content and to the parent box rather than the viewport.

[`scrollend`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event) and [`:host-context()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:host-context) degrade instead of setting the floor. `scrollend` falls back to a settle timer where it is missing. `:host-context()` (Chromium and WebKit only) carries an increased-contrast refinement that Firefox skips.

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
