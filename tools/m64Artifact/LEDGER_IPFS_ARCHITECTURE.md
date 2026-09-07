# M64 Ledger / Dictionary / IPFS Architecture Notes

Status: design direction, not a frozen protocol.

This document records the architectural ideas around M64, Polygon/EVM storage, shared dictionaries, cross-ledger references, deterministic IPFS recovery, and ledger-native discovery/bootstrap. Some of the M64 v2 codec pieces already exist in `m64.js`; most of the ledger graph, discovery, and IPFS reconstruction model described here is still design work.

## Core premise

M64 should not treat a blockchain as an application server.

The ledger is a durable source of data and references. The browser/client is responsible for resolving those references, reconstructing artifacts, verifying them, and executing them when appropriate.

A useful hard rule is:

```text
Nothing needs to be hydrated inside the EVM.
```

For JavaScript artifacts the basic model is:

```text
Polygon / Litecoin / DigiByte / other ledger data
        |
        |  artifact bytes + references
        v
client-side resolver
        |
        |  fetch referenced objects
        |  resolve dictionary ids
        |  reconstruct canonical source/files
        v
JavaScript engine / IPFS / other runtime
```

Solidity may be used to manufacture convenient durable objects, but Solidity execution is not the point of the system.

## EVM as a durable data substrate

The intended use of EVM is deliberately unconventional.

An EVM transaction can carry a substantial `data` field. A contract can also provide a stable Ethereum-style address that identifies an on-chain object. M64 can use either of those facts without asking the EVM to decode or execute the embedded artifact.

The client can retrieve transaction input/data or call a simple contract and interpret the returned bytes according to Chisel/M64 conventions.

This gives at least two useful locator types on Polygon:

```text
P:<transaction hash>   one specific historical transaction
C:<contract address>   one addressable on-chain object / namespace
```

A transaction hash is useful when exact historical identity matters.

A contract address is useful when the object is intentionally represented as a persistent table, dictionary, manifest, or namespace.

Both are only references from the resolver's point of view.

## Ledger objects, not conventional smart contracts

The more general abstraction is a ledger object.

A ledger object may be:

- a Polygon transaction containing data
- a Polygon contract containing a dictionary or manifest
- a Litecoin transaction
- a DigiByte transaction
- an IPFS CID
- a future ledger/object type understood by the resolver

The relationships exist because one object describes another object. The ledger does not need to traverse the relationship itself.

Example:

```text
artifact A
  dictionary = C:0x...
  parent     = P:0x...
  payload    = <M64>
```

The browser interprets those locators and follows them.

This is closer to a graph of historical artifacts, Git commits, or linked immutable records than to a normal smart-contract application.

## Dictionaries are plural

There does not need to be one canonical dictionary.

A dictionary is identified by its own ledger reference, normally a Polygon contract address or another immutable object locator.

Therefore a symbol is not globally defined as:

```text
173 = drawLine
```

It is defined in a namespace:

```text
(C:0xDictionaryA, 173) = drawLine
(C:0xDictionaryB, 173) = canvas
```

Different people can publish their own dictionaries. An artifact simply states which dictionary or dictionary graph it uses.

This removes most governance pressure. There is no requirement that everyone agree on a single vocabulary.

A dictionary can become common because many artifacts use it, not because the protocol grants it exclusive authority.

## Append-only semantics

If a dictionary is represented by a contract, old meanings must not be reinterpretable.

The safest shape is structural rather than social:

```text
append:   allowed according to policy
replace:  impossible
remove:   impossible
reorder:  impossible
upgrade:  preferably impossible
```

If index 173 means `drawLine`, no later operation should be able to make index 173 mean something else.

Who may append is a separate policy question. Possible models include:

- one writer/appender address
- open append where the writer pays gas
- a curated dictionary that can later be frozen
- a permanently frozen dictionary with later extension dictionaries

Because dictionaries are plural, a user who dislikes another dictionary can simply publish a different one.

## Reference and extension instead of Solidity storage inheritance

Solidity source inheritance does not inherit the storage of an already deployed contract.

But one dictionary can reference another deployed dictionary or historical object.

Conceptually:

```text
Base JavaScript dictionary
C:0xAAA...
        |
        +-- graphics extension
            C:0xBBB...
                |
                +-- project-specific extension
                    C:0xCCC...
```

The extension relationship is resolved by the client.

A frozen parent makes a flat continuation of numeric ids possible. Another design is to keep ids scoped by table and encode a pair such as:

```text
(table id, symbol id)
```

