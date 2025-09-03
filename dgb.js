

dgb = [];

dgb.debug = [];
dgb.check = [];
dgb.util = [];

dgb.check.validateVin = function(obj, onError = console.error) {
  if (typeof obj !== 'object' || obj === null) {
    onError('Error: vin must be a non-null object.');
    return false;
  }
  if (!('txid' in obj)) {
    onError('Error: vin is missing "txid" property.');
    return false;
  }
  if (typeof obj.txid !== 'string') {
    onError('Error: txid must be a string.');
    return false;
  }
  if (obj.txid.length !== 64) {
    onError(`Error: txid must be 64 characters long, got ${obj.txid.length}.`);
    return false;
  }
  if (!/^[0-9a-f]{64}$/i.test(obj.txid)) {
    onError('Error: txid must be a valid 64-character hex string.');
    return false;
  }
  if (!('vout' in obj)) {
    onError('Error: vin is missing "vout" property.');
    return false;
  }
  if (typeof obj.vout !== 'number' || !Number.isInteger(obj.vout)) {
    onError('Error: vout must be an integer.');
    return false;
  }
  if (obj.vout < 0) {
    onError('Error: vout must be non-negative.');
    return false;
  }
  return true;
}

dgb.util.byteHex = n => n.toString(16).padStart(2, '0')
dgb.util.privKey2Address = function privKey2Address(wif) {

  const raw = dgb.util.b58ToBytes(wif);

  const hex = dgb.util.bytesToHex(raw);
  const body = hex.slice(0, -8);
  const checksum = hex.slice(-8);
  const hash = dgb.util.sha256(dgb.util.sha256(body)).slice(0, 8);

  const prefix = body.slice(0, 2);
  const suffix = body.slice(-2);
  const compressed = suffix === '01';

  const privKey = compressed ? body.slice(2, -2) : body.slice(2);
    
  const ec = new elliptic.ec('secp256k1');
  const key = ec.keyFromPrivate(privKey);
  const pubKey = key.getPublic(compressed, 'hex');
      
  const pubHash = dgb.util.ripemd160(dgb.util.sha256(pubKey));
  const versioned = '1e' + pubHash; // 0x1e = Digibyte Mainnet pubkeyhash
  const checksum2 = dgb.util.sha256(dgb.util.sha256(versioned)).slice(0, 8);
  const addressHex = versioned + checksum2;
  const address = dgb.util.base58Encode(addressHex);

return {
    valid: checksum === hash,
    compressed,
    privKey,
    pubKey,
    pubHash,
    addressPrefix: '1e',
    versioned,
    checksum,
    address,
    addressHex,
    hex,
    body
  };
}

dgb.debug.loadPhrase = loadPhrase = function(pos=0) {

final = []
    
const mnemonic = "spider cat cross label end marine soup inflict scissors twelve gaze give";

// Step 1: get root HDNode from mnemonic
const root = ethers58.utils.HDNode.fromMnemonic(mnemonic);

// Step 2: derive Digibyte path (BIP44 / coin_type 20)
const dgbNode = root.derivePath("m/44'/20'/0'/0/" + pos);

privKey = dgbNode.privateKey.substr(2);
pubKey = dgbNode.publicKey.substr(2);
final.privKey = dgbNode.privateKey
final.pubkey = dgbNode.publicKey
const ec = new elliptic.ec('secp256k1');

const key = ec.keyFromPrivate(privKey);
const pubHash = dgb.util.ripemd160(dgb.util.sha256(pubKey));
const versioned = '1e' + pubHash; // 0x1e = Digibyte Mainnet pubkeyhash
const checksum = dgb.util.sha256(dgb.util.sha256(versioned)).slice(0, 8);

wifChecksum = dgb.util.sha256(dgb.util.sha256('80' + privKey + '01')).substr(0,8)    

return {   
    address : dgb.util.base58Encode('1e' + pubHash + checksum),
    pubHash : "0x" + pubHash,
    privKey : dgbNode.privateKey,
    pubKey  : dgbNode.publicKey,
    fingerprint : dgbNode.fingerprint,
    chainCode : dgbNode.chainCode,
    checksum : wifChecksum
    }
}

dgb.util.getMnemonicAddress = loadPhrase = function(mnemonic,pos=0) {

if( !mnemonic.length )   
   mnemonic = ethers58.Wallet.createRandom().mnemonic.phrase
    
const root = ethers58.utils.HDNode.fromMnemonic(mnemonic);
const dgbNode = root.derivePath("m/44'/20'/0'/0/" + pos);
const privKey = dgbNode.privateKey.substr(2);
const pubKey = dgbNode.publicKey.substr(2);
const ec = new elliptic.ec('secp256k1');

const key = ec.keyFromPrivate(privKey);
const pubHash = dgb.util.ripemd160(dgb.util.sha256(pubKey));
const versioned = '1e' + pubHash; // 0x1e = Digibyte Mainnet pubkeyhash
const checksum = dgb.util.sha256(dgb.util.sha256(versioned)).slice(0, 8);
const version = '80'
const compression = '01'    
const privKeyExp = version + privKey + compression
const wifChecksum = dgb.util.sha256(dgb.util.sha256(privKeyExp)).substr(0,8) 
const privKeyWif = dgb.util.base58Encode(privKeyExp + wifChecksum)

return {   
    address : dgb.util.base58Encode('1e' + pubHash + checksum),
    pubHash : "0x" + pubHash,
    node : dgbNode,
    privKeyWif
    }
}


