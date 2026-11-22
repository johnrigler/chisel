import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const sources = await Promise.all(['chisel.portal.store.js', 'chisel.bsv.media.js', 'chisel.portal.explore.js'].map(async path => [path, await read(path)]));
const manifest = JSON.parse(await read('data-bsv/manifest.json'));
const catalog = JSON.parse(await read('data-bsv/' + manifest.defaultIndex)).transactions;
const marker = Buffer.from('19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut');
const push = data => Buffer.concat([data.length < 76 ? Buffer.from([data.length]) : Buffer.from([77, data.length & 255, data.length >> 8]), data]);
const script = (...parts) => Buffer.concat([Buffer.from([0, 106]), ...parts.map(push)]).toString('hex');
const tx = hex => ({vout: [{n: 0, scriptPubKey: {hex}}]});
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.value = ''; this.textContent = ''; this.events = {}; this.attributes = {}; }
  appendChild(node) { return this.insertBefore(node, null); }
  insertBefore(node, before) { node.remove(); this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, node); node.parentNode = this; return node; }
  remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
  addEventListener(name, fn) { this.events[name] = fn; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
function fixture() {
  const nodes = new Map(['portalRecordExplore', 'portalRecordSearch', 'portalRecordFileType', 'portalRecordBlockFilter', 'portalRecordResults', 'portalRecordResultCount', 'portalRecordFiles', 'portalRecordFileStatus', 'portalRecordRefreshCatalog', 'portalRecordServiceStatus', 'portalRecordScope', 'portalRecordCurrentBlock'].map(id => ['#' + id, new Element()]));
  nodes.get('#portalRecordFileType').value = nodes.get('#portalRecordBlockFilter').value = 'all';
  const document = {querySelector: id => nodes.get(id), createElement: tag => new Element(tag)};
  const context = vm.createContext({document, URL, TextDecoder, Uint8Array, Blob, AbortController, console, setTimeout, clearTimeout, fetch: async () => { throw new Error('Unexpected fetch'); }});
  context.window = context;
  for (const [path, source] of sources) vm.runInContext(source, context, {filename: path});
  return {context, nodes, media: context.CHISEL_BSV_MEDIA, explore: context.CHISEL_PORTAL_EXPLORE};
}

test('B files preserve push boundaries, declared metadata and truncated image signatures', () => {
  const {media} = fixture(), jpeg = Buffer.from([255, 216, 255, 0, 1]);
  const files = media.files(tx(script(marker, jpeg, Buffer.from('image/jpeg'), Buffer.from('binary'), Buffer.from('a.jpg'))));
  assert.equal(files.length, 1); assert.equal(files[0].name, 'a.jpg'); assert.equal(files[0].mimeSource, 'declared');
  assert.equal(files[0].bytes, 5); assert.equal(files[0].complete, true); assert.deepEqual([...files[0].data], [...jpeg]);
  const truncated = script(marker) + '4d1000ffd8ff' + '[truncated]';
  const file = media.files(tx(truncated))[0];
  assert.equal(file.mime, 'image/jpeg'); assert.equal(file.mimeSource, 'signature'); assert.equal(file.complete, false);
  assert.equal(file.bytes, 16); assert.equal(file.availableBytes, 3);
  assert.equal(media.files(tx(script(Buffer.from('See https://example.org/image.jpg')))).length, 0);
  assert.equal(media.files(tx('76a914' + '00'.repeat(20) + '88ac')).length, 0);
  assert.equal(media.pushes('006a4effff').length, 0);
});

test('full output fetch uses the exact network/output and rejects mismatched cached bytes', async () => {
  const {media} = fixture(), preview = media.files(tx(script(marker) + '05ffd8ff'))[0];
  const full = script(marker, Buffer.from([255, 216, 255, 1, 2]), Buffer.from('image/jpeg'));
  let called;
  const fetcher = async url => { called = url; return {ok: true, text: async () => JSON.stringify(full)}; };
  const loaded = await media.loadFile('bsvTestnet', 'ab'.repeat(32), preview, fetcher);
  assert.match(called, /\/bsv\/test\/tx\/abab.*\/out\/0\/hex$/); assert.equal(loaded.complete, true);
  await assert.rejects(media.loadFile('bsv', 'ab'.repeat(32), {...preview, data: Uint8Array.from([255, 216, 0])}, fetcher), /differs from the saved preview/);
  await assert.rejects(media.loadFile('litecoin', 'ab'.repeat(32), preview, fetcher), /Invalid BSV/);
  await assert.rejects(media.loadFile('bsv', 'ab'.repeat(32), preview, async () => ({ok: false, status: 429})), /HTTP 429/);
});

test('bundled image search finds seven actual B files and keeps chain and block scope', async () => {
  const {explore, media} = fixture();
  for (const row of catalog) {
    const raw = JSON.parse(await read('data-bsv/' + row.rawPath));
    assert.deepEqual(JSON.parse(JSON.stringify(media.summarize(raw).files)), row.summary.files);
  }
  const rows = [...catalog, {...catalog[0], coin: 'litecoin', sourceId: 'litecoin'}];
  const images = explore.search(rows, catalog[0], {type: 'images'});
  assert.equal(images.length, 7); assert.ok(images.every(row => row.coin === 'bsv'));
  assert.equal(explore.search(rows, catalog[0], {type: 'images', query: 'image/jpeg'}).length, 7);
  assert.ok(explore.search(rows, catalog[0], {block: true}).every(row => row.summary.blockHeight === catalog[0].summary.blockHeight));
  assert.equal(explore.search([{...catalog[0], summary: {opReturnText: 'https://example.org/image.jpg'}}], catalog[0], {type: 'images'}).length, 0);
});

test('record controls, search results and file buttons retain node identity during refresh', async () => {
  const {explore, nodes} = fixture(), opened = [];
  const controller = explore.createController({document: {querySelector: id => nodes.get(id), createElement: tag => new Element(tag)},
    rows: () => catalog, open: row => opened.push(row), recordUrl: row => 'https://example.org/?txid=' + row.txid,
    checkFileProxy: async () => 'connected', checkScanner: async () => { throw new Error('HTTP 404'); }, refresh: async () => {}});
  controller.setRow(catalog[0]);
  const query = nodes.get('#portalRecordSearch'), type = nodes.get('#portalRecordFileType');
  type.value = 'images'; query.value = 'jpeg'; query.events.input();
  const firstResult = nodes.get('#portalRecordResults').children[0];
  const fileNode = nodes.get('#portalRecordFiles').children[0], button = fileNode.children.find(child => child.tagName === 'button');
  for (let i = 0; i < 4; i++) controller.setRow({...catalog[0], summary: {...catalog[0].summary}});
  assert.equal(nodes.get('#portalRecordResults').children.length, 7);
  assert.equal(nodes.get('#portalRecordResults').children[0], firstResult);
  assert.equal(fileNode.children.filter(child => child.tagName === 'button').length, 1);
  assert.equal(fileNode.children.find(child => child.tagName === 'button'), button);
  assert.equal(query.value, 'jpeg'); assert.equal(type.value, 'images');
  firstResult.onclick({preventDefault() {}}); assert.equal(opened[0].txid, catalog[0].txid);
  await nodes.get('#portalRecordRefreshCatalog').onclick();
  assert.match(nodes.get('#portalRecordServiceStatus').textContent, /FileProxy: connected.*BSV scanner feed: HTTP 404/);
  controller.clear(); assert.equal(nodes.get('#portalRecordFiles').children.length, 0);
});


test('loading an image retains its button and image node across record refreshes', async () => {
  const {explore, media, context, nodes} = fixture();
  const raw = tx(script(marker) + '05ffd8ff');
  const row = {coin: 'bsv', txid: 'ab'.repeat(32), raw, summary: {...media.summarize(raw), blockHeight: 123}};
  const full = script(marker, Buffer.from([255, 216, 255, 1, 2]), Buffer.from('image/jpeg'));
  context.fetch = async () => ({ok: true, text: async () => full});
  const controller = explore.createController({document: {querySelector: id => nodes.get(id), createElement: tag => new Element(tag)},
    rows: () => [row], open() {}, recordUrl: () => 'https://example.org/record',
    checkFileProxy: async () => 'connected', checkScanner: async () => 'available', refresh: async () => {}});
  controller.setRow(row);
  const file = nodes.get('#portalRecordFiles').children[0], button = file.children.find(child => child.tagName === 'button');
  await button.onclick();
  const image = file.children.find(child => child.tagName === 'img');
  assert.ok(image.src.startsWith('blob:')); assert.equal(button.hidden, true);
  controller.setRow({...row, summary: {...row.summary}});
  assert.equal(file.children.find(child => child.tagName === 'img'), image);
  assert.equal(file.children.find(child => child.tagName === 'button'), button);
  assert.match(file.children[1].textContent, /Loaded 5 bytes/);
  controller.clear();
});
