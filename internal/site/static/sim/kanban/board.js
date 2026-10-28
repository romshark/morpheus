// Server for the kanban demo. Owns the board and the set of unconfirmed
// operations; renders the whole column strip and ships it as one fat
// morph over a single SSE projection stream.
//
// It does not own which field a client has open for editing. That is
// view state: local to one client, invisible to everyone else, and not
// worth a round-trip. See the editor renderer below.
//
// Commands never render. They mutate state, bump the revision, and let
// the stream patch every connected client, so the actor and an observer
// in another tab take the same path. That is what makes the intent
// markers honest: a card reads "Moving…" because the server says the
// move is pending, not because the browser guessed.

import sim from "/static/datasim.js";

// --- state -----------------------------------------------------------

const COLUMN_SEED = [
	{
		title: "Backlog",
		cards: [
			["Audit focus order in the dialog", "Tab currently escapes the panel once the footer is reached."],
			["Drop the legacy colour tokens", ""],
		],
	},
	{
		title: "In progress",
		cards: [["Connected sortable lists", "Cards move between columns; the receiving list reports itself in the drop event."]],
	},
	{
		title: "Review",
		cards: [["Spinner repaints every frame", "Rotate the composited wrapper instead of the SVG arc."]],
	},
	{ title: "Done", cards: [["Ship the morph tolerance levels", ""]] },
];

let board;
let nextId = 0;
// Entity id → what the server is doing to it but has not committed.
let pending = new Map();
// Per-entity command counter. A newer command for the same entity wins,
// which is what supersedes an in-flight move when a card is dragged
// again before the first write lands.
const opSeq = new Map();
// Off until the toolbar switch asks for it. The switch only posts on
// change, so this is the board's state until someone flips it.
let collabEnabled = false;
let revision = 0;
let waiters = [];

function id(prefix) {
	nextId += 1;
	return `${prefix}-${nextId}`;
}

function seed() {
	nextId = 0;
	pending = new Map();
	opSeq.clear();
	board = COLUMN_SEED.map((col) => ({
		id: id("kb-col"),
		title: col.title,
		cards: col.cards.map(([title, desc]) => ({ id: id("kb-card"), title, desc })),
	}));
}
seed();

// Wake every open stream. Each command calls this twice: once for the
// intent, once for the outcome.
function publish() {
	revision += 1;
	for (const wake of waiters.splice(0)) wake();
}

// Resolves on the next publish, on the resync deadline, or when the
// client disconnects, whichever comes first.
function nextPublish(signal, timeoutMs) {
	return new Promise((resolve) => {
		let done = false;
		const settle = () => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			signal.removeEventListener("abort", settle);
			waiters = waiters.filter((w) => w !== settle);
			resolve();
		};
		const timer = setTimeout(settle, timeoutMs);
		signal.addEventListener("abort", settle, { once: true });
		waiters.push(settle);
	});
}

// --- lookups ---------------------------------------------------------

function findColumn(colId) {
	return board.find((c) => c.id === colId) ?? null;
}

function locateCard(cardId) {
	for (let ci = 0; ci < board.length; ci++) {
		const index = board[ci].cards.findIndex((card) => card.id === cardId);
		if (index !== -1) return { column: board[ci], index, card: board[ci].cards[index] };
	}
	return null;
}

// Claim the entity for this command. A later claim for the same entity
// makes this one stale, so its outcome is dropped instead of undoing
// work the newer command already did.
function claim(entityId) {
	const seq = (opSeq.get(entityId) ?? 0) + 1;
	opSeq.set(entityId, seq);
	return () => opSeq.get(entityId) === seq;
}

// --- rendering -------------------------------------------------------

const esc = (value) =>
	String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

// A Datastar expression lives in an attribute, so a literal quote in an
// interpolated id would close it early. Ids are generated, but escaping
// keeps the renderer safe if they ever stop being.
const expr = (value) => esc(value);

// The unconfirmed-operation row. Server state, so every client watching
// the board sees the same marker on the same card.
// hiddenWhileEditing names an $_kb_edit key whose open editor reports
// this same command itself.
function intentRow(entityId, hiddenWhileEditing) {
	const op = pending.get(entityId);
	if (!op) return "";
	const show = hiddenWhileEditing ? ` data-show="$_kb_edit !== '${expr(hiddenWhileEditing)}'"` : "";
	return (
		`<p class="kb-intent" role="status"${show}>` +
		`<neo-spinner style="--neo-spinner-size: 0.85rem;"></neo-spinner>` +
		`${esc(op)}</p>`
	);
}

