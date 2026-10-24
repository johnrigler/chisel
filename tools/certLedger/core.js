/* Narrow, hash-only CertLedger import. Does not access keys or broadcast. */
globalThis.ChiselCertLedger = (() => {
    'use strict';
    const ADDRESS = 'LMxCERTLEDGERzzzzzzzzzzzzzzzWTMCKs';
    const ROOT = 'LLLLLLLLLLLLLLLLLLLLLLLLLLLLXgkk2V';
    const STORAGE_KEY = 'chisel.pendingPayloadAnalyzer.v1';
    function digest(value) {
        if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new Error('Enter a full lowercase SHA-256 digest: exactly 64 hexadecimal characters.');
        return value;
    }
    function fromDraft(value) {
        if (!value || value.schema !== 'chisel-certledger-anchor-v1' || value.currency !== 'litecoin' || value.network !== 'mainnet') throw new Error('Expected a Litecoin mainnet CertLedger hash draft.');
        const hash = digest(value.sha256);
        if (value.opReturnAscii !== 'sha256:'+hash || value.namespace?.address !== ADDRESS) throw new Error('The draft hash, ASCII payload or CertLedger namespace disagrees.');
        // Ignore imported recipient lists, amounts, script bytes, key fields and extra metadata.
        return hash;
    }
    function payload(hash, amount) {
        digest(hash);
        if (!/^\d+\.\d{1,8}$/.test(amount)) throw new Error('Use an LTC tag amount with at most eight decimal places.');
        const [whole, fraction] = amount.split('.');
        const units = BigInt(whole)*100000000n + BigInt(fraction.padEnd(8,'0'));
        if (units < 547n || units > 100000n) throw new Error('Tag amount must be 0.00000547–0.00100000 LTC per tag.');
        return { schema:'chisel-certledger-anchor-v1', currency:'litecoin', replaceRecipients:true,
            opReturnAscii:'sha256:'+hash, recipients:[
                {address:ROOT,amount,outputType:'unspendable',note:'Litecoin general index'},
                {address:ADDRESS,amount,outputType:'unspendable',note:'CertLedger transport index'}
            ] };
    }
    return { ADDRESS, ROOT, STORAGE_KEY, digest, fromDraft, payload };
})();
