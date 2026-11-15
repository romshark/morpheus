// A field in a shadow root has no form owner, which leaves Enter in it without
// the browser's implicit submission. submitOnEnter runs the HTML "implicit
// submission" steps for the host's form instead.

// Input types that block implicit submission in a form with no submit button.
const BLOCKING_TYPES = new Set([
	"text",
	"search",
	"email",
	"url",
	"tel",
	"password",
	"date",
	"month",
	"week",
	"time",
	"datetime-local",
	"number",
]);

// Call from a keydown listener on Enter. The submission waits for the event
// to finish, which lets a later listener cancel it with preventDefault, as it
// can for a native field.
export function submitOnEnter(e: KeyboardEvent, form: HTMLFormElement | null): void {
	if (!form) return;
	setTimeout(() => {
		if (!e.defaultPrevented) submitImplicitly(form);
	});
}

function submitImplicitly(form: HTMLFormElement): void {
	const elements = Array.from(form.elements);
	const button = elements.find(isSubmitButton);
	if (button) {
		// Clicking the default button runs its own click handlers too.
		if (!button.matches(":disabled")) button.click();
		return;
	}
	if (elements.filter(blocksImplicitSubmission).length > 1) return;
	form.requestSubmit();
}

function isSubmitButton(el: Element): el is HTMLButtonElement | HTMLInputElement {
	if (el instanceof HTMLButtonElement) return el.type === "submit";
	return el instanceof HTMLInputElement && (el.type === "submit" || el.type === "image");
}

function blocksImplicitSubmission(el: Element): boolean {
	if (el instanceof HTMLInputElement) return BLOCKING_TYPES.has(el.type);
	// Kit fields stand in for an <input> in the form's elements.
	return el.localName === "neo-textinput" || el.localName === "neo-otp";
}
