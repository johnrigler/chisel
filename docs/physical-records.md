# Physical records and complete QR identifiers

Chisel 2.8.8 adds **SCAN RECORD** to the existing camera tool. RECORD reads
one complete 16-hex identifier (eight bytes). KEY 4 and ARTIFACT 1 retain
their separate key-recovery and on-chain index behavior.

This applies to correspondence, signed artifacts, equipment and collections.
CertLedger is one use of it. The physical folder establishes the collection's
identity; its inventory can grow without changing the printed label.

## Open a folder

1. Update Chisel, Mogwai and the relevant private Daisy archive checkout.
2. Run the existing service: `python3 ~/mogwai/fileProxy/fp.py serve --host 127.0.0.1 --port 47799`.
3. Open Chisel → Tools → **Physical records / Daisy catalog**. Set your
   FileProxy URL once, then scan the label or enter its complete identifier.
4. Choose **RECORD**, scan one label, and tap **OPEN RECORD**. FileProxy
   searches configured Daisy ISO years, current year first, then earlier
   years. It returns all matches in the newest matching year.

Only an operator-selected FileProxy is remembered; Chisel does not send IDs
to a default public service. `127.0.0.1` means the device using the browser.
A different device needs a reachable protected service.

## Source format

An ordinary directory holds a plain ASCII `record-id` file containing the
identifier, plus `README.md` and actual scans. A directory named exactly for
the ID also works without a marker; a present marker takes precedence.

```text
daisy_2026/444/records/0123456789ABCDEF/
  record-id
  README.md
  received-letter.pdf
  envelope-front.jpg
```

Describe what each physical item is, when it was added, and its position in
the folder. New files appear on the next lookup. FileProxy's existing SQLite
catalog remains its generated archive index; this read inspects live source
files and does not rewrite it. No source is executed.

Annual paths come from `~/config.json` (`projects.daisy_2026.path`, etc.) or
explicit FileProxy roots. A generic `daisy` root with `YYYY/` children also
works. Explicit year roots take precedence. Years follow Daisy's ISO week-year
convention. Unavailable roots are reported; automatic GitHub/IPFS retrieval is
separate work.

The private FileProxy viewer previews images, PDFs and text, offers original
downloads, and checks full SHA-256 against its live listing. Shared home paths
are imported only for record reads, not exposed through the general file API.
Same-origin loopback reads work directly. Remote reads use a token configured
with `serve --record-token-file FILE`; the viewer retains it only in page
memory. Use HTTPS remotely. Real case IDs and contents stay in private data,
outside Chisel's public source and examples.

## Wallet-independent references

The user's proposed Coinomi workflow uses an ordinary Litecoin payment with
an amount-level satoshi code as its reference signal. The payment can carry
no descriptive text; the private catalog supplies the interpretation. Chisel
need not originate the transaction. Its reader can apply the existing code
convention later.

Record the actual chain, transaction ID, output, amount and code interpretation
after observing the transaction. A stable folder ID locates an evolving
collection; a dated inventory and full digests identify a specific version
for a later ledger anchor. This update implements lookup and live byte checks.
Automatic payment matching, inventory anchoring and IPFS publication remain
separate work. The files remain readable and portable without Chisel.
