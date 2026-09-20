#!/usr/bin/env bun
function argValue(flag, fallback) {
    const i = Bun.argv.indexOf(flag);
    if (i >= 0 && Bun.argv[i + 1]) return Bun.argv[i + 1];
    return fallback;
}
const inputPath = Bun.argv.slice(2).find((x) => !x.startsWith("--"));
if (!inputPath) {
    console.error("usage: bun tools/bunOven/import-jist-to-fileProxy.js FEED.jsonl [--coin dogecoin] [--replace] [--proxy http://127.0.0.1:7799]");
    process.exit(2);
}
const proxy = String(argValue("--proxy", process.env.CHISEL_FILE_PROXY || "http://127.0.0.1:7799")).replace(/\/+$/, "");
const coin = argValue("--coin", "dogecoin");
const mode = Bun.argv.includes("--replace") ? "replace" : argValue("--mode", "merge");
const text = await Bun.file(inputPath).text();
const response = await fetch(proxy + "/import-jist-feed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        coin,
        mode,
        sourceName: inputPath.split(/[\\/]/).pop().replace(/\.[^.]+$/, ""),
        text
    })
});
const json = await response.json().catch(() => null);
if (!response.ok || !json || json.ok === false) {
    console.error(JSON.stringify(json || { ok: false, status: response.status }, null, 2));
    process.exit(1);
}
console.log(JSON.stringify(json, null, 2));
