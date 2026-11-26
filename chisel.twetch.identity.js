/* Twetch integration boundary: legacy Bitcoin message proof, not a Twetch session. */
(function (root) {
  "use strict";
  const C = root.CHISEL, noble = root.ChiselNoble;
  if (!C || !noble) return;
  const encoder = new TextEncoder();
  async function messageDigest(message) {
    const prefix = encoder.encode("Bitcoin Signed Message:\n");
    const bytes = encoder.encode(message);
    if (!bytes.length || bytes.length > 8192) throw Error("Message must be 1–8192 UTF-8 bytes.");
    const framed = C.concatBytes(C.hexToUint8Array(C.varInt(prefix.length)),prefix,
      C.hexToUint8Array(C.varInt(bytes.length)),bytes);
    return C.hexToUint8Array(await C.doubleSha256Hex(C.bytesToHex(framed)));
  }
  async function publicAddress(publicKey) {
    const hash = await C.hash160Hex(C.bytesToHex(publicKey));
    return C.base58CheckEncode(C.concatBytes(Uint8Array.of(0),C.hexToUint8Array(hash)));
  }
  async function verify(proof) {
    try {
      if (proof.format !== "bitcoin-signed-message") return false;
      const sig = Uint8Array.from(atob(proof.signature),ch=>ch.charCodeAt(0));
      if (sig.length !== 65 || sig[0] < 27 || sig[0] > 34) return false;
      const compressed = sig[0] >= 31, recovery = sig[0] - (compressed ? 31 : 27);
      const digest = await messageDigest(proof.message);
      const recovered = C.concatBytes(Uint8Array.of(recovery),sig.slice(1));
      const key = await noble.recoverPublicKeyAsync(recovered,digest,{prehash:false,isCompressed:compressed});
      return await publicAddress(key) === proof.address &&
        await noble.verifyAsync(sig.slice(1),digest,key,{prehash:false,lowS:true,format:"compact"});
    } catch (_) { return false; }
  }
  async function sign(wif,address,message) {
    const decoded = await C.wifToPrivateKey(wif);
    if (decoded.version !== 128) throw Error("Load the selected Bitcoin-family mainnet WIF first.");
    const privateBytes = C.hexToUint8Array(decoded.privateKeyHex);
    try {
      const key = noble.getPublicKey(privateBytes,decoded.compressed);
      if (await publicAddress(key) !== address) throw Error("Loaded key does not match the selected address.");
      const digest = await messageDigest(message);
      const recovered = await noble.signAsync(digest,privateBytes,{prehash:false,lowS:true,format:"recovered"});
      const compact = C.concatBytes(Uint8Array.of(27 + (decoded.compressed ? 4 : 0) + recovered[0]),recovered.slice(1));
      const proof = {format:"bitcoin-signed-message",address,message,signature:btoa(String.fromCharCode(...compact))};
      if (!(await verify(proof))) throw Error("Local signature verification failed.");
      return proof;
    } finally { privateBytes.fill(0); }
  }
  root.CHISEL_TWETCH_IDENTITY = Object.freeze({sign,verify});
  const $=id=>document.getElementById(id);
  const drawer=$("twetchIdentity"), input=$("twetchIdentityMessage"), output=$("twetchIdentityProof"),
    status=$("twetchIdentityStatus"), challenge=$("twetchIdentityChallenge"), signButton=$("twetchIdentitySign"),
    copy=$("twetchIdentityCopy"), card=$("portalPersonalAccount"), addressNode=$("portalPersonalAccountAddress");
  if (![drawer,input,output,status,challenge,signButton,copy,card,addressNode].every(Boolean)) return;
  let generation=0, lastAddress="";
  function activeAddress() {
    if(card.hidden || !["bitcoin","bsv","bitcoincash"].includes(card.dataset.currency)) return "";
    return addressNode.textContent.trim();
  }
  function invalidate() {
    generation++;
    output.value="";
    copy.disabled=true;
    signButton.disabled=false;
    status.textContent="No proof generated. Nothing will be sent or broadcast.";
  }
  function sync() {
    const address=activeAddress();
    if(address===lastAddress) return;
    lastAddress=address;
    input.value="";
    invalidate();
  }
  new MutationObserver(sync).observe(card,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["hidden","data-currency"]});
  sync();
  challenge.onclick=()=>{
    const address=activeAddress();
    if(!address) return;
    const nonce=C.bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    input.value="Chisel local Twetch identity test\nAddress: "+address+"\nNonce: "+nonce+"\nCreated: "+new Date().toISOString()+"\nLocal proof only; not a transaction or account authorization.";
    invalidate();
  };
  input.addEventListener("input",invalidate);
  signButton.onclick=async()=>{
    const address=activeAddress(), message=input.value, wif=$("senderWif")?.value.trim();
    if (!address || !message.trim() || !wif) {
      status.textContent="Load the matching Bitcoin-family WIF through Chisel identity and provide a message.";
      return;
    }
    const id=++generation;
    output.value="";copy.disabled=true;signButton.disabled=true;
    status.textContent="Signing and verifying locally…";
    try {
      const proof=await sign(wif,address,message);
      if(id!==generation || activeAddress()!==address || input.value!==message) return;
      output.value=JSON.stringify(proof,null,2);
      copy.disabled=false;
      status.textContent="Local proof verified. Twetch authorization not checked. No network request made.";
    } catch(error) {
      if(id===generation) status.textContent=error.message || "Local signing failed.";
    } finally {if(id===generation) signButton.disabled=false;}
  };
  copy.onclick=async()=>{
    if(!output.value)return;
    try {await navigator.clipboard.writeText(output.value);status.textContent="Public proof copied. Twetch authorization not checked.";}
    catch(_){output.focus();output.select();status.textContent="Select and copy the proof manually.";}
  };
})(window);