// The local acknowledgement row: visible from the moment the request
// leaves the browser until it settles, covering the latency before the
// server's own intent patch arrives.
//
// Its wording comes from the acting expression rather than being fixed
// here, so it reads the same as the server's own marker below. The two
// rows report different facts (sent vs received) but that difference is
// not the user's problem, and swapping the text mid-operation only looks
// like something changed.
//
// _kb_ack is a set, not one id: several commands can be outstanding at
// once, and a single slot would drop the first card's marker the moment
// the second card was moved.
function ackRow(entityId, hiddenWhileEditing) {
	const guard = hiddenWhileEditing ? ` && $_kb_edit !== '${expr(hiddenWhileEditing)}'` : "";
	return (
		`<p class="kb-ack" role="status" data-attr:data-kb-on="${acked(entityId)}${guard}">` +
		`<neo-spinner style="--neo-spinner-size: 0.85rem;"></neo-spinner>` +
		`<span data-text="$_kb_acklabel"></span></p>`
	);
}

// A button that reports its own command. An add has no row of its own to
// mark and no card to mark either (the card does not exist yet), so the
// control that started it carries the progress.
//
// Busy from the click, not from the server's first patch. That patch is a
// request latency, a handler, and a response latency away; until it lands
// the button is the only thing the user has to look at, and a control
// that does not react reads as a click that missed. The local marker
// covers exactly that wait. The server's own flag covers every other
// client and outlives the response, so the two never leave a gap.
//
// One expression drives the label and the disabled state together. Two
// drivers on different clocks show one command as two visible steps: the
// button releasing before its label changes back.
//
// data-indicator is what makes the local half local. Datastar holds it
// true for exactly this button's request, so it needs no arming and no
// clearing, and another command settling first cannot take it down. The
// shared _kb_ack set is the wrong clock here: it is cleared on a timer
// after the last outstanding command, which for a button is long after
// the patch that already showed the work done.
function busyButton({ entityId, attrs, idle, busy, onClick }) {
	const flight = `_kbBusy.${entityId.replace(/[^A-Za-z0-9]/g, "_")}`;
	const busyExpr = pending.has(entityId) ? "true" : `$${flight}`;
	return (
		`<neo-button ${attrs} data-indicator="${flight}"` +
		` data-attr:data-kb-busy="${busyExpr}"` +
		` data-attr:disabled="${busyExpr} ? 'true' : 'false'"` +
		` data-on:click="${onClick}">` +
		`<span class="kb-btn-idle">${esc(idle)}</span>` +
		`<span class="kb-btn-busy">` +
		`<neo-spinner style="--neo-spinner-size: 0.85rem;"></neo-spinner>` +
		`${esc(busy)}</span>` +
		`</neo-button>`
	);
}

// Every command scopes cancellation to itself. Datastar's default
// aborts the previous request sharing an element and URL, which across
// this board means one card's save killing another's. Ordering for the
// same entity is the server's job (see claim), not the transport's.
const POST_OPTS = "{requestCancellation: new AbortController(), retryMaxCount: 2}";

// The outstanding-command set, held as "|id||id|" so a plain substring
// test is exact and no signal path has to be built at runtime.
const arm = (entityId) => `$_kb_ack = $_kb_ack + '|${expr(entityId)}|';`;
const acked = (entityId) => `$_kb_ack.includes('|${expr(entityId)}|')`;
const fire = (url) => `$_kb_cmds = $_kb_cmds + 1; @post('${expr(url)}', ${POST_OPTS})`;

// Entity keys for the two add commands. They are kept off the column id
// so an add and a rename of the same column mark different things.
const addCardKey = (columnId) => `add-card:${columnId}`;
const ADD_COLUMN_KEY = "add-column";

// Opening an editor is view state, not board state: it belongs to one
// client, changes nothing anyone else can see, and must not wait for a
// round-trip. So every field ships both of its states and the local
// $_kb_edit signal picks which one shows. The template still carries
// every state; the data choosing between them is just closer to hand.
//
// $_kb_edit holds "<entity id>:<field>", or "" for nothing being edited.
const editKey = (entityId, field) => `${entityId}:${field}`;

