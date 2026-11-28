import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../chisel.portal.js', import.meta.url), 'utf8');
const start = source.indexOf('  function setPortalPage(page)');
const end = source.indexOf('  function resetPortalRowsForNewLoad()', start);

function fixture({mobile = false, page = 1, count = 65} = {}) {
  const node = (parentElement = null, overflowY = 'visible') => ({parentElement, overflowY,
    clientHeight: 0, scrollHeight: 0, scrollTop: 0, hidden: false,
    contains(target) { for (let item = target; item; item = item.parentElement) if (item === this) return true; return false; },
    closest() { return this.editable ? this : null; }});
  const root = Object.assign(node(), {clientHeight: 800, scrollHeight: 2400, scrollTop: 1000});
  const body = Object.assign(node(root), {dataset: {mode: 'portal'}});
  const host = node(body), handlers = new Map(), options = new Map();
  host.addEventListener = (name, callback, config) => { handlers.set(name, callback); options.set(name, config); };
  const list = Object.assign(node(host, mobile ? 'visible' : 'auto'), {
    clientHeight: mobile ? 1600 : 500, scrollHeight: 1600, scrollTop: mobile ? 0 : 1100,
    scrollIntoView(config) { scrolls.push(config); root.scrollTop = 100; }});
  const controls = Object.assign(node(host), {bottom: 780, getBoundingClientRect() { return {bottom: this.bottom}; }});
  const row = node(list), nested = Object.assign(node(row, 'auto'), {clientHeight: 100, scrollHeight: 300, scrollTop: 200});
  const field = Object.assign(node(row), {editable: true});
  const nodes = {portalListView: host, portalTransactionList: list, portalPageControls: controls};
  const state = {portalPage: page, portalLoadGeneration: 1, portalPageSize: 20, filter: '',
    expandedRowKeys: {existing: true}, selectedRowKey: 'existing', selectedTxid: 'ab'.repeat(32)};
  let recordActive = false, renders = 0;
  const scrolls = [];
  const context = vm.createContext({state, $: selector => nodes[selector.slice(1)],
    document: {body, documentElement: root, scrollingElement: root},
    window: {innerHeight: 800, getComputedStyle: node => ({overflowY: node.overflowY})},
    recordView: {active: () => recordActive},
    getFilteredPortalRows: () => Array.from({length: count}),
    getPortalPageCount: () => Math.max(1, Math.ceil(count / state.portalPageSize)),
    clampPortalPage() { state.portalPage = Math.max(1, Math.min(Math.ceil(count / state.portalPageSize), state.portalPage)); return state.portalPage; },
    renderPortalRows() { renders++; },
    visibleDateLookupContextToken: () => [state.portalPage, state.portalLoadGeneration, state.portalPageSize, state.filter].join('|')});
  vm.runInContext(source.slice(start, end) + '\nbindPortalPageSwipe();', context);
  const touch = (x, y, identifier = 7) => ({clientX: x, clientY: y, identifier});
  function send(type, {target = row, touches = [], changedTouches = [], cancelable = true} = {}) {
    const event = {target, touches, changedTouches, cancelable, prevented: false, preventDefault() { this.prevented = true; }};
    handlers.get(type)(event); return event;
  }
  const begin = (target = row) => send('touchstart', {target, touches: [touch(100, 400)]});
  const move = (x = 100, y = 300, target = row) => send('touchmove', {target, touches: [touch(x, y)]});
  const finish = (x = 100, y = 300, target = row) => send('touchend', {target, changedTouches: [touch(x, y)]});
  return {state, root, body, host, list, row, nested, field, controls, options, scrolls, begin, move, finish, send, touch,
    get renders() { return renders; }, recordActive(value) { recordActive = value; }};
}

test('an extra upward swipe at the list bottom advances exactly once and reveals the first new record', () => {
  const f = fixture(); f.begin();
  assert.equal(f.move().prevented, true);
  assert.equal(f.state.portalPage, 1, 'release commits the gesture');
  assert.equal(f.finish().prevented, true);
  assert.equal(f.state.portalPage, 2); assert.equal(f.list.scrollTop, 0);
  assert.equal(f.renders, 1); assert.equal(f.scrolls.length, 1);
  assert.equal(f.scrolls[0].block, 'start');
  assert.equal(Object.keys(f.state.expandedRowKeys).length, 0);
  assert.equal(f.state.selectedRowKey, ''); assert.equal(f.state.selectedTxid, '');
  f.move(); f.finish(); assert.equal(f.state.portalPage, 2);
});

