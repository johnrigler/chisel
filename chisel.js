
function defineConstants(constMap) {
    for (const [name, value] of constMap) {
        const desired = (typeof value === 'function') ? value() : value;

        if (typeof globalThis[name] === 'undefined') {
            globalThis[name] = desired;
        } else if (globalThis[name] !== desired) {
            console.warn(`Constant "${name}" already defined with a different value`, {
                current: globalThis[name],
                desired
            });
        }
    }
}

defineConstants([
    ['B58',       '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'],
    ['b58_dcmap', `123456789abcdefghjklmnpqrstuvwxyz!)0(=/',i;?"_o}{@+|*.: -~`],
    ['IDX', () => Object.fromEntries([...B58].map((c, i) => [c, i]))],
    ['BASE', () => 58n ** 6n],
    ['MOD32', () => 2n ** 32n],
    ['MCD', `c123456789ABCDEFGHiJKLMNoPQRSTUVWXYZabdefghjkmnpqrstuvwxyz`],
    ['BFF', `0123456789abcdefghijklmnopqrstuvwxyz!)(=/',;?"_}{@+|*.: -~`],
]);

const toBigInt = bytes => bytes.reduce((n,b)=> (n<<8n) + BigInt(b), 0n);

const u32LE = n => n.toString(16).padStart(8,'0').match(/../g).reverse().join('');
const u64LE = n => n.toString(16).padStart(16,'0').match(/../g).reverse().join('');
sha = buf => crypto.subtle.digest('SHA-256', buf).then(b => new Uint8Array(b));



chisel = []
chisel.nodeProxy = []

chainz = []
chainz.apiKey = "2c8cf5f8ed4e"
chainz.query =  () => fetch(`https://chainz.cryptoid.info/explorer/api.dws?q=summary`).then( x => x.json())



// dgb.chainz.getbalance = () => fetch("https://chainz.cryptoid.info/dgb/api.dws?key=2c8cf5f8ed4e&q=getbalance&a=DATUGu64TCU4qD7vDC5hUYmyfRmEJcGM3J").then( x => x.json(())



fetch("https://chainz.cryptoid.info/explorer/api.dws?q=summary").then( x => x.json())

chisel.nodeProxy.fileLoad = async function fileLoad(name) {
  return await fetch('http://localhost:7799/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: name })
  }).then( x => x.json() )
};

chisel.nodeProxy.fileSave = async function fileSave(data,name)
    {
    await fetch("http://localhost:7799/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: name, data: data })
    })
}

chisel.nodeProxy.fileWrite = async function fileWrite(data,file) {
    if(typeof(data) == 'object')
    {
    var _data = JSON.stringify(data)
    type = "application/json";
    }
    else
    {
    var _data = data;
    type = "text/plain";
    }
    await fetch(`http://localhost:7799/save2?filename=${file}`, {
      method: "POST",
      headers: { "Content-Type": type },
      body: _data
    });
}

chisel.nodeProxy.fileRead = async function fileRead(name) {
  return await fetch('http://localhost:7799/load', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ filename: name })
  })
};      

chisel.nodeProxy.fileList = async function fileList(dirname = "") {

return await fetch("http://localhost:7799/list", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dirname: dirname })
}).then(r => r.json())

}

chisel.nodeProxy.fileDelete = async function fileDelete(file) {
  await fetch("http://localhost:7799/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file })
  }).then(r => r.json());
}

chisel.nodeProxy.mkDir = async function mkDir(dir) {
  await fetch("http://localhost:7799/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dirname: dir })
  }).then(r => r.json());
}

chisel.nodeProxy.rmDir = async function rmDir(dir) {
  await fetch("http://localhost:7799/rmdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dirname: dir })
  }).then(r => r.json());
}