// The label half. Double-clicking it only writes signals.
function editableLabel({ tag, cls, entityId, field, idSignal, text, empty }) {
	const key = editKey(entityId, field);
	return (
		`<${tag} class="${cls}"${empty ? " data-kb-empty" : ""} title="Double-click to edit"` +
		` data-show="$_kb_edit !== '${expr(key)}'"` +
		` data-on:dblclick="$${idSignal} = '${expr(entityId)}'; $_kb_edit = '${expr(key)}'">` +
		`${esc(text)}</${tag}>`
	);
}

// The field half. `variant` names the label it stands in for, so it
// carries that label's metrics and the swap does not resize the card.
//
// Committing is the only part that reaches the server. The editor stays
// open while the write is in flight (that is what the Save button
// reports) and closes on success; a failure leaves the typed text in
// place to retry.
function editor({ entityId, field, variant, label, value, url, idSignal, multiline }) {
	const key = editKey(entityId, field);
	const open = `$_kb_edit === '${expr(key)}'`;
	const setTarget = `$${idSignal} = '${expr(entityId)}'; $kb_card = '${expr(entityId)}'; `;
	// An edit that changed nothing is not a command. Opening a field and
	// tabbing away, or pressing Enter on untouched text, would otherwise
	// spend a round-trip for the server to decide it had nothing to do,
	// and flash "Saving…" while it did. The value attribute is the
	// server's own copy, kept current by the patches.
	const commit = (fieldExpr) =>
		`const _f = ${fieldExpr}, _v = _f.value.trim(); ` +
		`if (_v === (_f.getAttribute('data-kb-value') ?? '').trim()) { $_kb_edit = '' } else { ` +
		`${setTarget}$kb_value = _v; $_kb_acklabel = 'Saving…'; ${arm(entityId)} ${fire(url)} }`;
	const selfCommit = commit("el");
	// Enter and Escape share one data-on:keydown. Two attributes of the
	// same name would not both survive HTML parsing: the first wins and
	// the second is dropped silently.
	const keydown =
		`if (evt.key === 'Escape') { evt.preventDefault(); $_kb_edit = '' } ` +
		(multiline ? "" : `if (evt.key === 'Enter') { evt.preventDefault(); ${selfCommit} }`);
	// Always a textarea, even for a title. An <input> cannot wrap, so it
	// would collapse a two-line title to one and resize the card;
	// auto-resize-height tracks the same wrap the label had. Enter still
	// commits, so the extra line a textarea would otherwise accept never
	// gets typed.
	//
	// data-neo-sortable-nodrag: the whole card is the drag grip, so
	// without this a press into the field, or a drag to select text in
	// it, would pick the card up instead.
	//
	// The server's copy rides in data-kb-value, not in `value`. The field
	// applies a `value` attribute the moment it changes, so binding it to
	// one the morph maintains meant another client editing this same card
	// silently replaced whatever had been typed here and the save that
	// followed saw nothing to do. A plain data attribute is inert: the
	// patch keeps it current, and data-effect copies it in on open, which
	// is the one moment the server's text should win.
	//
	// Rendered already hidden. data-show only takes effect once Datastar
	// has processed the element, and until then the field would occupy
	// the card, so the elastic would measure a card that tall and then
	// animate the shrink on load. data-show clears the inline property
	// when it opens, so this is the same switch, just pre-set.
	const field_ =
		`<neo-textarea rows="1" auto-resize-height data-neo-sortable-nodrag` +
		` class="kb-edit-field kb-edit-${variant}" aria-label="${esc(label)}" data-kb-value="${esc(value)}"` +
		(multiline ? "" : ` style="display: none" data-show="${open}"`) +
		` data-effect="if (${open}) { el.value = el.getAttribute('data-kb-value') ?? ''; el.focus() }"` +
		` data-on:keydown="${keydown}"` +
		(multiline ? "" : ` data-on:blur="if (${open}) { ${selfCommit} }"`) +
		`></neo-textarea>`;
	if (!multiline) return field_;
	return (
		`<div class="kb-editor" style="display: none" data-show="${open}">${field_}` +
		`<div class="kb-editor-actions">` +
		busyButton({
			entityId,
			attrs: `class="kb-save" size="sm"`,
			idle: "Save",
			busy: "Saving…",
			onClick: commit("el.closest('.kb-editor').querySelector('neo-textarea')"),
		}) +
		`<neo-button size="sm" variant="secondary" data-on:click="$_kb_edit = ''">Cancel</neo-button>` +
		`</div></div>`
	);
}