Example:

```text
0:17  -> function
0:31  -> return
1:8   -> drawLine
1:12  -> putPixel
2:4   -> noteOn
```

The exact addressing scheme is not frozen.

## Contracts may reference other tables

A small EVM object can act as a manifest rather than a monolithic dictionary.

For example, a root object could contain an array of addresses:

```text
table[0] -> base JavaScript vocabulary
table[1] -> browser/DOM vocabulary
table[2] -> graphics vocabulary
table[3] -> MIDI vocabulary
```

The EVM does not need to recursively resolve those tables. The browser reads the manifest and follows the addresses.

Likewise, transaction data can directly describe older transactions or contract addresses.

## JavaScript and language vocabulary

JavaScript engines already use related ideas internally:

- lexical keywords become token ids
- identifiers may be interned
- bytecode uses numeric opcodes
- compiled functions use constant pools

Those implementation-specific ids are not portable or stable enough to use directly, but the architecture is useful.

M64 can separate relatively fixed language vocabulary from open-ended project vocabulary.

For JavaScript, a possible future split is:

```text
fixed language table
  function
  return
  const
  let
  if
  else
  for
  while
  ...

shared/open dictionary
  drawLine
  putPixel
  width
  height
  Uint8Array
  getContext
  ...

literal material
  numbers
  uncommon strings
  unavoidable punctuation/data
```

The current M64 v2 codec already supports dictionary indexes above 63 and external lookup hooks. The exact split between fixed language tokens and ledger-backed dictionaries is still open.

## Language-neutral contract shape

A Solidity dictionary does not need to understand JavaScript.

The same primitive contract form could identify itself with metadata such as:

```text
language = javascript
language = python
language = rust
```

or a language-neutral namespace identifier.

The EVM object only maps ids, terms, references, and metadata. The client determines how those terms are used.

Different languages can therefore use separate dictionaries while reusing the same general M64/ledger machinery.

## M64 artifact model

The desired external-dictionary artifact is much smaller than a self-contained package with an embedded token array.

Conceptually:

```text
language / runtime
resolver or dictionary reference(s)
M64 payload
optional expected output/checkpoint hashes
```

For example:

```text
language: javascript
dictionary: C:0x...
payload: <M64>
```

A richer artifact may reference multiple tables or parent artifacts.

The important point is that repeated language and project vocabulary is paid for once in shared objects and then referenced numerically by many later artifacts.

## Why Polygon is a useful first EVM layer

Polygon PoS is currently a practical place to experiment because it combines:

- EVM compatibility
- standard Ethereum-style addresses
- MetaMask and Remix support
- inexpensive transactions compared with Ethereum L1
- transaction calldata suitable for carrying M64 artifacts
- ordinary JSON-RPC retrieval from a browser/client

The architecture should not assume Polygon is the only or final ledger.

Polygon is better treated as one high-capacity stratum in a larger ledger graph.

A particularly durable or culturally important root/checkpoint could also be referenced from Ethereum, Litecoin, DigiByte, or another ledger.

## Cross-ledger graph

M64 and Chisel should be able to describe references without requiring every referenced object to live on the same chain.

Possible locator families include:

```text
P:<polygon transaction hash>
C:<polygon contract address>
L:<litecoin transaction reference>
D:<digibyte transaction reference>
I:<ipfs cid>
```

These prefixes are illustrative, not a frozen encoding.

A future artifact can therefore be a graph spanning several ledgers:

```text
Polygon M64 artifact
   |
   +-- Polygon dictionary contract
   |
   +-- Litecoin historical artifact
   |
   +-- DigiByte metadata/reference
   |
   +-- IPFS checkpoint
```

The client resolver is the common execution environment for this graph.

## Discovery is part of recoverability

Recoverable bytes are not enough if there is no practical way to find the first object.

The architecture should therefore treat discovery/bootstrap as a separate layer from content reconstruction.

Possible discovery roots include:

```text
known public address / identity
known contract address
known transaction hash
known thunderword / beacon address
known Litecoin or DigiByte marker
known IPFS CID
human-readable metadata copied from a block explorer
```

No single discovery mechanism needs to be authoritative. Redundant paths are desirable.

## The all-ones Polygon beacon / thunderword convention

One historical Chisel/Polygon convention has been to use the Ethereum-style all-ones address as a low-traffic beacon/burn namespace:

```text
0x1111111111111111111111111111111111111111
```

The conventional all-zero address is much more widely used as a burn/null address. The all-ones address is useful here precisely because it is less crowded.