chisel.drawCharTabletImage = function drawCharTabletImage(output, canvas, scale = 8) {
  if (!Array.isArray(output) || output.length === 0) return;

  const rows = output.length;
  const cols = output[0].length - 8; // exclude first 2 and last 6 chars
// console.log(canvasId);

 // const canvas = document.getElementById(txid);
  console.log(canvas);
  const ctx = canvas.getContext('2d');

console.log(canvas, canvas instanceof HTMLCanvasElement);
console.log(ctx);

    
  canvas.width = cols * scale;
  canvas.height = rows * scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < rows; y++) {
    const line = output[y];
    for (let x = 0; x < cols; x++) {
      const ch = line[x + 2]; // skip first 2 chars
      const rgb = colorMap0[ch] || [0, 0, 0];
      ctx.fillStyle = `rgb(${rgb.join(',')})`;

//        ctx.fillStyle = `rgb(${(x*30)%255}, ${(y*30)%255}, 150)`;
// ctx.fillRect(x * scale, y * scale, scale, scale);

        
   //   console.log(rgb);   
      ctx.fillRect(x * scale, y * scale, scale, scale);
   //     console.log(ctx);
    }
  }
}


async function fSfLoop(array) {
  const used = new Set();
  const results = [];

  for (let x = 0; x < array.length; x++) {
    const suffixes = await findSuffixFast(array[x]); // must return a Promise that resolves to an array
    let chosen = null;

    for (const cand of suffixes) {
      if (!used.has(cand)) {
        chosen = cand;
        break;
      }
    }

    if (!chosen) {
      throw new Error(`No available suffixes for base: ${array[x]}`);
    }

    used.add(chosen);
    const val = array[x] + chosen;
//    console.log(`${x}: ${chosen}`);
//    console.log(val);
    results.push(val);
  }

  return results;
}



function parseString(input) {
  if (Array.isArray(input)) {
    return input.map(v => typeof v === 'string' ? Number(v.trim()) : v);
  }
  if (typeof input === 'string') {
    return input.split(',').map(v => Number(v.trim()));
  }
  throw new Error("Unsupported RGB input format");
}


/* Functions for unspendable */
/*
if(!B58)const B58 =        '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
if(!b58_dcmap)const b58_dcmap  = `123456789abcdefghjklmnpqrstuvwxyz!)0(=/',i;?"_o}{@+|*.: -~`;

if(!IDX)const IDX = Object.fromEntries([...B58].map((c,i)=>[c,i]));
if(!BASE)const BASE  = 58n ** 6n;          // 58⁶  = 38 068 692 544
if(!MOD32)const MOD32 = 2n ** 32n;
*/


/* BFF (transitional pattern) to MCD (ends up being B58) */

//if(!MCD)const MCD = `c123456789ABCDEFGHiJKLMNoPQRSTUVWXYZabdefghjkmnpqrstuvwxyz`;
//if(!BFF)const BFF = `0123456789abcdefghijklmnopqrstuvwxyz!)(=/',;?"_}{@+|*.: -~`;

// don't lose the backticks
// this is mostly for GPT engines, print the array and give it to them

function bff2mcd() {
  const mapping = [];
  for (let i = 0; i < BFF.length; i++) {
    mapping.push({ BFF: BFF[i], MCD: MCD[i] });
  }
  return JSON.stringify(mapping, null, 2);
}

