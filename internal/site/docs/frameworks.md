# Frameworks

Morpheus is **framework-agnostic**. Its components are standard custom elements that render as plain DOM nodes anywhere. Pass state as attributes, put slotted content between the tags, and subscribe to Morpheus custom events. The same contract works in React, Vue, Svelte, Solid, server-rendered HTML, or plain vanilla JavaScript.

The simplest way to use Morpheus is to [load the bundle once](getting-started.md) and write the elements directly in your framework's templates, the same as any other HTML.

Morpheus components are designed to be controlled by changes to the DOM in a declarative way, and hence don't provide an imperative API surface. Control them through attributes and observe state changes through events. For example:

- Turn a `<neo-switch>` on by setting its `checked` attribute, and react to the user toggling it by listening for the `neo-switch-change` event.
- Show a toast by rendering a `<neo-toast duration="4000">` inside the `<neo-toaster>`; it animates in and auto-dismisses after 4 seconds. It emits a `neo-toast-close` event when it closes, with the cause in `detail.reason`.

### Datastar (Signals)

The following example uses [Reactive Datastar signals](https://data-star.dev/guide/reactive_signals/) to control the components straight from HTML attributes, with no build step and no component wrapper. The example below is an accent-color picker held in 2 **local signals**; the `_` prefix keeps them client-only, never serialized to a backend. A `data-on:*` listener reads the kit's events and `data-attr:*` bindings push the values back. This keeps the `<neo-select>`, the `<neo-color-field>`, and the readout in sync.

```example datastar_local
min-height: 18rem
min-width: 20rem
wrap: framework-demo-root
```

### Datastar (server-driven)

Morpheus targets **server-driven** UIs just as well. This is the same picker, but no display state lives in the browser. The `<neo-select>` and `<neo-color-field>` post their change, and the server resolves the named-vs-custom logic and **morphs** the whole picker back. The **Server script** tab holds the handler. This page fakes the backend with an in-browser simulator, but the contract (action out, element morph back) is exactly what a real Datastar endpoint emits.

```example datastar_morph
min-height: 18rem
min-width: 20rem
wrap: framework-demo-root
script: sim/frameworks/accent.js
```

### HTMX

The HTMX implementation should be very similar to the [server-driven Datastar example](#datastar-server-driven).

### React

The following example uses [React 19.2.7](https://react.dev). One piece of React state keeps the `<neo-select>`, the `<neo-color-field>`, and the hex `<neo-textinput>` in sync.

```example react
min-height: 18rem
min-width: 20rem
tab: tsx
```

<script type="module" src="/static/react-demo.js"></script>

### Alpine.js {#alpine}

[Alpine.js v3.x.x](https://alpinejs.dev) binds in the markup. `x-data` holds the color, the option, and the named-vs-custom logic; `:value` pushes that state onto each element and `@event` listeners feed the kit's events back. It needs no build step and no component wrapper. The declarative bindings provide the 2-way binding.

```example alpine_demo
min-height: 18rem
min-width: 20rem
tab: html
wrap: framework-demo-root
```

<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
