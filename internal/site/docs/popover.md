# Popover

Component `<neo-popover>` is an anchored floating panel attached to a trigger, with a [`[data-neo-popover-trigger]`](#slots-data-neo-popover-trigger) child and a [`[data-neo-popover-content]`](#slots-data-neo-popover-content) panel. The host owns positioning, the open/close events, outside-click and <neo-kbd>Esc</neo-kbd> dismissal, and the strict-placement clamp logic.

```playground
height: 24rem
- popover_default: Default
- popover_open: Open
- popover_placements: Placements
- popover_actions: With actions
- popover_tall: Tall content (clamps + scrolls)
- popover_strict: Strict placement
- popover_wide: Wide content (horizontal clamp)
- popover_hover: Hover to open
```

## Reference

### Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean`, reflected, observed | `false` | Controls panel visibility. |
| `trigger-action` | `"show" \| "hide"` | `toggle` | What clicking the trigger does. Default toggles open and closed; `show` only opens (for hover-then-click patterns like submenus, where a click must not close an already-open panel); `hide` only closes. |
| `placement` | `"bottom-start" \| "bottom" \| "bottom-end" \| "top-start" \| "top" \| "top-end" \| "left-start" \| "left" \| "left-end" \| "right-start" \| "right" \| "right-end"`, observed | `"bottom-start"` | Anchor position relative to the trigger. `start` and `end` on the top and bottom follow the direction; `left` and `right` don't. |
| `screen-offset` | `CSS length`, observed | `8px` | Margin kept clear of the viewport edges. Mirrors to `--neo-popover-screen-offset`. |
| `follow-scroll` | `"always" \| "until-trigger-invisible"` | `unset` | When absent, close on outside scroll. Set to `always` to stay anchored to the trigger during scroll. Set to `until-trigger-invisible` to stay anchored until the trigger leaves the viewport, then close. |
| `clamp-placement` | `boolean`, observed | `false` | Opt out of the default strict placement. The panel position re-anchors to keep itself inside the viewport when content would otherwise overflow, instead of staying glued to the configured side and shrinking `max-width`/`max-height`. |
| `min-fit-height` | `CSS length \| "content"`, observed | `"content"` | Minimum vertical slot the strict placement requires. If the slot at the configured side is shorter and the opposite side has more room, the panel auto-flips (e.g. `bottom-start` becomes `top-start`). `content` resolves from the panel's scroll height on each positioning pass. Mirrors to `--neo-popover-min-fit-height`. |
| `min-fit-width` | `CSS length \| "content"`, observed | `"content"` | Same as `min-fit-height` but for the horizontal axis (`left-*`/`right-*`). `content` resolves from the panel's scroll width. Use `0` to disable the horizontal flip. Mirrors to `--neo-popover-min-fit-width`. |
| `min-open-height` | `CSS length`, observed | `2rem` | Minimum usable vertical slot required to remain open after placement and auto-flip. If the bounded slot is smaller, the popover closes instead of rendering a cramped panel. Use `0` to disable. Mirrors to `--neo-popover-min-open-height`. |
| `min-open-width` | `CSS length`, observed | `2rem` | Same as `min-open-height` but for horizontal space. Use `0` to disable. Mirrors to `--neo-popover-min-open-width`. |
| `flip` | `true \| false`, observed | `true` | Auto-flip to the opposite side when the `min-fit-*` threshold is not met. Set `flip="false"` to pin the panel to the configured primary side; if opening would then make it too cramped, the popover scrolls the trigger into view and opens immediately. |
| `match-trigger-width` | `boolean`, observed | `false` | Size the panel's border-box width to the trigger's border-box width on every positioning pass. Used by `neo-select` and `neo-combobox`. |
| `hover` | `boolean` | `false` | Open on pointer hover over the trigger; close after the pointer leaves both the trigger and the content. Mouse only; touch falls back to click. While set, clicking the trigger always shows the panel (instantly, no delay) so touch and keyboard users have a way in; click never toggles it shut. |
| `hover-open-delay` | `integer (ms)` | `100` | Milliseconds the pointer must rest on the trigger before `hover` opens the panel. Filters out incidental cursor crossings. Does not apply to click. |
| `hover-close-delay` | `integer (ms)` | `200` | Milliseconds to wait after the pointer leaves both trigger and content before `hover` closes the panel. Long enough to bridge the gap between trigger and panel without snapping shut. |

### Slots

| Name | Description |
| --- | --- |
| `[data-neo-popover-trigger]` | Click target that opens the popover. |
| `[data-neo-popover-content]` | Floating panel content. |
| `[data-neo-popover-close]` | Element inside the content that closes the popover on click (matched via `closest`, which also matches a descendant). |

### Events

| Name | Detail | Bubbles | Description |
| --- | --- | --- | --- |
| `neo-popover-open` |  | yes | Fires when the popover opens. |
| `neo-popover-close` |  | yes | Fires when the popover closes. |
| `neo-popover-position` | `{ placement: string }` | yes | Fires after the panel is positioned; `placement` is the effective placement after any auto-flip or viewport clamp. |

### CSS variables

| Name | Default | Description |
| --- | --- | --- |
| `--neo-popover-bg` | `var(--btn-bg)` | Panel background. |
| `--neo-popover-color` | `var(--page-fg)` | Panel text color. |
| `--neo-popover-border-color` | `var(--btn-border)` | Panel border color. |
| `--neo-popover-border-width` | `1px` | Panel border width. |
| `--neo-popover-radius` | `var(--page-radius, 0.25rem)` | Panel corner radius. |
| `--neo-popover-padding` | `calc(var(--page-spacing, 0.25rem) * 4)` | Inner padding of the panel. |
| `--neo-popover-shadow` | `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)` | Panel box shadow. |
| `--neo-popover-min-width` | `14rem` | Panel minimum width. |
| `--neo-popover-max-width` | `22rem` | Panel maximum width. |
| `--neo-popover-z-index` | `1000` | Panel stacking order. |
| `--neo-popover-enter-duration` | `calc(140ms * var(--neo-duration-scale, 1))` | Open/close transition duration. |
| `--neo-popover-screen-offset` | `8px` | Minimum margin kept between the panel and the viewport edges when clamped. Overridable per-instance via the `screen-offset` attribute. |

## Examples

### Placements

Each side (`top`, `right`, `bottom`, `left`) pairs with an optional `-start` or `-end` alignment, for 12 combinations. Bare side names center the panel on that edge; `bottom-start` is the initial value.

```example popover_placements
min-height: 20rem
```

### With actions

Pair the popover with a confirm / cancel toolbar inside the content panel. The action buttons carry `data-neo-popover-close` so picking either dismisses the panel.

```example popover_actions
min-height: 15rem
```

### Tall content (clamps + scrolls)

When the panel is taller than the viewport it clamps to the screen (leaving [`screen-offset`](#attributes-screen-offset) of margin) and scrolls internally rather than overflowing the page.

```example popover_tall
min-height: 6rem
boundary: dismiss
```

### Strict placement

Setting [`flip="false"`](#attributes-flip) pins the panel to `bottom-start` and keeps that side instead of flipping above when the slot runs short. When the bottom slot is shorter than [`min-fit-height`](#attributes-min-fit-height), opening the popover scrolls the trigger into a useful position and shows the panel immediately. Set the [`clamp-placement`](#attributes-clamp-placement) attribute to let the panel re-anchor inside the viewport instead. Scroll so the trigger sits near the bottom of the viewport, then open the panel to see it scroll into place.

```example popover_strict
min-height: 6rem
boundary: dismiss
```

### Auto-flip threshold

Strict placement keeps the panel glued to the configured side. When that slot is shorter than [`min-fit-height`](#attributes-min-fit-height) (here `8rem`; default `content`) and the opposite side has more room, the primary axis flips (`bottom-start` becomes `top-start`). Scroll so the trigger sits near the bottom of the viewport, then open the panel to see it flip.

```example popover_auto_flip
min-height: 6rem
boundary: dismiss
```

### Wide content (horizontal clamp)

When the panel is wider than the viewport it clamps to the screen (leaving [`screen-offset`](#attributes-screen-offset) of margin) and scrolls horizontally inside the panel. The horizontal clamp mirrors the vertical one.

```example popover_wide
min-height: 6rem
boundary: dismiss
```

### Hover to open

Set [`hover`](#attributes-hover) on the host and the panel opens when the pointer enters the trigger, closing after the pointer leaves both the trigger and the panel. The [`hover-open-delay`](#attributes-hover-open-delay) filters incidental cursor crossings; [`hover-close-delay`](#attributes-hover-close-delay) gives the pointer time to bridge the gap from trigger to panel before the close kicks in. Click still works (instantly, no delay) so touch and keyboard users have a way in; clicking a hover popover never toggles it shut.

```example popover_hover
min-height: 16rem
```

## Examples: Datastar

### Morphing during interaction

A Datastar app can fat-morph the page at any moment, which can change a `<neo-popover>`'s panel content while it is open. Open the popover and watch autoplay push progress into it. The panel stays open and its content reconciles in place because the host element stays mounted across the morph, with no [`open`](#attributes-open) attribute needed.

```playground
id: popover-morph-playground
autoplay: true
height: 20rem
- popover_morph_initial: Initial
- popover_morph_50: Progress: 50%
- popover_morph_75: Progress: 75%
- popover_morph_100: Progress: 100%
```

### Cascading popovers

Popovers nest naturally. Each child popover lives inside its parent's content panel. A click inside any open level keeps every ancestor open, and a click outside closes the whole chain. <neo-kbd>Esc</neo-kbd> closes one level at a time. Submenu triggers are regular menu items; non-submenu items carry `data-neo-popover-close` so picking one collapses the entire stack. Hovering a submenu trigger opens it; hovering a sibling closes any open submenu at that level.

<script>
		// Hovering an item closes any open sibling submenu and opens
		// the hovered one if it is a <neo-popover>.
		window.__neoMenuHover = function(nav, evt) {
			let item = evt.target;
			while (item && item.parentElement !== nav) item = item.parentElement;
			if (!item) return;
			for (const child of nav.children) {
				if (child === item) continue;
				if (child.tagName === 'NEO-POPOVER' && child.hasAttribute('open')) {
					child.hide && child.hide();
				}
			}
			if (item.tagName === 'NEO-POPOVER' && !item.hasAttribute('open')) {
				item.show && item.show();
			}
		};

		// ArrowRight opens a submenu trigger (focus via __neoMenuOpen);
		// ArrowLeft closes and returns focus to the trigger. Other arrows
		// fall through to navgroup's Up/Down handling.
		window.__neoMenuKey = function(nav, evt) {
			const key = evt.key;
			if (key !== 'ArrowRight' && key !== 'ArrowLeft') return;
			const focused = document.activeElement;
			if (!focused || focused.closest('neo-navgroup') !== nav) return;
			if (key === 'ArrowRight') {
				const popover = focused.parentElement;
				if (
					popover &&
					popover.tagName === 'NEO-POPOVER' &&
					focused.matches('[data-neo-popover-trigger]')
				) {
					evt.preventDefault();
					popover.show && popover.show();
				}
				return;
			}
			// ArrowLeft: only meaningful for nested submenus.
			const enclosing = nav.closest('neo-popover');
			if (!enclosing) return;
			const trigger = enclosing.querySelector(
				':scope > [data-neo-popover-trigger]',
			);
			const triggerNav = trigger && trigger.closest('neo-navgroup');
			if (trigger && triggerNav && triggerNav !== nav) {
				evt.preventDefault();
				enclosing.hide && enclosing.hide();
				trigger.focus();
			}
		};

		// On open, focus the first item of the menu's navgroup. Stop
		// propagation because `neo-popover-open` bubbles; otherwise the
		// ancestor's __neoMenuOpen yanks focus out and the submenu's
		// outside-focus guard hides it on the spot.
		window.__neoMenuOpen = function(popover, evt) {
			if (evt && typeof evt.stopPropagation === 'function') {
				evt.stopPropagation();
			}
			requestAnimationFrame(() => {
				const nav = popover.querySelector(
					':scope > [data-neo-popover-content] > neo-navgroup',
				);
				if (nav && typeof nav.focusItem === 'function') {
					nav.focusItem(0);
				}
			});
		};
	</script>

```example popover_cascading
min-height: 24rem
```

### Lazy-loaded content

A popover whose body is fetched on first open. Wire `data-on:neo-popover-open` to a loader that morphs the rendered content into the placeholder.

- The loader fires once per open; bind `requestCancellation` to a fresh `AbortController` so the request can be dropped.
- [`neo-popover-close`](#events-neo-popover-close) aborts the in-flight request. Closing mid-load leaves no stale content. Open the popover to see it.

```example popover_lazy
min-height: 16rem
script: sim/popover/loadcontent.js
simulator: delay
```

### Async load with failure swap

A popover that fetches its body on open, shows a loading placeholder while the request is in flight, and swaps in a failure placeholder once Datastar exhausts its retry budget (it dispatches `datastar-fetch` with `type: 'retries-failed'`). On success the server morphs the body in place.

The demo retries with `retry: auto`, which covers only network throws. Use the `server unreachable` control to force one. Datastar exhausts the retry budget, fires `retries-failed`, and the failure placeholder swaps in. A `server response status` error is not retried by `auto`. The swap then falls back to `finished`-after-error. Also see [Datastar action options](https://data-star.dev/reference/actions#options).

<template id="popoverAsyncDemo-success-template">
<div id="popoverAsyncDemo-body" class="popover-lazy-body popover-lazy-loaded"><h3>Recent activity</h3><ul class="popover-lazy-list"><li><img class="person-avatar" src="/static/avatar/avatar_1.svg" alt="" aria-hidden="true"/><div class="popover-lazy-text"><div class="popover-lazy-name">Diego Vega</div><div class="popover-lazy-meta">CFO</div></div></li><li><img class="person-avatar" src="/static/avatar/avatar_2.svg" alt="" aria-hidden="true"/><div class="popover-lazy-text"><div class="popover-lazy-name">Jan O&#39;Sullivan</div><div class="popover-lazy-meta">Lead Designer</div></div></li><li><img class="person-avatar" src="/static/avatar/avatar_3.svg" alt="" aria-hidden="true"/><div class="popover-lazy-text"><div class="popover-lazy-name">Evelyn Kone</div><div class="popover-lazy-meta">Data Analyst</div></div></li><li><img class="person-avatar" src="/static/avatar/avatar_4.svg" alt="" aria-hidden="true"/><div class="popover-lazy-text"><div class="popover-lazy-name">Samira Khalil</div><div class="popover-lazy-meta">Head of Engineering</div></div></li></ul></div>
</template>

```example popover_async_failure
min-height: 16rem
script: sim/popover/asyncload.js
simulator: errors
tabs: templ script
```

<template id="popoverLazyDemo-template">
<div id="popoverLazyDemo-body" class="popover-lazy-body popover-lazy-loaded"><h3>Recent activity</h3><ul class="popover-lazy-list"><li><img class="person-avatar" src="/static/avatar/avatar_1.svg" alt="" aria-hidden="true"/><div class="popover-lazy-text"><div class="popover-lazy-name">Diego Vega</div><div class="popover-lazy-meta">CFO</div></div></li><li><img class="person-avatar" src="/static/avatar/avatar_2.svg" alt="" aria-hidden="true"/><div class="popover-lazy-text"><div class="popover-lazy-name">Jan O&#39;Sullivan</div><div class="popover-lazy-meta">Lead Designer</div></div></li><li><img class="person-avatar" src="/static/avatar/avatar_3.svg" alt="" aria-hidden="true"/><div class="popover-lazy-text"><div class="popover-lazy-name">Evelyn Kone</div><div class="popover-lazy-meta">Data Analyst</div></div></li><li><img class="person-avatar" src="/static/avatar/avatar_4.svg" alt="" aria-hidden="true"/><div class="popover-lazy-text"><div class="popover-lazy-name">Samira Khalil</div><div class="popover-lazy-meta">Head of Engineering</div></div></li></ul></div>
</template>
