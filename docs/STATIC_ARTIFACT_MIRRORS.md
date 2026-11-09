# Static artifact mirrors (first implementation, 2026-11-09)

## Runtime contract

Chisel must remain able to read previously reconstructed public artifacts when
FileProxy is stopped. FileProxy is an index builder/publisher, not the reader.
The public web server exposes ordinary GET URLs outside /fileproxy/. A second
independent static copy protects against the entire rigler.org host going away.

Publication sources remain Polygon 137, UTXO ledgers or other carriers. Static
mirrors contain cached bytes and discovery hints, **not proof of current chain
state**. A mirrored M64 artifact needs both its original encoded bytes and a
pinned, complete dictionary snapshot to remain independently reconstructable.

## Implemented

The dependency-free browser reader lives at
tools/m64Artifact/static-artifact-reader.js. It reads the versioned JSON
manifest, restricts object paths to canonical SHA-256-derived locations,
fetches the object from the *same manifest directory*, and re-hashes its bytes.
Callers can require an independently known SHA-256 (expectedSha256).

The Polygon SVG viewer offers two new explicit actions:

- Download the selected icon as a deterministic, standalone SVG.
- Check a static manifest for that selected icon by ID and verify its returned
  bytes against the locally bundled SVG fixture's SHA-256.

The viewer defaults to a **bundled static test mirror** at
../../chisel-artifacts/manifest.json, relative to the current Chisel app. The
sample manifest includes only the home icon, is marked unverified, and works on
static hosting/IPFS without FileProxy. The proposed production address
https://rigler.org/chisel-artifacts/manifest.json remains **not deployed**. Static mirror failure leaves
the local preview and existing direct Polygon RPC viewer operational. Nothing
starts a transaction, writes to FileProxy or treats mirrored bytes as a live
Polygon read.

When reading via a mirror, the viewer reports a verified *static copy*, not a
verified on-chain entry. Its green 'on-chain' styling still requires the
existing Polygon chain-137 inspection and byte-for-byte dictionary check.

## Creating a test copy

From the Chisel SVG viewer, select an icon (e.g. home) and click Download
selected standalone SVG. On the server, use the Mogwai FileProxy CLI:

    cd ~/mogwai/fileProxy
    python3 -m fileproxy.static_publish \
      --root /srv/www/chisel-artifacts \
      publish --id polygon/137/icon/home \
      --file /path/to/chisel-icon-home.svg --media-type image/svg+xml
    python3 -m fileproxy.static_publish \
      --root /srv/www/chisel-artifacts verify

Configure Apache to serve that directory directly at /chisel-artifacts/.
CORS is needed for the hosted Chisel page to fetch the static manifest and
SVG across origins. The resulting files can be copied to another static host
without FileProxy running. If the static asset's bytes differ from the exact
local Chisel icon fixture, the viewer rejects it.

## Future iterations

1. Export *verified Polygon* packed secondary entries, definition digest,
   chain ID, contract, entry IDs, block and full dictionary snapshot.
2. Publish both compressed source and reconstructed SVG, with exact digests.
3. Allow configured mirrors (including IPFS) instead of one editable URL.
4. Add portable static index and snapshot sync to a separate host.
5. Integrate general artifacts, not only the icon fixture, into Portal record
   hydration. Optional FileProxy/Etherscan backend should not be a dependency.

Security: do not expose API keys, private identity state or server-local paths
in a public manifest. A manifest hash by itself is not proof of provenance.
For arbitrary unknown SVG, treat it as untrusted active content. The current
viewer renders only exact bytes matching a known icon fixture, inside an image
element.
