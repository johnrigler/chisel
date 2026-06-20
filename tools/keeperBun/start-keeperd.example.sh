#!/usr/bin/env bash
set -euo pipefail

# Start one locked keeper daemon. For the first prototype this can be run manually.
# For multi-user, run one instance per Litecoin-address Unix user with a distinct port.

OWNER="${1:?usage: start-keeperd.example.sh <litecoin-address-user> [port]}"
PORT="${2:-8787}"

exec /usr/local/bin/bun \
    /opt/chisel/tools/keeperBun/keeperd.js \
    --owner "$OWNER" \
    --host 127.0.0.1 \
    --port "$PORT" \
    --db :memory: \
    --ttl-default 3600
