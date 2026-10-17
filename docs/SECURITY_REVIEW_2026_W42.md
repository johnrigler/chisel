# Chisel review fixes — 2026 W42

This change addresses the technical review of commit `c231a9c` in Daisy 2026, week 42. It keeps the static browser application and existing valid signatures compatible.

| Review item | Change | Regression evidence |
| --- | --- | --- |
| 1. Provider-driven automatic fee retry | Removed error-text fee parsing and rebuilding. The user reviews actual outputs and the verified fee before signing. Normal and manual paths enforce a local ceiling. Ordered broadcast failover still submits identical signed bytes. | Send cancellation, explicit acceptance, and malicious `99000000` fee-error tests. |
| 2. Untrusted UTXO values | Fetch the selected inputs' previous raw transactions, check each txid locally, read the actual output value and locking script, and require ownership before signing. Locally audit the transaction returned by an RPC against the prepared outputs and fee. | Under-reported amount, substituted raw transaction, wrong output index, wrong owner, and replaced recipient tests. |
| 3. CompactSize and spending every input | Strict bounded CompactSize decoding for counts and script lengths, duplicate/truncation checks, witness-aware previous-transaction IDs. Choose enough inputs, with a 100-input application limit. The low-level signer correctly handles 253 inputs. | 252/253/300-input parser cases, 253-input signing with independent first/last signature verification, and exact legacy fixtures. |
| 4. Amount parsing | Exact fixed-point decimal conversion, safe-integer bounds, and positive recipient amounts. Reject hex, exponent strings and more than eight decimal places instead of rounding. Editing an incomplete value leaves a useful preview error. | Boundary and malformed amount cases; full-app mocked send smoke. |
| 5. Chain-derived links | Every portal anchor assignment uses a parsed HTTP(S) allowlist; reject executable schemes, credentials and control characters. Remove invalid hrefs and raw media fallbacks. | URL evasions and production link-rendering helper tests. |
| 6. Signed artifact ambiguity | Enforce low-S signatures and scalar ranges. Canonicalization accepts plain JSON only, rejecting exotic objects, accessors, hidden/symbol properties, sparse arrays and cycles. Snapshot the payload before asynchronous signing. | Existing artifact proof unchanged; high-S twins, altered payloads and non-JSON cases rejected. |
| 7. Identity bypasses signing boundary | Identity signing and verification use the shared secp256k1 boundary. Include identity and signing scripts in syntax and behavior checks. | Production Noble transaction/artifact fixtures, with the legacy transaction signer deliberately disabled. |
| 8. Mislabelled vendor source | Remove the saved HTML page named `elliptic-6-6-1.js`; retain the real minified legacy copy and correct references. Record and verify hashes for every vendor JS asset. | Vendor hashes, file types, embedded-copy equality and generated-driver freshness in CI. |
| 9. elliptic advisory | Ordinary wallet/identity pages, CLI, standalone driver and Keeper now use pinned local Noble 3.2.0. Never generate a legacy comparison signature during production signing. Keep elliptic only for explicit compatibility/testing APIs; missing Noble fails closed. | Public fixture parity harness; Keeper DER compatibility; production signing with a poisoned legacy signer. |
| 10. Hygiene | Main-page CSP uses exact inline-script hashes and local script sources. Expand CI to all root regression tests and missing syntax checks; pin Actions to commit IDs. Archive inactive workflow drafts and stray root snippets without discarding them. | CSP hash and asset-existence checks; complete regression workflow. |

## Fee policy

The application rejects a fee above the smaller of **10 times its local minimum estimate** and **100 times the coin's default base fee**. The absolute upper bounds are 0.01 LTC, 0.2 RVN, and 0.02 DGB; the estimate-relative limit can be lower. Extra legacy inputs are included in the estimate. These are application limits, not a promise about network acceptance. A provider rejection leaves the fee unchanged; the user must start a fresh reviewed transaction after editing it.

The review lists the selected network, verified input total, every raw output and the exact network fee. Declining it performs no signing or broadcasting in that step. A raw transaction with unexpected recipients, change, data or fee is rejected locally. Manual raw hex is reviewed from its actual bytes rather than stale editable JSON.

Normal sending chooses only enough verified inputs to cover recipients, fee and non-dust return change. Unselected inputs remain unspent. Omission of an entire UTXO by an explorer does **not** turn that omitted coin into a fee.

## Trust and compatibility limits

Hash-checking previous transactions establishes their amounts and scripts, not current unspent status or chain confirmation. A stale or fabricated outpoint can still cause network rejection. RPC nodes must expose raw previous transactions; Litecoin providers fall through in their configured order if raw lookup fails or returns the wrong transaction. If verification is unavailable, signing stops. This path supports legacy P2PKH spends; witness data is read to calculate previous txids, not to sign witness or MWEB inputs. Raw outputs outside JavaScript's exact integer range are rejected.

Noble is committed as a readable source file and a classic-script browser bundle, with its MIT license and checksums. No npm installation, CDN or build step is needed to run the site. The retained elliptic API is an offline parity reference and an explicit legacy option; its presence does not mean its upstream advisory was fixed. Production pages do not select it. `CHISEL.signDigest()` is now asynchronous; callers must await it. `signArtifact()` already was asynchronous.

The main CSP permits HTTP(S)/WebSocket connections for user-selected explorers, nodes, gateways and File Proxy services. Styles retain inline support. Other standalone pages have not acquired a blanket CSP in this change. Password-manager storage remains an explicit user-controlled feature; saving a WIF in a password manager may synchronize it according to that manager's settings.

## Reproduce locally

```sh
node --test tests/*.test.mjs
node tests/check-vendor.mjs
node tools/build-driver.mjs --check
npm ci --prefix tools/secp256k1Migration --ignore-scripts --no-audit --no-fund
npm test --prefix tools/secp256k1Migration
```

The full-app smoke uses a public scalar-one fixture, mocked UTXO/raw-transaction reads and a mocked broadcaster. It checks initialization, cancelled review, accepted send, an under-reported input value and invalid recipient precision. No real transaction or public comment is sent during validation. Never fund fixture keys.
