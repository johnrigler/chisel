# M64 Polygon Dictionary

Status: contract, resolver, CI compile, captured deployment bytecode, and browser deployment page implemented; first real Polygon deployment still pending.

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

## Verified deployment artifact

The Solidity source is compiled in GitHub Actions with pinned `solc@0.8.30`. The successful CI run uploaded `m64-dictionary-solc`, and that exact output was captured as:

```text
contracts/M64Dictionary.compiled.json
```

The captured artifact records:

```text
source blob SHA: ea45c92a5ecc03328cdb22a13beba8bfcf9327fa
compiled-from commit: 27b89c2a66643dc360085b793ee1afefe81b37a1
CI artifact id: 10042240484
CI artifact digest: sha256:6bdbce2af0c2b2bf4ad1d175df8b3498e0abb4d5fa60f393c3789b58b2b0c45d
creation bytecode SHA-256 (decoded bytes): a5c12de54f73cf070319f2d5cf47838c16a8c66a1251cbc43ccfb5a5a9a1b817
```

The hash above is over the decoded creation bytecode bytes, not the ASCII hexadecimal text in the compiler `.bin` file. `tests/m64.evm.test.mjs` recomputes the decoded-byte SHA-256 and checks the expected ABI surface, while CI also recompiles Solidity and requires the fresh `.bin` to match the captured bytecode exactly. This prevents a hand-edited deployment payload from quietly replacing the CI output.

## Browser deployment

`deploy-dictionary-polygon.html` is the normal deployment path.

Before enabling its deployment button it:

1. loads `M64Dictionary.compiled.json`;
2. recomputes the creation-bytecode SHA-256 in the browser;
3. compares it to the captured CI hash;
4. shows compiler/source/commit/bytecode identity;
5. connects an injected wallet and switches to Polygon.

Deployment then uses the vendored ethers v6 `ContractFactory`. After mining, the page verifies:

```text
language() == "javascript"
dictionaryVersion() == 1
termCount() == 0
```

and returns the durable descriptor:

```text
eip155:137:0x<new-contract-address>
```

The user should not need Remix for the normal path. Remix remains only an independent inspection/debugging option.

## First live experiment

Once a real Polygon address exists:

1. record the `eip155:137:<address>` descriptor in Chisel;
2. inspect `language`, version, and starting term count through the browser provider;
3. publish a small seed vocabulary;
4. build a v3 artifact against the live resolver;
5. hydrate the artifact from the contract and verify `canonicalBytes` and SHA-256;
6. repeat with Dark Star;
7. measure new terms, reused terms, M64 bytes, contract gas, and artifact calldata cost.

The important experiment is marginal cost after vocabulary already exists. The dictionary is shared public infrastructure, not a private Chisel database.
