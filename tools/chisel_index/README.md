# Chisel unified index and rabbit-trail tool

This directory is intentionally reusable by Chisel, Mogwai, certLedger, and
other projects. It has no web framework and no required third-party Python
packages.

The filesystem is canonical:

```text
data/
  transactions/<coin>/*.json
  links/<coin>/*-links.json
  rabbit-trails/*.json
  imports/rabbit-trails/*
```

SQLite is a derived, disposable search layer at
`data/index/chisel.sqlite3`. It combines every chain's canonical JSON and
indexes transaction IDs, exact/partial
addresses, inputs, outputs, OP_RETURN text, URLs, amount-level satoshi codes,
and rabbit-trail evidence.

Older Jist databases are **quarantined by default** because their chain label
cannot be trusted without separately fingerprinting the RPC source. They are
never modified. Import them only after verification:

```bash
python3 tools/chisel_index/indexer.py --data-root data rebuild
python3 tools/chisel_index/indexer.py --data-root data search DHooQkHN
python3 tools/chisel_index/indexer.py --data-root data search 3969
python3 tools/chisel_index/indexer.py --data-root data trails
python3 tools/chisel_index/indexer.py --data-root data import my-trail.yaml
python3 tools/chisel_index/indexer.py --data-root data --include-legacy-jist rebuild
```

`data` may be a relative symlink to a long-lived sibling datastore. A broken
symlink is reported explicitly. `ensure` compares source file metadata and
rebuilds only when canonical JSON or rabbit trails changed. With
`--include-legacy-jist`, verified Jist databases also participate in the
fingerprint.

## Root versus trail

A root transaction touches a Thunderword or “third rail.” A rabbit trail is
the activity found by following evidence-bearing sender/change/persistent
addresses away from that root. A readable address embedded in an output is
content and is not automatically treated as a trail address.

Rabbit trails record evidence and confidence separately. Reuse of a signing
address is evidence of key/control continuity; it is not, by itself, proof of
a person's real-world identity.

## Imports

The importer accepts canonical or loose JSON, JSONL, safe YAML, and line-based
Daisy/plain text. PyYAML is optional. Without it, the built-in safe YAML
subset handles ordinary mappings/lists; more exotic YAML falls back to txid
and address extraction instead of constructing Python objects.

Every import preserves the original under `data/imports/rabbit-trails/` and
writes normalized JSON under `data/rabbit-trails/`. The JSON schema is
`rabbit-trail.schema.json`.
