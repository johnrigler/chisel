# Chisel Origin Bridge

From the 2020 crypto-linguistic white paper to the current Chisel implementation.

Primary author and project owner: John Rigler.

Editorial synthesis and document preparation: ChatGPT, OpenAI. This credit is for organization, drafting assistance, and formatting only. The core theory, inventions, code, names, examples, transactions, and project direction belong to John Rigler and the Chisel project.

---

## 1. Why vanilla JavaScript still comes first

Chisel is intentionally built as plain browser JavaScript. That is not nostalgia and it is not a refusal to use modern tooling. It is a boundary decision. The reader and authoring interface should be able to run from a static directory, GitHub Pages, IPFS, rigler.org, or a local file/server without first asking a Node toolchain to bless the build.

The architectural point is that Chisel should not recreate the gatekeeper pattern it is trying to escape. A transaction artifact should be understandable from a block explorer, a full node export, or a static JSON snapshot. The interface that explains and signs it should also be inspectable as ordinary browser code. The fewer moving parts between the user and the signed transaction, the better.

Historically, the JavaScript `elliptic` library made local browser secp256k1 signing practical for Chisel. That was the bridge from an earlier idea about browser-local signing to a working implementation. Chisel is now moving that primitive behind an implementation-neutral boundary and targeting `@noble/secp256k1` as the replacement signer.

The Noble migration keeps the important part unchanged: private keys and transaction signing remain local to the browser. What changes is the curve implementation, not Chisel's transaction model, WIF handling, address derivation, sighash construction, script construction, or browser-first distribution model.

The migration boundary is implemented in `chisel.secp256k1.js`, the Noble adapter is `chisel.secp256k1.noble.js`, and the guarded regression path is documented in `docs/SECP256K1_MIGRATION.md`.

The normal static browser path still retains the legacy elliptic runtime until a pinned standalone Noble browser build is wired into ordinary Chisel. That is a packaging and cutover issue, not a change in project direction. Noble is the target implementation; elliptic is now compatibility scaffolding.

## 2. The recurring Chisel design move

Chisel follows a small-tool, Unix-like design instinct: use the primitive that already exists, expose it, and compose it with other small tools instead of creating another mandatory framework.

The pattern appears repeatedly:

```text
Bash parses Bash
`declare -f` exposes a normalized function representation
small checksum / ASC functions identify compact state
M64 compresses symbolic representations
Solidity can hold durable dictionary or symbol state
LoRa, WebRTC, QR, HTTP, or removable media can transport signed objects
blockchains provide durable public settlement or evidence
IPFS can hydrate larger artifacts
Portal and Mogwai provide human navigation
```

The point is not that every one of those mechanisms belongs in the core. The point is that none of them should have to own the entire system.

A signed transaction is a useful example. Its validity does not depend on whether it arrived through HTTP, WebRTC, LoRa, Bluetooth, QR codes, or a USB stick. Transport can be opportunistic. A gateway can relay a signed transaction to a blockchain node without ever holding the private key.

That same separation applies to background services. Full nodes, gateways, chain watchers, proof generators, IPFS pinning, hydration, indexing, and store-and-forward relays perform real work and can be monetized using an existing cryptocurrency without making payment itself the definition of truth.

## 3. Executive summary

Chisel is a browser-first toolkit for reading and preserving small blockchain artifacts. It treats a transaction output as more than a payment. An address can carry readable structure, an amount can carry a small code, an OP_RETURN can carry text or a pointer, and the transaction itself can become a public note, breadcrumb, receipt, ritual, or searchable index.

The 2020 white paper states the root claim: a cryptocurrency transaction can combine spendable and unspendable outputs that are understood as coming from one sender and acting atomically as a self-descriptive object. Chisel is the working implementation of that claim.

The practical goal is not to build another private database wrapped around a chain. The goal is to make public ledger material readable and recoverable from the ledger itself, then let local tools add notes, categories, imports, and indexes without becoming the source of truth.

In plain terms: Chisel turns ordinary UTXO transaction machinery into a small, chain-native publishing and indexing system.

## 4. White paper kernel

The paper starts from a limitation in Bitcoin-style systems: ordinary wallets expose address and amount, but not a native public memo field. OP_RETURN became the common payload channel, but it is not universally exposed by wallet software and tends to create specialized readers, indexers, and third-party tooling.

The paper proposes two universal channels that already exist in every simple payment: the target address and the transaction amount. The address channel can carry readable material through obviously unspendable addresses. The amount channel can carry small labels through advanced satoshi codes, including Kloctal and Shoctal-style encodings.

The paper then combines these with multi-output transactions. Because output order is preserved, a transaction can carry a message block. Repeated or structured amount codes can bind outputs together. Optional agents can assemble, summarize, or relay these messages, but the ledger remains the durable source.

