# Polygon M64 SVG icons

## Deployment and state

- Chain: Polygon PoS (137)
- Contract: [0xd78e182813cd4e964aa382d6a81f9efbb10648bd](https://polygonscan.com/address/0xd78e182813cd4e964aa382d6a81f9efbb10648bd)
- Source: [M64SymbolDictionary.sol](../../contracts/M64SymbolDictionary.sol)
- UI: [Read, render and append SVG icons](svg-icons-polygon.html)
- Known primary digest: 0x426a13288d28851f6cb25d02d7af346cb656a97c387f03804bad54599af1b1cd

The constructor was deployed with 62 immutable *compression fragments*, not 62 finished icons. At the initial read-only state check, secondaryCount() was 0. The 64 SVG icon definitions remain to be appended. The contract need not be redeployed.

## Request one icon

The browser resolves a name (home, wallet), ordinal (0–63), or M64 alphabet character (A–Z, a–z, 0–9, - and _) to an icon from the static manifest. A plain decimal number is an ordinal; to select a digit *as an M64 character*, prefix it with @, e.g. @0. Prefix a literal on-chain secondary entry ID with #.

The browser maps the icon to the actual secondary entry ID by comparing the decoded on-chain bytes with the local SVG fixture. The contract has no name getter and there is no guarantee an icon's ordinal equals its secondary entry ID. It may contain unrelated or duplicate entries.

The contract exposes a read-only getter:

    entry(uint256 id) returns (uint8 kind, bytes data, uint32 symbolCount)

Kind 0 is packed M64 v2, kind 1 is raw bytes. For packed entries the page reconstructs the SVG fragment using the verified immutable primary dictionary. Only byte-for-byte fixture matches are rendered. The browser wraps the returned SVG symbol fragment in a standalone SVG document for image display.

No IPFS, NFT service, deployed renderer, or wallet signature is needed to read the icon. A Polygon RPC endpoint remains necessary. The viewer defaults to a current public Polygon Bor endpoint or an injected wallet provider.

## Publish the missing 64 icons

The source fixture is [svg-icons-v1.js](seeds/svg-icons-v1.js). It is local data, not proof the icons have been registered.

The viewer encodes each icon independently with the native-six-bit M64 v2 JavaScript codec and verifies a byte-for-byte local round trip. It then offers *review* and separately *wallet-approved submission* of up to eight missing entries at once, using:

    addSecondaryBatch(bytes[] packed, uint32[] counts)

Each compressed icon refers only to the immutable 62 primary definitions, so its representation does not depend on existing secondary indexes. The caller checks the current secondary count and definition digest immediately before submitting. After a successful receipt, the page rescans contract state and checks reconstructed bytes. Repeat to finish all 64 icons.

The historical [raw batch plan](seeds/svg-icons-v1.deployment-plan.json) uses addRawBatch(bytes[]) instead. The compressed approach is preferred for this deployment. The fixture tested at 15,384 raw bytes and 5,214 packed bytes (66.1% reduction), before ABI/storage overhead and gas costs. Review actual gas estimates before signing.

The interface can read without connecting a wallet. There is **no automatic transaction** on page load or when reviewing an icon. Anyone may append because the contract is permissionless and append-only; an appended entry is not automatically trusted or endorsed.

## Trust limits

The viewer compares all 62 primary bytes with the seed, validates contract metadata and snapshot digests, and compares recognized entries to exact SVG fixture bytes. This is an operational state audit, not verified Solidity source or proof of authorship. Pin the chain ID, contract, snapshot count, and digest when publishing dependent records. Independently verify source/runtime provenance and use another Polygon RPC for stronger trust.
