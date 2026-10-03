# Chisel Architecture

This document defines the architectural rules for Chisel.

It is deliberately stricter than the README. The README explains what Chisel is; this file defines how new code should be built, reviewed, refactored, and reconstructed.

The goal is not framework purity. The goal is a codebase that remains understandable, portable, durable, and easy for both humans and AI systems to inspect and modify without requiring a large external toolchain or institutional memory.

## 1. Browser first

The normal Chisel experience should run in an ordinary browser.

Prefer browser APIs, static files, and client-side logic. A public reader should not require Node, Bun, Deno, Python, a database server, a cloud account, or a private backend merely to open and inspect Chisel material.

Server-side helpers may exist for authoring, indexing, hydration, node access, bulk import, or local convenience. They are satellites, not the center.

## 2. Static and IPFS compatible

Public-facing Chisel code should work from static hosting wherever practical.

Assume the same artifact may be served from GitHub Pages, Apache, IPFS, localhost, removable media, or another simple file host.

Do not make DNS, a particular origin, a SaaS backend, or a deployment platform part of the data model.

Relative paths are preferred when they preserve portability.

## 3. Vanilla JavaScript is the default

Use browser-native JavaScript, HTML, and CSS unless there is a concrete reason not to.

Do not add React, Vue, Angular, Next, TypeScript, bundlers, transpilers, component frameworks, package managers, or other application frameworks merely because they are conventional.

A dependency must solve a real problem that browser APIs and small local code do not reasonably solve.

"No framework" does not mean "no structure." Chisel should create the amount of structure it actually needs.

## 4. No mandatory build step

A checkout should remain inspectable and useful without first reconstructing a JavaScript build environment.

Generated artifacts may exist where useful, but the primary public application should not depend on an opaque compile or bundle pipeline.

The source should be close to the thing that runs.

## 5. Prefer small primitives over large abstractions

Use the smallest representation that already does the job.

Examples include:

- a transaction output instead of a new database object;
- an address instead of a hosted identifier;
- a txid instead of an application-specific locator;
- a JSON or text fixture instead of a service;
- a QR code instead of an account handshake;
- a small function instead of a class hierarchy;
- a browser API instead of a package;
- a shell helper instead of a new daemon where the shell is sufficient.

Composition is preferred to framework enclosure.

## 6. The ledger and the interpretation are separate

Public blockchain data is the durable substrate. Local interpretation is allowed to change.

Do not confuse:

- what the transaction literally contains;
- what Chisel currently knows how to decode;
- local notes or corrections;
- imported metadata;
- cached or indexed representations.

A local index should be rebuildable from durable source material wherever possible.

## 7. Identity should be cryptographic, not account-shaped

Do not assume that a hosted username, cookie, OAuth account, DNS name, or application database row is the root identity.

Where identity matters, prefer explicit addresses, keys, signed messages, signed transactions, or other verifiable artifacts.

Convenience state may remember a user's addresses or preferences, but convenience state is not identity.

## 8. Signing stays local by default

Private keys should remain under the user's control.

Browser-local signing is the preferred path. Remote signing, custodial signing, or server-side key handling must be treated as exceptional architecture and clearly separated from the ordinary path.

Never make a network service necessary merely to perform cryptographic work the browser can safely perform locally.

## 9. Transport does not define trust

HTTP, QR, Bluetooth, WebRTC, LoRa, removable media, IPFS, or another relay may carry an artifact.

The transport is not the authority.

Validation should come from the artifact itself, its signature, its transaction structure, its checksum, its ledger confirmation, or another explicit verification rule.

This allows transports to be replaced without redefining Chisel.

## 10. Network boundaries must be obvious

Calls to explorers, nodes, fileProxy, IPFS gateways, RPC endpoints, third-party APIs, or other services should be easy to locate in the source.

Do not bury network behavior inside unrelated UI logic.

When practical, isolate provider-specific behavior behind small adapter functions so a provider can be changed without rewriting the application.

## 11. State should be inspectable

Prefer state that can be represented as ordinary JavaScript objects, JSON, text, URLs, addresses, txids, or other visible values.

Avoid hidden global state, implicit framework state, and unnecessary indirection.

If a user action changes important state, a developer reading the relevant code should be able to determine where that state lives.

## 12. Local state belongs to the user

Cookies, localStorage, IndexedDB, filesystem data, cached addresses, preferences, and local indexes should be treated as user-owned working material.

Do not design local persistence as surveillance infrastructure.

Where practical, make local state visible, exportable, editable, and disposable.

## 13. Keep protocol logic separate from UI logic

Encoding, decoding, checksum rules, address construction, transaction serialization, signing, ledger parsing, M64, Base57, and similar protocol behavior should not depend on DOM layout.

UI code may call protocol code. Protocol code should not need to know which button was clicked.

This is especially important for fixtures and regression testing.

## 14. Preserve known-value behavior before refactoring

Do not broadly rewrite signing, serialization, fee selection, UTXO selection, broadcast, address generation, checksum behavior, or legacy artifact decoding without regression fixtures.

For dangerous code paths:

1. capture known-good inputs and outputs;
2. make the fixture executable;
3. change one boundary at a time;
4. compare old and new behavior;
5. remove the old path only after parity is demonstrated.

Refactoring is not a reason to silently change protocol behavior.

## 15. Backward readability matters

Ledger artifacts can outlive the application version that created them.

A newer Chisel should make a serious effort to continue reading older Chisel artifacts.

If a format must change, prefer versioned decoding, explicit migration, or hydration rules over simply abandoning old material.