dgb.util.hexToBytes = function hexToBytes(hex) {
  return Uint8Array.from(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
}

dgb.util.bytesToHex = function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

dgb.util.sha256 = function sha256(hex) {
  const bytes = dgb.util.hexToBytes(hex);
  const wordArray = CryptoJS.lib.WordArray.create(bytes);
  return CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
}

dgb.util.sha256b = function sha256(hex) {
    const raw = CryptoJS.enc.Hex.parse(hex);
    return CryptoJS.SHA256(raw).toString(CryptoJS.enc.Hex);
  }


dgb.util.dblSha = function dblSha(hex) {
  return dgb.util.sha256(dgb.util.sha256(hex));
}


dgb.util.ripemd160 = function(hex) {
  const bytes = dgb.util.hexToBytes(hex); 
  const wordArray = CryptoJS.lib.WordArray.create(bytes);
  return CryptoJS.RIPEMD160(wordArray).toString(CryptoJS.enc.Hex);
}

/*
RiPEMD16ceƒdHEXb q
  ∆0 ∆1 e ∂0rdHEXb; 
  ∆0 ∆4 e CryptoJS.lib.WordArray.create(bytes);
  ® CryptoJS.RiPEMD16c(wordArray).toString(CryptoJS.enc.Hex);
p

   ABCDEFGHJKLM <-- single char meaning 
   NPQRST 
   UVWXYZ 

const charMap = {
  a: 'A', b: 'B',
  c: 'C', v: '.', w: ':', x: ' ',
  y: '-', z: '#'
};

"1axbvcdy".replace(/[abcvwxyz]/g, c => charMap[c] || c);

function transformLine(u, a , d) {
  return u.replace(/e/g, '=')
          .replace(/d/g, '(')
          .replace(/b/g, ')')
          .replace(/q/g, '{')
          .replace(/p/g, '}')
          .replace(/∆(\d+)/g, (_, n) => a[Number(n)])
          .replace(/∂(\d+)/g, (_, n) => d[Number(n)])
}

*/

dgb.b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';


dgb.util.b58ToBytes = function base58ToBytes(str) {
    let bytes = [0];
    for (let i = 0; i < str.length; i++) {
      const val = dgb.b58.indexOf(str[i]);
      if (val === -1) throw 'Invalid Base58 character';

      for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
      bytes[0] += val;

      for (let j = 0; j < bytes.length; j++) {
        if (bytes[j] > 0xff) {
          if (bytes[j + 1] === undefined) bytes[j + 1] = 0;
          bytes[j + 1] += (bytes[j] / 256) | 0;
          bytes[j] %= 256;
        }
      }
    }

    // Handle leading 1s (which are zeros in base58)
    for (let i = 0; i < str.length && str[i] === '1'; i++) {
      bytes.push(0);
    }

    return new Uint8Array(bytes.reverse());
}

dgb.util.signRawTransaction = function(rawTxHex, privKeyHex) {
  const ec = new elliptic.ec('secp256k1');

  // Extract txid and vout from rawTx
  const version = rawTxHex.slice(0, 8);
  const vinCount = rawTxHex.slice(8, 10);
  const vinStart = 10;
  const txidLE = rawTxHex.slice(vinStart, vinStart + 64);
  const vout = rawTxHex.slice(vinStart + 64, vinStart + 72);
  const scriptLenOffset = vinStart + 72;
  const scriptLen = rawTxHex.slice(scriptLenOffset, scriptLenOffset + 2);

  if (scriptLen !== '00') throw new Error("Expected empty scriptSig in unsigned raw TX");

  const sequence = rawTxHex.slice(scriptLenOffset + 2, scriptLenOffset + 10);

  // Rebuild a simplified tx for signing (replace scriptSig with pubkeyScript for sighash)
  const pubkey = ec.keyFromPrivate(privKeyHex).getPublic(true, 'hex');
  const pubkeyHash = dgb.util.ripemd160(dgb.util.sha256(pubkey));
  const pkScript = '76a914' + pubkeyHash + '88ac'; // p2pkh
  const pkScriptLen = dgb.util.byteHex(pkScript.length / 2);

  const toHash =
    version +
    vinCount +
    txidLE +
    vout +
    pkScriptLen + pkScript +
    sequence +
    rawTxHex.slice(scriptLenOffset + 10, -8) + // all outputs and no locktime yet
    rawTxHex.slice(-8) +  // locktime
    '01000000'; // SIGHASH_ALL (4-byte little endian)

  const hashToSign = dgb.util.sha256(dgb.util.sha256(toHash));

  // Sign it
  const sig = ec.keyFromPrivate(privKeyHex).sign(hashToSign, { canonical: true });
  const der = sig.toDER('hex') + '01'; // Append SIGHASH_ALL
  const derLen = dgb.util.byteHex(der.length / 2);

  const pubLen = dgb.util.byteHex(pubkey.length / 2);
  const scriptSig = derLen + der + pubLen + pubkey;
  const fullScriptLen = dgb.util.byteHex(scriptSig.length / 2);

  // Insert scriptSig into rawTx at proper location
  const beforeScript = rawTxHex.slice(0, scriptLenOffset);
  const afterScript = rawTxHex.slice(scriptLenOffset + 2); // skip old '00'

  const finalRaw = beforeScript + fullScriptLen + scriptSig + afterScript;
  return finalRaw.toLowerCase();
};


dgb.util.base58Encode = function base58Encode(hex) {
  const base58chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  // Convert hex string to byte array
  const bytes = hex.match(/.{2}/g).map(b => parseInt(b, 16));

  // Convert byte array to a big number array (simulate big number division)
  let digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; ++j) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  // Handle leading zeros (each '00' byte == '1' in base58)
  let pad = 0;
  while (pad < bytes.length && bytes[pad] === 0) pad++;

  let result = '';
  for (let i = 0; i < pad; i++) result += '1';
  for (let i = digits.length - 1; i >= 0; i--) result += base58chars[digits[i]];

  return result;
}

