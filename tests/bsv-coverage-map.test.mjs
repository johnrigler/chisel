import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({}); context.window = context;
vm.runInContext(await readFile(new URL('../chisel.portal.coverage.js', import.meta.url), 'utf8'), context);
const {createModel, cellLabel} = context.CHISEL_BSV_COVERAGE;
const base = {kind: 'bsv-block-scan', coin: 'bsv', blocks: [], jobs: []};

test('the square covers every height once, from oldest at the top left to newest at the bottom right', () => {
  for (const tipHeight of [0, 4, 99, 977426]) {
    const map = createModel(base, {tipHeight, side: 8});
    assert.equal(map.cells[0].start, 0); assert.equal(map.cells.at(-1).end, tipHeight);
    assert.equal(map.cells.reduce((sum, cell) => sum + cell.end - cell.start + 1, 0), tipHeight + 1);
    map.cells.forEach((cell, index) => {
      assert.ok(cell.end >= cell.start);
      if (index) assert.equal(cell.start, map.cells[index - 1].end + 1);
    });
  }
});

test('a visited subset is shaded separately from a fully complete square, partial work and errors', () => {
  const scan = {...base, blocks: [{height: 0, status: 'complete'}, {height: 25, status: 'partial'}, {height: 50, status: 'error', error: 'retry'}]};
  let map = createModel(scan, {tipHeight: 99, side: 2});
  assert.equal(map.cells[0].state, 'mixed'); assert.equal(map.cells[0].fraction, 1 / 25);
  assert.equal(map.cells[1].state, 'partial'); assert.equal(map.cells[2].state, 'error'); assert.equal(map.cells[3].state, 'empty');
  scan.blocks.push(...Array.from({length: 24}, (_, i) => ({height: i + 1, status: 'complete'})));
  map = createModel(scan, {tipHeight: 99, side: 2}); assert.equal(map.cells[0].state, 'complete');
  assert.match(cellLabel(map.cells[0]), /Blocks 0–24 · 25\/25 complete/);
});

test('reader travel never paints unreported blocks green', () => {
  const scan = {...base, blocks: [{height: 0, status: 'complete'}], jobs: [{name: 'early', direction: 'forward', anchorHeight: 0, nextHeight: 100}]};
  const map = createModel(scan, {tipHeight: 100, side: 8});
  assert.equal(map.cells.reduce((sum, cell) => sum + cell.complete, 0), 1);
  assert.ok(map.cells.filter(cell => cell.state === 'empty').length > 50);
});

test('early and recent readers stay distinct while the historical cursor remains available as saved detail', () => {
  const jobs = [{name: 'history', direction: 'backward', nextHeight: 90},
    {name: 'recent', direction: 'backward', anchorHeight: 100, nextHeight: 80},
    {name: 'early', direction: 'forward', anchorHeight: 10, nextHeight: 20}];
  const map = createModel({...base, jobs});
  assert.deepEqual(Array.from(map.readers, reader => reader.id), ['early', 'recent']);
  assert.deepEqual(Array.from(map.readers, reader => reader.arrow), ['→', '←']);
  assert.equal(map.otherJobs[0].name, 'history');
  assert.ok(map.readers[0].cell.index < map.readers[1].cell.index);
});

test('stopped or stale reports cannot make readers appear to be running', () => {
  const time = Date.parse('2026-11-27T18:00:00Z');
  const scan = {...base, jobs: [{name: 'early', direction: 'forward', nextHeight: 20, phase: 'scanning'}],
    runner: {lastReportedState: 'stopped', heartbeatAt: new Date(time).toISOString()}};
  let map = createModel(scan, {now: time}); assert.equal(map.state, 'Stopped'); assert.equal(map.readers[0].running, false);
  scan.runner.lastReportedState = 'running';
  map = createModel(scan, {now: time}); assert.equal(map.state, 'Running'); assert.equal(map.readers[0].running, true);
  map = createModel(scan, {now: time + 180001}); assert.equal(map.state, 'Last report'); assert.equal(map.readers[0].running, false);
  map = createModel(scan, {now: time - 60000}); assert.equal(map.readers[0].running, false);
});

test('a live tip extends the whole-ledger denominator without inventing new scanned sections', () => {
  const scan = {...base, blocksComplete: 580, jobs: [{name: 'recent', direction: 'backward', anchorHeight: 976665, nextHeight: 976552}]};
  const map = createModel(scan, {tipHeight: 977426});
  assert.equal(map.total, 977427); assert.equal(map.liveTip, true); assert.equal(map.percentage.toFixed(2), '0.06');
  assert.equal(map.cells.at(-1).state, 'empty');
  const staleTip = createModel(scan, {tipHeight: 900000}); assert.equal(staleTip.tip, 976665); assert.equal(staleTip.liveTip, false);
});

test('missing or invalid reader positions are not converted to block zero', () => {
  for (const nextHeight of [null, -1, true, [], {}, '', ' ']) {
    const map = createModel({...base, blocks: [null, {height: true, status: 'complete'}],
      jobs: [{name: 'early', direction: 'forward', nextHeight}]});
    assert.ok(map.readers.every(reader => reader.height === null && reader.cell === null));
    assert.equal(map.knownComplete, 0);
  }
});

test('large exports are binned without exceeding JavaScript argument limits', () => {
  const blocks = Array.from({length: 100000}, (_, height) => ({height, status: 'complete'}));
  const map = createModel({...base, blocks}, {tipHeight: 999999});
  assert.equal(map.complete, 100000); assert.equal(map.percentage, 10);
  assert.equal(map.cells.reduce((sum, cell) => sum + cell.complete, 0), 100000);
});

test('Apollo cursors have distinct markers and split when sharing a map cell', () => {
  const jobs = [
    {name:'early', direction:'forward', nextHeight:10},
    {name:'recent', direction:'backward', nextHeight:90},
    {name:'apollo-forward', direction:'forward', anchorHeight:50, nextHeight:50},
    {name:'apollo-backward', direction:'backward', anchorHeight:50, nextHeight:50}
  ];
  const map = createModel({...base, jobs}, {tipHeight:99, side:8});
  assert.deepEqual(Array.from(map.readers, r => r.id), ['early','recent','apollo-forward','apollo-backward']);
  const [forward, backward] = map.readers.slice(2);
  assert.equal(forward.marker,'A→'); assert.equal(backward.marker,'A←');
  assert.equal(forward.cell.index, backward.cell.index);
  assert.notEqual(forward.below, backward.below);
  assert.notEqual(forward.color, backward.color);
  assert.equal(map.otherJobs.length,0);
  assert.equal(map.knownComplete,0);
});

test('recent discoveries use unique valid BSV IDs and preserve scanner discovery order', () => {
  const a='a'.repeat(64), b='b'.repeat(64);
  const map=createModel({...base,jobs:[{name:'apollo-forward',direction:'forward',nextHeight:10,
    recentRecords:[{txid:a,blockHeight:9},{txid:b,blockHeight:8},{txid:a,blockHeight:9},
      {txid:'bad',blockHeight:9},{txid:'c'.repeat(64),blockHeight:null}]}]});
  assert.deepEqual(Array.from(map.readers[0].recentRecords,r=>r.txid),[a,b]);
});
