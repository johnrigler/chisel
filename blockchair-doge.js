#!/usr/bin/env bun

/*
    Chisel bunOven: Blockchair Dogecoin adapter

    Pulls a Dogecoin transaction from Blockchair, normalizes it into the
    UTXO transaction shape Portal expects, saves it through fileProxy, and
    can optionally broadcast a locally signed raw Dogecoin transaction.

    Environment:
        BLOCKCHAIR_KEY       required for paid/keyed requests
        BLOCKCHAIR_API_KEY   alternate name
        CHISEL_FILE_PROXY    default http://127.0.0.1:7799

    Usage:
        bun tools/bunOven/blockchair-doge.js save TXID [TXID...]
        bun tools/bunOven/blockchair-doge.js get TXID [TXID...]
        bun tools/bunOven/blockchair-doge.js raw TXID [TXID...]
        bun tools/bunOven/blockchair-doge.js push RAWHEX
*/

const argv = Bun.argv.slice(2);
const cmd = (argv[0] || "help").toLowerCase();
const rest = argv.slice(1).filter((x) => !x.startsWith("--"));

const key = process.env.BLOCKCHAIR_KEY || process.env.BLOCKCHAIR_API_KEY || "";
const proxy = (process.env.CHISEL_FILE_PROXY || "http://127.0.0.1:7799").replace(/\/+$/, "");
const base = (process.env.BLOCKCHAIR_BASE || "https://api.blockchair.com").replace(/\/+$/, "");
const chain = process.env.BLOCKCHAIR_CHAIN || "dogecoin";

function usage(exitCode = 2) {
    console.error(`usage:
  BLOCKCHAIR_KEY=... bun tools/bunOven/blockchair-doge.js save TXID [TXID...]
  BLOCKCHAIR_KEY=... bun tools/bunOven/blockchair-doge.js get TXID [TXID...]
  BLOCKCHAIR_KEY=... bun tools/bunOven/blockchair-doge.js raw TXID [TXID...]
  BLOCKCHAIR_KEY=... bun tools/bunOven/blockchair-doge.js push RAWHEX

commands:
  save   pull from Blockchair, normalize, save through fileProxy, reindex DOGE
  get    pull from Blockchair and print normalized Chisel JSON
  raw    pull from Blockchair and print the raw Blockchair JSON
  push   broadcast a locally signed raw Dogecoin tx hex through Blockchair
`);
    process.exit(exitCode);
}

function needKey() {
    if (!key) {
        console.error("Missing BLOCKCHAIR_KEY or BLOCKCHAIR_API_KEY");
        process.exit(1);
    }
}

function isTxid(s) {
    return /^[0-9a-fA-F]{64}$/.test(String(s || ""));
}

function coinUnits(n) {
    if (n === null || n === undefined || n === "") return "0.00000000";
    let s = String(n).trim();
    let neg = false;
    if (s.startsWith("-")) {
        neg = true;
        s = s.slice(1);
    }
    if (!/^\d+$/.test(s)) {
        const asNum = Number(n || 0);
        if (!Number.isFinite(asNum)) return "0.00000000";
        s = String(Math.trunc(asNum));
    }
    s = s.padStart(9, "0");
    const whole = s.slice(0, -8) || "0";
    const frac = s.slice(-8);
    return (neg ? "-" : "") + whole + "." + frac;
}

function unixUtc(timeText) {
    if (!timeText) return null;
    const s = String(timeText).trim();
    let iso = s;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        iso = s.replace(" ", "T") + "Z";
    }
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return null;
    return Math.floor(ms / 1000);
}

function firstOutputAddress(vout) {
    for (const o of vout || []) {
        const a = o?.scriptPubKey?.address || "";
        if (a) return a;
    }
    return "";
}

