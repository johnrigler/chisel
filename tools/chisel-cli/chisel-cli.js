#!/usr/bin/env node
"use strict";

/*
 * Chisel local CLI
 *
 * Browser Chisel files deliberately expose globals.  This small Node wrapper
 * gives those same files a browser-like global scope and exposes only useful,
 * inspectable command-line operations.  It does not use npm packages and it
 * does not alter the static/IPFS build.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash, webcrypto } = require("node:crypto");

const CLI_VERSION = "2.7.10";

const REQUIRED_MODULES = Object.freeze([
  "chisel.js",
  "chisel.unspendable.js",
  "chisel.sign.js",
  "chisel.ravencoin.js",
  "chisel.digibyte.js",
  "chisel.litecoin.js"
]);

const COIN_ALIASES = Object.freeze({
  dgb: "digibyte",
  digibyte: "digibyte",
  ltc: "litecoin",
  litecoin: "litecoin",
  tltc: "litecoinTestnet",
  litecointestnet: "litecoinTestnet",
  rvn: "ravencoin",
  ravencoin: "ravencoin"
});

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

function usage() {
  return `Chisel-cli ${CLI_VERSION} — local browser-driver CLI

Usage:
  chisel-cli [--root PATH] help
  chisel-cli [--root PATH] version
  chisel-cli [--root PATH] about
  chisel-cli [--root PATH] check
  chisel-cli [--root PATH] verify-driver

  chisel-cli [--root PATH] un PREFIX PHRASE...
  chisel-cli [--root PATH] uninspect PREFIX PHRASE...
  chisel-cli [--root PATH] encode PHRASE...
  chisel-cli [--root PATH] opreturn PHRASE...
  chisel-cli [--root PATH] opreturn-hex PHRASE...
  chisel-cli [--root PATH] opreturn-script PHRASE...

  chisel-cli [--root PATH] hash sha256|double-sha256|ripemd160|hash160 HEX
  chisel-cli [--root PATH] tx decode HEX|@FILE|-
  chisel-cli [--root PATH] account COIN --wif-stdin

Shell/RPC pass-through supplied by tools/chisel:
  chisel-cli rpc METHOD '[JSON_PARAMS_ARRAY]'
  chisel-cli rpc-call METHOD ARG...
  chisel-cli rpc-methods

Examples:
  chisel-cli check
  chisel-cli un LKx 'DOWNTON ABBEY'
  chisel-cli uninspect LKx 'DOWNTON ABBEY'
  chisel-cli opreturn 'https://youtu.be/example'
  chisel-cli tx decode @signed-tx.hex
  read -rs WIF; printf '%s\\n' "$WIF" | chisel account ltc --wif-stdin; unset WIF

Notes:
  --root must appear before the command.  Without it, the command loads the
  Chisel checkout that contains this tools/ directory, or $CHISEL_ROOT.
  The account command deliberately refuses positional WIF values.  It emits
  public account data only and does not sign or broadcast.
`;
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, function jsonReplacer(key, item) {
    if (typeof item === "bigint") {
      return item.toString();
    }

    if (item instanceof Uint8Array) {
      return Buffer.from(item).toString("hex");
    }

    return item;
  }, 2) + "\n");
}

function parseInvocation(argv) {
  const remaining = argv.slice();
  let root = process.env.CHISEL_ROOT
    ? path.resolve(process.env.CHISEL_ROOT)
    : path.resolve(__dirname, "..");

  while (remaining[0] === "--root") {
    if (!remaining[1]) {
      throw new UsageError("--root requires a path.");
    }

    root = path.resolve(remaining[1]);
    remaining.splice(0, 2);
  }

  return {
    root: root,
    command: remaining.shift() || "help",
    args: remaining
  };
}

function requireArgument(args, description) {
  if (args.length === 0) {
    throw new UsageError(description);
  }
}

function phraseFrom(args, description) {
  requireArgument(args, description);
  return args.join(" ");
}

function makeSandbox() {
  if (!webcrypto || !webcrypto.subtle) {
    throw new Error("Node Web Crypto is unavailable. Chisel CLI requires Node.js 18 or later.");
  }

  const sandbox = {
    console: console,
    crypto: webcrypto,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    AbortController: globalThis.AbortController,
    AbortSignal: globalThis.AbortSignal
  };

  if (typeof globalThis.fetch === "function") {
    sandbox.fetch = globalThis.fetch.bind(globalThis);
    sandbox.Headers = globalThis.Headers;
    sandbox.Request = globalThis.Request;
    sandbox.Response = globalThis.Response;
  }

  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  return vm.createContext(sandbox, { name: "Chisel local CLI" });
}

function loadChisel(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error("Chisel source root does not exist: " + root);
  }

  const missing = REQUIRED_MODULES.filter(function missingModule(file) {
    return !fs.existsSync(path.join(root, file));
  });

  if (missing.length > 0) {
    throw new Error(
      "Chisel source root is missing required module(s): " + missing.join(", ") +
      ". Set CHISEL_ROOT or use --root before the command."
    );
  }

  const context = makeSandbox();

  REQUIRED_MODULES.forEach(function loadModule(file) {
    const filename = path.join(root, file);
    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename: filename });
  });

  if (!context.CHISEL || !context.CHISEL.unspendable) {
    throw new Error("Chisel modules loaded but did not expose CHISEL and CHISEL.unspendable.");
  }

  return {
    context: context,
    chisel: context.CHISEL
  };
}

function readDriverManifest(root) {
  const manifestPath = path.join(root, "dist", "chisel-driver.manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return { found: false, path: manifestPath };
  }

  try {
    return {
      found: true,
      path: manifestPath,
      value: JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    };
  } catch (error) {
    return {
      found: true,
      path: manifestPath,
      error: error.message
    };
  }
}

function hashFile(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sourceFileStatus(root) {
  return REQUIRED_MODULES.map(function describeSourceFile(file) {
    const filePath = path.join(root, file);
    return {
      path: file,
      exists: fs.existsSync(filePath),
      bytes: fs.existsSync(filePath) ? fs.statSync(filePath).size : null,
      sha256: fs.existsSync(filePath) ? hashFile(filePath) : null
    };
  });
}

function resolveCoinName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const name = COIN_ALIASES[normalized];

  if (!name) {
    throw new UsageError("Unknown coin '" + value + "'. Use dgb, ltc, tltc, or rvn.");
  }

  return name;
}

function readStdin(maximumBytes) {
  const limit = Number(maximumBytes || 1024 * 1024);

  return new Promise(function collectStdin(resolve, reject) {
    const chunks = [];
    let total = 0;
    let failed = false;

    process.stdin.on("data", function readChunk(chunk) {
      if (failed) {
        return;
      }

      total += chunk.length;

      if (total > limit) {
        failed = true;
        reject(new Error("stdin exceeds the " + limit + " byte limit."));
        process.stdin.destroy();
        return;
      }

      chunks.push(chunk);
    });

    process.stdin.on("error", reject);
    process.stdin.on("end", function finishReading() {
      if (!failed) {
        resolve(Buffer.concat(chunks).toString("utf8"));
      }
    });
  });
}

async function readTransactionSource(value) {
  if (value === "-") {
    return (await readStdin(4 * 1024 * 1024)).trim();
  }

  if (value.startsWith("@")) {
    const filePath = path.resolve(process.cwd(), value.slice(1));
    return fs.readFileSync(filePath, "utf8").trim();
  }

  return value.trim();
}

async function commandAccount(chisel, args) {
  if (args.length !== 2 || args[1] !== "--wif-stdin") {
    throw new UsageError("Usage: chisel account COIN --wif-stdin");
  }

  const coinName = resolveCoinName(args[0]);
  const coin = chisel.getCoin(coinName);

  if (!coin || typeof coin.wifToAccount !== "function") {
    throw new Error("Installed Chisel coin has no WIF account helper: " + coinName);
  }

  let wif = (await readStdin(1024)).trim();

  if (!wif) {
    throw new Error("No WIF was received on stdin.");
  }

  try {
    const account = await coin.wifToAccount(wif);

    printJson({
      currency: account.currency,
      network: account.network,
      ticker: account.ticker,
      compressed: account.compressed,
      address: account.address,
      compressedAddress: account.compressedAddress,
      uncompressedAddress: account.uncompressedAddress
    });
  } finally {
    // This does not promise memory erasure in a garbage-collected runtime. It
    // does keep the input out of arguments, output, and ordinary file writes.
    wif = "";
  }
}

async function commandVerifyDriver(root) {
  const manifest = readDriverManifest(root);

  if (!manifest.found) {
    throw new Error("Driver manifest not found: " + manifest.path);
  }

  if (manifest.error) {
    throw new Error("Cannot parse driver manifest: " + manifest.error);
  }

  const value = manifest.value;
  const entries = Array.isArray(value.sourceFiles) ? value.sourceFiles : [];

  if (entries.length === 0) {
    throw new Error("Driver manifest does not list sourceFiles.");
  }

  const sourceFiles = entries.map(function verifySource(entry) {
    const relativePath = String(entry.path || "");
    const filePath = path.resolve(root, relativePath);
    const exists = fs.existsSync(filePath);
    const actual = exists ? hashFile(filePath) : null;

    return {
      path: relativePath,
      expectedSha256: entry.sha256 || null,
      actualSha256: actual,
      ok: Boolean(exists && entry.sha256 && actual === entry.sha256)
    };
  });

  const driverPath = path.join(root, "dist", "chisel-driver.js");
  const driverExists = fs.existsSync(driverPath);
  const actualDriverHash = driverExists ? hashFile(driverPath) : null;
  const driverOk = Boolean(driverExists && value.sha256 && actualDriverHash === value.sha256);
  const ok = sourceFiles.every(function eachSource(entry) {
    return entry.ok;
  }) && driverOk;

  const report = {
    ok: ok,
    manifest: manifest.path,
    manifestVersion: value.version || null,
    sourceFiles: sourceFiles,
    driver: {
      path: path.relative(root, driverPath),
      expectedSha256: value.sha256 || null,
      actualSha256: actualDriverHash,
      ok: driverOk
    }
  };

  printJson(report);

  if (!ok) {
    process.exitCode = 1;
  }
}

async function main(argv) {
  const invocation = parseInvocation(argv);
  const command = invocation.command;

  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(usage());
    return;
  }

  if (command === "version") {
    printJson({
      cli: CLI_VERSION,
      node: process.version,
      sourceRoot: invocation.root,
      sources: sourceFileStatus(invocation.root)
    });
    return;
  }

  if (command === "verify-driver") {
    await commandVerifyDriver(invocation.root);
    return;
  }

  const runtime = loadChisel(invocation.root);
  const chisel = runtime.chisel;

  if (command === "about") {
    printJson({
      cli: CLI_VERSION,
      sourceRoot: invocation.root,
      driverManifest: readDriverManifest(invocation.root).value || null,
      chisel: chisel.about()
    });
    return;
  }

  if (command === "check") {
    const unspendableAddress = await chisel.unspendable.generate("LKx", "DOWNTON ABBEY");
    const report = {
      ok: true,
      cli: CLI_VERSION,
      node: process.version,
      sourceRoot: invocation.root,
      sources: sourceFileStatus(invocation.root),
      chisel: chisel.about(),
      smoke: {
        ripemd160_abc: chisel.ripemd160Hex("616263"),
        unspendableAddress: unspendableAddress,
        validLitecoinReadablePrefix: unspendableAddress.startsWith("LKx") && unspendableAddress.length === 34
      },
      driverManifest: readDriverManifest(invocation.root).value || null
    };

    report.ok = report.smoke.ripemd160_abc === "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc" &&
      report.smoke.validLitecoinReadablePrefix;
    printJson(report);

    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "un" || command === "uninspect") {
    requireArgument(invocation.args, "Usage: chisel " + command + " PREFIX PHRASE...");
    const prefix = invocation.args.shift();
    const phrase = phraseFrom(invocation.args, "Usage: chisel " + command + " PREFIX PHRASE...");
    const inspection = await chisel.unspendable.inspect(prefix, phrase);

    if (command === "un") {
      process.stdout.write(inspection.address + "\n");
    } else {
      printJson(inspection);
    }
    return;
  }

  if (command === "encode") {
    process.stdout.write(chisel.stringToHex(phraseFrom(invocation.args, "Usage: chisel encode PHRASE...")) + "\n");
    return;
  }

  if (command === "opreturn" || command === "opreturn-hex" || command === "opreturn-script") {
    const text = phraseFrom(invocation.args, "Usage: chisel " + command + " PHRASE...");
    const payloadHex = chisel.stringToHex(text);
    const scriptHex = chisel.buildOpReturnScript(payloadHex);

    if (command === "opreturn-hex") {
      process.stdout.write(payloadHex + "\n");
    } else if (command === "opreturn-script") {
      process.stdout.write(scriptHex + "\n");
    } else {
      printJson({
        text: text,
        payloadHex: payloadHex,
        payloadBytes: payloadHex.length / 2,
        scriptHex: scriptHex
      });
    }
    return;
  }

  if (command === "hash") {
    if (invocation.args.length !== 2) {
      throw new UsageError("Usage: chisel hash sha256|double-sha256|ripemd160|hash160 HEX");
    }

    const algorithm = invocation.args[0];
    const hex = invocation.args[1];
    const methods = {
      sha256: chisel.sha256Hex,
      "double-sha256": chisel.doubleSha256Hex,
      ripemd160: chisel.ripemd160Hex,
      hash160: chisel.hash160Hex
    };
    const method = methods[algorithm];

    if (!method) {
      throw new UsageError("Unknown hash algorithm: " + algorithm);
    }

    process.stdout.write((await method(hex)) + "\n");
    return;
  }

  if (command === "tx") {
    if (invocation.args.length !== 2 || invocation.args[0] !== "decode") {
      throw new UsageError("Usage: chisel tx decode HEX|@FILE|-");
    }

    const rawHex = await readTransactionSource(invocation.args[1]);
    printJson(chisel.parseRawTransactionDetailed(rawHex));
    return;
  }

  if (command === "account") {
    await commandAccount(chisel, invocation.args);
    return;
  }

  throw new UsageError("Unknown command: " + command);
}

main(process.argv.slice(2)).catch(function reportError(error) {
  const message = error && error.message ? error.message : String(error);
  process.stderr.write("chisel: " + message + "\n");

  if (error instanceof UsageError) {
    process.stderr.write("Run 'chisel help' for usage.\n");
    process.exitCode = 2;
  } else if (!process.exitCode) {
    process.exitCode = 1;
  }
});