function renderCard(card) {
	const title =
		editableLabel({
			tag: "h3", cls: "kb-card-title", entityId: card.id, field: "title",
			idSignal: "kb_card", text: card.title,
		}) +
		editor({
			entityId: card.id, field: "title", variant: "card-title", label: "Card title",
			value: card.title, url: "/kanban/card/rename", idSignal: "kb_card",
		});
	const desc =
		editableLabel({
			tag: "p", cls: "kb-card-desc", entityId: card.id, field: "desc",
			idSignal: "kb_card", text: card.desc || "Add a description", empty: !card.desc,
		}) +
		editor({
			entityId: card.id, field: "desc", variant: "desc", label: "Description",
			value: card.desc, url: "/kanban/card/describe", idSignal: "kb_card",
			multiline: true,
		});
	// No [data-neo-sortable-handle]: the whole card is the grip. The kit
	// then also makes the card itself the keyboard grip, so it takes the
	// tab stop and the reorder shortcuts.
	// neo-elastic animates the card's height as the editor opens, the
	// intent row appears, or the description grows.
	//
	// The [data-neo-elastic-content] wrapper is rendered here rather than
	// left to hydration. Given loose children the component moves them
	// into a wrapper it makes itself, and re-parenting the editor blurs
	// it the instant it opens, which the blur handler reads as a commit.
	return (
		`<article id="${esc(card.id)}" class="kb-card" data-neo-sortable-item>` +
		`<neo-elastic class="kb-card-body"><div data-neo-elastic-content>` +
		`${title}${desc}` +
		// While the description editor is open its Save button reports the
		// command, so these two stand down: all three key on this card and
		// would otherwise fire together.
		ackRow(card.id, editKey(card.id, "desc")) +
		intentRow(card.id, editKey(card.id, "desc")) +
		`</div></neo-elastic></article>`
	);
}

function renderColumn(column) {
	const listId = `kb-list-${esc(column.id)}`;
	// The count stays put through the rename. Dropping it while the field
	// is open would resize the header the field is trying to match.
	const head =
		`<neo-badge class="kb-count">${column.cards.length}</neo-badge>` +
		editableLabel({
			tag: "h2", cls: "kb-col-title", entityId: column.id, field: "title",
			idSignal: "kb_col", text: column.title,
		}) +
		editor({
			entityId: column.id, field: "title", variant: "col-title", label: "Column title",
			value: column.title, url: "/kanban/column/rename", idSignal: "kb_col",
		});
	return (
		// The id is what lets the morph update this column in place. Without
		// it the morph pairs sections by position and rebuilds their nodes,
		// which resets the strip's scroll and destroys any element the user
		// is part-way through interacting with.
		`<section id="${esc(column.id)}" class="kb-col" data-kb-col="${esc(column.id)}">` +
		`<header class="kb-col-head">${head}</header>` +
		intentRow(column.id) +
		// morph-tolerance="all": the stream patches this list while a
		// card is held, and only losing the dragged card should end the
		// gesture. group="board": a card dragged out lands in a peer.
		`<neo-sortable id="${listId}" class="kb-list" group="board" morph-tolerance="all"` +
		` aria-label="${esc(column.title)}">` +
		// An empty placeholder template replaces the kit's default dashed
		// ghost. The slot still holds the grabbed card's size, it just
		// draws nothing: the card under the pointer and the gap it leaves
		// already say where it will land.
		`<template data-neo-sortable-placeholder></template>` +
		column.cards.map(renderCard).join("") +
		`</neo-sortable>` +
		`<div class="kb-col-foot">` +
		busyButton({
			entityId: addCardKey(column.id),
			attrs: `id="kb-add-card-${esc(column.id)}" class="kb-add-card" size="sm" variant="secondary"`,
			idle: "Add card",
			busy: "Adding…",
			onClick: `$kb_col = '${expr(column.id)}'; ${fire("/kanban/card/add")}`,
		}) +
		`</div></section>`
	);
}