dgb.util.pubKeyToAddress = function(pubKeyHex) {

  const pubBytes = Uint8Array.from(pubKeyHex.match(/.{2}/g).map(h => parseInt(h, 16)));

  const sha = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(pubBytes)).toString(CryptoJS.enc.Hex);
  const ripemd = CryptoJS.RIPEMD160(CryptoJS.enc.Hex.parse(sha)).toString(CryptoJS.enc.Hex);

  const version = '1e'; // Digibyte mainnet pubkeyhash prefix
  const payload = version + ripemd;

  const hash1 = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(payload)).toString(CryptoJS.enc.Hex);
  const hash2 = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(hash1)).toString(CryptoJS.enc.Hex);
  const checksum = hash2.slice(0, 8);

  const addressHex = payload + checksum;
  console.log(addressHex);
//  return dgb.util.base58Encode(addressHex);
}


dgb.util.wifDecode = function wifDecode(wif) {

  function sha256(hex) {
    const raw = CryptoJS.enc.Hex.parse(hex);
    return CryptoJS.SHA256(raw).toString(CryptoJS.enc.Hex);
  }

  const raw = dgb.util.b58ToBytes(wif);
  const hex = dgb.util.bytesToHex(raw);

  const body = hex.slice(0, -8);
  const checksum = hex.slice(-8);
  const hash = dgb.util.sha256b(dgb.util.sha256b(body)).slice(0, 8);

  const prefix = body.slice(0, 2);
  const suffix = body.slice(-2);
  const compressed = suffix === '01';

  const privKey = compressed ? body.slice(2, -2) : body.slice(2);

  const ec = new elliptic.ec('secp256k1');
  const key = ec.keyFromPrivate(privKey);
  const pub = key.getPublic(compressed, 'hex');

  const pubHash = dgb.util.ripemd160(dgb.util.sha256(pub));
  const versioned = '1e' + pubHash; // 0x1e = Digibyte Mainnet pubkeyhash
  const checksum2 = dgb.util.sha256(dgb.util.sha256(versioned)).slice(0, 8);
  const addressHex = versioned + checksum2;
  const address = dgb.util.base58Encode(addressHex);

return {
    valid: checksum === hash,
    compressed,
    privKey,
    pubKey: pub,
    pubHash,
    addressPrefix: '1e',
    address,
    hex,
    body,
    check: checksum
  };
}

dgb.util.verifySignature = function verifySignature(msgHex, sigHex, pubHex) {
  // Create curve context
  const ec = new elliptic.ec('secp256k1');

  // Remove sighash flag (last byte)
  const der = sigHex.slice(0, -2);

  // Reconstruct public key
  const pubKey = ec.keyFromPublic(pubHex, 'hex');

  // Hash message (assumed hex input and hex output)
  const hash = dgb.util.sha256(msgHex); // output: hex

  // Verify (elliptic can take DER sig as hex directly)
  return pubKey.verify(hash, der);
}

dgb.util.signMessage = function signMessage(msgHex, privKeyHex) {
  
  // Convert private key to keypair using elliptic
  const ec = new elliptic.ec('secp256k1');
  const key = ec.keyFromPrivate(privKeyHex);

  // Hash the message (typically a tx or message hash)
  const hash = sha256(msgHex); // assumed to return a hex string

  // Sign the hash
  const sig = key.sign(hash, { canonical: true });

  // DER-encode + add hash type 0x01 (SIGHASH_ALL)
  const derHex = sig.toDER('hex') + '01';

  return derHex;
}

dgb.util.magicPrefixHash = function(messageHex) {
  const prefix = "DigiByte Signed Message:\n";
  const prefixBytes = Array.from(new TextEncoder().encode(prefix));
  const msgBytes = dgb.util.hexToBytes(messageHex);
  const lenBytes = [msgBytes.length];

  const full = prefixBytes.concat(lenBytes, msgBytes);
  const fullHex = dgb.util.bytesToHex(full);

  return dgb.util.sha256(dgb.util.sha256(fullHex));
}