That is the narrow technical spine of Chisel: address text, amount tags, optional OP_RETURN, ordered outputs, and external readers that do not own the meaning.

## 5. Implementation map

Note: use MacDougall in new writing. Older source files may contain MacDougal. Do not make the spelling drift worse.

| White paper concept | Chisel term | Current implementation / location | Interpretation |
| --- | --- | --- | --- |
| Browser-local signing feasibility | Noble secp256k1 target behind common boundary | `chisel.secp256k1.js`, `chisel.secp256k1.noble.js`, `chisel.sign.backend.js` | The browser can keep signing local while the curve implementation remains replaceable. |
| Static browser interface | Vanilla JS application shell | `index.html`, `app.js`, `chisel.js` | No bundler or Node build step is required for the main reader/authoring path. |
| Physical usability layer | QR labels and stickers | `tools/qrField`, `tools/keyPrint`, scan pages | Keys, txids, addresses, and route labels can move through ordinary printed objects. |
| Base58-Hash currency family | Multi-chain UTXO target | DigiByte, Ravencoin, Litecoin, Dogecoin modules | The common substrate is UTXO transaction construction, not a single chain brand. |
| Obviously unspendable address | MacDougall address line | `chisel.unspendable.js`, `unspendable.py` lineage | Readable output address intended as a burn / non-spendable target. |
| Address namespace | DAx / DBx / DCx / DDx / DEx | MacDougall conventions | DAx person, DBx transport/source, DCx subject, DDx/DEx split pointer. |
| Advanced satoshi code | ASC / Shoctal / amount tag | Daisy scripts, chord output, amount fields | Small value-level metadata used as a tag, checksum, or logical binder. |
| OP_RETURN | Payload channel | Chain send modules and decode logic | Useful but optional. Chisel does not depend on OP_RETURN as the only semantic layer. |
| Multi-output transaction | Artifact transaction | send-to-multiple outputs, local fixtures | The whole vout set is the object. Output order matters. |
| Agent / hub | fileProxy, bunOven, keeperBun | `tools/fileProxy`, `tools/bunOven`, `tools/keeperBun` | Authoring, import, caching, and API access tools. They are not the ledger. |
| Interactive systems | Portal, chords, print rituals | Portal path, chord files, label/QR tools | Human-facing views over ledger-native objects. |

## 6. Architecture boundary

Chisel core builds, signs, serializes, decodes, and explains meaningful UTXO transactions. Portal displays and filters transaction artifacts. Data is a static or local snapshot of transaction fixtures, indexes, imports, and chords. Tools are satellites that help author, import, cache, print, scan, relay, or hydrate material.

fileProxy should be treated as an authoring/import/local-write tool. Normal readers should be able to open a static dataset from relative JSON paths, GitHub Pages, IPFS, rigler.org, or another trusted HTTP source when indexes are present.

keeperBun should be treated as an optional signed-access API broker for paid or secret-bearing APIs. It should never be part of the baseline reading path. Secrets are operational plumbing, not Chisel semantics.

Rule: anything required to understand a transaction belongs near the core. Anything required only to fetch, cache, print, scan, relay, or administer belongs outside the core.

## 7. M64 and symbolic state

M64 is useful when it compresses structure rather than blindly compressing source text. A language adapter can reduce repeated syntax and words to symbols, and a durable EVM/Solidity dictionary can assign compact references to those symbols.

Bash is a particularly useful experiment because Bash already parses Bash. Chisel can source a small function file, use `declare -f` to emit the shell's normalized representation, then run tiny checksum/ASC or symbolic transforms over that result. Colon records can remain inert data while executable behavior stays in ordinary functions. Nested functions can express a practical tree even though Bash itself does not provide lexical function scope.

The persistent object does not need to be "Bash source." It can be a compact symbolic tree plus dictionary references. Bash, JavaScript, or another language can then be a hydration target.

This is a research direction. Chisel should not pretend to serialize arbitrary Bash semantics when a small deliberately constrained form will do.

## 8. Transport and relay boundary

A signed blockchain transaction can be constructed offline and transported independently of the blockchain's native peer network. A LoRa or WebRTC relay does not need the private key and does not need to reinterpret the transaction. It can carry opaque signed bytes toward a gateway that has blockchain connectivity.

The return path can be much smaller than a whole block. Depending on the trust model, a gateway can return a txid status, block height, block hash, selected transaction subset, compact proof, or a Merkle inclusion proof.

This suggests a small control-plane vocabulary rather than "blockchain over radio":

```text
TX      signed object moving toward a chain
QUERY   request for a narrow piece of chain state
PROOF   selected result or evidence coming back
```

The same signed object can use another transport without changing its meaning.

## 9. Reputation and optimistic claims