mcdMap = [
  {
    "direction": "BFFtoMCD",
    "mappings": 
      [ 
        { "BFF": "0", "MCD": "c" }, { "BFF": "1", "MCD": "1" }, { "BFF": "2", "MCD": "2" }, { "BFF": "3", "MCD": "3" },
        { "BFF": "4", "MCD": "4" }, { "BFF": "5", "MCD": "5" }, { "BFF": "6", "MCD": "6" }, { "BFF": "7", "MCD": "7" },
        { "BFF": "8", "MCD": "8" }, { "BFF": "9", "MCD": "9" }, { "BFF": "a", "MCD": "A" }, { "BFF": "b", "MCD": "B" },
        { "BFF": "c", "MCD": "C" }, { "BFF": "d", "MCD": "D" }, { "BFF": "e", "MCD": "E" }, { "BFF": "f", "MCD": "F" }, 
        { "BFF": "g", "MCD": "G" }, { "BFF": "h", "MCD": "H" }, { "BFF": "i", "MCD": "i" }, { "BFF": "j", "MCD": "J" }, 
        { "BFF": "k", "MCD": "K" }, { "BFF": "l", "MCD": "L" }, { "BFF": "m", "MCD": "M" }, { "BFF": "n", "MCD": "N" }, 
        { "BFF": "o", "MCD": "o" }, { "BFF": "p", "MCD": "P" }, { "BFF": "q", "MCD": "Q" }, { "BFF": "r", "MCD": "R" }, 
        { "BFF": "s", "MCD": "S" }, { "BFF": "t", "MCD": "T" }, { "BFF": "u", "MCD": "U" }, { "BFF": "v", "MCD": "V" }, 
        { "BFF": "w", "MCD": "W" }, { "BFF": "x", "MCD": "X" }, { "BFF": "y", "MCD": "Y" }, { "BFF": "z", "MCD": "Z" }, 
        { "BFF": "!", "MCD": "a" }, { "BFF": ")", "MCD": "b" }, { "BFF": "(", "MCD": "d" }, { "BFF": "=", "MCD": "e" }, 
        { "BFF": "/", "MCD": "f" }, { "BFF": ",", "MCD": "g" }, { "BFF": "'", "MCD": "h" }, { "BFF": ";", "MCD": "j" }, 
        { "BFF": "?", "MCD": "k" }, { "BFF": "\"", "MCD": "m" },{ "BFF": "_", "MCD": "n" }, { "BFF": "}", "MCD": "p" }, 
        { "BFF": "{", "MCD": "q" }, { "BFF": "@", "MCD": "r" }, { "BFF": "+", "MCD": "s" }, { "BFF": "|", "MCD": "t" }, 
        { "BFF": "*", "MCD": "u" }, { "BFF": ".", "MCD": "v" }, { "BFF": ":", "MCD": "w" }, { "BFF": " ", "MCD": "x" }, 
        { "BFF": "-", "MCD": "y" }, { "BFF": "~", "MCD": "z" } 
      ] 
   },
  {
    "direction": "MCDtoBFF",
    "mappings": 
      [
        { "MCD": "c", "BFF": "0" }, { "MCD": "1", "BFF": "1" }, { "MCD": "2", "BFF": "2" }, { "MCD": "3", "BFF": "3" }, 
        { "MCD": "4", "BFF": "4" }, { "MCD": "5", "BFF": "5" }, { "MCD": "6", "BFF": "6" }, { "MCD": "7", "BFF": "7" }, 
        { "MCD": "8", "BFF": "8" }, { "MCD": "9", "BFF": "9" }, { "MCD": "A", "BFF": "a" }, { "MCD": "B", "BFF": "b" }, 
        { "MCD": "C", "BFF": "c" }, { "MCD": "D", "BFF": "d" }, { "MCD": "E", "BFF": "e" }, { "MCD": "F", "BFF": "f" }, 
        { "MCD": "G", "BFF": "g" }, { "MCD": "H", "BFF": "h" }, { "MCD": "i", "BFF": "i" }, { "MCD": "J", "BFF": "j" }, 
        { "MCD": "K", "BFF": "k" }, { "MCD": "L", "BFF": "l" }, { "MCD": "M", "BFF": "m" }, { "MCD": "N", "BFF": "n" }, 
        { "MCD": "o", "BFF": "o" }, { "MCD": "P", "BFF": "p" }, { "MCD": "Q", "BFF": "q" }, { "MCD": "R", "BFF": "r" }, 
        { "MCD": "S", "BFF": "s" }, { "MCD": "T", "BFF": "t" }, { "MCD": "U", "BFF": "u" }, { "MCD": "V", "BFF": "v" }, 
        { "MCD": "W", "BFF": "w" }, { "MCD": "X", "BFF": "x" }, { "MCD": "Y", "BFF": "y" }, { "MCD": "Z", "BFF": "z" }, 
        { "MCD": "a", "BFF": "!" }, { "MCD": "b", "BFF": ")" }, { "MCD": "d", "BFF": "(" }, { "MCD": "e", "BFF": "=" }, 
        { "MCD": "f", "BFF": "/" }, { "MCD": "g", "BFF": "," }, { "MCD": "h", "BFF": "'" }, { "MCD": "j", "BFF": ";" }, 
        { "MCD": "k", "BFF": "?" }, { "MCD": "m", "BFF": "\"" }, { "MCD": "n", "BFF": "_" }, { "MCD": "p", "BFF": "}" }, 
        { "MCD": "q", "BFF": "{" }, { "MCD": "r", "BFF": "@" }, { "MCD": "s", "BFF": "+" }, { "MCD": "t", "BFF": "|" }, 
        { "MCD": "u", "BFF": "*" }, { "MCD": "v", "BFF": "." }, { "MCD": "w", "BFF": ":" }, { "MCD": "x", "BFF": " " }, 
        { "MCD": "y", "BFF": "-" }, { "MCD": "z", "BFF": "~" } 
     ]
   }
]