dgb.util.signMessageCompact = function(messageHex, privKeyHex, compressed=true) {
  const ec = new elliptic.ec('secp256k1');
  const key = ec.keyFromPrivate(privKeyHex);
  const hash = dgb.util.magicPrefixHash(messageHex);
  const sig = key.sign(hash, { canonical: true });

  // Recoverable signature
  const recoveryParam = sig.recoveryParam; // 0-3
  const headerByte = 27 + recoveryParam + (compressed ? 4 : 0);
  const r = sig.r.toArray('be', 32);
  const s = sig.s.toArray('be', 32);

  const sigBytes = [headerByte].concat(r, s);
  const base64sig = btoa(String.fromCharCode.apply(null, sigBytes));
  return base64sig;
}

dgb.util.signVinDetailed = function(rawTxHex, privHex, pubHex) {
  const ec = new elliptic.ec('secp256k1');
  const key = ec.keyFromPrivate(privHex);

  // Step 1: append sighash type (01) to tx before hashing
  const sighashType = '01000000'; // SIGHASH_ALL (little endian)
  const txToSign = rawTxHex + sighashType;

  // Step 2: hash transaction
  const hash = dgb.util.sha256(dgb.util.sha256(txToSign));

  // Step 3: sign the hash
  const sig = key.sign(hash); // not forcing canonical, match digibyted more closely

  const derHex = sig.toDER('hex');
  const derWithHashType = derHex + '01'; // append SIGHASH_ALL

  const derLen = derWithHashType.length / 2;
  const pubKeyLen = pubHex.length / 2;

  const scriptSigLen = derLen + 1 + pubKeyLen; // sig push + pub push
  const scriptSigHex =
    dgb.util.byteHex(derLen) + derWithHashType +
    dgb.util.byteHex(pubKeyLen) + pubHex;

  // Step 4: Reconstruct full signed tx (replace 00 with actual scriptSig)
  const preScript = rawTxHex.slice(0, rawTxHex.indexOf('00'));
  const postScript = rawTxHex.slice(rawTxHex.indexOf('00') + 2);
  const fullTx = preScript + dgb.util.bytesToHex(scriptSigHex.length / 2) + scriptSigHex + postScript;

  return {
    r: sig.r.toString(16),
    s: sig.s.toString(16),
    der: derHex,
    derWithHashType,
    pubKey: pubHex,
    scriptSig: scriptSigHex,
    fullInput: preScript + dgb.util.byteHex(scriptSigHex.length / 2) + scriptSigHex + postScript,
    signedTx: fullTx,
  };
}


/////////////////////////////////////////////////////////////////////////////////////

dgb.helper = []

dgb.util.start = function() {
dgb.query("listunspent").then( unspent =>
{       
ux.renderObjectTable('select', unspent.result, ['address','amount'], selected => {
    dgb.utxo = selected;
tablet.push(dgb.utxo2change(dgb.utxo[0],3,.1)) 
  console.log('dgb.utxo:', selected);
  dgb.raw = dgb.helper.buildRaw( [ [ dgb.utxo[0] ], tablet ] )
  console.log(tablet);
    select.innerHTML = "";
    })
  })
}

dgb.util.makeTablet = function() {

tablet = [];

[
    "DDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    "DDoooooooooooooooooooooooooD",
    "DDoDDDDDDDDDDDDDDDDDDDDDDDoD",
    "DDoooooooooooDoooooooooooooD",
    "DDDDDDDDDDDDDoDDDDDDDDDDDDDD"
   ].forEach( x => unspendable(x)
    .then( x => { 
                tablet.push({[x]:0.0000546})
                })
    )
}


dgb.helper.u32LE = function u32LE(n) {
  return ('00000000' + (n >>> 0).toString(16)).slice(-8).match(/../g).reverse().join('');
}

dgb.helper.u64LE = function u64LE(n) {
  n = BigInt(n);
  var hex = n.toString(16).padStart(16, '0');
  return hex.match(/../g).reverse().join('');
}

dgb.helper.varInt = function varInt(n) {
  if (n < 0xfd) return dgb.helper.toHex(n, 1);
  if (n <= 0xffff) return 'fd' + dgb.helper.toHex(n, 2);
  if (n <= 0xffffffff) return 'fe' + dgb.helper.toHex(n, 4);
  return 'ff' + dgb.helper.toHex(n, 8);
}

dgb.helper.toHex = function toHex(n, bytes) {
  var hex = n.toString(16).padStart(bytes * 2, '0');
  return hex.match(/../g).reverse().join('');
}

