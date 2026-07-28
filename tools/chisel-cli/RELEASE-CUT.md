# 2.7.10 cut: exact scope and cleanup

This release should be the small seam between the browser library and local
authoring tools. It should not try to ship the Mogwai Litecoin personal-stream
workflow yet.

## Add

- `tools/chisel`
- `tools/chisel-cli.js`
- `tools/chisel-cli.test.js`

The patch uses the existing browser module order:

1. `chisel.js`
2. `chisel.unspendable.js`
3. `chisel.sign.js`
4. `chisel.ravencoin.js`
5. `chisel.digibyte.js`
6. `chisel.litecoin.js`

It has no dependency on `index.html`, `app.js`, Portal, fileProxy, Bun, Deno,
or a package manager.

## Do not broaden 2.7.10

- Do not add a WIF field to the public Portal.
- Do not make fileProxy a public-runtime requirement.
- Do not add draft records, a watcher, or SQLite lifecycle state here.
- Do not put raw signed transaction hex in a public dataset.
- Do not change `dist/chisel-driver.js` solely because this CLI exists; the CLI
  loads the existing source files directly.

## Cleanup before commit

Keep local runtime data outside the public repository. In particular, do not
commit a `data -> ../chisel-data` symlink or sandbox-mangled symlink target.
Keep small, deliberate public snapshots in `data-bundled/` instead.

Also remove from the release branch only after confirming they are not needed
by a current workflow:

- generated tarballs and release copies
- cache/bytecode files such as `__pycache__/` and `*.pyc`
- accidental editor swap files
- zero-byte generated media placeholders
- hidden/old workflow backups
- obsolete `data.old/` copies

This patch does not delete any of those files because it was built from an
archive rather than the active checkout.

## Cut checklist

```bash
git switch -c release/v2.7.10
cp /path/to/chisel-v2.7.10-tools/tools/chisel tools/
cp /path/to/chisel-v2.7.10-tools/tools/chisel-cli.js tools/
cp /path/to/chisel-v2.7.10-tools/tools/chisel-cli.test.js tools/
chmod +x tools/chisel tools/chisel-cli.js

bash -n tools/chisel
CHISEL_TEST_ROOT="$PWD" node tools/chisel-cli.test.js
tools/chisel check
tools/chisel verify-driver
git status --short
```

Then bump the visible release label to `2.7.10` in the current app/version
surface, commit only intentional source changes, and release. The static
browser app should still load with no Node, proxy, or local data requirement.

## 2.7.11 follows

The next release can use this command as the executor for:

```text
Mogwai phrase + YouTube URL
  -> fixed LKx readable address
  -> local draft record
  -> build/sign/send commands
  -> one watcher writes cached transaction JSON and SQLite status
  -> Portal displays that personal Litecoin feed
```

The runtime boundary remains: Chisel core signs locally; the public portal is
an inspectable static reader; fileProxy/indexing is authoring infrastructure.
