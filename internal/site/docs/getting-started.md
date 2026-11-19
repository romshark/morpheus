# Getting started

Morpheus is a server-driven web components UI kit built around Go, [templ](https://templ.guide), and [Datastar](https://data-star.dev). Components are plain custom elements that emit DOM events and expose attribute hooks. They work in other stacks too, but the path of least resistance, and the one every demo on this site follows, is the one shown below.

## Install

Install the static assets the browser loads and the Go module that gives you templ helpers like `neo.Select` or `datastar.ComboboxAsync`.

### Static assets

The browser loads [`morpheus.css`](https://github.com/romshark/morpheus/blob/main/min/morpheus.css), 1 theme stylesheet (e.g. [`theme-default.css`](https://github.com/romshark/morpheus/blob/main/min/theme-default.css)), and the component bundle [`bundle.js`](https://github.com/romshark/morpheus/blob/main/min/bundle.js). [jsDelivr](https://www.jsdelivr.com) serves every tagged release straight from the repository. Load them in your page head:

```html ../examples/getting_started_install.html
```

Pin the tag, as above. jsDelivr also accepts floating refs such as `@latest` and partial versions. Those resolve to the newest matching tag, which pulls in breaking changes.

To self-host instead, take the same files from [`/min/`](https://github.com/romshark/morpheus/tree/main/min) or from a [release](https://github.com/romshark/morpheus/releases) and serve them yourself.

The [Bundle builder](bundle-builder.md) makes a bundle of only the components you choose. Its `morpheus.min.js` and `morpheus.min.css` replace `bundle.js` and `morpheus.css`, and it includes `theme-default.css`. The `morpheus` command builds the same files from the [command line](bundle-builder.md#command-line).

The kit reads `:root` custom properties of colours and shape. The theme stylesheet ([`theme-default.css`](https://github.com/romshark/morpheus/blob/main/min/theme-default.css) ships in light + dark) sets them. See the [Theming](theming.md) page on the full variable list and how to author custom palettes.

### Go module

To use the kit in a Go + templ project, add the helper packages to your module:

```bash
go get github.com/romshark/morpheus
```

`neo` exposes 1 templ per component (`neo.Select`, `neo.Combobox`, `neo.Button`, ...). `datastar` wraps the async-aware components (`datastar.ComboboxAsync`, `datastar.PopoverAsync`) with the SSE retry protocol pre-wired.
