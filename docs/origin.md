# Chisel Origin Bridge

From the 2020 crypto-linguistic white paper to the current Chisel implementation.

Primary author and project owner: John Rigler.

Editorial synthesis and printable document preparation: ChatGPT, GPT-5.5 Thinking, OpenAI. This credit is for organization, drafting assistance, and formatting only. The core theory, inventions, code, names, examples, transactions, and project direction belong to John Rigler and the Chisel project.

---

## 1. Why vanilla JavaScript and elliptic come first

Chisel is intentionally built as plain browser JavaScript. That is not nostalgia and it is not a refusal to use modern tooling. It is a boundary decision. The reader and authoring interface should be able to run from a static directory, GitHub Pages, IPFS, rigler.org, or a local file/server without first asking a Node toolchain to bless the build.

The architectural point is that Chisel should not recreate the gatekeeper pattern it is trying to escape. A transaction artifact should be understandable from a block explorer, a full node export, or a static JSON snapshot. The interface that explains and signs it should also be inspectable as ordinary browser code. The fewer moving parts between the user and the signed transaction, the better.

This connects to an earlier conversation between John Rigler and Keir Finlow-Bates about whether local signing could be made practical in a lightweight interface. The idea was clear before the implementation path was clear: a user should be able to prepare and sign meaningful blockchain material locally rather than hand the act to a hosted wallet service. At that time, John had not yet found the JavaScript `elliptic` library, and the practical route seemed to wander through the usual Node.js dependency trench.

`elliptic` changed the shape of the problem. It gives Chisel the browser-side secp256k1 machinery needed to sign UTXO-style material locally. Chisel still needs careful transaction construction, fee handling, source UTXO selection, and broadcast plumbing, but the hardest feasibility knot became smaller: local signing in a browser is no longer theoretical.

The QR code sticker and label tools belong to the same design line. They are not decoration. They make keys, addresses, txids, routes, and message fragments physically usable. The goal is not another conference demo where crypto people impress crypto people. The goal is mundane adoption: a bar, event table, print ritual, or community night where a transaction becomes easy enough to scan, verify, explain, and enjoy.

The ETHDenver image is a usability target rather than a travel plan: not only the venue full of specialists, but the bar across town where people are doing ordinary things and need the tool to be obvious. That is the adoption layer Chisel should aim at.

> Colleague note for Keir: the thing we discussed as a signing possibility now has a practical browser-side path. `elliptic` is the missing bridge that made the old conversation executable.


## 2. Executive summary

Chisel is a browser-first toolkit for reading and preserving small blockchain artifacts. It treats a transaction output as more than a payment. An address can carry readable structure, an amount can carry a small code, an OP_RETURN can carry text or a pointer, and the transaction itself can become a public note, breadcrumb, receipt, ritual, or searchable index.

The 2020 white paper states the root claim: a cryptocurrency transaction can combine spendable and unspendable outputs that are understood as coming from one sender and acting atomically as a self-descriptive object. Chisel is the working implementation of that claim.

The practical goal is not to build another private database wrapped around a chain. The goal is to make public ledger material readable and recoverable from the ledger itself, then let local tools add notes, categories, imports, and indexes without becoming the source of truth.

In plain terms: Chisel turns ordinary UTXO transaction machinery into a small, chain-native publishing and indexing system.

> Colleague takeaway: Chisel is not primarily a wallet, block explorer, IPFS tool, or casino gadget. It is a data-transaction workbench for UTXO ledgers.


## 3. White paper kernel

The paper starts from a limitation in Bitcoin-style systems: ordinary wallets expose address and amount, but not a native public memo field. OP_RETURN became the common payload channel, but it is not universally exposed by wallet software and tends to create specialized readers, indexers, and third-party tooling.

The paper proposes two universal channels that already exist in every simple payment: the target address and the transaction amount. The address channel can carry readable material through obviously unspendable addresses. The amount channel can carry small labels through advanced satoshi codes, including Kloctal and Shoctal-style encodings.

The paper then combines these with multi-output transactions. Because output order is preserved, a transaction can carry a message block. Repeated or structured amount codes can bind outputs together. Optional agents can assemble, summarize, or relay these messages, but the ledger remains the durable source.

That is the narrow technical spine of Chisel: address text, amount tags, optional OP_RETURN, ordered outputs, and external readers that do not own the meaning.


## 4. Implementation map

The table below maps the white paper concepts to current Chisel terms and code areas. It is intentionally blunt: this is where a new reader should look before diving into old UI sections or historical experiments.

Note: Use MacDougall in new writing. Older source files may contain MacDougal. Do not make the spelling drift worse.