Earlier bootstrap/tool experiments could be sent toward that address with human-readable or directly inspectable transaction data. A person using a block explorer could:

```text
1. search the all-ones address
2. inspect its relatively small transaction history
3. recognize the publishing/sender address
4. inspect that publisher's transaction data
5. recover a bootstrap instruction, locator, tool, or later ledger reference
```

This is not meant to make the burn address an application server or protocol authority. It is a public landmark: a deliberately memorable place to start looking.

An automated resolver should not depend on one commercial explorer's index. Standard EVM JSON-RPC does not provide a universal `transactionsByAddress` query. Long-term machine recovery may therefore require an archive/indexing service, scanning blocks, a locally built index, logs/events designed for discovery, or another redundant locator. The important property is that the underlying transactions remain ledger data even if a particular explorer disappears.

## Identity can be a root of the graph

A public/private key pair can itself become a discovery anchor.

If the recovering user possesses the private key, the corresponding public address is deterministic. That address can identify transactions, signatures, contracts, manifests, or beacon entries published by the same identity.

Conceptually:

```text
private key / deterministic wallet seed
        |
        v
public identity address
        |
        v
discover bootstrap transactions / contracts / beacon entries
        |
        v
follow ledger references
        |
        v
resolve dictionaries + M64 artifacts
        |
        v
reconstruct canonical files
        |
        v
verify/recreate IPFS
```

This creates the possibility of recovery from very little local state.

In the strongest version, ordinary hosting, GitHub, domain names, current IPFS pins, and local working directories may all be gone. The retained secret/key material plus public ledger history and a sufficiently specified resolver can still provide a path back to the published system.

The system should not require a literal human-memorized brain wallet. Human-generated passphrases are generally weak key material and can be brute-forced. A safer version of the same architectural idea is a standard high-entropy deterministic wallet seed or other securely stored deterministic secret. The relevant property is reproducible identity, not memorability by itself.

## Bootstrap objects should be unusually simple

The first recoverable object should require as little infrastructure as possible to understand.

A useful bootstrap artifact might deliberately be:

- plain UTF-8 or ASCII
- visible in a block explorer without specialized decoding
- small enough to copy and paste manually
- self-identifying
- versioned
- explicit about the next ledger locator(s)
- optionally signed by the identity address

For example, an early bootstrap layer could conceptually say:

```text
CHISEL-BOOT1
M64=C:0x...
ROOT=P:0x...
IPFS=I:bafy...
```

The exact encoding is not frozen. The point is that the recovery ladder should begin with something much simpler than the system it eventually reconstructs.

This preserves the useful property of the earlier Polygon attempts: a person who knows roughly where to look can inspect the ledger directly and recover enough information to reach the next layer.

## Multiple paths back to the same object

A mature artifact should be discoverable through several independent routes when practical:

```text
identity address
     |
     +-- all-ones beacon transaction
     |
     +-- known dictionary contract
     |
     +-- Polygon artifact transaction
     |
     +-- Litecoin/DigiByte reference
     |
     +-- IPFS checkpoint CID
```

These should converge on the same immutable/checkpointed artifact graph.

This means the disappearance of one index, domain, gateway, repository, explorer, or pinning provider does not necessarily destroy discoverability.

## IPFS is a distribution/checkpoint layer, not the only source of truth

A major design goal is ledger-complete recovery.

An artifact should be capable, in principle, of reconstructing its canonical IPFS representation even if no current IPFS node retains a copy.

The model is:

```text
ledger artifacts + dictionary references
        |
        v
client reconstructs exact files/bytes
        |
        v
client constructs deterministic IPFS DAG / CAR
        |
        v
computed root CID
        |
        +-- compare with historical expected CID
        |
        v
republish / pin / serve again
```

This separates availability from recoverability.

An artifact may temporarily have zero hosted IPFS copies while still being recoverable from the ledger graph.

## Deterministic IPFS reconstruction

Reconstructing the same file bytes is not by itself always enough to guarantee the same IPFS root CID. Import/chunking/DAG settings also matter.

Therefore a ledger-complete artifact should define a deterministic IPFS reconstruction profile.

A future profile might fix things such as:

```text
CID version
multihash algorithm
chunker
chunk size
raw leaves
DAG layout
file ordering
directory construction
metadata treatment
```

A stronger approach is to define deterministic CAR generation and treat the CAR/root CID as the checkpoint.

The design objective is:

```text
same ledger graph
+ same M64 resolver rules
+ same IPFS reconstruction profile
= same canonical CAR / root CID
```

