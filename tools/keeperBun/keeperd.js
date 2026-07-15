#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import {
    DEFAULT_BIND_HOST,
    DEFAULT_PORT,
    DEFAULT_TTL_SECONDS,
    addSecondsIso,
    canonicalStringify,
    isExpired,
    jsonError,
    jsonOk,
    joinUrlPath,
    litecoinP2pkhAddressFromPublicKeyHex,
    makeChallengeMessage,
    normalizeBearer,
    parseArgs,
    payloadSha256,
    randomHex,
    readJsonBody,
    safeLog
} from "./keeper-common.js";
import { verifyTextSignature } from "./keeper-crypto.js";

const args = parseArgs();
const owner = String(args.owner || "").trim();
const host = String(args.host || DEFAULT_BIND_HOST);
const port = Number(args.port || DEFAULT_PORT);
const serverName = String(args.server || "rigler.org");
const defaultTtlSeconds = Number(args["ttl-default"] || DEFAULT_TTL_SECONDS);
const dbPath = String(args.db || ":memory:");
const publicBase = String(args.public || "");
const bootId = randomHex(16);

const db = new Database(dbPath);

const state = {
    owner,
    serverName,
    bootId,
    initialized: false,
    mode: "locked",
    startedAt: new Date().toISOString(),
    initializedAt: null,
    expires: null,
    apiToken: null,
    secrets: new Map(),
    challenges: new Map(),
    timer: null
};

db.exec(`
    CREATE TABLE IF NOT EXISTS api_cache (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        chain TEXT NOT NULL,
        kind TEXT NOT NULL,
        query TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        body TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_api_cache_lookup
        ON api_cache(source, chain, kind, query);
`);

function statusBody() {
    return {
        owner: state.owner,
        mode: state.mode,
        initialized: state.initialized,
        bootId: state.bootId,
        startedAt: state.startedAt,
        initializedAt: state.initializedAt,
        expires: state.expires,
        secretCount: state.secrets.size,
        db: dbPath === ":memory:" ? ":memory:" : "persistent-cache",
        public: publicBase || null
    };
}

function lock(reason = "lock") {
    if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
    }

    state.secrets.clear();
    state.challenges.clear();
    state.initialized = false;
    state.mode = reason === "expired" ? "expired" : "locked";
    state.initializedAt = null;
    state.expires = null;
    state.apiToken = null;
}

function requireOwner(user) {
    if (!user) {
        throw new Error("missing user");
    }

    if (state.owner && user !== state.owner) {
        throw new Error("user does not match daemon owner");
    }
}

function requireToken(req) {
    const token = normalizeBearer(req);

    if (!state.initialized || !state.apiToken || token !== state.apiToken) {
        return false;
    }

    if (state.expires && isExpired(state.expires)) {
        lock("expired");
        return false;
    }

    return true;
}

function setTtl(seconds) {
    const ttl = Math.max(1, Math.min(Number(seconds || defaultTtlSeconds), 86400));
    state.expires = addSecondsIso(ttl);

    if (state.timer) {
        clearTimeout(state.timer);
    }

    state.timer = setTimeout(() => {
        safeLog(`TTL expired for ${state.owner || "unowned keeper"}`);
        lock("expired");
    }, ttl * 1000);

    return ttl;
}

function rememberCache(id, source, chain, kind, query, body) {
    db.query(`
        INSERT OR REPLACE INTO api_cache
            (id, source, chain, kind, query, fetched_at, body)
        VALUES
            (?, ?, ?, ?, ?, ?, ?)
    `).run(id, source, chain, kind, query, Date.now(), JSON.stringify(body));
}

function readCache(id, maxAgeSeconds = 300) {
    const row = db.query("SELECT fetched_at, body FROM api_cache WHERE id = ?").get(id);

    if (!row) {
        return null;
    }

    if (maxAgeSeconds >= 0 && (Date.now() - Number(row.fetched_at)) > maxAgeSeconds * 1000) {
        return null;
    }

    return JSON.parse(row.body);
}

async function blockchairGet(chain, pathParts, params = {}) {
    const key = state.secrets.get("blockchair");

    if (!key) {
        throw new Error("missing blockchair key");
    }

    const url = new URL(`https://api.blockchair.com/${joinUrlPath([chain, ...pathParts])}`);

    for (const [name, value] of Object.entries(params)) {
        url.searchParams.set(name, String(value));
    }

    url.searchParams.set("key", key);

    const res = await fetch(url);
    const text = await res.text();

    if (!res.ok) {
        throw new Error(`blockchair ${res.status}: ${text.slice(0, 500)}`);
    }

    return JSON.parse(text);
}

