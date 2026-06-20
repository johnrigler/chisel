import { createHash, randomBytes } from "node:crypto";

export const DEFAULT_BIND_HOST = "127.0.0.1";
export const DEFAULT_PORT = 8787;
export const DEFAULT_TTL_SECONDS = 3600;

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_MAP = new Map(Array.from(BASE58).map((ch, index) => [ch, index]));

export function parseArgs(argv = Bun.argv.slice(2)) {
    const out = { _: [] };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (!arg.startsWith("--")) {
            out._.push(arg);
            continue;
        }

        const eq = arg.indexOf("=");

        if (eq > 0) {
            out[arg.slice(2, eq)] = arg.slice(eq + 1);
            continue;
        }

        const key = arg.slice(2);
        const next = argv[i + 1];

        if (!next || next.startsWith("--")) {
            out[key] = true;
            continue;
        }

        out[key] = next;
        i++;
    }

    return out;
}

export function nowIso() {
    return new Date().toISOString();
}

export function addSecondsIso(seconds) {
    return new Date(Date.now() + Number(seconds) * 1000).toISOString();
}

export function isExpired(iso) {
    return Date.now() > Date.parse(iso);
}

export function randomHex(bytes = 32) {
    return randomBytes(bytes).toString("hex");
}

export function sha256HexText(text) {
    return createHash("sha256").update(text, "utf8").digest("hex");
}

export function sha256HexBytes(bytes) {
    return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export function hash160Hex(bytes) {
    const sha = createHash("sha256").update(Buffer.from(bytes)).digest();
    return createHash("ripemd160").update(sha).digest("hex");
}

export function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex) {
    const clean = String(hex || "").trim().replace(/^0x/i, "").replace(/\s+/g, "").toLowerCase();

    if (clean.length % 2 !== 0) {
        throw new Error("invalid hex length");
    }

    const out = new Uint8Array(clean.length / 2);

    for (let i = 0; i < clean.length; i += 2) {
        out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
    }

    return out;
}

export function base58Encode(bytes) {
    let value = 0n;

    for (const byte of bytes) {
        value = (value << 8n) + BigInt(byte);
    }

    let encoded = "";

    while (value > 0n) {
        const mod = Number(value % 58n);
        encoded = BASE58[mod] + encoded;
        value = value / 58n;
    }

    for (const byte of bytes) {
        if (byte === 0) {
            encoded = "1" + encoded;
        } else {
            break;
        }
    }

    return encoded || "1";
}

export function base58Decode(value) {
    let total = 0n;

    for (const ch of String(value || "")) {
        const digit = BASE58_MAP.get(ch);

        if (digit === undefined) {
            throw new Error("invalid base58 character");
        }

        total = total * 58n + BigInt(digit);
    }

    let hex = total.toString(16);

    if (hex.length % 2) {
        hex = "0" + hex;
    }

    let bytes = hex === "00" && total === 0n ? [] : Array.from(Buffer.from(hex, "hex"));

    for (const ch of String(value || "")) {
        if (ch === "1") {
            bytes.unshift(0);
        } else {
            break;
        }
    }

    return new Uint8Array(bytes);
}

export function base58CheckEncode(payloadBytes) {
    const payload = Buffer.from(payloadBytes);
    const checksum = createHash("sha256").update(createHash("sha256").update(payload).digest()).digest().subarray(0, 4);
    return base58Encode(Buffer.concat([payload, checksum]));
}

export function base58CheckDecode(value) {
    const all = Buffer.from(base58Decode(value));

    if (all.length < 5) {
        throw new Error("base58check payload too short");
    }

    const payload = all.subarray(0, all.length - 4);
    const checksum = all.subarray(all.length - 4);
    const expected = createHash("sha256").update(createHash("sha256").update(payload).digest()).digest().subarray(0, 4);

    if (!checksum.equals(expected)) {
        throw new Error("bad base58check checksum");
    }

    return new Uint8Array(payload);
}

export function litecoinP2pkhAddressFromPublicKeyHex(publicKeyHex) {
    const pubKeyBytes = hexToBytes(publicKeyHex);
    const hash160 = Buffer.from(hash160Hex(pubKeyBytes), "hex");
    const payload = Buffer.concat([Buffer.from([0x30]), hash160]);
    return base58CheckEncode(payload);
}

export function dogecoinP2pkhAddressFromPublicKeyHex(publicKeyHex) {
    const pubKeyBytes = hexToBytes(publicKeyHex);
    const hash160 = Buffer.from(hash160Hex(pubKeyBytes), "hex");
    const payload = Buffer.concat([Buffer.from([0x1e]), hash160]);
    return base58CheckEncode(payload);
}

export function canonicalStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return "[" + value.map(canonicalStringify).join(",") + "]";
    }

    const keys = Object.keys(value).sort();
    const parts = keys.map((key) => JSON.stringify(key) + ":" + canonicalStringify(value[key]));
    return "{" + parts.join(",") + "}";
}

export function payloadSha256(payload) {
    return sha256HexText(canonicalStringify(payload));
}

export function makeChallengeMessage(challenge, payloadHash) {
    return [
        "Rigler Secret Keeper INIT",
        "v: 1",
        `server: ${challenge.server}`,
        `user: ${challenge.user}`,
        `chain: ${challenge.chain}`,
        `bootId: ${challenge.bootId}`,
        `nonce: ${challenge.nonce}`,
        `expires: ${challenge.expires}`,
        `payloadSha256: ${payloadHash}`
    ].join("\n");
}

export function jsonOk(extra = {}) {
    return new Response(JSON.stringify({ ok: true, ...extra }) + "\n", {
        headers: { "content-type": "application/json; charset=utf-8" }
    });
}

export function jsonError(status, code, message, extra = {}) {
    return new Response(JSON.stringify({ ok: false, code, error: message, ...extra }) + "\n", {
        status,
        headers: { "content-type": "application/json; charset=utf-8" }
    });
}

export async function readJsonBody(req, maxBytes = 65536) {
    const text = await req.text();

    if (text.length > maxBytes) {
        throw new Error("request body too large");
    }

    return JSON.parse(text || "{}");
}

const LINE_BUFFERS = new WeakMap();
const LINE_DECODER = new TextDecoder();

export async function readLine(reader) {
    let acc = LINE_BUFFERS.get(reader) || "";

    while (true) {
        const newline = acc.indexOf("\n");

        if (newline >= 0) {
            const line = acc.slice(0, newline);
            LINE_BUFFERS.set(reader, acc.slice(newline + 1));
            return line.trim();
        }

        const { value, done } = await reader.read();

        if (done) {
            LINE_BUFFERS.set(reader, "");
            return acc.length ? acc.trim() : null;
        }

        acc += LINE_DECODER.decode(value, { stream: true });
    }
}

export function ndjsonWrite(obj) {
    console.log(JSON.stringify(obj));
}

export function safeLog(message) {
    console.error(`[${nowIso()}] ${message}`);
}

export function normalizeBearer(req) {
    const auth = req.headers.get("authorization") || "";
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

export function joinUrlPath(parts) {
    return parts.map((part) => encodeURIComponent(String(part))).join("/");
}
