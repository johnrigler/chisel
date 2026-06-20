# v2.7.0 Portal patch

This is a browser-only Portal patch over the uploaded v2.7.0 tree.

Changes:

1. Pagination controls moved below the transaction viewport.
2. Changing pages now collapses inline expanded records, clears the selected inline row, and resets the viewport scroll to the top of the new page.
3. The page renderer no longer appends expanded records from off-page rows. This fixes giant Gomez/Jethro records sticking around after navigating away.
4. Expanded rows now include a local annotation editor:
   - Category
   - Note
   - Fix / cleanup
5. Added server-side secret keeper that uses "bun".

Annotation storage:

```text
localStorage.chisel.portal.annotations.v1
```

These annotations are deliberately local-only. They do not write to UTXO/EVM ledgers, do not modify tx JSON fixtures, and do not require fileProxy.

Files changed:

```text
index.html
chisel.portal.js
PATCH_NOTES.md
README_PATCH_v270.md
```