function blockchairUrl(path, params = {}) {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(params)) {
        if (v !== null && v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    if (key) url.searchParams.set("key", key);
    return url;
}

async function fetchBlockchairTx(txid) {
    if (!isTxid(txid)) throw new Error(`bad txid: ${txid}`);
    const url = blockchairUrl(`/${chain}/dashboards/transaction/${txid}`);
    const res = await fetch(url);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    if (!res.ok || !json || json?.context?.code >= 400) {
        throw new Error(`Blockchair ${res.status}: ${text.slice(0, 1000)}`);
    }
    const item = json?.data?.[txid.toLowerCase()] || json?.data?.[txid] || Object.values(json?.data || {})[0];
    if (!item || !item.transaction) throw new Error(`Blockchair returned no transaction for ${txid}`);
    return json;
}

function normalizeBlockchairTx(rawResponse, txidWanted = "") {
    const itemKey = txidWanted && rawResponse?.data?.[txidWanted.toLowerCase()]
        ? txidWanted.toLowerCase()
        : Object.keys(rawResponse?.data || {})[0];
    const item = rawResponse.data[itemKey];
    const t = item.transaction || {};
    const txid = String(t.hash || itemKey || txidWanted).toLowerCase();
    const blockHeight = Number.isFinite(Number(t.block_id)) && Number(t.block_id) >= 0 ? Number(t.block_id) : null;
    const blockTime = unixUtc(t.time);
    const confirmed = blockHeight !== null;

    const vout = (item.outputs || []).map((o, i) => {
        const n = Number.isFinite(Number(o.index)) ? Number(o.index) : i;
        const address = o.recipient || "";
        const amount = coinUnits(o.value);
        return {
            n,
            value: amount,
            value_sat: String(o.value ?? "0"),
            scriptPubKey: {
                address,
                addresses: address ? [address] : [],
                type: o.type || "",
                asm: "",
                hex: o.script_hex || ""
            },
            chisel: {
                address,
                amount
            },
            blockchair: o
        };
    });

    const vin = (item.inputs || []).map((i, n) => {
        const address = i.recipient || "";
        return {
            n,
            txid: i.transaction_hash || "",
            vout: Number.isFinite(Number(i.index)) ? Number(i.index) : null,
            sequence: Number.isFinite(Number(i.spending_sequence)) ? Number(i.spending_sequence) : null,
            addresses: address ? [address] : [],
            value: coinUnits(i.value),
            value_sat: String(i.value ?? "0"),
            scriptSig: {
                hex: i.spending_signature_hex || "",
                asm: ""
            },
            blockchair: i
        };
    });

    const title = firstOutputAddress(vout) || txid;

    return {
        txid,
        hash: txid,
        chain: "dogecoin",
        coin: "dogecoin",
        ticker: "DOGE",
        source: "blockchair",
        block_height: blockHeight,
        block_time: blockTime,
        confirmed,
        status: {
            confirmed,
            block_height: blockHeight,
            block_time: blockTime
        },
        vin,
        vout,
        fee: coinUnits(t.fee),
        input_total: coinUnits(t.input_total),
        output_total: coinUnits(t.output_total),
        raw_blockchair: rawResponse,
        summary: {
            txid,
            coin: "dogecoin",
            ticker: "DOGE",
            source: "blockchair",
            title,
            lines: vout.length,
            voutCount: vout.length,
            blockHeight: blockHeight,
            blockTime: blockTime,
            time: t.time || null,
            explorerUrl: "https://blockchair.com/dogecoin/transaction/" + txid
        }
    };
}

async function saveTx(tx) {
    const body = {
        coin: "dogecoin",
        ticker: "DOGE",
        txid: tx.txid,
        filenameMode: "base58",
        json: tx
    };
    const res = await fetch(proxy + "/save-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    if (!res.ok || !json || json.ok === false) {
        throw new Error(`fileProxy save-tx ${res.status}: ${text.slice(0, 1000)}`);
    }
    return json;
}

async function reindex() {
    const res = await fetch(proxy + "/reindex?coin=dogecoin");
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    if (!res.ok || !json || json.ok === false) {
        throw new Error(`fileProxy reindex ${res.status}: ${text.slice(0, 1000)}`);
    }
    return json;
}

async function pushRaw(rawHex) {
    if (!/^(0x)?[0-9a-fA-F]+$/.test(rawHex || "")) throw new Error("raw tx must be hex");
    rawHex = rawHex.replace(/^0x/i, "");
    const url = blockchairUrl(`/${chain}/push/transaction`);
    const form = new URLSearchParams();
    form.set("data", rawHex);
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString()
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    if (!res.ok || !json || json?.context?.code >= 400) {
        throw new Error(`Blockchair push ${res.status}: ${text.slice(0, 1000)}`);
    }
    return json;
}

try {
    if (cmd === "help" || cmd === "--help" || cmd === "-h") usage(0);

    if (cmd === "save" || cmd === "get" || cmd === "raw") {
        needKey();
        if (!rest.length) usage();
        const out = [];
        for (const txid of rest) {
            const raw = await fetchBlockchairTx(txid);
            if (cmd === "raw") {
                out.push(raw);
                continue;
            }
            const tx = normalizeBlockchairTx(raw, txid);
            if (cmd === "get") {
                out.push(tx);
                continue;
            }
            const saved = await saveTx(tx);
            out.push({ ok: true, txid: tx.txid, coin: tx.coin, ticker: tx.ticker, block_height: tx.block_height, block_time: tx.block_time, path: saved.path });
        }
        if (cmd === "save") {
            const idx = await reindex();
            console.log(JSON.stringify({ ok: true, saved: out, reindexed: true, count: Array.isArray(idx.transactions) ? idx.transactions.length : idx.count }, null, 2));
        } else {
            console.log(JSON.stringify(out.length === 1 ? out[0] : out, null, 2));
        }
        process.exit(0);
    }

    if (cmd === "push") {
        needKey();
        if (!rest.length) usage();
        const json = await pushRaw(rest[0]);
        console.log(JSON.stringify(json, null, 2));
        process.exit(0);
    }

    usage();
} catch (e) {
    console.error(JSON.stringify({ ok: false, error: String(e?.message || e) }, null, 2));
    process.exit(1);
}