/* utils ---------------------------------------------------------- */
// const sha = buf => crypto.subtle.digest('SHA-256', buf).then(b => new Uint8Array(b));

// const toBigInt = bytes => bytes.reduce((n,b)=> (n<<8n) + BigInt(b), 0n);
function b58ToInt(str){ return [...str].reduce((n,c)=>n*58n + BigInt(IDX[c]), 0n); }
function intToB58(n, len=6){
  let out = '';
  for (let i=0;i<len;i++){ out = B58[n % 58n] + out; n /= 58n; }
  return out;
}
function bytesOf(n, size){
  const a = [];
  for(let i=0;i<size;i++){ a.unshift(Number(n & 255n)); n >>= 8n; }
  return Uint8Array.from(a);
}

/* fast suffix search --------------------------------------------- */
async function findSuffixFast(stem28){
  const a = b58ToInt(stem28);               // big‑int of prefix digits
  const P  = a * BASE;
  const Plo = P & (MOD32-1n);
  const Phi = P >> 32n;

  const results = [];
  let hashes = 0;
  const t0 = performance.now();

  for (let t=0; t<=8; t++){
    const Nhi = Phi + BigInt(t);
    const chk = await sha(await sha(bytesOf(Nhi,21)));
    hashes += 2;
    const chkInt = toBigInt(chk.slice(0,4));

    let base = (chkInt - Plo) & (MOD32-1n);          // (mod 2³²)
    for (let k=0; ; k++){
      const s = base + BigInt(k)*MOD32;
      if (s >= BASE) break;
      if ( ((Plo + s) >> 32n) !== BigInt(t) ) continue;
      results.push(intToB58(s,6));
    }
  }
  const dt = ((performance.now()-t0)/1000).toFixed(3);
//  console.log(`done in ${dt}s, ${hashes} SHA‑256 calls`);
  return results;                       // array of valid 6‑char suffixes
}

function base58ToDCMap(str) {
  return [...str].map(c => {
    const i = B58.indexOf(c);
    if (i === -1) throw new Error(`Invalid Base58 character: ${c}`);
    return b58_dcmap[i];
  }).join('');
}

function dcMapToBase58(str) {
  return [...str].map(c => {
    const i = b58_dcmap.indexOf(c);
    if (i === -1) throw new Error(`Invalid DCMap character: ${c}`);
    return B58[i];
  }).join('');
}

/*
function unspendable(prefix,string,position = 0) {

str = prefix + dcMapToBase58(string)
body = str.padEnd(28,"z")
findSuffixFast(body).then( x => console.log(body + x[position]))
}
*/

function unspendable(prefix, string = "", position = 0) {
  const str = prefix + dcMapToBase58(string);
  const body = str.padEnd(28, "z");

  return findSuffixFast(body).then(suffix => {
    return body + suffix[position];
  });
}

