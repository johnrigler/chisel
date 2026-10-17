import {
    base58CheckDecode,
    bytesToHex,
    hexToBytes,
    litecoinP2pkhAddressFromPublicKeyHex,
    sha256HexText
} from "./keeper-common.js";

import * as noble from "../../vendor/noble-secp256k1-3.2.0.js";
import "../../chisel.secp256k1.js";
const der = globalThis.ChiselSecp256k1;

export async function privateKeyFromLitecoinWif(wif) {
    const payload = base58CheckDecode(wif);
    const prefix = payload[0];

    if (prefix !== 0xb0 && prefix !== 0xef && prefix !== 0x80) {
        throw new Error(`unexpected WIF prefix 0x${prefix.toString(16)}`);
    }

    let compressed = false;
    let keyBytes;

    if (payload.length === 34 && payload[33] === 0x01) {
        compressed = true;
        keyBytes = payload.slice(1, 33);
    } else if (payload.length === 33) {
        keyBytes = payload.slice(1, 33);
    } else {
        throw new Error("unsupported WIF length");
    }

    return {
        privateKeyHex: bytesToHex(keyBytes),
        compressed,
        prefix
    };
}

export async function publicKeyHexFromPrivateKeyHex(privateKeyHex, compressed = true) {
    return bytesToHex(noble.getPublicKey(hexToBytes(privateKeyHex), Boolean(compressed)));
}

export async function signTextWithPrivateKeyHex(text, privateKeyHex) {
    const digestHex = sha256HexText(text);
    const signature = await noble.signAsync(hexToBytes(digestHex), hexToBytes(privateKeyHex), { prehash: false, lowS: true, format: "compact" });
    return { digestHex, signatureHex: bytesToHex(der.compactToDer(signature)) };
}

export async function verifyTextSignature(text, publicKeyHex, signatureHex) {
    try {
        return noble.verify(der.derToCompact(hexToBytes(signatureHex)), hexToBytes(sha256HexText(text)), hexToBytes(publicKeyHex), { prehash: false, lowS: true, format: "compact" });
    } catch (error) { return false; }
}

export async function signChallengeWithLitecoinWif(challenge, payloadHash, wif) {
    const { privateKeyHex, compressed } = await privateKeyFromLitecoinWif(wif);
    const publicKeyHex = await publicKeyHexFromPrivateKeyHex(privateKeyHex, compressed);
    const address = litecoinP2pkhAddressFromPublicKeyHex(publicKeyHex);
    const message = [
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
    const signed = await signTextWithPrivateKeyHex(message, privateKeyHex);

    return {
        address,
        publicKeyHex,
        signatureHex: signed.signatureHex,
        digestHex: signed.digestHex,
        message
    };
}

export function assertHexLike(value, name) {
    try {
        hexToBytes(value);
    } catch (err) {
        throw new Error(`${name} is not valid hex: ${err.message}`);
    }
}
