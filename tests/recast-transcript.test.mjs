import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../tools/recast/', import.meta.url);
const context = vm.createContext({});
for (const file of ['transcript.js', 'core.js']) {
  vm.runInContext(await readFile(new URL(file, root), 'utf8'), context, { filename: file });
}
const X = context.MogwaiTranscript, C = context.MogwaiRecast;
const srt = [
  '1', '00:00:01,000 --> 00:00:02,500', 'user: This is the first statement.', '',
  '2', '00:00:03,100 --> 00:00:05,000', 'assistant: And this is the response.', '',
].join('\n');

test('SRT imports as independent phrase-level transcript with exact timestamps', () => {
  const transcript = X.fromText(srt, 'phone-call.srt');
  assert.equal(transcript.segments.length, 2);
  assert.equal(transcript.segments[0].start, 1);
  assert.equal(transcript.segments[0].end, 2.5);
  assert.equal(X.captionAt(transcript, 1.2).index, 0);
  assert.equal(X.captionAt(transcript, 2.8), null);
  assert.equal(X.captionAt(transcript, 3.5).index, 1);
  assert.equal(transcript.segments[0].words, undefined);
});

test('WebVTT settings and markup are stripped, no markup execution', () => {
  const text = 'WEBVTT\n\n00:01.100 --> 00:03.400 align:start\n<v Speaker><b>Timed</b> line</v>\n\n';
  const transcript = X.fromText(text, 'timed.vtt');
  assert.equal(transcript.segments[0].text, 'Timed line');
  assert.equal(transcript.segments[0].start, 1.1);
});

test('word timestamp JSON retains word-by-word timing and offset', () => {
  const transcript = X.fromText(JSON.stringify({ words: [
    { word: 'Exactly', start: 0, end: 0.5 },
    { word: 'right.', start: 0.5, end: 1.2 },
  ] }), 'words.json');
  transcript.offset = 2.4;
  assert.equal(X.captionAt(transcript, 2.7).wordIndex, 0);
  assert.equal(X.captionAt(transcript, 3.1).wordIndex, 1);
  assert.equal(X.captionAt(transcript, 1), null);
});

test('projects preserve transcripts, separate from 100 layout cue limit', () => {
  const transcript = X.fromText(srt, 'call.srt');
  transcript.segments[0].highlight = true;
  const project = C.validate({ format: C.FORMAT, width: 1280, height: 720,
    source: { name: 'call.ogg', kind: 'audio' }, cues: [C.emptyCue()], transcript });
  assert.equal(project.source.kind, 'audio');
  assert.equal(project.transcript.segments.length, 2);
  assert.equal(project.transcript.segments[0].highlight, true);
});

test('malformed and untimed captions are rejected', () => {
  assert.throws(() => X.fromText('Untimed transcription only', 'bad.txt'), /No timed captions/);
  assert.throws(() => X.fromText('1\n00:00:04,000 --> 00:00:03,000\nImpossible', 'bad.srt'), /Invalid transcript timing/);
});
