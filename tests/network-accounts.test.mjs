import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const modules = await Promise.all(['chisel.js', 'chisel.sign.js', 'vendor/noble-secp256k1-3.2.0.browser.js',
  'chisel.secp256k1.js', 'chisel.secp256k1.noble.js', 'chisel.sign.backend.js',
  'chisel.litecoin.js', 'chisel.networks.js'].map(read));
const app = await read('app.js');
const privateKey = '0'.repeat(63) + '1'; // Public test vector; never fund it.
const mainAddress = '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH';
const testAddress = 'mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r';

function fixture(fetcher) {
  const calls = [];
  const context = { crypto:webcrypto, Uint8Array, TextEncoder, TextDecoder, AbortController,
    setTimeout, clearTimeout, fetch:async (url, options) => {
      calls.push({url,options});
      if (!fetcher) throw Error('Unexpected network request');
      return fetcher(url,options);
    } };
  context.window = context;
  vm.createContext(context);
  modules.forEach(source => vm.runInContext(source, context));
  return { C:context.CHISEL, context, calls };
}
const json = (data, status=200) => new Response(JSON.stringify(data), {status});

test('one private key gives known P2PKH addresses on four explicit networks', async () => {
  const {C,calls} = fixture();
  for (const name of ['bitcoin','bitcoinTestnet4','bsv','bsvTestnet']) {
    const coin = C.getCoin(name);
    const wif = await C.privateKeyToCoinWif(privateKey,coin,true);
    const account = await coin.wifToAccount(wif);
    assert.equal(account.address, coin.IS_TESTNET ? testAddress : mainAddress);
    assert.equal(account.network,coin.NETWORK);
    assert.equal(coin.CAN_SEND,false);
    assert.equal(coin.ACCOUNT_ONLY,true);
    assert.throws(() => coin.signRawTransaction('00',[]), /later phase/);
    assert.throws(() => coin.sendRawTransaction(null,{},'00'), /later phase/);
    assert.throws(() => coin.createRawTransaction(null,{},[],{}), /later phase/);
  }
  assert.equal(calls.length,0,'derivation does not contact any provider');
});

test('WIF conversion preserves the scalar and uncompressed public-key choice across networks', async () => {
  const {C} = fixture();
  const ltc = C.getCoin('litecoin'), btc = C.getCoin('bitcoin');
  const original = await C.privateKeyToCoinWif(privateKey,ltc,false);
  const imported = await C.accountFromSharedWif(original,btc);
  assert.equal(imported.account.privateKeyHex,privateKey);
  assert.equal(imported.account.compressed,false);
  assert.equal(imported.account.address,'1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm');
  assert.equal((await C.wifToPrivateKey(imported.wif)).version,128);
  const testnet = await C.accountFromSharedWif(imported.wif,C.getCoin('bsvTestnet'));
  assert.equal(testnet.account.compressed,false);
  assert.equal((await C.wifToPrivateKey(testnet.wif)).version,239);
  const returned = await C.accountFromSharedWif(testnet.wif,ltc);
  assert.equal(returned.wif,original);
});

test('invalid scalar, unknown WIF version, checksum errors and wrong-network addresses fail before requests', async () => {
  const {C,calls} = fixture(), btc = C.getCoin('bitcoin');
  for (const key of ['0'.repeat(64),'f'.repeat(64)]) await assert.rejects(C.privateKeyToCoinWif(key,btc,true));
  const bytes = new Uint8Array(34); bytes[0]=17; bytes.set(C.hexToUint8Array(privateKey),1); bytes[33]=1;
  await assert.rejects(C.accountFromSharedWif(await C.base58CheckEncode(bytes),btc), /not used/);
  const wif = await C.privateKeyToCoinWif(privateKey,btc,true);
  await assert.rejects(C.accountFromSharedWif(wif.slice(0,-1)+'0',btc));
  await assert.rejects(btc.getAddressBalance(null,{},testAddress), /selected network/);
  await assert.rejects(btc.getAddressBalance(null,{},wif), /public address/);
  assert.equal(calls.length,0);
});