That gives a closed verification loop.

## IPFS checkpoint verification

An artifact may record an expected CID for its reconstructed representation.

Recovery then becomes:

```text
1. retrieve ledger object
2. follow ledger references
3. resolve dictionaries
4. hydrate/reconstruct canonical files
5. build deterministic IPFS DAG/CAR
6. calculate root CID
7. compare calculated CID with recorded CID
8. publish or pin the verified result
```

The CID acts as a checkpoint between two representations:

```text
ledger/M64 representation <-> canonical IPFS representation
```

This allows independent verification of the reconstruction.

## Executable IPFS artifacts

For executable artifacts, the reconstruction should include the complete dependency tree required to reproduce the intended program.

For example:

```text
/index.html
/m64.js
/render.js
/style.css
/assets/...
```

Mutable external dependencies should be avoided. A reconstructed application that still depends on `https://some-cdn/latest/...` is not fully recoverable from the ledger graph.

Dependencies should either be included in the canonical reconstructed tree or referenced by another immutable ledger/CID object.

## Three different integrity layers

The architecture can provide three complementary checks:

```text
ledger history
  proves that a particular compressed artifact/reference existed

M64/dictionary reconstruction
  deterministically produces canonical source/data

IPFS CID
  verifies the reconstructed content/DAG
```

None of these layers needs the EVM to execute the resulting JavaScript.

## What is distinctive about the model

The interesting part is not simply putting source code on a blockchain.

The intended model is closer to:

```text
compact artifact
    +
reusable independently addressable vocabularies
    +
ledger references
    +
identity/beacon discovery
    +
client-side reconstruction
    +
deterministic IPFS checkpoint/republication
```

Repeated code vocabulary can be represented by small symbol references instead of repeated source strings. Shared dictionaries are amortized across many artifacts.

This begins to resemble a ledger-backed linker/loader or portable symbol system more than ordinary text compression.

The additional discovery layer makes it possible to treat identity/key material as a root from which the rest of the system can potentially be rediscovered rather than merely decoded.

## Current implementation versus future direction

Already present in the M64 workbench:

- canonicalization of JavaScript staging source
- dictionary-index encoding
- indexes above 63 using extended varints
- automatic lexical term collection
- external term/index lookup hooks
- local hydration and execution testing
- Polygon transaction-data carrier page

Historical/experimental convention already used outside the current M64 codec:

- all-ones Polygon address as a low-volume thunderword/beacon location for human-discoverable bootstrap data

Not yet a frozen or complete protocol:

- production dictionary smart contract
- writer/freeze policy
- multi-table addressing format
- contract-to-contract/reference manifest convention
- compact cross-ledger locator encoding
- external-dictionary M64 artifact package version
- deterministic IPFS reconstruction profile
- CAR generation/recovery workflow
- ledger-to-IPFS recovery tool
- identity-to-bootstrap discovery convention
- automated beacon/index reconstruction independent of commercial explorers

## Near-term experiments

Useful next experiments, without prematurely freezing the protocol:

1. Deploy a deliberately simple append-only JavaScript dictionary contract with Remix/MetaMask on Polygon.
2. Load a representative vocabulary extracted from existing M64/Dark Star JavaScript.
3. Encode several real JavaScript artifacts using only contract-assigned ids plus literal residue.
4. Measure raw source bytes, canonical bytes, M64 bytes, transaction gas, and actual Polygon cost.
5. Test an artifact that references more than one dictionary/table.
6. Test a child/extension dictionary that references a frozen parent.
7. Define one small deterministic IPFS reconstruction profile.
8. Reconstruct a complete static executable from ledger data, compute its CID, delete all local copies, and reproduce the same CID from the ledger graph alone.
9. Publish a minimal plain-text Polygon bootstrap object through the all-ones beacon convention and recover it without using any Chisel-specific local state.
10. Starting only from a known public identity address plus public ledger access, rediscover the bootstrap object and walk the graph to a verified IPFS CID.

The measurements should determine whether the architecture is merely elegant or materially useful.

## Design principle

The strongest form of the idea is:

```text
availability may fall to zero;
recoverability should not.
```

A stronger bootstrap formulation is:

```text
retain identity/key material
+ retain public ledger history
+ retain the reconstruction specification
= a path back to the executable system
```

If the ledgers remain readable and the reconstruction conventions remain specified, an M64 artifact should be capable of being found, reconstructed, verified, and brought back into an IPFS/executable form even after its ordinary hosted copies have disappeared.
