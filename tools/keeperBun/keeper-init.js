#!/usr/bin/env bun
import {
    DEFAULT_PORT,
    ndjsonWrite,
    parseArgs,
    randomHex,
    readLine,
    safeLog
} from "./keeper-common.js";

const args = parseArgs();
const keeper = String(args.keeper || `http://127.0.0.1:${DEFAULT_PORT}`);
const sshUser = String(args.user || Bun.env.USER || Bun.env.LOGNAME || "").trim();
const reader = Bun.stdin.stream().getReader();

async function keeperPost(path, body) {
    const res = await fetch(`${keeper}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    });

    const text = await res.text();
    let parsed;

    try {
        parsed = JSON.parse(text || "{}");
    } catch (_err) {
        throw new Error(`keeper returned non-json status=${res.status}: ${text.slice(0, 500)}`);
    }

    if (!res.ok || parsed.ok === false) {
        throw new Error(parsed.error || `keeper error ${res.status}`);
    }

    return parsed;
}

function assertUser(user) {
    if (!user) {
        throw new Error("missing user");
    }

    if (sshUser && user !== sshUser) {
        throw new Error("HELO user does not match SSH user");
    }
}

async function main() {
    const line = await readLine(reader);

    if (!line) {
        throw new Error("missing HELO");
    }

    const helo = JSON.parse(line);

    if (helo.op !== "HELO") {
        throw new Error("expected HELO");
    }

    const user = String(helo.user || sshUser || "").trim();
    const chain = String(helo.chain || "LTC").trim();

    assertUser(user);

    const challengeResponse = await keeperPost("/admin/challenge", {
        user,
        sshUser,
        chain,
        relayNonce: randomHex(16)
    });

    ndjsonWrite({
        ok: true,
        ...challengeResponse,
        op: "CHALLENGE"
    });

    const initLine = await readLine(reader);

    if (!initLine) {
        throw new Error("missing INIT");
    }

    const init = JSON.parse(initLine);

    if (init.op !== "INIT") {
        throw new Error("expected INIT");
    }

    assertUser(String(init.user || "").trim());

    const ready = await keeperPost("/admin/init", {
        sshUser,
        packet: init
    });

    ndjsonWrite({
        ok: true,
        ...ready,
        op: "READY"
    });
}

main().catch((err) => {
    safeLog(`keeper-init: ${err.message}`);
    ndjsonWrite({ ok: false, op: "ERROR", error: err.message });
    process.exit(1);
});