async function etherscanGet(params = {}) {
    const key = state.secrets.get("etherscan") || state.secrets.get("evm");

    if (!key) {
        throw new Error("missing etherscan key");
    }

    const url = new URL("https://api.etherscan.io/v2/api");

    for (const [name, value] of Object.entries(params)) {
        url.searchParams.set(name, String(value));
    }

    url.searchParams.set("apikey", key);

    const res = await fetch(url);
    const text = await res.text();

    if (!res.ok) {
        throw new Error(`etherscan ${res.status}: ${text.slice(0, 500)}`);
    }

    return JSON.parse(text);
}

function responseFromData(data, cached = false) {
    return jsonOk({ cached, data });
}

async function makeChallenge(req) {
    const body = await readJsonBody(req, 8192);
    const user = String(body.user || "").trim();
    const chain = String(body.chain || "LTC").trim();

    requireOwner(user);

    if (chain !== "LTC") {
        throw new Error("only LTC challenge is implemented in this v1");
    }

    const challenge = {
        v: 1,
        op: "CHALLENGE",
        server: state.serverName,
        user,
        chain,
        bootId: state.bootId,
        nonce: randomHex(32),
        expires: addSecondsIso(90),
        payloadMax: 65536
    };

    state.challenges.set(challenge.nonce, challenge);
    return jsonOk(challenge);
}

async function initFromSignedPacket(req) {
    const body = await readJsonBody(req, 131072);
    const packet = body.packet || body;
    const user = String(packet.user || "").trim();
    const chain = String(packet.chain || "LTC").trim();
    const address = String(packet.address || "").trim();
    const publicKeyHex = String(packet.publicKeyHex || "").trim();
    const signatureHex = String(packet.signatureHex || packet.signature || "").trim();
    const submittedPayloadHash = String(packet.payloadSha256 || "").trim();
    const challengeNonce = String(packet.challengeNonce || "").trim();
    const payload = packet.payload || {};

    requireOwner(user);

    if (chain !== "LTC") {
        throw new Error("only LTC init is implemented in this v1");
    }

    if (address !== user) {
        throw new Error("signed address must match SSH/user name");
    }

    const derivedAddress = litecoinP2pkhAddressFromPublicKeyHex(publicKeyHex);

    if (derivedAddress !== address) {
        throw new Error("public key does not derive to the claimed Litecoin address");
    }

    const challenge = state.challenges.get(challengeNonce);

    if (!challenge) {
        throw new Error("unknown or already-used challenge");
    }

    state.challenges.delete(challengeNonce);

    if (isExpired(challenge.expires)) {
        throw new Error("challenge expired");
    }

    if (challenge.user !== user || challenge.chain !== chain || challenge.bootId !== state.bootId) {
        throw new Error("challenge context mismatch");
    }

    const actualPayloadHash = payloadSha256(payload);

    if (actualPayloadHash !== submittedPayloadHash) {
        throw new Error("payload hash mismatch");
    }

    const message = makeChallengeMessage(challenge, actualPayloadHash);
    const ok = await verifyTextSignature(message, publicKeyHex, signatureHex);

    if (!ok) {
        throw new Error("bad signature");
    }

    lock("reinit");

    for (const [name, value] of Object.entries(payload.secrets || {})) {
        if (value === null || typeof value === "undefined" || String(value) === "") {
            continue;
        }

        state.secrets.set(String(name), String(value));
    }

    const ttlSeconds = setTtl(payload.ttlSeconds || defaultTtlSeconds);
    state.initialized = true;
    state.mode = "ready";
    state.initializedAt = new Date().toISOString();
    state.apiToken = randomHex(32);

    return jsonOk({
        op: "READY",
        owner: state.owner || user,
        mode: state.mode,
        api: {
            kind: "tcp",
            url: `http://${host}:${actualServer.port}`,
            token: state.apiToken
        },
        public: publicBase ? { url: publicBase } : null,
        ttlSeconds,
        expires: state.expires,
        bootId: state.bootId,
        secretCount: state.secrets.size
    });
}