test('ordinary scrolling to the bottom needs a separate swipe before changing page', () => {
  const f = fixture(); f.list.scrollTop = 900; f.begin();
  f.list.scrollTop = 1100;
  assert.equal(f.move().prevented, false); f.finish(); assert.equal(f.state.portalPage, 1);
  f.begin(); f.move(); f.finish(); assert.equal(f.state.portalPage, 2);
});

test('short, downward and horizontal gestures do not change pages', () => {
  for (const [x, y] of [[100, 370], [100, 490], [210, 300]]) {
    const f = fixture(); f.begin(); f.move(x, y); f.finish(x, y);
    assert.equal(f.state.portalPage, 1); assert.equal(f.renders, 0);
  }
  const f = fixture(); f.begin(); f.move(200, 390); f.move(); f.finish();
  assert.equal(f.state.portalPage, 1, 'a horizontal gesture stays native even after changing direction');
});

test('nested readers, editable fields, multitouch and cancelled touches retain native behavior', () => {
  for (const targetName of ['nested', 'field']) {
    const f = fixture(); f.begin(f[targetName]); assert.equal(f.move(100, 300, f[targetName]).prevented, false);
    f.finish(100, 300, f[targetName]); assert.equal(f.renders, 0);
  }
  for (const cancel of ['touchcancel', 'multitouch']) {
    const f = fixture(); f.begin();
    if (cancel === 'touchcancel') f.send('touchcancel');
    else f.send('touchmove', {touches: [f.touch(100, 380), f.touch(200, 380, 8)]});
    assert.equal(f.move().prevented, false); f.finish(); assert.equal(f.renders, 0);
  }
  const f = fixture(); f.send('touchstart', {touches: [f.touch(100, 400), f.touch(200, 400, 8)]});
  f.finish(); assert.equal(f.renders, 0);
});

test('the last or only page, other modes and open records never paginate by swiping', () => {
  for (const setup of [f => { f.state.portalPage = 4; }, f => { f.state.portalPageSize = 100; },
    f => { f.body.dataset.mode = 'send'; }, f => { f.host.hidden = true; }, f => f.recordActive(true)]) {
    const f = fixture(); setup(f); const previous = f.state.portalPage;
    f.begin(); assert.equal(f.move().prevented, false); f.finish();
    assert.equal(f.state.portalPage, previous); assert.equal(f.renders, 0);
  }
});

test('a view change during a touch cancels the pending page turn', () => {
  for (const mutate of [f => { f.state.portalPage = 2; }, f => { f.state.portalLoadGeneration++; },
    f => { f.state.filter = 'BSV'; }, f => { f.state.portalPageSize = 50; }]) {
    const f = fixture(); f.begin(); f.move(); mutate(f); const previous = f.state.portalPage; f.finish();
    assert.equal(f.state.portalPage, previous); assert.equal(f.renders, 0);
  }
});

test('mobile results can turn once the pager is visible without scrolling through settings', () => {
  const f = fixture({mobile: true}); f.begin(); f.move(); f.finish();
  assert.equal(f.state.portalPage, 2); assert.equal(f.root.scrollTop, 100);
  const above = fixture({mobile: true}); above.controls.bottom = 1000; above.begin();
  above.controls.bottom = 780; above.move(); above.finish(); assert.equal(above.state.portalPage, 1);
  above.begin(); above.move(); above.finish(); assert.equal(above.state.portalPage, 2);
});

test('the document bottom also works below the results, but not inside an unfinished desktop list', () => {
  const f = fixture({mobile: true}); f.root.scrollTop = 1600;
  f.begin(f.host); f.move(100, 300, f.host); f.finish(100, 300, f.host); assert.equal(f.state.portalPage, 2);
  const desktop = fixture(); desktop.root.scrollTop = 1600; desktop.list.scrollTop = 200;
  desktop.begin(desktop.host); desktop.move(100, 300, desktop.host); desktop.finish(100, 300, desktop.host);
  assert.equal(desktop.renders, 0);
});

test('fractional scroll positions are accepted at the boundary and top swipes stay on the current page', () => {
  const f = fixture(); f.list.scrollTop = 1098.5; f.begin(); f.move(); f.finish(); assert.equal(f.state.portalPage, 2);
  const top = fixture({page: 2}); top.list.scrollTop = 0; top.begin(); top.move(100, 500); top.finish(100, 500);
  assert.equal(top.state.portalPage, 2);
});