dgb.helper.signTXParts = function signTxParts(rawTxHex, privKeyHex) {
  const versionHex = rawTxHex.slice(0, 8);
  const locktimeHex = rawTxHex.slice(-8);

  // ----- Extract inputs -----
  const vinCount = parseInt(rawTxHex.slice(8, 10), 16);
  if (vinCount !== 1) throw 'Only single input supported';
  const vinStart = 10;
  const vinRaw = rawTxHex.slice(vinStart, vinStart + 72); // 32 bytes txid + 4 vout + 1 scriptLen + 4 sequence (no script)
  const vinTxidLE = vinRaw.slice(0, 64); // txid LE
  const vinVout = vinRaw.slice(64, 72);
  const vinSeq = vinRaw.slice(74); // skip scriptLen byte

  // ----- Extract outputs -----
  const voutCountIndex = vinStart + 72;
  const voutCount = parseInt(rawTxHex.slice(voutCountIndex, voutCountIndex + 2), 16);
  const voutStart = voutCountIndex;
  const locktimeStart = rawTxHex.length - 8;
  const passthroughVoutHex = rawTxHex.slice(voutStart, locktimeStart);

  // ----- Build preimage for sighash -----
  const sighashPreimage = rawTxHex.slice(0, locktimeStart) + "01000000"; // append SIGHASH_ALL
  const hash = dgb.util.sha256(dgb.util.sha256(sighashPreimage));

  // ----- Sign the double hash -----
  const sigDerPlus01 = dgb.util.signMessage(hash, privKeyHex); // returns DER + '01'

  // ----- Derive pubkey from privKeyHex -----
  const ec = new elliptic.ec('secp256k1');
  const pubKeyHex = ec.keyFromPrivate(privKeyHex).getPublic(true, 'hex');

  // ----- Build scriptSig -----
  const sigPush = (sigDerPlus01.length / 2).toString(16).padStart(2, '0') + sigDerPlus01;
  const pubPush = (pubKeyHex.length / 2).toString(16).padStart(2, '0') + pubKeyHex;
  const scriptSig = sigPush + pubPush;
  const scriptLen = (scriptSig.length / 2).toString(16).padStart(2, '0');

  const signedVinHex = vinTxidLE + vinVout + scriptLen + scriptSig + vinSeq;

  // ----- Final assembly -----
  const magic = hash; // already double-sha256 hex

  return [versionHex, signedVinHex, passthroughVoutHex, locktimeHex];
}


dgb.helper.buildRaw = function(args, version, locktime) {
  if (typeof version === 'undefined') version = 2;
  if (typeof locktime === 'undefined') locktime = 0;

  var ins = args[0];
  var outs = args[1];
  var hex = dgb.helper.u32LE(version); // version

  // inputs
  hex += dgb.helper.varInt(ins.length);
  for (var i = 0; i < ins.length; i++) {
  console.log(ins);
  const valid = dgb.check.validateVin(ins[i], msg => alert(msg));
  if(!valid) return false;
    var vin = ins[i];
    hex += vin.txid.match(/../g).reverse().join(''); // txid LE
    hex += dgb.helper.u32LE(vin.vout);
    hex += '00'; // empty scriptSig
    hex += dgb.helper.u32LE(0xffffffff); // sequence
  }

  // outputs
  altOut = []
  hex += varInt(outs.length);
  for (var j = 0; j < outs.length; j++) {
    var o = outs[j];

    if (typeof o.data !== 'undefined') {
      var dataHex = o.data.toLowerCase();
      var opReturn = '6a' + dgb.helper.varInt(dataHex.length / 2) + dataHex;
      hex += dgb.helper.u64LE(0); // zero-value
      hex += dgb.helper.varInt(opReturn.length / 2) + opReturn;
    } else {
      var addr = Object.keys(o)[0];
      var sats = Math.round(o[addr] * 1e8);

      var pk;
      if (addr[0] === 'S') {
        pk = p2shScript(addr); // fake P2SH
      } else {
        pk = p2pkhScript(addr); // default to P2PKH
      }

      altOut += dgb.helper.u64LE(sats);
      hex += dgb.helper.u64LE(sats);
      altOut += dgb.helper.varInt(pk.length / 2) + pk;
      hex += dgb.helper.varInt(pk.length / 2) + pk;
    }
  }

  hex += dgb.helper.u32LE(locktime);
  altOut += dgb.helper.u32LE(locktime);
  console.log(altOut);
  return  hex.toLowerCase();
};

/////////////////////////////////////////////////////////////////////////////////////

outputs = [];

dgb.chainz = [];
dgb.chainz.txinfo =   hash => fetch("https://chainz.cryptoid.info/dgb/api.dws?q=txinfo&t=" + hash).then( x => x.json())
dgb.chainz.txinfo =   hash => fetch("https://chainz.cryptoid.info/dgb/api.dws?key=2c8cf5f8ed4e&q=txinfo&t=" + hash).then( x => x.json())
dgb.chainz.api =   ( q,hash ) => fetch("https://chainz.cryptoid.info/dgb/api.dws?key=2c8cf5f8ed4e&q=" + q + "&t=" + hash).then( x => x.json())


//  const sha256 = b => CryptoJS.SHA256(CryptoJS.lib.WordArray.create(b)).words
  //    .reduce((a,w)=>a.concat([(w>>>24)&255,(w>>>16)&255,(w>>>8)&255,w&255]),[]);
  const dblSha256 = b => sha256(Uint8Array.from(sha256(b)));

function asciiToHex(str) {
  return Array.from(str).map(c =>
    c.charCodeAt(0).toString(16).padStart(2, '0')
  ).join('');
}



/*

D5*		DE		DP		SQ		SZ		Si
D6		DF		DQ		SR		Sa		Sj
D7		DG		DR		SS		Sb		Sk*
D8		DH		DS		ST		Sc	
D9		DJ		DT		SU		Sd
DA		DK		DU*		SV		Se
DB		DL		SM*		SW		Sf
DC		DM		SN		SX		Sg
DD		DN		SP		SY		Sh

* partial, ignore

*/

