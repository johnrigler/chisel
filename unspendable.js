b58_dcmap = `123456789abcdefghjklmnpqrstuvwxyz!)0(=/',i;?"_o}{@+|*.: -~`

function b58ToInt(str){ return [...str].reduce((n,c)=>n*58n + BigInt(IDX[c]), 0n); }

function findSuffixFast2(stem28){
  const a = b58ToInt(stem28);               // big‑int of prefix digits
  const P  = a * BASE;
  const Plo = P & (MOD32-1n);
  const Phi = P >> 32n;
        
  const results = [];
  let hashes = 0;
  const t0 = performance.now();

    const Nhi = Phi + BigInt(1);
    sha1 = hexToBytes(ethers.sha256(bytesOf(Nhi,21)));
    chk = hexToBytes(ethers.sha256(sha1.slice(1))).slice(1)
    hashes += 2;
    const chkInt = toBigInt(chk.slice(0,4));

    let base = (chkInt - Plo) & (MOD32-1n);          // (mod 2³²)
    for (let k=0; ; k++){
      const s = base + BigInt(k)*MOD32;
      if (s >= BASE) break;
      if ( ((Plo + s) >> 32n) !== BigInt(1) ) continue;
      results.push(intToB58(s,6));
    }
  const dt = ((performance.now()-t0)/1000).toFixed(3);
  return results[0];                       // array of valid 6‑char suffixes
}


function dcMapToBase58(str) {
  return [...str].map(c => {
    const i = b58_dcmap.indexOf(c);
    if (i === -1) throw new Error(`Invalid DCMap character: ${c}`);
    return B58[i];
  }).join('');
}

function unspendable(prefix, string = "", position = 0) {
  const str = prefix + dcMapToBase58(string);
  const body = str.padEnd(28, "z");
  const suffix = findSuffixFast2(body)
 return body + suffix
}
