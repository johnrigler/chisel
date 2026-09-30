#!/usr/bin/env python3
"""Build Chisel's local, rebuildable SQLite witness.

The canonical local evidence remains JSON under transactions/ and selected
main-thunderword manifests under streams/. This module derives
index/chisel.sqlite3 from those files, so deleting or rebuilding the database
never loses the user-selected roots or fetched transaction JSON.

No private material belongs in this index. In particular, a WIF is converted to
a public address in the browser before Portal asks fileProxy to save a main
thunderword.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Set, Tuple


TXID_RE = re.compile(r"^[0-9a-fA-F]{64}$")
TXID_IN_TEXT_RE = re.compile(r"(?<![0-9a-fA-F])([0-9a-fA-F]{64})(?![0-9a-fA-F])")

COIN_ALIASES = {
    "dgb": "digibyte",
    "digibyte": "digibyte",
    "rvn": "ravencoin",
    "raven": "ravencoin",
    "ravencoin": "ravencoin",
    "ltc": "litecoin",
    "litecoin": "litecoin",
    "litecointestnet": "litecointestnet",
    "btc": "bitcoin",
    "bitcoin": "bitcoin",
    "bitcointestnet3": "bitcointestnet3",
    "bitcointestnet4": "bitcointestnet4",
    "doge": "dogecoin",
    "dogecoin": "dogecoin",
    "eth": "evm",
    "ethereum": "evm",
    "evm": "evm",
    "polygon": "evm",
    "matic": "evm",
}


def normalize_coin(value: Any) -> str:
    clean = str(value or "").strip().lower()
    if not clean:
        return "unknown"
    compact = re.sub(r"[^a-z0-9]+", "", clean)
    return COIN_ALIASES.get(compact, compact or "unknown")


def canonical_address(value: Any) -> str:
    address = str(value or "").strip()
    return address.lower() if address.lower().startswith("0x") else address


def stream_key(coin: Any, address: Any) -> str:
    return normalize_coin(coin) + ":" + canonical_address(address)


def is_txid(value: Any) -> bool:
    return bool(TXID_RE.fullmatch(str(value or "").strip()))


def int_or_none(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    # Browser and JavaScript APIs often send milliseconds.
    if number > 1_000_000_000_000:
        number //= 1000
    return number


def text_or_empty(value: Any, limit: int = 4000) -> str:
    return str(value or "").strip()[:limit]


def json_object(path: Path) -> Optional[Dict[str, Any]]:
    try:
        value = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, ValueError, TypeError):
        return None
    return value if isinstance(value, dict) else None


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(131072), b""):
            digest.update(chunk)
    return digest.hexdigest()


def first_value(*values: Any) -> Any:
    for value in values:
        if value is not None and value != "":
            return value
    return None


def extract_txid(value: Dict[str, Any], path: Path) -> str:
    for key in ("txid", "hash", "tx_hash", "transaction_hash"):
        candidate = value.get(key)
        if is_txid(candidate):
            return str(candidate).lower()

    summary = value.get("summary")
    if isinstance(summary, dict):
        for key in ("txid", "hash", "tx_hash"):
            candidate = summary.get(key)
            if is_txid(candidate):
                return str(candidate).lower()

    match = TXID_IN_TEXT_RE.search(path.name)
    return match.group(1).lower() if match else ""


def extract_block_time(value: Dict[str, Any]) -> Optional[int]:
    summary = value.get("summary") if isinstance(value.get("summary"), dict) else {}
    return int_or_none(first_value(
        value.get("block_time"),
        value.get("blockTime"),
        value.get("blocktime"),
        value.get("confirmed_at"),
        value.get("confirmedAt"),
        value.get("timestamp"),
        value.get("time"),
        summary.get("blockTime"),
        summary.get("block_time"),
        summary.get("timestamp"),
    ))


def extract_block_height(value: Dict[str, Any]) -> Optional[int]:
    summary = value.get("summary") if isinstance(value.get("summary"), dict) else {}
    return int_or_none(first_value(
        value.get("block_height"),
        value.get("blockHeight"),
        value.get("blockheight"),
        value.get("height"),
        summary.get("blockHeight"),
        summary.get("block_height"),
        summary.get("blockheight"),
        summary.get("height"),
    ))


def decode_op_return_part(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if re.fullmatch(r"[0-9a-fA-F]+", text) and len(text) % 2 == 0:
        try:
            decoded = bytes.fromhex(text).decode("utf-8", errors="replace").strip()
            if decoded:
                return decoded
        except ValueError:
            pass
    return text


def extract_op_return(value: Dict[str, Any]) -> str:
    outputs = value.get("vout")
    if not isinstance(outputs, list):
        outputs = value.get("outputs")
    if not isinstance(outputs, list):
        return ""

    pieces: List[str] = []
    for output in outputs:
        if not isinstance(output, dict):
            continue
        script = output.get("scriptPubKey")
        if not isinstance(script, dict):
            script = output.get("script_pub_key")
        if not isinstance(script, dict):
            continue
        asm = text_or_empty(script.get("asm"), 10000)
        output_type = text_or_empty(first_value(script.get("type"), output.get("type"))).lower()
        if not asm.upper().startswith("OP_RETURN") and output_type not in ("nulldata", "op_return"):
            continue
        payload = asm.split(None, 1)[1] if " " in asm else ""
        if not payload:
            payload = first_value(script.get("hex"), output.get("data"), "")
        decoded = decode_op_return_part(payload)
        if decoded:
            pieces.append(decoded)
    return "\n".join(pieces)[:10000]


def extract_title(value: Dict[str, Any]) -> str:
    summary = value.get("summary") if isinstance(value.get("summary"), dict) else {}
    return text_or_empty(first_value(
        summary.get("title"),
        value.get("title"),
        value.get("label"),
        value.get("subject"),
        value.get("name"),
    ), 1000)


def infer_coin_from_path(data_root: Path, path: Path, value: Dict[str, Any]) -> str:
    declared = first_value(value.get("coin"), value.get("ticker"), value.get("chain"))
    if declared:
        return normalize_coin(declared)
    summary = value.get("summary")
    if isinstance(summary, dict):
        declared = first_value(summary.get("coin"), summary.get("ticker"), summary.get("chain"))
        if declared:
            return normalize_coin(declared)

    try:
        parts = path.relative_to(data_root).parts
    except ValueError:
        parts = path.parts
    lowered = [part.lower() for part in parts]
    if "transactions" in lowered:
        pos = lowered.index("transactions")
        if len(lowered) > pos + 1:
            return normalize_coin(lowered[pos + 1])
    return "unknown"


def transaction_files(data_root: Path) -> Iterator[Path]:
    roots = [data_root / "transactions", data_root / "data" / "transactions"]
    seen: Set[Path] = set()
    for root in roots:
        if not root.is_dir():
            continue
        for path in root.rglob("*.json"):
            if not path.is_file() or path.name.startswith("."):
                continue
            resolved = path.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            yield resolved


def stream_files(data_root: Path) -> Iterator[Path]:
    root = data_root / "streams"
    if not root.is_dir():
        return
    for path in root.rglob("*.json"):
        if path.is_file() and not path.name.startswith("."):
            yield path.resolve()


def database_schema_compatible(conn: sqlite3.Connection) -> bool:
    """Return True when an existing database matches the unified-index schema.

    Older experimental Chisel SQLite files used different transaction columns.
    CREATE TABLE IF NOT EXISTS cannot migrate those tables, so detect them before
    creating indexes that assume the current schema.
    """
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'"
    ).fetchone()
    if row is None:
        return True
    columns = {r[1] for r in conn.execute("PRAGMA table_info(transactions)")}
    required = {
        "coin", "txid", "json_path", "json_sha256", "byte_size",
        "modified_at", "block_time", "block_height", "title",
        "op_return_text", "indexed_at",
    }
    return required.issubset(columns)


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS catalog_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transactions (
          coin TEXT NOT NULL,
          txid TEXT NOT NULL,
          json_path TEXT NOT NULL,
          json_sha256 TEXT NOT NULL,
          byte_size INTEGER NOT NULL,
          modified_at INTEGER NOT NULL,
          block_time INTEGER,
          block_height INTEGER,
          title TEXT NOT NULL DEFAULT '',
          op_return_text TEXT NOT NULL DEFAULT '',
          indexed_at INTEGER NOT NULL,
          PRIMARY KEY (coin, txid)
        );

        CREATE INDEX IF NOT EXISTS transactions_by_txid
          ON transactions (txid);
        CREATE INDEX IF NOT EXISTS transactions_by_time
          ON transactions (coin, block_time DESC);

        CREATE TABLE IF NOT EXISTS main_thunderwords (
          stream_key TEXT PRIMARY KEY,
          coin TEXT NOT NULL,
          address TEXT NOT NULL,
          label TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT '',
          source_txid TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_fetched_at INTEGER,
          manifest_path TEXT NOT NULL,
          UNIQUE (coin, address)
        );

        CREATE INDEX IF NOT EXISTS main_thunderwords_by_updated
          ON main_thunderwords (updated_at DESC);

        CREATE TABLE IF NOT EXISTS main_thunderword_transactions (
          stream_key TEXT NOT NULL,
          coin TEXT NOT NULL,
          txid TEXT NOT NULL,
          discovered_at INTEGER,
          source TEXT NOT NULL DEFAULT '',
          transaction_present INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (stream_key, coin, txid),
          FOREIGN KEY (stream_key) REFERENCES main_thunderwords(stream_key)
            ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS main_thunderword_transactions_by_txid
          ON main_thunderword_transactions (coin, txid);
        """
    )