Not every distributed message has to be globally proven before it is relayed. A lighter network can preserve who signed a claim, what evidence accompanied it, and whether later evidence confirmed or contradicted it.

The useful separation is:

```text
signature = who made the claim
evidence  = what supports the claim
history   = how that signer behaved before
trust     = how much weight a receiver chooses to give them
truth     = not automatically defined by the signer
```

Unknown participants can begin with little reputation and earn trust through verifiable behavior. Reputation should remain contextual rather than collapsing into one global social-credit score.

Cryptographically provable statements, eventually verifiable observations, and interpretive claims should not be treated as the same category.

## 10. Working definitions

- **Chisel:** A browser-first toolkit for constructing, signing, decoding, importing, and presenting data-rich UTXO transactions.
- **Vanilla JS:** The no-build, inspectable browser runtime choice for the main app. Optional tools may use Python, Bun, Deno, or Node, but those are satellites.
- **Noble:** `@noble/secp256k1`, the target browser-local secp256k1 implementation behind Chisel's implementation-neutral signing boundary.
- **elliptic:** The historical secp256k1 implementation and current compatibility/parity path. It should disappear from the normal build only after Noble is packaged for the ordinary static browser distribution.
- **MacDougall:** The readable address-language layer descended from obviously unspendable address construction. New docs should spell it with two Ls.
- **ASC:** Advanced Satoshi Code. A small amount-level code used as a tag, checksum, binder, or compact signal. Shoctal is one family inside this idea.
- **Chord:** A shell-like local rendering of transaction outputs and route/context information. It is a view, not the canonical chain record.
- **Thunderword:** A universal marker address used as a search/index beacon.
- **Portal:** The main reader/viewer experience for Chisel artifacts.
- **fileProxy:** Local filesystem bridge for authoring, imports, and local writes. It should not be required for ordinary static reading.
- **bunOven:** Importer that pushes feed material through fileProxy into the Chisel datastore shape.
- **keeperBun:** Signed-access hot keeper for API secrets and paid remote API access. It is optional infrastructure.
- **Satellite:** A tool, UI, proxy, print page, scanner, relay, or chain-specific helper that uses Chisel but should not define the core.

## 11. Positioning cautions

Use cautious language around unspendability. The social and practical point is that the address is deliberately constructed as a readable burn target, not harvested as a vanity key. Consensus rules do not mark it as special. A user should still treat any value sent there as destroyed.

Do not frame OP_RETURN as useless. It remains useful for compact payloads, URLs, hashes, and direct text. The critique is narrower: OP_RETURN alone often pushes users toward specialized tools and gatekeepers. Chisel uses it as one lane, not the whole road.

Do not frame agents as trusted authorities. Agents can relay, assemble, cache, summarize, or sell infrastructure services, but the durable object is the public transaction or signed claim. If an agent becomes mandatory to interpret the artifact, the design has drifted back toward the thing the project is trying to avoid.

For compliance and audit audiences, use the phrase voluntary pre-disclosure. The system can make public transactions easier to understand, document, and audit. It is not a claim that Chisel replaces law, KYC, AML, accounting systems, or professional review.

## 12. Five-minute colleague demo

Start with a single transaction artifact. Point to the txid as the permanent lookup key. Show the OP_RETURN channel if present. Show MacDougall address outputs as indexed human labels. Show the amount field as a possible tag or binder. Show local notes as local interpretation, not ledger truth. Then open the raw JSON to prove the view is not magic.

After that, show that the same object could be loaded from a local fileProxy, a static dataset, a full node export, a block explorer API, or another transport. The source can vary, but the transaction artifact remains the anchor.

Only then show how Chisel constructs and signs a new UTXO transaction locally. The strongest technical point is not the specific curve library. It is that the browser can prepare and sign meaningful transaction structure without handing the private key to a server.

## 13. Source notes

Primary theory source: John Rigler, “Thoughts on an all-purpose cryptocurrency linguistic system,” IEEE Blockchain 2020 draft PDF in the project archive. Relevant sections include the abstract, Introduction, OP_RETURN Codes, Advanced Satoshi Codes, Obviously Unspendable Addresses, Combining Systems for Greater Value, and Further Interactive Systems.

Current implementation source: the Chisel project and its browser-first transaction, Portal, local datastore, M64, relay, QR, and tool experiments.

MacDougall source: `unspendable.py` / UNSPENDABLE README lineage, including readable address conventions, checksum suffix construction, and DAx / DBx / DCx / DDx / DEx namespace assignments.

Assistant credit: ChatGPT, OpenAI, assisted in editorial synthesis, document organization, and generation of Markdown and HTML versions. This is not a claim of authorship over Chisel, MacDougall, unspendable, ASC, Shoctal, the white paper, the codebase, or any ledger artifacts.