function renderColumns() {
	return (
		`<div id="kanban-columns" class="kanban-columns">` +
		board.map(renderColumn).join("") +
		busyButton({
			entityId: ADD_COLUMN_KEY,
			attrs: `id="kb-add-col" class="kb-add-col" variant="secondary"`,
			idle: "Add column",
			busy: "Adding…",
			onClick: fire("/kanban/column/add"),
		}) +
		`</div>`
	);
}

// --- projection stream -----------------------------------------------

// How long a client can sit on a board the server never agreed to. A
// command lost in transit never moved the revision, so nothing else will
// correct it; this is what puts the card back. Kept short because that
// wait is the user watching a card sit where the server never put it.
const RESYNC_MS = 3000;
const WAKE_MS = 500;

// Set by the stream route: the board asked, so it heard the ready
// signal and the retry below can stop.
let streamOpened = false;

// One long-lived response per client. A patch goes out when the board
// actually changed. A patch when nothing changed is not free: it walks
// the whole strip and can land between a mousedown and its mouseup, so
// the unconditional re-send is only a slow repair for a command that
// never reached the server, where the revision cannot have moved.
sim.get("/kanban/stream", async (ctx, sse) => {
	streamOpened = true;
	let sent = -1;
	let resyncedAt = 0;
	while (!ctx.signal.aborted) {
		const now = Date.now();
		if (revision !== sent || now - resyncedAt >= RESYNC_MS) {
			sse.patchElements(renderColumns());
			sent = revision;
			resyncedAt = now;
		}
		await nextPublish(ctx.signal, WAKE_MS);
	}
});

// --- commands --------------------------------------------------------

// Shared shape for every write: mark the intent, publish so the board
// shows it, do the work, then publish the result.
//
// There is no rejection path here. Failure is injected at the transport
// by the Settings panel, and a 500 or an unreachable server never
// reaches a handler at all, so a handler that could refuse its own work
// would only be simulating a case the page already covers.
// applyOnCommit holds the change back until the write lands, for a
// command whose subject does not exist yet. Changing something already
// on the board applies at once: the user put the card in that column or
// typed that title, and the marker beside it says the server has not
// agreed yet. A card that is still being created has no such history to
// show, so publishing it early would draw a saved card that is not one.
//
// The write takes no time of its own. Every delay the board shows is one
// the Settings panel asked for, so with the panel at rest a command is
// as instant as the board can make it, and `pending` is observable only
// for as long as the work genuinely takes.
async function command(sse, { entity, intent, apply, applyOnCommit }) {
	const current = claim(entity);
	if (!applyOnCommit) apply();
	pending.set(entity, intent);
	publish();

	// Yield once so a client that abandons the command between the intent
	// and the write is seen doing it.
	try {
		await sse.delay(0);
	} catch {
		if (current()) {
			if (applyOnCommit) apply();
			pending.delete(entity);
			publish();
		}
		return;
	}
	// Superseded while waiting: the newer command owns both the board
	// and the marker, so leave everything alone.
	if (!current()) return;

	if (applyOnCommit) apply();
	pending.delete(entity);
	publish();
}

sim.post("/kanban/card/move", async (ctx, sse) => {
	const cardId = String(ctx.signals?.kb_card ?? "");
	const listId = String(ctx.signals?.kb_to_list ?? "");
	const toIndex = Number(ctx.signals?.kb_to_index ?? 0);
	const found = locateCard(cardId);
	// The drop event reports the receiving <neo-sortable> id, which is
	// the column id with the list prefix the renderer added.
	const target = findColumn(listId.replace(/^kb-list-/, ""));
	if (!found || !target) return publish();

	const from = found.column;
	const fromIndex = found.index;
	const card = found.card;
	await command(sse, {
		entity: cardId,
		intent: "Moving…",
		apply() {
			from.cards.splice(fromIndex, 1);
			target.cards.splice(Math.max(0, Math.min(toIndex, target.cards.length)), 0, card);
		},
	});
});

sim.post("/kanban/card/add", async (ctx, sse) => {
	const column = findColumn(String(ctx.signals?.kb_col ?? ""));
	if (!column) return publish();
	const card = { id: id("kb-card"), title: "New card", desc: "" };
	await command(sse, {
		entity: addCardKey(column.id),
		intent: "Adding card…",
		applyOnCommit: true,
		apply() {
			column.cards.push(card);
		},
	});
});