| White paper concept | Chisel term | Current implementation / location | Interpretation |
| --- | --- | --- | --- |
| Browser-local signing feasibility | elliptic signing path | vendor/elliptic-6-6-1.js, chisel.sign.js | The browser can hold the signing act locally instead of sending secrets to a hosted service. |
| Static browser interface | Vanilla JS application shell | index.html, app.js, chisel.js | No bundler or Node build step is required for the main reader/authoring path. |
| Physical usability layer | QR labels and stickers | tools/qrField, tools/keyPrint, scan pages | Keys, txids, addresses, and route labels can be moved through ordinary printed objects. |
| Base58-Hash currency family | Multi-chain UTXO target | DigiByte, Ravencoin, Litecoin, Dogecoin modules | The common substrate is UTXO transaction construction, not a single chain brand. |
| Obviously unspendable address | MacDougall address line | chisel.unspendable.js, unspendable.py lineage | Readable output address that should be treated as burned / non-spendable. |
| Address namespace | DAx / DBx / DCx / DDx / DEx | MacDougall conventions | DAx person, DBx transport/source, DCx subject, DDx/DEx split pointer. |
| Advanced satoshi code | ASC / Shoctal / amount tag | Daisy scripts, chord output, amount fields | Small value-level metadata used as a tag, checksum, or logical binder. |
| OP_RETURN | Payload channel | Chain send modules and decode logic | Useful but optional. Chisel should not depend on OP_RETURN as the only semantic layer. |
| Multi-output transaction | Artifact transaction | send-to-multiple outputs, local fixtures | The whole vout set is the object. Output order matters. |
| Agent / hub | fileProxy, bunOven, keeperBun | tools/fileProxy, tools/bunOven, tools/keeperBun | Authoring, import, caching, and API access tools. They are not the ledger. |
| Interactive systems | Portal, chords, print rituals | Portal path, chord files, label/QR tools | Human-facing views over ledger-native objects. |


## 5. Architecture boundary

Chisel needs a cleaner boundary. Right now the codebase contains core transaction machinery, local datastore tooling, historical demos, UI experiments, chain-specific logic, and operational helpers. That is normal for a research prototype, but it makes the project hard to explain.

The recommended boundary is this: Chisel core builds, signs, serializes, decodes, and explains meaningful UTXO transactions. Portal displays and filters transaction artifacts. Data is a static or local snapshot of transaction fixtures, indexes, imports, and chords. Tools are satellites that help author, import, cache, print, scan, or relay material.

fileProxy should be treated as an authoring/import/local-write tool. Normal readers should be able to open a static dataset from relative JSON paths, GitHub Pages, IPFS, rigler.org, or another trusted HTTP source when indexes are present.

keeperBun should be treated as an optional signed-access API broker for paid or secret-bearing APIs. It should never be part of the baseline reading path. Secrets are operational plumbing, not Chisel semantics.

> Rule: anything required to understand a transaction belongs near the core. Anything required only to fetch, cache, print, scan, or administer belongs outside the core.


## 6. The refactor thesis

The current project should be refactored around one first impression: Chisel reads and writes ledger-native artifacts. Everything else should support that view or move out of the way.

The old Decode section is now misleading because it suggests that decoding is a separate destination. Decoding should be a service inside Portal, a reusable library function, and a diagnostic mode. Portal should become the main reader experience.

The docs should come before large code changes. A colleague should be able to read docs/origin.md, docs/architecture.md, and docs/demo-path.md, then open the app and recognize the same nouns in the interface.

The UI should be pruned until the first path is obvious: load a transaction, see the outputs, see OP_RETURN if present, see MacDougall labels, see local notes, and see the source JSON.

- Phase 0: freeze vocabulary. Chisel, Portal, MacDougall, ASC, chord, Thunderword, fileProxy, keeperBun.
- Phase 1: add this origin bridge and a short demo path to docs/.
- Phase 2: make Portal the default reader and demote Decode to diagnostics or remove it from primary navigation.
- Phase 3: normalize the data directory contract and static dataset loading.
- Phase 4: split satellites from core, leaving only reusable UTXO transaction primitives in the main path.
- Phase 5: add two or three clean public examples that a colleague can understand without project folklore.


## 7. Five-minute colleague demo

The first demo should avoid mythic density. Do not start with the whole Dogecoin/Joyce archaeology, the casino framing, or the keeper daemon. Start with a single transaction artifact and explain the layers.

Demo script: open Portal with a local or bundled fixture. Point to the txid as the permanent lookup key. Show the OP_RETURN channel if present. Show MacDougall address outputs as indexed human labels. Show the amount field as a possible tag or binder. Show local notes as local interpretation, not ledger truth. Then open the raw JSON to prove the view is not magic.

After that, show that the same object could be loaded from a local fileProxy, a static dataset, a full node export, a block explorer API, or a paid API broker. That is the point: the source can vary, but the transaction artifact remains the anchor.

