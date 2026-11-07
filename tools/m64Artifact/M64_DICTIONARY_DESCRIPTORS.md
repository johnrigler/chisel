# M64 dictionary descriptors and selection (design proposal)

Status: protocol design, **not** a deployed EVM interface or a change to published CM64 v3 wire bytes. The active native six-bit/two-escape prototype remains a read-only experiment.

## Principle

M64 compression must not assume JavaScript, JSON, HTML, Python, or any particular text format. A single six-bit encoder and decoder can operate with multiple independent, contract-backed dictionaries. A dictionary's metadata explains what it is intended to compress. A new ledger artifact references the chosen dictionary by its existing native carrier/address and version; it must **not** copy description, MIME strings, or metadata into every transaction.

A descriptor is guidance for finding candidates, not proof that a candidate yields the smallest payload. A format-agnostic fallback dictionary remains useful.

## Current implementation versus proposed fields

The existing JavaScript-side dictionary resolver in `m64.dictionary.js` uses `{kind, ref, version, language}`. This object is an application-facing description, not an ABI guarantee that these fields are already exposed by any deployed dictionary contract. The Polygon M64Dictionary contract must be inspected before assuming it has a descriptor getter.

Proposed dictionary metadata (immutable or versioned on publication):

| Field | Meaning |
| --- | --- |
| `mediaType` | Primary descriptive content type, e.g. `application/json`, `text/html`, `text/x-python`, `text/javascript`, or `application/octet-stream` |
| `description` | Human-readable purpose and scope: e.g. `JSON keys, punctuation, and recurring property-value patterns` |
| `dictionaryVersion` | Version of the fixed symbol assignments and secondary definitions |
| `codecVersion` | Identifies the native six-bit packing and escape/index rules accepted by the dictionary |
| `definitionDigest` | Hash of the exact ordered dictionary definitions, allowing independent integrity checks |
| `baseDictionary` (optional) | Reference to any explicitly supported parent/base dictionary |
| `tags` (optional) | Additional candidate-selection labels, e.g. `json`, `web`, `structured-data`; never required in the artifact payload |

A concrete contract may expose these through one `view` getter, or a compact set of getters. Returning a contract's `string` or `bytes` field provides its byte length via the EVM ABI. A second-level M64 definition stored as packed `bytes` still needs an exact count of valid **six-bit symbols**, unless a different unambiguous padding convention is specified.

### Hypothetical contract interface (not deployed)

```solidity
interface IM64DictionaryInfo {
    function mediaType() external view returns (string memory);
    function description() external view returns (string memory);
    function dictionaryVersion() external view returns (uint32);
    function codecVersion() external view returns (uint32);
    function definitionDigest() external view returns (bytes32);
}
```

This interface demonstrates the intended discovery fields, **not** a requirement to retrofit the existing M64Dictionary at `0x522afe4f086da1df80531dea1e8793b05cace9cf`. The actual ABI, contract costs, and any registry design must be reviewed before deployment.

## Selection algorithm

1. Obtain or infer a content-type *hint* from the source file, user input, or explicit selection. A hint may be absent or wrong.
2. Discover candidate dictionaries from a local registry/cache or an on-chain registry. Query their descriptors once and cache results. Avoid scanning every contract on every encoding request.
3. Filter out incompatible codec versions and broken/unavailable dictionaries. Prefer matching media types and user-requested profiles; include a generic fallback.
4. For each candidate, encode **the same original input bytes** under the same lossless policy and calculate its actual packed program length, including any in-stream escapes, symbol-count framing, dictionary reference/version, and protocol overhead. The canonicalization of JavaScript is an **optional preprocessing stage**, not something an arbitrary JSON/HTML/Python input must undergo.
5. Rank by the actual expected publication cost. Count calldata byte gas, ABI overhead, contract storage/logging and RPC/lookup cost as applicable. If a dictionary must be created or enlarged, report that separate one-time cost and the assumed reuse horizon.
6. Verify decode back to the exact original bytes before offering a publication transaction. Show the chosen descriptor, the candidate comparisons, and all cost diagnostics in the **workbench UI only**.
7. Store only native binary program bytes and the minimum necessary dictionary reference/version (and integrity information when required) on-chain. **Never publish JSON or descriptor strings as a silent envelope.**

## Stability and safety

- Dictionary ID assignments and secondary definitions must be immutable for a published version. Append-only changes require well-defined version semantics; an immutable digest is strongly preferred.
- The same dictionary reference and version must deterministically produce the same result during future reconstruction.
- Secondary M64 references need bounded, cycle-safe expansion and exact symbol counts. Descriptors themselves are not part of that expansion.
- The best dictionary for a file labelled `application/json` might still be a generic dictionary. Selection must depend on measured bytes, not metadata alone.
- Do not treat any current preview-size figures (including the Dark Star 414-byte experiment) as Polygon gas measurements.
- No wallet connection, deployment, contract write, or transaction is implied by this design document.

## Example user experience

If a user imports a JSON file, Chisel might find a contract described as `application/json: common keys and nested object syntax`, a generic text dictionary, and a specialized logging-events dictionary. It measures all candidates against the input and shows the smallest correct *total* binary record before allowing the user to choose or publish. The published record contains the chosen dictionary reference and encoded bytes, **not** a JSON wrapper or copied human description.