dgb.thunder = 'DDDDDDDDDDDDDDDDDDDDDDDDDDDD5SVJPi'

dgb.query = function(method, params = []) {
  // if called with no arguments → print usage help
  if (arguments.length === 0) {
    console.log('Usage: dgb("rpcMethod", [param1, param2, ...])');
    fetch("http://127.0.0.1:7788").then( x => x.json() ).then ( x => console.log(x) )
  
    console.log('Example: dgb("getblockhash", [21700539])');
    return Promise.resolve();      // nothing to fetch
  }

  if (!Array.isArray(params)) {
    throw new Error('params must be an array, e.g. [21700539]');
  }

  return fetch('http://127.0.0.1:7788/', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      jsonrpc: '1.0',
      id: 'web',
      method,
      params
    })
  }).then(r => r.json());
}

dgb.help = function( parms = "") 
   { 
   dgb.query("help", [parms])
         .then( x => x.result )
         .then( x => x)
         .then( console.log ) 
   }

dgb.gbc = () => dgb.query("getblockcount").then(r => r.result);
dgb.gbh = height => dgb.query("getblockhash", [height]).then(r => r.result);
dgb.gb_0 = hash => dgb.query("getblock", [hash,0]).then(r => r.result);
dgb.gb_1 = hash => dgb.query("getblock", [hash,1]).then(r => r.result);
dgb.gb_2 = hash => dgb.query("getblock", [hash,2]).then(r => r.result);
dgb.grt_0 = hash => dgb.query("getrawtransaction",[hash,0]).then( r => r.result);
dgb.grt_1 = hash => dgb.query("getrawtransaction",[hash,1]).then( r => r.result);
dgb.feerate = () => dgb.query("estimatesmartfee",[6]).then( x => x.result ).then( x => x.feerate )
dgb.usage = () => dgb.query()

dgb.utxo2change = function utxo2change (x,cnt,fee) {
    burn=(0.0000546*cnt)
    
 return  {[x.address]:x.amount-burn-(fee*cnt)}
}
 

dgb.findUTXO = () => dgb.query("listunspent")
  .then(x => x.result)
  .then(results => {
    return results
      .filter(utxo => utxo.label && utxo.label.startsWith("extern"))
      .map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout
      }));
  }); 

// outputs.push("{data: " + toHex("Web3 must be hacked into POW ledgers.") + "}" )

dgb.createRawTabletTx = function(utxo, tablet, opret) {
  const toHex = (s) => {
    if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) return s.toLowerCase();
    return Array.from(new TextEncoder().encode(s))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const opretHex = toHex(opret);
  const outputs = [];

  const burnValue = 0.00001132;

  tablet.forEach(addr => {
    const normalized = addr.trim();
    if (
      !normalized.toLowerCase().startsWith("change") &&
      !normalized.toLowerCase().includes("instruction")
    ) {
      const obj = {};
      obj[normalized] = burnValue;
      outputs.push(obj);
    }
  });

  // Final OP_RETURN
  outputs.push({ data: opretHex });

  return [
    utxo,  // must be array of UTXO objects
    outputs  // outputs as array of single-key objects
  ];
}

dgb.chainz = [];
dgb.chainz.txinfo =   hash => fetch("https://chainz.cryptoid.info/dgb/api.dws?q=txinfo&t=" + hash).then( x => x.json())
dgb.chainz.txinfo =   hash => fetch("https://chainz.cryptoid.info/dgb/api.dws?key=2c8cf5f8ed4e&q=txinfo&t=" + hash).then( x => x.json())
dgb.chainz.api =   ( q,hash ) => fetch("https://chainz.cryptoid.info/dgb/api.dws?key=2c8cf5f8ed4e&q=" + q + "&t=" + hash).then( x => x.json())


// dgb.chainz.getbalance = () => fetch("https://chainz.cryptoid.info/dgb/api.dws?key=2c8cf5f8ed4e&q=getbalance&a=DATUGu64TCU4qD7vDC5hUYmyfRmEJcGM3J").then( x => x.json(())

/* ── helper: best‑effort hex → UTF‑8 ──────────────────────────────── */
function hexToUtf8(hex) {
  if (!hex || hex.length % 2) return null;           // must be even length

  /* -------- Node (has Buffer) -------------------- */
  if (typeof Buffer !== 'undefined') {
    try { return Buffer.from(hex, 'hex').toString('utf8'); }
    catch { return null; }
  }

  /* -------- Browser TextDecoder ------------------ */
  if (typeof TextDecoder !== 'undefined') {
    try {
      const bytes = new Uint8Array(hex.match(/../g).map(b => parseInt(b, 16)));
      return new TextDecoder('utf-8').decode(bytes);
    } catch { /* fall through */ }
  }

  /* -------- Fallback (old browsers) -------------- */
  try {
    // create a percent‑encoded string and run decodeURIComponent
    const escaped = hex.match(/../g).map(b => '%' + b).join('');
    return decodeURIComponent(escaped);
  } catch { return null; }
}