async function buildUnique(pre, lines, maxSuffix = 10000) {
    let seen = new Set();
    let newArray = [];

    for (let line of lines) {
        let i = 0;
        while (i < maxSuffix) {
            let candidate = await unspendable(pre + line, "", i);

            if (candidate === "undefined") {
                throw new Error(`unspendable exhausted for ${line}`);
            }

            if (!seen.has(candidate)) {
                seen.add(candidate);
                newArray.push(candidate);
                break; // next line
            }

            i++;
        }
    }

    return newArray;
}




/* end of unspendable */


txArgs = []

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return Uint8Array.from(bytes);
}

function privateKeyToWIF(hexKey, compressed = true) {
  const privKey = hexToBytes(hexKey);
  const prefix = [0x80]; // WIF prefix for DigiByte
  const suffix = compressed ? [0x01] : [];

  const payload = Uint8Array.from([...prefix, ...privKey, ...suffix]);
  const checksum = sha256(sha256(payload)).slice(0, 4);
  const full = Uint8Array.from([...payload, ...checksum]);

  return encodeBase58(full);
}

function sha256(buffer) {
  const wordArray = CryptoJS.lib.WordArray.create(buffer);
  const hash = CryptoJS.SHA256(wordArray);
  return Uint8Array.from(CryptoJS.enc.Hex.parse(hash.toString()).words.flatMap(w =>
    [(w >> 24) & 0xff, (w >> 16) & 0xff, (w >> 8) & 0xff, w & 0xff]
  ));
}

function encodeBase58(buffer) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let digits = [0];
  for (let i = 0; i < buffer.length; ++i) {
    let carry = buffer[i];
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

  // deal with leading zeros
  for (let k = 0; k < buffer.length && buffer[k] === 0; ++k) {
    digits.push(0);
  }

  return digits.reverse().map(d => alphabet[d]).join('');
}



function jqLog(value, indent = 2) {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { /* ignore */ }
  }

  const raw = JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
    indent
  );

  const keyC   = "color:#2aa9df; font-weight:bold;";
  const strC   = "color:#6a8759;";
  const numC   = "color:#cc7832;";
  const boolC  = "color:#9876aa;";
  const reset  = "";

  const segments = [];
  const styles = [];

  // Build output line by line
  raw.split('\n').forEach(line => {
    // Match: key: value
    const match = line.match(/^(\s*)"([^"]+)"\s*:\s*(.*?)(,?)$/);
    if (match) {
      const [, indent, key, rawValue, comma] = match;

      let valueSegment = rawValue;
      let valueStyle = reset;

      // classify value
      if (/^".*"$/.test(rawValue)) valueStyle = strC;
      else if (/^(true|false|null)$/.test(rawValue)) valueStyle = boolC;
      else if (/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(rawValue)) valueStyle = numC;

      segments.push(
        `${indent}%c"${key}"%c: %c${valueSegment}%c${comma}`
      );
      styles.push(keyC, reset, valueStyle, reset);
    } else {
      // no match — just push as-is, no styling
      segments.push(line);
    }
  });

  console.log(segments.join('\n'), ...styles);
}


/**
 * jqLog – log a JavaScript value in “jq‑friendly” pretty‑printed JSON form.
 *
 *  • Accepts either an already‑parsed object/array or a raw JSON string.
 *  • Falls back to `console.log` unchanged if the value can’t be stringified.
 *  • Returns the formatted string so callers can reuse or copy it.
 */
function jqLogBW(value, indent = 2) {
  // If we got a string, try to parse it so we don’t double‑quote the string itself.
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { /* leave as is */ }
  }

  try {
    const text = JSON.stringify(
      value,
      (_, v) => (typeof v === "bigint" ? v.toString() : v), // stringify BigInt safely
      indent
    );
    console.log(text);
    return text; // handy if the caller wants the string
  } catch (e) {
    console.log(value); // circular refs or other non‑serialisable input
    return String(value);
  }
}