Durable writing creates a long-term decoding obligation.

## 16. Prefer explicit duplication over opaque abstraction

Do not remove a few repeated lines at the cost of creating a difficult abstraction.

Duplication is sometimes cheaper than indirection.

Abstract when the shared behavior is stable and conceptually real, not merely because two code blocks currently resemble each other.

## 17. Optimize for locality of understanding

A developer or AI system should be able to understand a module with as little external context as practical.

Prefer:

- descriptive names;
- short call chains;
- explicit inputs and outputs;
- nearby documentation;
- visible constants;
- direct control flow;
- small adapter boundaries.

Avoid architecture where understanding one function requires reconstructing a large hidden runtime.

## 18. Code should be AI-readable

AI is an expected maintainer of Chisel, not merely a code generator.

Write source so that a model can reliably inspect and modify it later.

That means:

- important rules should be written down;
- unusual invariants should be stated near the code;
- modules should have clear purposes;
- names should describe concepts rather than implementation fashion;
- hidden side effects should be minimized;
- format examples and fixtures should be preserved;
- magic generated code should not become the only readable specification.

The target is not "code made by AI." The target is code that remains legible to humans and AI after context has been lost.

## 19. Architecture is allowed to be project-specific

Chisel does not need to inherit the software industry's preferred abstraction stack.

If a small Chisel-specific convention solves the problem better, document it and use it.

A few hundred lines of explicit project-owned infrastructure may be preferable to importing a large ecosystem whose behavior is mostly outside the repository.

The test is maintainability and capability, not fashion.

## 20. Dependencies must earn their permanence

Every dependency is a future archaeological site.

Before adding one, ask:

- What exact capability does it provide?
- Can the browser already do this?
- Can a small local implementation do this safely?
- Does it require a build pipeline?
- Can it be pinned and vendored if long-term reproducibility matters?
- What happens when its CDN, package registry, project, or API disappears?
- Will an artifact still be understandable years later?

Cryptographic dependencies deserve especially conservative treatment.

## 21. Public reading and private authoring are different layers

The public Portal should be able to read bundled or durable material without requiring the machinery used to produce it.

fileProxy, Bun, Deno, Python helpers, local full nodes, import scripts, scanners, index builders, and other tools may participate in authoring and publishing.

Their existence should not make the published artifact dependent on them.

## 22. Replaceable tools beat central services

Chisel should be a collection of cooperating tools with inspectable interfaces.

A scanner, encoder, signer, Portal, file proxy, hydrator, label printer, game bridge, or indexer should be replaceable where practical.

Avoid turning every capability into one permanent monolithic application.

Loose coupling allows old ideas to be revived without reviving an entire historical stack.

## 23. Recovery is part of the design

Assume repositories, gateways, domains, browsers, APIs, and machines will change.

For durable features, ask how the artifact can be reconstructed if today's convenience layer disappears.

Prefer deterministic formats, checksums, explicit versioning, bundled fixtures, ledger-native references, and content-addressed storage where appropriate.

If recovery requires knowledge that exists only in one developer's memory, the architecture is incomplete.

## 24. Security-sensitive code should be boring

Cryptographic and transaction code is not the place for cleverness.

Prefer explicit transformations, known test vectors, deterministic behavior, small reviewable functions, and conservative dependencies.

UI experimentation may move quickly. Signing and serialization should move carefully.

## 25. The shortest loop is preferred

Chisel development should preserve a short path:

```text
idea -> source change -> run -> inspect -> test -> commit
```

Do not add process or tooling unless it removes more friction than it creates.

A change that requires reconstructing a large environment before it can be tested has acquired architectural cost.

## 26. Complexity must justify itself

Complexity is not evidence of maturity.

A sophisticated solution is justified only when the problem requires it.

When two designs provide the needed capability, prefer the one with:

- fewer moving parts;
- fewer dependencies;
- fewer hidden assumptions;
- clearer failure modes;
- easier recovery;
- easier inspection;
- longer expected readability.

## 27. Preserve experiments, but consolidate protocols

Chisel is allowed to explore.

Experimental tools, alternate transports, encodings, scanners, visual systems, games, and interfaces may coexist.

But once several experiments depend on the same underlying concept, move that concept toward a documented protocol or shared primitive rather than allowing incompatible private versions to proliferate.

Exploration can be messy. Durable boundaries should not be.

## 28. Ask "why does this layer exist?"

Before extending an existing subsystem, question the subsystem itself.

Do not automatically use AI to produce more React, more TypeScript, more middleware, more configuration, more services, or more wrappers simply because they already exist.

For every layer, ask:

1. What constraint originally required this?
2. Does that constraint still exist?
3. Can the browser, ledger, filesystem, or AI-assisted workflow now remove it?
4. What is the smallest replacement?

AI should be used to reconsider architecture, not merely accelerate inherited architecture.

## 29. Source is part of the durable artifact

Chisel's source code is not disposable scaffolding around the "real" product.

Readable source explains how artifacts are created, interpreted, and recovered.

Keep important algorithms and protocol rules in forms that can be inspected directly from the repository.

Documentation, fixtures, and examples should make it possible to reconstruct intent even after the original development conversation is gone.

## 30. The final test

Before adding architecture, ask:

> If this repository were found years from now by a competent developer and an AI model, with no access to the original development environment, would the important parts still make sense and could they be made to run?

If the answer becomes increasingly "no," simplify the system or document the missing assumptions.

---

These rules are defaults, not ceremonial restrictions. A rule may be broken when a concrete requirement demands it, but the exception should be explicit and the new complexity should earn its place.
