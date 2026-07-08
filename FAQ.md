# FAQ

## Will Morpheus work with my JavaScript framework of choice?

Most likely. The components are standard [custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements): they dispatch DOM events and read plain HTML attributes, so they are framework-agnostic. Only [Datastar](https://data-star.dev) is tested against, since it drives the landing and documentation pages, but [HTMX](https://htmx.org), [Alpine](https://alpinejs.dev/), and other frontend frameworks work the same way.

Convenience wrappers for libraries such as React are not yet provided.

## Is it production-ready?

No. Morpheus is an open alpha. Stability and full correctness are not yet guaranteed. See [TODO](TODO.md).

## Will parts of the kit move behind a paywall at some point?

No. Anything available for free stays free. The source is public on GitHub under the MIT license, so a fork remains possible if the project is abandoned. Paid extras may be added later, but they will not include what was previously free.

## How can I help?

See [TODO](TODO.md).

## Can I donate to support your efforts?

Donations are not currently accepted. For financial support, contact [roman.scharkov@gmail.com](mailto:roman.scharkov@gmail.com).

## How does this compare to Shoelace / Web Awesome / basecoatui / etc.?

Those kits have their own goals. Morpheus targets server-driven patching architectures: every component is built so the server can morph-patch the DOM (see [Datastar Tao](https://data-star.dev/guide/the_tao_of_datastar#in-morph-we-trust) and [bigskysoftware/idiomorph](https://github.com/bigskysoftware/idiomorph)) without breaking internal client state. This requires reactive custom elements and purely declarative behavior control. This constraint drives API choices that other kits do not need.

## Does it work without JavaScript?

No. [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) do not function when JavaScript is disabled.

## If the name of the kit is "Morpheus", why are the components prefixed with "neo-"?

Both names come from [The Matrix](https://en.wikipedia.org/wiki/The_Matrix). "Neo" is also ancient Greek νέος (néos, "new, young"), and `<neo-slider>` is simply shorter than `<morpheus-slider>`.
