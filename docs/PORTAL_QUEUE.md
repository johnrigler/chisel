# Portal read queue

`chisel.portal.queue.js` is a plain browser script loaded before
`chisel.portal.js`. It has no DOM, network, storage, timers or package
dependencies. It coordinates reads without changing their source adapters.

The Portal uses six active slots. Ordinary work uses at most five, retaining
one slot for an opened/expanded record. Ordinary notes use at most two slots;
an explicit record can bypass that soft group limit within the total budget.
Pending work runs in this order:

1. The record page, selected row and expanded rows.
2. Visible-page transaction details, then notes.
3. Background history, newest timestamps first.

Rendering reprioritizes pending jobs as the page or selection changes. Existing
batch selectors continue choosing candidates; the queue owns their combined
concurrency and pending promise reuse. Visible date lookups call the same
hydrator as amounts, record pages and expansion. Reading the date no longer
starts a separate transaction fetch while that transaction is being opened.

Jobs have a resource key and row-object owner. Requests for the same key/owner
share a promise and can promote its priority. Transaction, note and artifact
reads have distinct resource keys. Source order, provider fallback, timeout,
cache persistence, polling and retry decisions remain with the existing
readers. Failed jobs release their slot and can be requested again through
those existing paths; the queue adds no retry loop.

Reset advances the queue generation and settles obsolete callers with `null`.
Queued work is discarded. Already active reads retain their slots until they
finish; reset does not claim to abort an underlying request. Their existing
generation/row checks suppress stale mutations. Late cleanup removes only its
own job and date-lookup table, preserving new work for the same transaction.
The visible date and notes batch flags are also guarded by load generation.

This pass preserves Portal's public methods and shared state fields. The
record controller adds a read-only `currentRow()` accessor for prioritization.
Record/list rendering, transaction serialization, signing and fee calculation
are unchanged.

Tests cover the shared budget, foreground reservation, note-group limit,
promotion, page reprioritization, newest-first order, failures/retries, reset,
replaced row owners and stale completion cleanup. Portal integration checks
exercise actual held HTTP requests during background loading, date lookup,
record opening and resets. Existing static fallback, notes, record navigation
and transaction fixtures remain in the full regression suite.