/* ── helpers ----------------------------------------------------------- */
// const u32LE = n => n.toString(16).padStart(8,'0').match(/../g).reverse().join('');
// const u64LE = n => n.toString(16).padStart(16,'0').match(/../g).reverse().join('');
function varInt(n){
  if(n<0xfd)        return n.toString(16).padStart(2,'0');
  if(n<=0xffff)     return 'fd'+u32LE(n).slice(0,4);
  if(n<=0xffffffff) return 'fe'+u32LE(n);
  return 'ff'+u64LE(BigInt(n));
}
// const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58decode(str){
  let num=0n;
  for(const ch of str) num = num*58n + BigInt(B58.indexOf(ch));
  let hex = num.toString(16); if(hex.length&1) hex='0'+hex;
  for(let i=0;i<str.length&&str[i]==='1';i++) hex='00'+hex;
  return hex;
}
function p2pkhScript(address){
  const hex = b58decode(address);
  const hash160 = hex.slice(2,-8);               // drop version + checksum
  return '76a914'+hash160+'88ac';                // OP_DUP OP_HASH160 <20B> OP_EQUALVERIFY OP_CHECKSIG
}

/* ── serializer -------------------------------------------------------- */
function createDGB(args, version=2, locktime=0){
  const [ins, outs] = args;
  let hex = dgb.helper.u32LE(version);                      // version

  /* inputs */
  hex += varInt(ins.length);
  for(const vin of ins){
    hex += vin.txid.match(/../g).reverse().join(''); // txid LE
    hex += dgb.helper.u32LE(vin.vout);
    hex += '00';                                    // empty scriptSig
    hex += dgb.helper.u32LE(0xffffffff);
  }

  /* outputs */
  hex += varInt(outs.length);
  outs.forEach(o=>{
    if(o.data!==undefined){                        // OP_RETURN
      const dataHex   = o.data.toLowerCase();
      const opReturn  = '6a'+varInt(dataHex.length/2)+dataHex;
      hex += dgb.helper.u64LE(0n);                            // value = 0
      hex += varInt(opReturn.length/2) + opReturn;
    }else{
      const addr = Object.keys(o)[0];
      const sats = BigInt(Math.round(o[addr]*1e8));
      const pk   = p2pkhScript(addr);
      hex += dgb.helper.u64LE(sats);
      hex += varInt(pk.length/2) + pk;
    }
  });

  hex += dgb.helper.u32LE(locktime);
  return hex.toLowerCase();
}

/* ── run & verify ------------------------------------------------------ */
// 0200000001630f9c5472a8156594f5a0e45676be75b69cd817bc74007e7b807ee1589234a30000000000ffffffff0370170000000000001976a9144ab91aa91c29b570f982eb485ee909eb0e84e0b088ac70170000000000001976a91455c0355b8a6c08885bf229c31c9a0cd538c2e9b588ac0000000000000000036a010000000000