/* ── dgb.parseTx ─────────────────────────────────────────── */
dgb.parseTx = hash =>
  dgb.grt_1(hash).then(tx =>
    tx.vout.map(out =>
      out.value === 0
        ? {
            type : 'op_return',
            hex  : out.scriptPubKey.hex.slice(4),          // data bytes
            text : hexToUtf8(out.scriptPubKey.hex.slice(4))// decoded UTF‑8 (may be null)
          }
        : {
            type    : 'output',
            address : out.scriptPubKey.address,
            value   : out.value
          }
    )
  );


function utf8ToHex(str) {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}


/*
https://digibyteblockexplorer.com/address/DBxYoUTUBEvCoMzzzzzzzzzzzzzzZ31xMU

[
  {
    "type": "output",
    "address": "DBx…",
    "value": 0.00006
  },
  {
    "type": "op_return",
    "hex": "48656c6c6f2c20e4b896e7958c20f09f9883",
    "text": "Hello, 世界 😊"
  }
]

*/
/**
 * jq‑style JSON logger for browser DevTools.
 * Usage: jqLog(objOrJsonString);
 */
function jqLog(input, scheme = {}) {
  // default jq‑inspired palette (tweak via second arg)
  const c = {
    key:      'color:#8ae234',      // bright green
    string:   'color:#729fcf',      // blue
    number:   'color:#fce94f',      // yellow
    boolean:  'color:#ad7fa8',      // magenta
    null:     'color:#ef2929',      // red
    punct:    'color:#888',         // gray
    ...scheme
  };

  // stringify once; indent = 2
  const src = typeof input === 'string' ? input : JSON.stringify(input, null, 2);

  // regex finds every structural/primitive token
  const rx = /"(\\u[\da-f]{4}|\\[^u]|[^\\"])*"(?=:)|"(\\u[\da-f]{4}|\\[^u]|[^\\"])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/gi;

  const seg = [];       // [%cTEXT, ...]
  const sty = [];       // CSS per %c

  let i = 0;
  src.replace(rx, (m, _, __, idx) => {
    // push inter‑token punctuation (whitespace, braces, commas …)
    if (i < idx) {
      seg.push('%c' + src.slice(i, idx));
      sty.push(c.punct);
    }

    // classify matched token
    let s;
    if (m[0] === '"') {
      s = m.endsWith(':') ? c.key : c.string;
    } else if (m === 'true' || m === 'false') {
      s = c.boolean;
    } else if (m === 'null') {
      s = c.null;
    } else {
      s = c.number; // number
    }

    seg.push('%c' + m);
    sty.push(s);

    i = idx + m.length;
  });

  // trailing punctuation
  if (i < src.length) {
    seg.push('%c' + src.slice(i));
    sty.push(c.punct);
  }

  console.log(seg.join(''), ...sty);
}

/*
fetch("http://127.0.0.1:8080/input1.json").then( x => x.text())
     .then( x => { 
         jqLog(x)
         txArgs = JSON.parse(x) 
         } )
*/
/* ── helpers ----------------------------------------------------------- */

dgb.filterObviously = function filterObviously(data) {
  const utxos = Array.isArray(data) ? data : data.result;
  return utxos.filter(utxo => !/^D[ABCDE]x/.test(utxo.address));
}

function p2pkhScript(address){
  const hex = b58decode(address);
  const hash160 = hex.slice(2,-8);               // drop version + checksum
  return '76a914'+hash160+'88ac';                // OP_DUP OP_HASH160 <20B> OP_EQUALVERIFY OP_CHECKSIG
}

function p2shScript(addr) {
  const hash160 = b58checkDecode(addr).hex;
  return 'a914' + hash160 + '87';
}

function p2pkhScriptUnvalidated(addr) {
  // decode base58check without validating prefix
  const b58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt(0);
  for (let c of addr) {
    num = num * 58n + BigInt(b58.indexOf(c));
  }

  let hex = num.toString(16).padStart(50, '0'); // 25 bytes = 50 hex chars
  let pubKeyHash = hex.slice(2, 42);            // skip version (1 byte) and checksum (4 bytes)
  return '76a914' + pubKeyHash + '88ac';        // OP_DUP OP_HASH160 <hash> OP_EQUALVERIFY OP_CHECKSIG
}

/* ── serializer -------------------------------------------------------- */
dgb.buildRaw = function buildRaw(args, version=2, locktime=0){
  const [ins, outs] = args;
  let hex = u32LE(version);                      // version

  /* inputs */
  hex += varInt(ins.length);
  for(const vin of ins){
//    if (!dgb.check.validateVin(input, msg => alert(msg))) return false;
    hex += vin.txid.match(/../g).reverse().join(''); // txid LE
    hex += u32LE(vin.vout);
    hex += '00';                                    // empty scriptSig
    hex += u32LE(0xffffffff);
  }

  /* outputs */
  hex += varInt(outs.length);
  outs.forEach(o=>{
    if(o.data!==undefined){                        // OP_RETURN
      const dataHex   = o.data.toLowerCase();
      const opReturn  = '6a'+varInt(dataHex.length/2)+dataHex;
      hex += u64LE(0n);                            // value = 0
      hex += varInt(opReturn.length/2) + opReturn;
    }else{
      const addr = Object.keys(o)[0];
      const sats = BigInt(Math.round(o[addr]*1e8));
  //    const pk   = p2pkhScript(addr);
  //    const pk = p2pkhScriptUnvalidated(addr);

   let pk;
    if(addr[0] === 'S'){
      pk = p2shScript(addr);  // fake it, doesn't support actual "S" 
      } else {
      pk = p2pkhScript(addr); // default to P2PKH
      }


      hex += u64LE(sats);
      hex += varInt(pk.length/2) + pk;
    }
  });

  hex += u32LE(locktime);
  return hex.toLowerCase();
}

dgb.show = function(tx = "11c6cb1998c665f2a9bd79fd0547994ae132a7ac6ef98aeff57069b60269b9d3") {
dgb.grt_1(tx)
  .then(result => {
    const div = document.querySelector("div");
    div.innerHTML = ""; // clear existing

    const pre = document.createElement("pre");
    const lines = [];

    for (let key in result) {
      if (key === "blockhash") {
        const lineStart = `"${key}": "`;
        const lineEnd = '",\n';

        // Static text node for start of line
        lines.push(document.createTextNode(lineStart));

        // Link node
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = result[key];
        link.style.color = "blue";
        link.onclick = (e) => {
          e.preventDefault();
          dgb.gb_2(result[key])
            .then(res => {
              div.innerHTML = "<pre>" + JSON.stringify(res, null, 2) + "</pre>";
            })
            .catch(err => {
              div.innerText = "Error: " + err;
            });
        };
        lines.push(link);

        // Static text node for end of line
        lines.push(document.createTextNode(lineEnd));
      } else {
        lines.push(document.createTextNode(`"${key}": "${result[key]}",\n`));
      }
    }

    lines.forEach(line => pre.appendChild(line));
    div.appendChild(pre);
  })
  .catch(err => {
    document.querySelector("div").innerText = "Error: " + err;
  });
}

dgb.query("listunspent").then( result => dgb.utxo = dgb.filterObviously(result) )

/* ── run & verify ------------------------------------------------------ */
/*
fetch("http://127.0.0.1:8080/blobimge.json").then( x => x.text())
     .then( x => {
         jqLog(x)
         txArgs = JSON.parse(x)
         const raw = dgb.buildRaw(txArgs);
         console.log(raw);
         })
*/
// 0200000001630f9c5472a8156594f5a0e45676be75b69cd817bc74007e7b807ee1589234a30000000000ffffffff0370170000000000001976a9144ab91aa91c29b570f982eb485ee909eb0e84e0b088ac70170000000000001976a91455c0355b8a6c08885bf229c31c9a0cd538c2e9b588ac0000000000000000036a010000000000


/*

dgb.query("createrawtransaction",[ vin,vout ])
.then(response => {
  if (response.error) {
    console.error("RPC Error:", response.error.message);
  } else {
    console.log(response.result);
  }
})
.catch(err => {
  console.error("Transport error:", err);
});

*/


async function shoctal(input) {
  // 1. Compute SHA-1 hash (shasum is SHA-1)
  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // 2. Get first 2 bytes (4 hex chars)
  const firstTwoBytes = hashArray.slice(0, 2);
  const hexStr = firstTwoBytes.map(b => b.toString(16).padStart(2, '0')).join('');

  // 3. Convert hex to number
  const num = parseInt(hexStr, 16);

  // 4. Convert to octal string
  const octalStr = num.toString(8);

  // 5. Shift octal digits +2 (wrap in 0-7 range, but your tr changes '0->2', '1->3' ... '7->9')
  // Your tr '01234567' -> '23456789' maps digits:
  // '0'->'2', '1'->'3', '2'->'4', '3'->'5', '4'->'6', '5'->'7', '6'->'8', '7'->'9'

  const shiftedOctal = octalStr.split('').map(d => {
    const digit = parseInt(d, 8);
    return (digit + 2).toString(); // no wrap, goes up to 9 (which is decimal digit)
  }).join('');

  // 6. Prefix each digit with '02' and join with spaces or newlines as in your echo
  const result = shiftedOctal.split('').map(d => '02' + d).join(' ');

  return result;
}

dgb.util.getUTXOs = function getUTXOs(transactions, filterAddress) {
  const spent = new Set();

  // Mark all spent outputs
  transactions.forEach(tx => {
    tx.vin.forEach(input => {
      spent.add(input.txid + ':' + input.vout);
    });
  });

  // Collect unspent outputs, optionally filter by address
  const utxos = [];
  transactions.forEach(tx => {
    tx.vout.forEach((out, index) => {
      const outpoint = tx.txid + ':' + index;
      if (!spent.has(outpoint)) {
        if (!filterAddress || out.scriptpubkey_address === filterAddress) {
          utxos.push({
            txid: tx.txid,
            vout: index,
            address: out.scriptpubkey_address,
            value: out.value
          });
        }
      }
    });
  });

  return utxos;
}

dgb.util.digiAddress = async function digiAddress( address ) {
    url = `https://digiexplorer.info/api/address/${address}/txs`;
    return await fetch(url).then( x => x.json() )
              .then( x => dgb.util.getUTXOs(x, address ))
              .then( x => utxo = x)
}

dgb.util.digiTX = async function digiTx( tx ) {
    url = `https://digiexplorer.info/api/tx/${tx}`;
    return await fetch(url).then( x => x.json() )
}

