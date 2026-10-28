let's add a new page /demo-kanban

- It shall use Datastar's far morph and SSE CQRS approach, where the <template> basically defines all the states the UI can have and the input data decides what state eventually renders.
- Morpheus components exclusively (if you can't do something with Morpheus or the Morpheus API could be better to more easily cover that use case then tell me and let me decide how to proceed).

We're making a typical kanban board:
- we can add a new column
- we can rename the column by double clicking its name.
- we can add a new item on any column
- we can rename the item the same way as a column
- we can edit the description of the item
- we can drag'n'drop items between columns (can we use neo-sortable for that?! or would we have to change its API for that, if yes - how?)
- We must follow the "immediate intent" pattern, which basically means - any interaction (Datastar action) that is made against the server, needs to be show immediately that the intent is received and that the operation is in progress. Only after the operation is confirmed successful shall we remove the progress indicator. If the operation failed, we should revert the interaction (like for example when the card was moved to another column it must be put on the new column, but an spinner should indicate that this operation is just an intent yet, like "<spinner> moving...", but it that operation failed (the server returned 500 or couldn't be reached, I mean generally when all retry failed) it should move the card back and pop an error toast explaining that this item could not be moved to this column and you should retry). This way we avoid lying to the user (which would be an "optimistic update") that the item was actually moved _before_ the server confirms it actually is. Showing the intent on the item allows avoiding blocking the UI so I can quickly move cards between columns and still know what actually succeeded and what didn't. While its being moved, I should still be able to move that card around, and if that action request was still in flight when I put it on the other column - it should cancel the request and fire the new one. If the in flight request succeeded _while_ I'm dragging that item it should NOT abort my interaction (which would move the card to the column its saved to WHILE I was dragging it.).
- For when the title and/or the description is being edited (the action is in-flight) - we should also show on the card the "<spinner> saving..."

- We should have the settings sidebar on that page too (the same that we have for doc pages)

- Try to keep the client-side part of JavaScript utmost minimal and reduce it as much as possible to in-template Datastar capabilities, not outside script files, this is very important! Most code needs to live on the server simulator side. If you can't do that reliably - explain the situation, ask me and let me decide.

Make sure to follow the skills and instructions in CLAUDE.md.

Again, the architecture is basically:
this is essentially a CQRS real-time multiplayer where multiple people can edit the board at the same time, hence the SSE based fat morphs. And every change must show immediate intent. Giving the user no feedback on the fact that the interaction the user did is being processed is worse UX; and so is optimistic update (because you must let the user know when data is definitely saved and when it isn't yet).