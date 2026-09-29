PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
    path TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    chain TEXT,
    size INTEGER NOT NULL DEFAULT 0,
    mtime_ns INTEGER NOT NULL DEFAULT 0,
    sha256 TEXT,
    record_count INTEGER NOT NULL DEFAULT 0,
    indexed_at INTEGER NOT NULL,
    error TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
    chain TEXT NOT NULL,
    txid TEXT NOT NULL,
    source_kind TEXT NOT NULL DEFAULT 'reference',
    source_path TEXT,
    source_format TEXT,
    complete INTEGER NOT NULL DEFAULT 0,
    block_height INTEGER,
    block_hash TEXT,
    block_time INTEGER,
    title TEXT,
    primary_url TEXT,
    op_return_text TEXT,
    contract_name TEXT,
    contract_address TEXT,
    raw_sha256 TEXT,
    modified_at INTEGER,
    indexed_at INTEGER NOT NULL,
    PRIMARY KEY (chain, txid)
);

CREATE INDEX IF NOT EXISTS idx_transactions_txid ON transactions(txid);
CREATE INDEX IF NOT EXISTS idx_transactions_chain_time ON transactions(chain, block_time DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_height ON transactions(chain, block_height DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_title ON transactions(title);

CREATE TABLE IF NOT EXISTS transaction_inputs (
    chain TEXT NOT NULL,
    txid TEXT NOT NULL,
    vin_index INTEGER NOT NULL,
    prev_txid TEXT,
    prev_vout INTEGER,
    address TEXT,
    value_units TEXT,
    value_coin TEXT,
    coinbase INTEGER NOT NULL DEFAULT 0,
    source_path TEXT,
    PRIMARY KEY (chain, txid, vin_index)
);

CREATE INDEX IF NOT EXISTS idx_inputs_prevout ON transaction_inputs(chain, prev_txid, prev_vout);
CREATE INDEX IF NOT EXISTS idx_inputs_address ON transaction_inputs(chain, address);

CREATE TABLE IF NOT EXISTS transaction_outputs (
    chain TEXT NOT NULL,
    txid TEXT NOT NULL,
    vout_index INTEGER NOT NULL,
    address TEXT,
    value_units TEXT,
    value_coin TEXT,
    script_type TEXT,
    script_hex TEXT,
    op_return_hex TEXT,
    op_return_text TEXT,
    flags TEXT,
    score INTEGER NOT NULL DEFAULT 0,
    satoshi_code TEXT,
    source_path TEXT,
    PRIMARY KEY (chain, txid, vout_index)
);

CREATE INDEX IF NOT EXISTS idx_outputs_address ON transaction_outputs(chain, address);
CREATE INDEX IF NOT EXISTS idx_outputs_satoshi_code ON transaction_outputs(chain, satoshi_code);
CREATE INDEX IF NOT EXISTS idx_outputs_amount ON transaction_outputs(chain, value_units);
CREATE INDEX IF NOT EXISTS idx_outputs_score ON transaction_outputs(score DESC);

CREATE TABLE IF NOT EXISTS address_occurrences (
    chain TEXT NOT NULL,
    txid TEXT NOT NULL,
    address TEXT NOT NULL,
    address_norm TEXT NOT NULL,
    direction TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT -1,
    role TEXT NOT NULL,
    value_units TEXT,
    evidence TEXT,
    source_path TEXT,
    PRIMARY KEY (chain, txid, address_norm, direction, position, role)
);

CREATE INDEX IF NOT EXISTS idx_address_exact ON address_occurrences(chain, address_norm);
CREATE INDEX IF NOT EXISTS idx_address_tx ON address_occurrences(chain, txid);
CREATE INDEX IF NOT EXISTS idx_address_role ON address_occurrences(role);

CREATE TABLE IF NOT EXISTS address_ngrams (
    gram TEXT NOT NULL,
    chain TEXT NOT NULL,
    txid TEXT NOT NULL,
    address_norm TEXT NOT NULL,
    PRIMARY KEY (gram, chain, txid, address_norm)
);

CREATE INDEX IF NOT EXISTS idx_address_ngrams_tx ON address_ngrams(chain, txid);

CREATE TABLE IF NOT EXISTS links (
    chain TEXT NOT NULL,
    txid TEXT NOT NULL,
    kind TEXT NOT NULL,
    target TEXT NOT NULL,
    label TEXT,
    source TEXT,
    source_path TEXT,
    PRIMARY KEY (chain, txid, kind, target)
);

CREATE INDEX IF NOT EXISTS idx_links_target ON links(target);

CREATE TABLE IF NOT EXISTS candidates (
    chain TEXT NOT NULL,
    txid TEXT NOT NULL,
    vout_index INTEGER NOT NULL,
    address TEXT,
    value_units TEXT,
    value_coin TEXT,
    script_type TEXT,
    op_return_text TEXT,
    flags TEXT,
    score INTEGER NOT NULL DEFAULT 0,
    satoshi_code TEXT,
    source_path TEXT,
    PRIMARY KEY (chain, txid, vout_index)
);

CREATE INDEX IF NOT EXISTS idx_candidates_score ON candidates(score DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_address ON candidates(chain, address);
CREATE INDEX IF NOT EXISTS idx_candidates_satoshi ON candidates(chain, satoshi_code);

CREATE TABLE IF NOT EXISTS origin_events (
    chain TEXT NOT NULL,
    address TEXT NOT NULL,
    txid TEXT NOT NULL,
    vout_index INTEGER NOT NULL DEFAULT 0,
    block_height INTEGER,
    amount_units TEXT,
    amount_coin TEXT,
    event_type TEXT NOT NULL,
    label TEXT,
    notes TEXT,
    source TEXT,
    source_path TEXT,
    PRIMARY KEY (chain, address, txid, vout_index, event_type)
);

CREATE INDEX IF NOT EXISTS idx_origin_address ON origin_events(chain, address);

CREATE TABLE IF NOT EXISTS rabbit_trails (
    trail_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    default_chain TEXT,
    confidence TEXT,
    source_path TEXT NOT NULL,
    source_format TEXT,
    raw_sha256 TEXT,
    created_at TEXT,
    updated_at TEXT,
    indexed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rabbit_trail_roots (
    trail_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    chain TEXT NOT NULL,
    txid TEXT,
    address TEXT,
    role TEXT NOT NULL DEFAULT 'thunderword-root',
    note TEXT,
    evidence TEXT,
    PRIMARY KEY (trail_id, position),
    FOREIGN KEY (trail_id) REFERENCES rabbit_trails(trail_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trail_roots_tx ON rabbit_trail_roots(chain, txid);
CREATE INDEX IF NOT EXISTS idx_trail_roots_address ON rabbit_trail_roots(chain, address);

CREATE TABLE IF NOT EXISTS rabbit_trail_addresses (
    trail_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    chain TEXT NOT NULL,
    address TEXT NOT NULL,
    role TEXT NOT NULL,
    confidence TEXT,
    note TEXT,
    evidence TEXT,
    PRIMARY KEY (trail_id, position),
    FOREIGN KEY (trail_id) REFERENCES rabbit_trails(trail_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trail_addresses_address ON rabbit_trail_addresses(chain, address);

CREATE TABLE IF NOT EXISTS rabbit_trail_transactions (
    trail_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    chain TEXT NOT NULL,
    txid TEXT NOT NULL,
    role TEXT NOT NULL,
    confidence TEXT,
    note TEXT,
    evidence TEXT,
    PRIMARY KEY (trail_id, position),
    FOREIGN KEY (trail_id) REFERENCES rabbit_trails(trail_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trail_transactions_tx ON rabbit_trail_transactions(chain, txid);

CREATE TABLE IF NOT EXISTS rabbit_trail_claims (
    trail_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    subject TEXT,
    predicate TEXT,
    object TEXT,
    confidence TEXT,
    note TEXT,
    evidence TEXT,
    PRIMARY KEY (trail_id, position),
    FOREIGN KEY (trail_id) REFERENCES rabbit_trails(trail_id) ON DELETE CASCADE
);
