# Incremental Portal rendering

`chisel.portal.view.js` is a plain browser script loaded before the Portal. It
owns keyed DOM reconciliation, display-only DOM updates and list scroll
anchoring. It has no network, storage, queue or transaction dependencies.

The Portal still owns its public API, state, filtering, pagination, source
selection and presentation builders. A mounted list entry uses the existing
chain/TXID/source key and its row-object owner. A reset with the same key but a
new row object disposes the previous entry and creates fresh controls. Rows
that leave the visible page or filter are removed and their function runtimes
are disposed. Render requests continue to coalesce through the existing
animation-frame and batch mechanism.

Unchanged row headers are skipped. Changed headers update existing text,
attributes, links and buttons, retaining focus and same-source images. Page
controls use the same display updater. This updater is deliberately limited to
display trees; it must not be used to transplant editor or payload callbacks
that close over their own input elements.

Expanded rows and record pages keep separate media, header, notes, payload and
body sections. Changed media and headers update in place. Payload controls are
retained when their payload is unchanged; replacement waits until a focused
control is blurred. Other detail drawers retain their open state by class,
summary text and occurrence when their data section changes. Grouping wrappers
use `display: contents` to keep the existing layout and media-first order.

The note editor has a stable lifetime independent of surrounding data. Its
original save handlers continue reading the mounted textareas. Background
shared-note updates refresh the displayed note and metadata while leaving a
draft's text, selection and focus intact. A clean editor receives the new saved
values without forcing its disclosure open or closed.

The function runtime is keyed by executable source, entry point and
reconstruction provenance, rather than note text, title or update timestamp.
Unchanged functions keep their iframe, pending execution, timeout and canvas.
Changing or removing that descriptor disposes the previous runtime before
building its replacement. Collapsing, filtering, paging or resetting away a
mounted row also disposes it. Record pages use this same incremental detail
builder; background data no longer needs to suspend all record rendering while
the note field is focused.

Reordering keeps the longest existing ordered subsequence. Browsers with
`Element.moveBefore` preserve DOM state even when iframe owners exchange
positions. The fallback gives focused rows and iframe owners priority and
moves their siblings where possible; browsers without that API may reload an
iframe if multiple protected rows must exchange order. A scrolled list anchors
its first visible retained row. At scroll position zero, new transactions remain
visible at the top. Explicit page navigation still resets the list scroll.

Regression cases cover unrelated history updates, changed dates/amounts and
ledger status, active drafts and their save handlers, caret/focus, payload
selection, open drawers, image identity, in-flight function retention and
cleanup, record-page updates, ordering, scroll anchoring, page controls and
same-transaction resets. Existing raw-data fallback, binary payload, notes,
navigation and transaction tests remain in the full suite.
