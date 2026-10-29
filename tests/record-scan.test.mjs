import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const scanner = await readFile(new URL('../tools/recorder/index.html',import.meta.url),'utf8');
const launcher = await readFile(new URL('../records.html',import.meta.url),'utf8');
function productionFunction(name) {
  const start = scanner.indexOf('  function ' + name + '(');
  assert.ok(start >= 0,name);
  const end = scanner.indexOf('\n  function ',start+1);
  return scanner.slice(start,end);
}
function scannerFixture(mode='record1') {
  const state = {scanMode:mode,fragments:[],artifactId:'',lastQrValue:'',lastQrValueAt:0};
  const events = {statuses:[],artifacts:[]};
  const context = vm.createContext({state,Date,URL,FRAGMENT_COUNT:4,
    els:{checkFragments:{classList:{toggle(){}}}},
    window:{location:{href:'https://chisel.example/ipfs/cid/tools/recorder/index.html?scanMode='+mode+'&recordProxy=http%3A%2F%2Flocalhost%3A47799'}},
    setStatus:message=>events.statuses.push(message),
    acceptArtifactId:value=>events.artifacts.push(value),
  });
  vm.runInContext(['normalizeHex','consumeQr','updateFragmentControls','handoffRecordResolution'].map(productionFunction).join('\n'),context);
  return {context,state,events};
}

test('record mode accepts one whole ID and hands it to catalog lookup without key derivation',()=>{
  const f=scannerFixture();
  f.context.consumeQr('0123456789ABCDEF');
  assert.equal(f.state.artifactId,'0123456789abcdef');
  assert.equal(f.context.els.checkFragments.disabled,false);
  assert.equal(f.context.els.checkFragments.textContent,'OPEN RECORD');
  assert.deepEqual(f.events.artifacts,[]);
  f.context.handoffRecordResolution();
  const target=new URL(f.context.window.location.href);
  assert.equal(target.pathname,'/ipfs/cid/records.html');
  assert.equal(target.searchParams.get('id'),'0123456789ABCDEF');
  assert.equal(target.searchParams.get('fileProxy'),'http://localhost:47799');
  assert.equal(target.searchParams.has('privateKeyHex'),false);
});

test('record mode rejects a full key; key4 still needs four distinct stickers',()=>{
  const record=scannerFixture();
  record.context.consumeQr('0123456789abcdef'.repeat(4));
  assert.equal(record.state.artifactId,'');
  const key=scannerFixture('key4');
  for (const value of ['1','2','3','4']) key.context.consumeQr(value.repeat(16));
  assert.equal(key.state.fragments.length,4);
  assert.equal(key.state.artifactId,'');
  assert.equal(key.context.els.checkFragments.textContent,'CHECK 4');
  assert.equal(key.context.els.checkFragments.disabled,false);
});

test('artifact mode retains its chain address derivation path',()=>{
  const f=scannerFixture('artifact1');
  f.context.consumeQr('0123456789ABCDEF');
  assert.deepEqual(f.events.artifacts,['0123456789abcdef']);
  assert.equal(f.state.fragments.length,0);
});

function launchFixture({saved='',query=''}={}) {
  const nodes=Object.fromEntries(['recordId','proxy','status','scan','recordForm'].map(id=>[id,{value:'',textContent:''}]));
  const writes=[];
  const window={location:{href:'https://chisel.example/ipfs/cid/records.html'+query}};
  const context=vm.createContext({window,URL,document:{getElementById:id=>nodes[id]},
    localStorage:{getItem:()=>saved,setItem:(key,value)=>writes.push({key,value})},
  });
  vm.runInContext(launcher.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  return {nodes,writes,window};
}

test('a scanned ID only navigates automatically to a previously selected private service',()=>{
  const query='?id=0123456789ABCDEF';
  const first=launchFixture({query});
  assert.equal(first.window.location.href,'https://chisel.example/ipfs/cid/records.html'+query);
  const known=launchFixture({saved:'http://localhost:47799',query});
  assert.equal(known.window.location.href,'http://localhost:47799/record?id=0123456789ABCDEF');
  const changed=launchFixture({saved:'http://localhost:47799',query:query+'&fileProxy=https://other.example'});
  assert.ok(changed.window.location.href.startsWith('https://chisel.example/'));
});

test('launcher validates the endpoint and preserves a reverse proxy prefix',()=>{
  const f=launchFixture();
  f.nodes.recordId.value='0123456789abcdef';
  f.nodes.proxy.value='javascript:alert(1)';
  f.nodes.recordForm.onsubmit({preventDefault(){}});
  assert.ok(f.window.location.href.startsWith('https://chisel.example/'));
  f.nodes.proxy.value='https://records.example/fileproxy/?unused=1#ignored';
  f.nodes.recordForm.onsubmit({preventDefault(){}});
  assert.equal(f.window.location.href,'https://records.example/fileproxy/record?id=0123456789ABCDEF');
  assert.equal(f.writes.at(-1).value,'https://records.example/fileproxy');
});