def transaction_record(data_root: Path, path: Path, now: int) -> Optional[Tuple[Any, ...]]:
    value = json_object(path)
    if value is None:
        return None
    txid = extract_txid(value, path)
    if not txid:
        return None
    coin = infer_coin_from_path(data_root, path, value)
    try:
        relative_path = str(path.relative_to(data_root))
        stat = path.stat()
        digest = sha256_file(path)
    except OSError:
        return None
    return (
        coin,
        txid,
        relative_path,
        digest,
        stat.st_size,
        int(stat.st_mtime),
        extract_block_time(value),
        extract_block_height(value),
        extract_title(value),
        extract_op_return(value),
        now,
    )


def stream_transactions(value: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    seen: Set[str] = set()
    rows = value.get("transactions")
    if not isinstance(rows, list):
        rows = []
    for row in rows:
        if isinstance(row, str):
            row = {"txid": row}
        if not isinstance(row, dict):
            continue
        txid = str(row.get("txid") or row.get("hash") or "").strip().lower()
        if not is_txid(txid) or txid in seen:
            continue
        seen.add(txid)
        yield {
            "txid": txid,
            "source": text_or_empty(row.get("source"), 120),
            "discovered_at": int_or_none(first_value(row.get("discoveredAt"), row.get("discovered_at"), row.get("time"))),
        }

    txids = value.get("txids")
    if isinstance(txids, list):
        for txid in txids:
            txid = str(txid or "").strip().lower()
            if not is_txid(txid) or txid in seen:
                continue
            seen.add(txid)
            yield {"txid": txid, "source": "", "discovered_at": None}


def stream_record(data_root: Path, path: Path, value: Dict[str, Any], now: int) -> Optional[Dict[str, Any]]:
    coin = normalize_coin(first_value(value.get("coin"), path.parent.name))
    address = canonical_address(value.get("address"))
    if not address:
        return None
    try:
        manifest_path = str(path.relative_to(data_root))
    except ValueError:
        manifest_path = str(path)
    created_at = int_or_none(value.get("createdAt")) or int_or_none(value.get("created_at")) or now
    updated_at = int_or_none(value.get("updatedAt")) or int_or_none(value.get("updated_at")) or created_at
    return {
        "stream_key": stream_key(coin, address),
        "coin": coin,
        "address": address,
        "label": text_or_empty(value.get("label"), 1000),
        "source": text_or_empty(value.get("source"), 120),
        "source_txid": text_or_empty(first_value(value.get("sourceTxid"), value.get("source_txid")), 64).lower(),
        "created_at": created_at,
        "updated_at": updated_at,
        "last_fetched_at": int_or_none(first_value(value.get("lastFetchedAt"), value.get("last_fetched_at"))),
        "manifest_path": manifest_path,
        "transactions": list(stream_transactions(value)),
    }


def rebuild_index(data_root: Any, include_legacy_jist: bool = False) -> Dict[str, Any]:
    """Rebuild index/chisel.sqlite3 from canonical Chisel datastore files."""

    root = Path(data_root).expanduser().resolve()
    database = root / "index" / "chisel.sqlite3"
    now = int(time.time())
    result: Dict[str, Any] = {
        "ok": False,
        "database": str(database),
        "legacyJistIncluded": bool(include_legacy_jist),
        "counts": {
            "transactions": 0,
            "mainThunderwords": 0,
            "mainThunderwordTransactions": 0,
            "skippedTransactions": 0,
            "skippedStreams": 0,
        },
    }
    try:
        root.mkdir(parents=True, exist_ok=True)
        database.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(database))
        try:
            conn.execute("PRAGMA journal_mode = DELETE")
            conn.execute("PRAGMA synchronous = FULL")
            if not database_schema_compatible(conn):
                conn.close()
                legacy = database.with_name(
                    database.name + ".legacy-" + str(int(time.time()))
                )
                database.replace(legacy)
                result["replacedLegacyDatabase"] = str(legacy)
                conn = sqlite3.connect(str(database))
                conn.execute("PRAGMA journal_mode = DELETE")
                conn.execute("PRAGMA synchronous = FULL")
            init_schema(conn)
            conn.execute("BEGIN IMMEDIATE")
            conn.execute("DELETE FROM main_thunderword_transactions")
            conn.execute("DELETE FROM main_thunderwords")
            conn.execute("DELETE FROM transactions")

            tx_keys: Set[Tuple[str, str]] = set()
            for path in transaction_files(root):
                record = transaction_record(root, path, now)
                if record is None:
                    result["counts"]["skippedTransactions"] += 1
                    continue
                conn.execute(
                    """
                    INSERT INTO transactions (
                      coin, txid, json_path, json_sha256, byte_size, modified_at,
                      block_time, block_height, title, op_return_text, indexed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    record,
                )
                tx_keys.add((record[0], record[1]))
                result["counts"]["transactions"] += 1

            for path in stream_files(root):
                value = json_object(path)
                record = stream_record(root, path, value or {}, now) if value else None
                if record is None:
                    result["counts"]["skippedStreams"] += 1
                    continue
                conn.execute(
                    """
                    INSERT INTO main_thunderwords (
                      stream_key, coin, address, label, source, source_txid,
                      created_at, updated_at, last_fetched_at, manifest_path
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record["stream_key"],
                        record["coin"],
                        record["address"],
                        record["label"],
                        record["source"],
                        record["source_txid"],
                        record["created_at"],
                        record["updated_at"],
                        record["last_fetched_at"],
                        record["manifest_path"],
                    ),
                )
                result["counts"]["mainThunderwords"] += 1
                for tx in record["transactions"]:
                    present = 1 if (record["coin"], tx["txid"]) in tx_keys else 0
                    conn.execute(
                        """
                        INSERT INTO main_thunderword_transactions (
                          stream_key, coin, txid, discovered_at, source, transaction_present
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            record["stream_key"],
                            record["coin"],
                            tx["txid"],
                            tx["discovered_at"],
                            tx["source"],
                            present,
                        ),
                    )
                    result["counts"]["mainThunderwordTransactions"] += 1

            conn.execute(
                "INSERT INTO catalog_meta(key, value) VALUES(?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                ("rebuilt_at", str(now)),
            )
            conn.execute(
                "INSERT INTO catalog_meta(key, value) VALUES(?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                ("schema", "chisel-unified-index-v1"),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:  # fileProxy returns this structure directly
        result["error"] = str(exc)
        return result

    result["ok"] = True
    return result


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Rebuild Chisel's SQLite catalog from local datastore JSON.")
    parser.add_argument("--data-root", default="data", help="Chisel datastore root (default: ./data)")
    parser.add_argument("--include-legacy-jist", action="store_true", help="Reserved compatibility flag; legacy JIST is not canonical input.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable status.")
    args = parser.parse_args(argv)
    result = rebuild_index(args.data_root, include_legacy_jist=args.include_legacy_jist)
    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        print("ok=" + str(result.get("ok", False)))
        print("database=" + str(result.get("database", "")))
        print("counts=" + json.dumps(result.get("counts", {}), sort_keys=True))
        if result.get("error"):
            print("error=" + str(result["error"]), file=sys.stderr)
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
