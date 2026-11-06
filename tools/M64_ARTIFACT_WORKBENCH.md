# M64 Artifact Workbench

The current user interface is **M64 v3 only**, with an external dictionary and local browser execution. The workbench URL remains:

- `tools/m64Artifact/index.html` - v3 host, embedding the first program.
- `tools/m64Artifact/dark-star-z.html` - standalone Dark Star Z viewer, suitable for linking or embedding from Chisel.

The standalone viewer renders directly from the checked-in Dark Star source when no CID is supplied, with interactive controls for line geometry and color. A CID can identify a v3 artifact JSON on IPFS. The client reads its declared dictionary through an EVM JSON-RPC endpoint, hydrates and validates the canonical source, then waits for an explicit Render action. The browser executes the recovered program in a restricted iframe, not inside the EVM.

For a new v3 artifact, enter a real `M64Dictionary` contract address and correct chain/RPC. Term lookups are read-only, while appending new terms requires an explicit wallet-approved transaction. The current deployed Chisel contract is not implicitly an M64 dictionary.

The reader can save a PNG, save input parameters, download a v3 artifact JSON, or explicitly publish PNG/artifact JSON to **public IPFS** through Pinata v3. Upload requires a user-supplied JWT in a session-only field. The **Save standalone HTML** and **Interactive HTML page** upload options bundle the page's same-origin JavaScript dependencies and the Dark Star source into a single HTML file. The Pinata credential is cleared before export. A reproducible deterministic directory/CAR packaging path remains useful as a separate future improvement.

The interface can also draft positive and negative 72-byte cross-chain thunder attestations using `CT1|+|H|<sha256>` or `CT1|-|H|<sha256>`. It does not yet sign or broadcast those attestations. See [Cross-chain Thunder Attestations](../docs/CROSS_CHAIN_THUNDER_ATTESTATIONS.md).

No new M64 v2 artifacts are intended or supported by the active UI. Older codec, v2 validator, and historical hydrator code still remain under `tools/m64Artifact/` until targeted cleanup.

The toolchain remains vanilla JavaScript and direct Solidity/solc compilation. Neither a Node runtime nor Hardhat is required to use the browser reader or write an M64 artifact.
