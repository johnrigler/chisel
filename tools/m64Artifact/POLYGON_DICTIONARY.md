# M64 Polygon Dictionary

Status: implementation staged for first deployment; do not deploy until the branch CI compiles and passes.

This is the first durable ledger provider for the transport-neutral resolver in `m64.dictionary.js`.

## Contract behavior

`contracts/M64Dictionary.sol` is intentionally permissionless and append-only.

There is no owner or administrator. There are no edit, delete, renumber, or moderation methods.

Anyone willing to pay Polygon gas may add a non-empty term. Existing terms keep their IDs forever. Adding a duplicate term simply reuses the existing ID, so another publisher cannot change what an old artifact means.

The contract exposes:

```text
language() -> "javascript"
dictionaryVersion() -> 1
termCount()
lookupTerm(id)
lookupId(term)
addTerm(term)
addTerms(terms[])
```

The missing-term sentinel for `lookupId` is `uint256.max`. Empty strings are not valid terms. `lookupTerm` returns an empty string for an out-of-range ID, which is unambiguous because empty terms cannot be inserted.

## Resolver identity

A deployed Polygon dictionary is represented in M64 v3 as:

```text
eip155:137:0x<contract-address>
```

Example descriptor:

```json
{
  "kind": "ledger-dictionary",
  "ref": "eip155:137:0x0000000000000000000000000000000000000001",
  "version": 1,
  "language": "javascript"
}
```

The descriptor is stored in the artifact. The contract address is therefore part of the meaning of the artifact; Chisel does not silently substitute another dictionary.

## Browser provider

`m64.dictionary.evm.js` adapts an EVM contract to the normal Chisel resolver interface:

```text
describe()
idForTerm(term)
termForId(id)
ensureTerm(term)
ensureTerms(terms[])
```

It also exposes:

```text
termCount()
inspectContract()
createEip1193Dictionary(...)
```

The browser adapter uses the vendored ethers v6 build only for ABI/RPC/signing mechanics. M64 v3 itself remains independent of ethers and Polygon.

`dictionary-polygon.html` is the operator console for a deployed dictionary. It can connect an injected wallet, switch to Polygon, validate the contract metadata, look up terms/IDs, and append batches of missing terms.

## Deployment gate

The Solidity source is compiled in GitHub Actions with pinned `solc@0.8.30`. CI uploads the compiled ABI/bytecode as the `m64-dictionary-solc` workflow artifact.

The source should not be deployed until:

1. JavaScript/EVM resolver regressions pass;
2. the Solidity compilation step passes;
3. the exact compiled bytecode is captured into a Chisel deployment artifact;
4. a Chisel deployment page can show the bytecode/source identity before requesting a wallet signature.

The user should not need Remix for the normal path. Remix remains only an independent inspection/debugging option.

## After first deployment

Once a real Polygon address exists:

1. record the `eip155:137:<address>` descriptor in Chisel;
2. inspect `language`, version, and starting term count through the browser provider;
3. publish a small seed vocabulary;
4. build a v3 artifact against the live resolver;
5. hydrate the artifact from the contract and verify `canonicalBytes` and SHA-256;
6. repeat with Dark Star;
7. measure new terms, reused terms, M64 bytes, contract gas, and artifact calldata cost.

The important experiment is marginal cost after vocabulary already exists. The dictionary is shared public infrastructure, not a private Chisel database.
