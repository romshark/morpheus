// Shared command-attribute contract for the server-driven components. A
// boolean attribute is a command channel, not a presence flag:
//
//   absent / removed   → no command; keep current state (or the default)
//   x="false" (ci)     → command false
//   present otherwise  → command true
//
// A fat morph re-emitting markup without `x` can't disturb client state: the
// server drives a value with x="true"/"false" or waives control by omitting
// it. Interactive-state attributes (open, checked, value, expanded, …) keep
// their current client state on absence and reflect their own state for CSS,
// guarding reflective writes so they aren't read back as commands. Config
// attributes (never mutated by the user) fall back to their default on absence
// via boolAttr; the server stays the source of truth.

export type BoolCommand = boolean | null;

// Reads the command: null when absent, false for x="false" (case-insensitive),
// true for present / x="true" / any other value.
export function boolCommand(host: Element, name: string): BoolCommand {
	if (!host.hasAttribute(name)) return null;
	return (host.getAttribute(name) ?? "").toLowerCase() !== "false";
}

// Config convenience: the command if present, else the default. Use for
// server-only knobs that the client never mutates.
export function boolAttr(host: Element, name: string, dflt: boolean): boolean {
	const cmd = boolCommand(host, name);
	return cmd === null ? dflt : cmd;
}

// warnBadAxis logs when `orientation` is set to a value a two-axis
// component does not support (e.g. "grid"). Dev-time aid for the raw-HTML
// path only; the typed Templ wrapper already rejects it for Go callers,
// and the layout falls back to the component default either way.
export function warnBadAxis(host: Element): void {
	const v = host.getAttribute("orientation");
	if (v && v !== "horizontal" && v !== "vertical") {
		console.warn(`<${host.localName}>: unsupported orientation="${v}"; use "horizontal" or "vertical".`);
	}
}

export type OpenCommand = "open" | "close" | null;

// `open` keeps a richer shape for the open-family call sites.
export function openCommand(host: Element): OpenCommand {
	const cmd = boolCommand(host, "open");
	return cmd === null ? null : cmd ? "open" : "close";
}