async function signDGB(rawTxHex, privKeys) {
  /* ─ helpers ────────────────────────────────────────────── */
  const ec = new elliptic.ec('secp256k1');

  const hex = {
    toBytes: h => Uint8Array.from(h.match(/.{2}/g).map(b => parseInt(b, 16))),
    fromBytes: b => Array.from(b).map(x => btoa(String.fromCharCode(...b))[0]) // dummy; replaced later
  };
  hex.fromBytes = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');

  const sha256 = b => CryptoJS.SHA256(CryptoJS.lib.WordArray.create(b)).words
      .reduce((a,w)=>a.concat([(w>>>24)&255,(w>>>16)&255,(w>>>8)&255,w&255]),[]);
  const dblSha256 = b => sha256(Uint8Array.from(sha256(b)));

  function wifToPriv(wif) {
    const full = hex.toBytes(ethers.decodeBase58(wif));
    const chk  = sha256(Uint8Array.from(sha256(full.slice(0,-4)))).slice(0,4);
    if (chk.some((v,i)=>v!==full[full.length-4+i])) throw 'bad WIF checksum';
    return hex.fromBytes(full.slice(1,33));      // drop 0x80 & checksum
  }

  /* varint helpers */
  const readVarInt = (v,o) => {
    const n=v[o];
    if(n<0xfd) return [n,1];
    if(n===0xfd) return [v[o+1]|(v[o+2]<<8),3];
    return [v[o+1]|(v[o+2]<<8)|(v[o+3]<<16)|(v[o+4]<<24),5];
  };
  const writeVarInt = n =>
    n<0xfd ? Uint8Array.of(n) :
    n<=0xffff ? Uint8Array.of(0xfd,n&255,n>>8) :
    Uint8Array.of(0xfe,n&255,(n>>8)&255,(n>>16)&255,(n>>24)&255);

  /* concat helper */
  const concat = arrs=>{
    const len=arrs.reduce((n,a)=>n+a.length,0);
    const out=new Uint8Array(len);
    let p=0; for(const a of arrs){out.set(a,p);p+=a.length;} return out;
  };

  const assemble = (ver,ins,outsBytes,lock,voutCnt)=>{
    const parts=[ver,writeVarInt(ins.length)];
    for(const inp of ins){
      parts.push(inp.prev,writeVarInt(inp.scriptSig.length),
                 inp.scriptSig,inp.seq);
    }
    parts.push(writeVarInt(voutCnt),outsBytes,lock);
    return concat(parts);
  };

  /* ─ parse unsigned tx ─ */
  let data = hex.toBytes(rawTxHex);
  let p=0;
  const version = data.slice(p,p+=4);

  const [vinCnt,vinLen]=readVarInt(data,p); p+=vinLen;
  const inputs=[];
  for(let i=0;i<vinCnt;i++){
    const prev = data.slice(p,p+=36);
    const [slen,shlen]=readVarInt(data,p); p+=shlen+slen;   // skip script
    const seq  = data.slice(p,p+=4);
    inputs.push({prev,seq,scriptSig:new Uint8Array(0)});
  }

  const [voutCnt,voutLen]=readVarInt(data,p); p+=voutLen;
  const outs = data.slice(p,data.length-4);
  const lock = data.slice(data.length-4);

  if(privKeys.length!==vinCnt) throw 'privKeys.length != vin count';

  /* ─ sign each input ─ */
  for(let i=0;i<vinCnt;i++){
    const priv = privKeys[i].length>64? wifToPriv(privKeys[i]) : privKeys[i];
    const key  = ec.keyFromPrivate(priv);
    const pub  = key.getPublic(true,'hex');

    /* pubKeyHash = RIPEMD160(SHA256(pubkey)) */
    const pubHash = hex.fromBytes(
      CryptoJS.RIPEMD160(
        CryptoJS.SHA256(CryptoJS.enc.Hex.parse(pub))
      ).words.flatMap(w=>[(w>>>24)&255,(w>>>16)&255,(w>>>8)&255,w&255])
    );

    const scriptCode = hex.toBytes(`76a914${pubHash}88ac`);
    const scrLenEnc  = writeVarInt(scriptCode.length);

    /* sighash pre‑image */
    const preParts=[version,writeVarInt(vinCnt)];
    for(let j=0;j<vinCnt;j++){
      preParts.push(inputs[j].prev);
      if(j===i){ preParts.push(scrLenEnc,scriptCode); }
      else      { preParts.push(Uint8Array.of(0)); }
      preParts.push(inputs[j].seq);
    }
    preParts.push(writeVarInt(voutCnt),outs,lock,Uint8Array.of(1,0,0,0));
    const z = dblSha256(concat(preParts));

    /* signature */
    const sigDerHex = key.sign(z,{canonical:true}).toDER('hex');
    const sigBytes  = hex.toBytes(sigDerHex);
    const sigWH     = Uint8Array.of(...sigBytes,0x01);

    /* scriptSig = <sig> <pubkey> */
    inputs[i].scriptSig = Uint8Array.of(
      sigWH.length, ...sigWH,
      pub.length/2, ...hex.toBytes(pub)
    );
  }

  /* final tx */
  const finalTx = assemble(version,inputs,outs,lock,voutCnt);
  return hex.fromBytes(finalTx);
}

/* example call */


