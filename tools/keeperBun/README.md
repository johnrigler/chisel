# Chisel Keeper Bun

This is a small Bun-based hot keeper for Chisel API keys.

It is intended to keep Blockchair and Etherscan keys out of browser-side Chisel while still letting Chisel read Dogecoin, Litecoin, BSV, and EVM history through a local or Rigler-hosted broker.

The rule is simple:

```text
secrets go through stdin / SSH
secrets live only in process memory
SQLite stores cache only
browser Chisel never receives API keys
```

## Files

```text
keeperd.js              long-running Bun daemon; starts locked
keeper-init.js          SSH forced-command relay; HELO / CHALLENGE / INIT
login-litecoin.js       local client; signs INIT with Litecoin WIF
keeper-common.js        protocol, hashing, base58, cache helpers
keeper-crypto.js        secp256k1 signing / verification via bundled elliptic
sample-init-payload.json
chisel-ssh-entry.example
start-keeperd.example.sh
```

## Install Bun on rigler.org

Use your existing Bun install. The scripts assume:

```text
/usr/local/bin/bun
```

Adjust the example wrappers if Bun is elsewhere.

## Start the locked keeper daemon

Prototype form:

```bash
cd /path/to/chisel/tools/keeperBun
bun keeperd.js \
    --owner LcudkPQzLuuqsnzHSmJ7iLREaHStvPKRVb \
    --host 127.0.0.1 \
    --port 8787 \
    --db :memory:
```

This starts locked. It has no secrets until initialized.

Use persistent SQLite only for cache, never secrets:

```bash
bun keeperd.js \
    --owner LcudkPQzLuuqsnzHSmJ7iLREaHStvPKRVb \
    --host 127.0.0.1 \
    --port 8787 \
    --db /var/cache/chisel-keeper/Lcudk.sqlite
```

## SSH forced command

The intended SSH-side command is `keeper-init.js`. It does not store secrets. It relays HELO / CHALLENGE / INIT between the remote client and `keeperd`.

Example wrapper:

```bash
exec /usr/local/bin/bun \
    /opt/chisel/tools/keeperBun/keeper-init.js \
    --keeper http://127.0.0.1:8787 \
    --user "$USER"
```

Use that as a ForceCommand or restricted shell.

## Local login from Chromebook / client

Create a payload file locally:

```json
{
    "ttlSeconds": 3600,
    "secrets": {
        "blockchair": "BLOCKCHAIR_API_KEY_HERE",
        "etherscan": "ETHERSCAN_API_KEY_HERE"
    }
}
```

Then run:

```bash
bun login-litecoin.js \
    --host rigler.org \
    --user LcudkPQzLuuqsnzHSmJ7iLREaHStvPKRVb \
    --wif YOUR_LITECOIN_WIF \
    --payload init-payload.json \
    1>>out.txt \
    2>>error.txt
```

The client opens `ssh -T user@host`, sends HELO, receives a challenge, signs the challenge and payload hash, sends INIT, and receives READY.

The returned READY contains a bearer token. That token is the temporary API key for this hot keeper session. It expires with the daemon TTL.

## API calls

All `/api/*` calls require:

```text
Authorization: Bearer <READY api.token>
```

Dogecoin address history:

```bash
curl -H "Authorization: Bearer TOKEN" \
    http://127.0.0.1:8787/api/dogecoin/address/DADDRESS
```

Dogecoin transaction:

```bash
curl -H "Authorization: Bearer TOKEN" \
    http://127.0.0.1:8787/api/dogecoin/tx/TXID
```

Litecoin address history:

```bash
curl -H "Authorization: Bearer TOKEN" \
    http://127.0.0.1:8787/api/litecoin/address/LADDRESS
```

BSV address history through Blockchair:

```bash
curl -H "Authorization: Bearer TOKEN" \
    http://127.0.0.1:8787/api/bitcoin-sv/address/BSV_ADDRESS
```

Polygon/EVM tx list through Etherscan v2:

```bash
curl -H "Authorization: Bearer TOKEN" \
    'http://127.0.0.1:8787/api/evm/txlist/137/0x0076416C84c7151CaEfA74C3e09d6eBF2f296BA0?offset=25'
```

Cache status:

```bash
curl -H "Authorization: Bearer TOKEN" \
    http://127.0.0.1:8787/api/cache/status
```

Lock / clear secrets:

```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
    http://127.0.0.1:8787/api/lock
```

Admin lock from localhost:

```bash
curl -X POST http://127.0.0.1:8787/admin/lock
```

## Verification model

The daemon verifies:

```text
SSH/login user equals Litecoin address
public key derives that same Litecoin address
payload hash matches the submitted payload
signature verifies over the challenge + payload hash
challenge is fresh and one-use
```

This v1 signs a Chisel-specific SHA-256 challenge with secp256k1. It is not using Litecoin Core's message-signing envelope. That is deliberate for this prototype: it is a Chisel/Bun driver contract.

## What SQLite may store

Allowed:

```text
raw API responses
normalized transaction history
address history
cache timestamps
local non-secret notes later
```

Forbidden:

```text
Blockchair API key
Etherscan API key
Litecoin WIF
private keys
payload JSON with secrets
```

## Current limits

This is a v1. It does not yet start a per-user daemon automatically. Start `keeperd.js` first, then use SSH/login to initialize it. That makes the later Docker version cleaner because the long-running process and the SSH initializer are already separated.
