import {
    base58CheckDecode,
    bytesToHex,
    hexToBytes,
    litecoinP2pkhAddressFromPublicKeyHex,
    sha256HexText
} from "./keeper-common.js";

let ellipticModulePromise = null;

async function getElliptic() {
    if (!ellipticModulePromise) {
        ellipticModulePromise = (async function loadElliptic() {
            const mod = await import("../../vendor/elliptic-6-6-1.min.js");
            const elliptic = globalThis.elliptic || mod.default || mod;

            if (!elliptic || !elliptic.ec) {
                throw new Error("elliptic did not load");
            }

            return elliptic;
        })();
    }

    return await ellipticModulePromise;
}

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
    const elliptic = await getElliptic();
    const ec = new elliptic.ec("secp256k1");
    const key = ec.keyFromPrivate(privateKeyHex);
    return key.getPublic().encode("hex", Boolean(compressed));
}

export async function signTextWithPrivateKeyHex(text, privateKeyHex) {
    const elliptic = await getElliptic();
    const ec = new elliptic.ec("secp256k1");
    const key = ec.keyFromPrivate(privateKeyHex);
    const digestHex = sha256HexText(text);
    const signature = key.sign(digestHex, { canonical: true });

    return {
        digestHex,
        signatureHex: signature.toDER("hex")
    };
}

export async function verifyTextSignature(text, publicKeyHex, signatureHex) {
    const elliptic = await getElliptic();
    const ec = new elliptic.ec("secp256k1");
    const key = ec.keyFromPublic(publicKeyHex, "hex");
    const digestHex = sha256HexText(text);
    return key.verify(digestHex, signatureHex);
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