sim.post("/kanban/column/add", async (ctx, sse) => {
	const column = { id: id("kb-col"), title: "New column", cards: [] };
	await command(sse, {
		entity: ADD_COLUMN_KEY,
		intent: "Adding column…",
		applyOnCommit: true,
		apply() {
			board.push(column);
		},
	});
});

sim.post("/kanban/card/rename", async (ctx, sse) => {
	const found = locateCard(String(ctx.signals?.kb_card ?? ""));
	const value = String(ctx.signals?.kb_value ?? "").trim();
	if (!found || value === "" || value === found.card.title) return publish();
	const card = found.card;
	await command(sse, {
		entity: card.id,
		intent: "Saving…",
		apply() {
			card.title = value;
		},
	});
});

sim.post("/kanban/card/describe", async (ctx, sse) => {
	const found = locateCard(String(ctx.signals?.kb_card ?? ""));
	const value = String(ctx.signals?.kb_value ?? "").trim();
	if (!found || value === found.card.desc) return publish();
	const card = found.card;
	// The editor stays open for the whole write. It owns the Save button,
	// which is where this command reports its progress, and a failure
	// leaves the typed text in place to retry instead of discarding it.
	await command(sse, {
		entity: card.id,
		intent: "Saving…",
		apply() {
			card.desc = value;
		},
	});
});

sim.post("/kanban/column/rename", async (ctx, sse) => {
	const column = findColumn(String(ctx.signals?.kb_col ?? ""));
	const value = String(ctx.signals?.kb_value ?? "").trim();
	if (!column || value === "" || value === column.title) return publish();
	await command(sse, {
		entity: column.id,
		intent: "Saving…",
		apply() {
			column.title = value;
		},
	});
});

// --- board controls --------------------------------------------------

sim.post("/kanban/collab", async (ctx) => {
	collabEnabled = Boolean(ctx.signals?.kb_collab);
	publish();
});

// --- simulated second user -------------------------------------------

const COLLAB_MS = 7000;
const COLLAB_NOTES = [
	"Reproduced on Firefox 141 as well.",
	"Needs a decision before the next release.",
	"Blocked on the design review.",
	"Confirmed fixed on the branch.",
];

// Another client editing the same board, so the fat morph and the
// drag-time freeze are exercised without a second window open. It never
// touches an entity the server is still writing, which is the same
// courtesy a real peer's commands get from the projection.
function collabTick() {
	if (!collabEnabled) return;
	const candidates = [];
	for (const column of board) {
		for (const card of column.cards) {
			if (pending.has(card.id)) continue;
			candidates.push({ column, card });
		}
	}
	if (candidates.length === 0) return;
	const picked = candidates[Math.floor(Math.random() * candidates.length)];
	if (Math.random() < 0.5) {
		picked.card.desc = COLLAB_NOTES[Math.floor(Math.random() * COLLAB_NOTES.length)];
	} else {
		const target = board[Math.floor(Math.random() * board.length)];
		if (target === picked.column) return;
		const at = picked.column.cards.indexOf(picked.card);
		picked.column.cards.splice(at, 1);
		target.cards.push(picked.card);
	}
	publish();
}

setInterval(collabTick, COLLAB_MS);

// --- ready handshake -------------------------------------------------

// Datastar is a module in <head>, so it processes the board before this
// module (deferred, in <body>) patches window.fetch. A stream opened
// from data-init would miss the simulator and hit the real origin, so
// the board waits for this event instead.
//
// The event is only useful once the board is listening for it, and
// nothing here can know when that is: script timing varies with the
// cache, and a browser is free to schedule it differently again. A
// signal sent before anyone listens is lost, and a lost signal leaves
// the board on its skeleton forever, so guessing a few moments to send
// it is not good enough.
//
// Instead it repeats until the board answers. The answer is the stream
// request itself arriving at the route below, which is proof the board
// heard, not an assumption that it did. The listener is guarded, so the
// repeats that cross with it in flight do nothing.
const READY_RETRY_MS = 150;

function announceReady() {
	document.getElementById("kanban-board")?.dispatchEvent(new CustomEvent("kanban-sim-ready"));
}
const readyTimer = setInterval(() => {
	if (streamOpened) clearInterval(readyTimer);
	else announceReady();
}, READY_RETRY_MS);
announceReady();