Only then show how Chisel can construct and sign a new UTXO transaction locally. The strongest technical point is that the browser can prepare meaningful transaction structure without handing the private key to a server.

> Do not let the first five minutes become a tour of every experiment. Show one artifact, then show why it is portable.


## 8. Working definitions

- **Chisel:** A browser-first toolkit for constructing, signing, decoding, importing, and presenting data-rich UTXO transactions.
- **Vanilla JS:** The no-build, inspectable browser runtime choice for the main app. Optional tools may use Python, Bun, Deno, or Node, but those are satellites.
- **elliptic:** The JavaScript secp256k1 signing library that makes local browser signing practical for Chisel's UTXO workflow.
- **MacDougall:** The readable address-language layer descended from obviously unspendable address construction. New docs should spell it with two Ls.
- **ASC:** Advanced Satoshi Code. A small amount-level code used as a tag, checksum, binder, or compact signal. Shoctal is one family inside this idea.
- **Chord:** A shell-like local rendering of transaction outputs and route/context information. It is a view, not the canonical chain record.
- **Thunderword:** A universal marker address used as a search/index beacon, comparable to a well-known zero or all-ones address pattern in other ecosystems.
- **Portal:** The main reader/viewer experience for Chisel artifacts. Portal should absorb normal decoding behavior.
- **fileProxy:** Local filesystem bridge for authoring, imports, and local writes. It should not be required for ordinary static reading.
- **bunOven:** Importer that pushes feed material through fileProxy into the Chisel datastore shape.
- **keeperBun:** Signed-access hot keeper for API secrets and paid remote API access. It is optional infrastructure.
- **Satellite:** A tool, UI, proxy, print page, scanner, or chain-specific helper that uses Chisel but should not define the core.


## 9. Positioning cautions

Use cautious language around unspendability. The social and practical point is that the address is deliberately constructed as a readable burn target, not harvested as a vanity key. Consensus rules do not mark it as special. A user should still treat any value sent there as destroyed.

Do not frame OP_RETURN as useless. It remains useful for compact payloads, URLs, hashes, and direct text. The critique is narrower: OP_RETURN alone often pushes users toward specialized tools and gatekeepers. Chisel uses it as one lane, not the whole road.

Do not frame agents as trusted authorities. Agents can relay, assemble, cache, or summarize, but the durable object is the public transaction. If an agent becomes mandatory to interpret the artifact, the design has drifted back toward the thing the paper was trying to avoid.

For compliance and audit audiences, use the phrase voluntary pre-disclosure. The system can make public transactions easier to understand, document, and audit. It is not a claim that Chisel replaces law, KYC, AML, accounting systems, or professional review.


## 10. Suggested repository placement

Add this document as docs/origin.md. Add the printable version as docs/origin-print.html. Then add a short pointer from README.md near the top:

“New readers should start with docs/origin.md. It explains how the 2020 crypto-linguistic white paper maps to the current Chisel implementation.”

After that, add docs/architecture.md with the boundary rules: core, Portal, data, tools/satellites, keeper, examples. Add docs/demo-path.md with one deterministic artifact walkthrough.

This is not bureaucracy. It is a control surface. Without it, every new reader enters through a different tunnel and forms a different model of what Chisel is.

```text
docs/
  origin.md
  origin-print.html
  architecture.md
  demo-path.md
  glossary.md

core files:
  chisel.js
  chisel.sign.js
  chisel.unspendable.js
  chisel.<coin>.js
  chisel.thunderwords.js

data:
  data/transactions/<coin>/<txid>.json
  data/index/transactions.index.json
  data/chords/<coin>/*.chord

tools/satellites:
  fileProxy/
  bunOven/
  keeperBun/
  qrField/
  keyPrint/
  base64/
  decoder/
```


## 11. Source notes

Primary theory source: John Rigler, “Thoughts on an all-purpose cryptocurrency linguistic system,” IEEE Blockchain 2020 draft PDF in the project archive. Relevant sections: abstract, Introduction, OP_RETURN Codes, Advanced Satoshi Codes, Obviously Unspendable Addresses, Combining Systems for Greater Value, and Further Interactive Systems.

Current implementation source: Chisel v2.7.1 project snapshot and README language describing Chisel as a browser-first toolkit for reading and preserving small blockchain artifacts, plus the local datastore, Portal, fileProxy, bunOven, and chord conventions.

MacDougall source: unspendable.py / UNSPENDABLE README lineage, including the readable address conventions, checksum suffix construction, and DAx / DBx / DCx / DDx / DEx namespace assignments.

Assistant credit: ChatGPT, GPT-5.5 Thinking, OpenAI, assisted in editorial synthesis, document organization, and generation of Markdown and HTML versions. This is not a claim of authorship over Chisel, MacDougall, unspendable, ASC, Shoctal, the white paper, the codebase, or any ledger artifacts.