async function handleCachedBlockchair(chain, kind, query, fetcher) {
    const id = `blockchair:${chain}:${kind}:${query}`;
    const cached = readCache(id, Number(args["cache-ttl"] || 300));

    if (cached) {
        return responseFromData(cached, true);
    }

    const data = await fetcher();
    rememberCache(id, "blockchair", chain, kind, query, data);
    return responseFromData(data, false);
}

async function route(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const parts = path.split("/").filter(Boolean);

    try {
        if (req.method === "GET" && path === "/health") {
            return jsonOk(statusBody());
        }

        if (req.method === "GET" && path === "/admin/status") {
            return jsonOk(statusBody());
        }

        if (req.method === "POST" && path === "/admin/challenge") {
            return await makeChallenge(req);
        }

        if (req.method === "POST" && path === "/admin/init") {
            return await initFromSignedPacket(req);
        }

        if (req.method === "POST" && path === "/admin/lock") {
            lock("lock");
            return jsonOk(statusBody());
        }

        if (req.method === "POST" && path === "/api/lock") {
            if (!requireToken(req)) {
                return jsonError(401, "unauthorized", "bad or missing bearer token");
            }

            lock("lock");
            return jsonOk(statusBody());
        }

        if (path.startsWith("/api/")) {
            if (!requireToken(req)) {
                return jsonError(401, "unauthorized", "bad or missing bearer token");
            }
        }

        if (req.method === "GET" && parts.length === 4 && parts[0] === "api" && parts[2] === "address") {
            const chain = parts[1];
            const address = decodeURIComponent(parts[3]);

            if (!["dogecoin", "litecoin", "bitcoin-cash", "bitcoin-sv", "dash"].includes(chain)) {
                return jsonError(400, "bad_chain", "unsupported Blockchair chain");
            }

            return await handleCachedBlockchair(chain, "address", address, async () => {
                return await blockchairGet(chain, ["dashboards", "address", address], {
                    transaction_details: "true"
                });
            });
        }

        if (req.method === "GET" && parts.length === 4 && parts[0] === "api" && parts[2] === "tx") {
            const chain = parts[1];
            const txid = decodeURIComponent(parts[3]);

            if (!["dogecoin", "litecoin", "bitcoin-cash", "bitcoin-sv", "dash"].includes(chain)) {
                return jsonError(400, "bad_chain", "unsupported Blockchair chain");
            }

            return await handleCachedBlockchair(chain, "tx", txid, async () => {
                return await blockchairGet(chain, ["dashboards", "transaction", txid]);
            });
        }

        if (req.method === "GET" && parts.length === 5 && parts[0] === "api" && parts[1] === "evm" && parts[2] === "txlist") {
            const chainid = decodeURIComponent(parts[3]);
            const address = decodeURIComponent(parts[4]);
            const id = `etherscan:${chainid}:txlist:${address}`;
            const cached = readCache(id, Number(args["cache-ttl"] || 300));

            if (cached) {
                return responseFromData(cached, true);
            }

            const data = await etherscanGet({
                chainid,
                module: "account",
                action: "txlist",
                address,
                startblock: url.searchParams.get("startblock") || "0",
                endblock: url.searchParams.get("endblock") || "99999999",
                page: url.searchParams.get("page") || "1",
                offset: url.searchParams.get("offset") || "100",
                sort: url.searchParams.get("sort") || "desc"
            });

            rememberCache(id, "etherscan", `evm:${chainid}`, "txlist", address, data);
            return responseFromData(data, false);
        }

        if (req.method === "GET" && path === "/api/cache/status") {
            const row = db.query("SELECT COUNT(*) AS count FROM api_cache").get();
            return jsonOk({ count: row.count, db: dbPath === ":memory:" ? ":memory:" : "persistent-cache" });
        }

        return jsonError(404, "not_found", "no such endpoint");
    } catch (err) {
        safeLog(`${req.method} ${path}: ${err.message}`);
        return jsonError(400, "bad_request", err.message);
    }
}

const actualServer = Bun.serve({
    hostname: host,
    port,
    fetch: route
});

safeLog(`keeperd listening on http://${host}:${actualServer.port} owner=${owner || "*"} db=${dbPath}`);

process.on("SIGTERM", () => {
    safeLog("SIGTERM: clearing memory vault");
    lock("sigterm");
    process.exit(0);
});

process.on("SIGINT", () => {
    safeLog("SIGINT: clearing memory vault");
    lock("sigint");
    process.exit(0);
});
