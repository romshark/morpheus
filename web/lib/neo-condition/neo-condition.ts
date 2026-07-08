// Hidden by default (see neo-condition.css); the matching branch is
// revealed on connect, so the wrong-platform branch never flashes. With no
// JS the content stays hidden, since platform-specific hints are
// non-essential.

import { currentPlatform, type Platform } from "../platform";

function tokenMatches(token: string, platform: Platform): boolean {
	switch (token) {
		case "apple":
		case "mac":
		case "macos":
		case "ios":
			return platform === "apple";
		case "windows":
		case "win":
			return platform === "windows";
		case "linux":
			return platform === "linux";
		default:
			return false;
	}
}

// `platform` is a space-separated OR of platform tokens, optionally
// prefixed with `not `. Empty always matches.
function matchPlatform(expr: string): boolean {
	const e = expr.trim().toLowerCase();
	if (e === "") return true;
	const negate = e.startsWith("not ");
	const body = negate ? e.slice(4) : e;
	const platform = currentPlatform();
	const matched = body
		.split(/\s+/)
		.filter(Boolean)
		.some((t) => tokenMatches(t, platform));
	return negate ? !matched : matched;
}

export class NeoCondition extends HTMLElement {
	static observedAttributes = ["platform"];

	connectedCallback() {
		this.#apply();
	}

	attributeChangedCallback() {
		// Upgrade fires this before connectedCallback; let connect apply first.
		if (this.isConnected) this.#apply();
	}

	#apply() {
		// `contents` so the gate adds no box; empty string falls back to the
		// stylesheet's display:none.
		this.style.display = matchPlatform(this.getAttribute("platform") ?? "") ? "contents" : "";
	}
}

if (!customElements.get("neo-condition")) {
	customElements.define("neo-condition", NeoCondition);
}