test('same testnet address queries separate BTC and BSV providers and includes pending spending', async () => {
  const f = fixture(url => url.includes('mempool.space')
    ? json({address:testAddress,chain_stats:{funded_txo_sum:900,spent_txo_sum:200},mempool_stats:{funded_txo_sum:50,spent_txo_sum:100}})
    : json({confirmed:40,unconfirmed:20}));
  const btc = await f.C.getCoin('bitcoinTestnet4').getAddressBalance(null,{rpcUrl:'https://wrong-chain.invalid'},testAddress);
  const bsv = await f.C.getCoin('bsvTestnet').getAddressBalance(null,{},testAddress);
  assert.equal(btc.totalSats,650); assert.equal(btc.unconfirmedSats,-50);
  assert.equal(bsv.totalSats,60);
  assert.match(f.calls[0].url,/mempool\.space\/testnet4\/api\/address\//);
  assert.match(f.calls[1].url,/whatsonchain\.com\/v1\/bsv\/test\/address\/.*\/balance$/);
  for (const call of f.calls) {
    assert.equal(call.options.credentials,'omit');
    assert.equal(call.options.body,undefined);
    assert.doesNotMatch(call.url,new RegExp(privateKey));
  }
});

test('provider failure or malformed balance is never reported as a zero balance', async () => {
  for (const response of [json({},503),json({confirmed:'0',unconfirmed:0}),json({confirmed:0}),json({confirmed:1,unconfirmed:-2}),json({confirmed:Number.MAX_SAFE_INTEGER,unconfirmed:1})]) {
    const f=fixture(() => response);
    await assert.rejects(f.C.getCoin('bsvTestnet').getAddressBalance(null,{},testAddress));
  }
  const f=fixture(() => json({confirmed:0,unconfirmed:0}));
  assert.equal((await f.C.getCoin('bsvTestnet').getAddressBalance(null,{},testAddress)).totalSats,0);
});

test('raw transaction lookup checks the requested TXID against independently hashed bytes', async () => {
  const raw='0100000001'+'11'.repeat(32)+'0000000000ffffffff010000000000000000046a02686900000000';
  const f=fixture(() => new Response(raw));
  const txid=await f.C.transactionId(raw);
  assert.equal(await f.C.getCoin('bitcoin').getRawTransaction(null,{},txid),raw);
  await assert.rejects(f.C.getCoin('bsv').getRawTransaction(null,{},'a'.repeat(64)), /different transaction/);
});

function functionBetween(name,next) {
  const start=app.indexOf('  async function '+name+'(');
  const end=app.indexOf(next,start);
  assert(start>=0 && end>start);
  return app.slice(start,end);
}

test('a late balance response from a previous network cannot replace the active view', async () => {
  let resolve, selected={NAME:'bitcoinTestnet4',TICKER:'tBTC4',unitsToCoin:v=>v/1e8,
    getAddressBalance:() => new Promise(done=>{resolve=done;})};
  const events=[],writes=[],messages=[];
  const state={receiveWatchGeneration:1};
  const context={state,elems:{senderAddress:{value:testAddress}},getCoin:()=>selected,
    getTransportValues:()=>({}),validateTransportValues(){},makeClientForValues:async()=>null,
    render(){},setReceiveMonitorStatus:value=>messages.push(value),setUtxoData:v=>writes.push(v),
    CHISEL:{normalizeUTXO:v=>v},window:{dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
    alertFundsArrived(){}};
  vm.createContext(context);
  vm.runInContext(functionBetween('checkSenderFunds','  // Read-only balance lookup'),context);
  const pending=context.checkSenderFunds();
  await new Promise(setImmediate);
  state.receiveWatchGeneration=2;
  state.receiveWatchBusy=true;
  selected={NAME:'bsvTestnet'};
  resolve({totalSats:100,confirmedSats:100,unconfirmedSats:0});
  assert.equal(await pending,null);
  assert.equal(events.length,0); assert.equal(writes.length,0);
  assert.equal(messages.length,1,'only the initial checking message was rendered');
  assert.equal(state.receiveWatchBusy,true,'old request cannot clear a newer request lock');
});

test('public identity events preserve compression without exposing WIF or private key', async () => {
  const f=fixture(), events=[];
  f.context.state={identityPrivateKeyHex:privateKey,identityCompressed:false};
  f.context.privateKeyHexToWifForCoin=f.C.privateKeyToCoinWif;
  f.context.CustomEvent=class{constructor(type,init){this.type=type;this.detail=init.detail;}};
  f.context.dispatchEvent=event=>events.push(event);
  vm.runInContext(functionBetween('deriveIdentityAccounts','  async function applyIdentityToSelectedCurrency'),f.context);
  await f.context.deriveIdentityAccounts(privateKey);
  assert.equal(f.context.CHISEL_PUBLIC_ACCOUNTS.find(a=>a.currency==='bitcoin').address,'1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm');
  assert.doesNotMatch(JSON.stringify(events),/privateKeyHex|"wif"/);
  assert.doesNotMatch(JSON.stringify(events),new RegExp(privateKey));
});

test('testnet funding and network choice are available in the static app and external driver', async () => {
  const html=await read('index.html'), ui=await read('chisel.networks.ui.js');
  for(const name of ['bitcoin','bitcoinTestnet4','bsv','bsvTestnet']) assert.match(html,new RegExp('option value="'+name+'"'));
  assert.match(html,/id="testnetFunding"/); assert.match(html,/id="sharedAccountsList"/);
  assert.match(ui,/Test coins have no monetary value/);
  assert.match(ui,/Bitcoin requests must specifically use Testnet4/);
  const context={crypto:webcrypto,Uint8Array,TextEncoder,TextDecoder,setTimeout,clearTimeout,AbortController};
  context.window=context; vm.runInNewContext(await read('dist/chisel-driver.js'),context);
  assert.equal(context.CHISEL.getCoin('bsvTestnet').CAN_SEND,false);
});
