#!/usr/bin/env bun
import {
    canonicalStringify,
    ndjsonWrite,
    parseArgs,
    payloadSha256,
    readLine
} from "./keeper-common.js";
import { signChallengeWithLitecoinWif } from "./keeper-crypto.js";

const args = parseArgs();

function usage() {
    console.error(`usage:
    bun login-litecoin.js --host rigler.org --user Lcud... --wif <litecoin-wif> --payload init-payload.json

payload JSON example:
    {
        "ttlSeconds": 3600,
        "secrets": {
            "blockchair": "...",
            "etherscan": "..."
        }
    }
`);
    process.exit(2);
}

async function readPayload() {
    if (args.payload) {
        const file = Bun.file(String(args.payload));
        return JSON.parse(await file.text());
    }

    if (args["payload-json"]) {
        return JSON.parse(String(args["payload-json"]));
    }

    const text = await new Response(Bun.stdin.stream()).text();

    if (text.trim()) {
        return JSON.parse(text);
    }

    return {};
}

async function main() {
    const host = String(args.host || "").trim();
    const user = String(args.user || "").trim();
    const wif = String(args.wif || "").trim();

    if (!host || !user || !wif) {
        usage();
    }

    const payload = await readPayload();
    const child = Bun.spawn(["ssh", "-T", `${user}@${host}`], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "inherit"
    });

    const writer = child.stdin.getWriter();
    const reader = child.stdout.getReader();

    async function send(obj) {
        await writer.write(new TextEncoder().encode(JSON.stringify(obj) + "\n"));
    }

    await send({
        v: 1,
        op: "HELO",
        user,
        chain: "LTC",
        client: "chisel-keeper-bun-login"
    });

    const challengeLine = await readLine(reader);

    if (!challengeLine) {
        throw new Error("server closed before challenge");
    }

    const challengePacket = JSON.parse(challengeLine);

    if (!challengePacket.ok) {
        throw new Error(challengePacket.error || "challenge failed");
    }

    const challenge = challengePacket.data || challengePacket;
    const hash = payloadSha256(payload);
    const signed = await signChallengeWithLitecoinWif(challenge, hash, wif);

    if (signed.address !== user) {
        throw new Error(`WIF derives ${signed.address}, not SSH/user ${user}`);
    }

    await send({
        v: 1,
        op: "INIT",
        user,
        chain: "LTC",
        address: signed.address,
        challengeNonce: challenge.nonce,
        payload,
        payloadSha256: hash,
        publicKeyHex: signed.publicKeyHex,
        signatureHex: signed.signatureHex
    });

    const readyLine = await readLine(reader);

    if (!readyLine) {
        throw new Error("server closed before READY");
    }

    const ready = JSON.parse(readyLine);

    if (!ready.ok) {
        throw new Error(ready.error || "init failed");
    }

    console.log(canonicalStringify(ready));

    try {
        await writer.close();
    } catch (_err) {
        // SSH may already have closed stdin.
    }

    const exitCode = await child.exited;

    if (exitCode !== 0) {
        throw new Error(`ssh exited ${exitCode}`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
