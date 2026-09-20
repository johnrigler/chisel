Chisel v268e patch notes

Purpose
- Make portal stream rows act like a viewport, not a detached inspector.
- Add a MacDougall display-normalization pass without changing raw ledger text.
- Save richer discovered-link packets so future static/IPFS mirrors can preserve preferred labels.

Changes
- Portal rows with a primary OP_RETURN URL now open that URL directly in a new window/tab when clicked.
- Those rows still include an inspect action, which loads the raw/semantic transaction details into the lower drawers.
- Explorer verification remains available as a separate verify action.
- MacDougall decoded text now has raw and display forms. Example: LET-S DANCE displays as Let's Dance while raw remains LET-S DANCE.
- Common all-caps subject text is title-cased for display. Example: EYES OF THE WORLD displays as Eyes of the World.
- Discovered link files now include displayTitle and targets[] records with labels, while preserving the older urls/ipfs/addresses arrays.
- fileProxy transaction index summaries now try to decode/normalize MacDougall address lines before falling back to the raw address.

Operational note
- If an old transactions.index.json cache already exists, rebuild it with:
  GET http://127.0.0.1:7799/reindex
  or
  GET http://127.0.0.1:7799/tx-index?force=1

Caveat
- The normalization layer is intentionally conservative. It is a display hint, not a rewrite of the ledger record. Add future aliases/meaning drift to the link packets or an external label dictionary rather than mutating the transaction bytes.
