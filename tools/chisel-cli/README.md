# Chisel 2.7.10: Bash-facing cleanup tools

This is a drop-in `tools/` patch for the current Chisel checkout. It makes the
browser driver callable from Bash without converting Chisel into a Node/npm
application.

It is intentionally local-authoring infrastructure. The static GitHub
Pages/IPFS build remains browser-only and is untouched.

## Files

```text
tools/chisel              Bash entry point
tools/chisel-cli.js       Local Node wrapper around the existing browser modules
tools/chisel-cli.test.js  CLI smoke test
```

Copy the three files into the `tools/` directory of
`chisel-v277-selftest-demo-mode` (or the actual 2.7.10 checkout), then make
the two executable files executable:

```bash
chmod +x tools/chisel tools/chisel-cli.js
export PATH="$PWD/tools:$PATH"
```

`chisel` defaults to the checkout containing `tools/chisel`. If the command
lives elsewhere, point it at the checkout explicitly:

```bash
CHISEL_ROOT=/path/to/chisel-v2.7.10 chisel check
chisel --root /path/to/chisel-v2.7.10 check
```

The `--root` form must appear before the subcommand.

## What 2.7.10 gains

```bash
chisel check
chisel about
chisel verify-driver

chisel un LKx 'DOWNTON ABBEY'
chisel uninspect LKx 'DOWNTON ABBEY'

chisel encode 'https://youtu.be/example'
chisel opreturn 'https://youtu.be/example'
chisel opreturn-hex 'https://youtu.be/example'
chisel opreturn-script 'https://youtu.be/example'

chisel hash hash160 616263
chisel tx decode @signed-tx.hex
```

`un` prints only the address, so it is usable in a normal shell expression:

```bash
caption=$(chisel un LKx 'DOWNTON ABBEY')
printf '%s\n' "$caption"
```

For the current encoder, that produces:

```text
LKxDoWNToNxABBEYzzzzzzzzzzzzXa6kiD
```

`uninspect` is the readable audit form: it reports the original phrase,
encoded body, padded 28-character stem, and final checksum-bearing address.

## WIF boundary

The only WIF command derives public account information. It refuses a WIF as a
positional argument, reads it from stdin, does not print its private-key hex,
and does not sign or broadcast.

```bash
read -rs WIF
printf '%s\n' "$WIF" | chisel account ltc --wif-stdin
unset WIF
```

This is local-only. It is not a reason to paste a WIF into the public portal.

## Existing RPC bridge

The old sourceable `tools/chisel-api.sh` remains the RPC tool. The new Bash
entry point gives it three direct pass-through commands:

```bash
export CHISEL_API_URL='http://127.0.0.1:8769'

chisel rpc-methods
chisel rpc getrawtransaction '["TXID",1]'
chisel rpc-call getrawtransaction TXID 1
```

These make no network call unless one of the `rpc*` commands is explicitly
run. They are not part of the static public build.

## Verification

Run this against the checkout after the files are copied:

```bash
bash -n tools/chisel
CHISEL_TEST_ROOT="$PWD" node tools/chisel-cli.test.js
tools/chisel check
tools/chisel verify-driver
```

`check` verifies that the six browser modules load in the same order as the
browser driver, checks the built-in RIPEMD-160 primitive, and creates an
`LKx...` address. `verify-driver` compares current source hashes and
`dist/chisel-driver.js` to the existing driver manifest; run it after a driver
rebuild, not while the manifest is intentionally stale.

## Release boundary

2.7.10 is the cleanup bridge:

- Browser source modules remain the source of truth.
- Bash gets a local way to inspect, encode, decode, and verify them.
- `tools/chisel-api.sh` stays the explicit RPC/proxy layer.
- No transaction is built, signed, broadcast, cached, or inserted into Portal
  by this patch.

That gives 2.7.11 a clean base for the Mogwai Litecoin draft/sign/send/watch
workflow instead of forcing it through the Portal first.
