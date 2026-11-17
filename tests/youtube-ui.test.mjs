import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const [shareSource, uiSource] = await Promise.all([
  readFile(new URL('../chisel.share-driver.js', import.meta.url), 'utf8'),
  readFile(new URL('../chisel.youtube.ui.js', import.meta.url), 'utf8'),
]);

// Small DOM fixture: test the production UI handler without a browser, a wallet,
// a network connection, or the cryptographic core.
function openYouTube({content = 'https://youtu.be/jNQXAC9IVRw', address = ''} = {}) {
  const nodes = new Map(), rootHandlers = new Map(), actions = [];
  function element(id) {
    const listeners = new Map(), classes = new Set();
    return {
      id, value: '', hidden: false, textContent: '', src: '',
      selectedOptions: [{textContent: 'Litecoin'}],
      classList: {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle(name) { if (classes.has(name)) { classes.delete(name); return false; } classes.add(name); return true; },
      },
      addEventListener(type, callback) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(callback);
      },
      dispatchEvent(event) { for (const callback of listeners.get(event.type) || []) callback(event); },
      click() { this.onclick?.(); },
      focus() { actions.push('focus:' + id); },
    };
  }
  const node = id => { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); };
  node('opReturnAscii').value = content;
  node('senderAddress').value = address;
  node('status').textContent = '';
  node('currency').value = 'litecoin';
  node('opReturnHex').value = 'old hex';
  node('sendButton').click = () => actions.push('Chisel send button');
  Object.defineProperty(node('senderWif'), 'value', {
    get() { assert.fail('YouTube UI must not read the WIF'); },
  });
  const workbench = element('workbench');
  node('sendCredentialForm').closest = selector => {
    assert.equal(selector, '.panel');
    return workbench;
  };
  const sendPanel = element('sendPanel');
  sendPanel.firstElementChild = {};
  sendPanel.insertBefore = element => { sendPanel.child = element; };

  const document = {
    head: {appendChild() {}},
    getElementById: node,
    querySelector(selector) {
      assert.equal(selector, '[data-mode-panel="etch"]');
      return sendPanel;
    },
    createElement(tag) {
      const el = element(tag);
      if (tag === 'section') {
        Object.defineProperty(el, 'innerHTML', {
          set(html) {
            for (const match of html.matchAll(/\bid="([^"]+)"/g)) node(match[1]);
          },
        });
      }
      return el;
    },
  };
  const window = {
    addEventListener(type, callback) { rootHandlers.set(type, callback); },
    setGuiMode(mode) { actions.push('mode:' + mode); },
  };
  const sandbox = vm.createContext({
    URL, URLSearchParams, TextEncoder, window, document,
    Event: class { constructor(type) {this.type = type;} },
    MutationObserver: class {observe() {}},
  });
  vm.runInContext(shareSource, sandbox, {filename: 'chisel.share-driver.js'});
  vm.runInContext(uiSource, sandbox, {filename: 'chisel.youtube.ui.js'});
  return {node, document, window, workbench, sendPanel, rootHandlers, actions};
}

test('YouTube link renders thumbnail and only public identity information', () => {
  const f = openYouTube({address: 'LfixturePublicAddress'});
  assert.equal(f.sendPanel.child.hidden, false);
  assert.equal(f.node('ytImage').src, 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg');
  assert.match(f.node('ytIdentity').textContent, /LfixturePublicAddress/);
  assert.match(f.node('ytLink').textContent, /youtu.be/);
  assert.equal(f.actions.length, 0);
});

test('Go with no identity only reveals settings, without entering the send path', () => {
  const f = openYouTube();
  f.node('ytGo').click();
  assert.equal(f.workbench.classList.contains('youtube-editing'), true);
  assert.match(f.node('ytStatus').textContent, /Load a Chisel identity/);
  assert.deepEqual(f.actions, ['focus:senderWif']);
});

test('Go with public address delegates to the existing audited Send button', () => {
  const f = openYouTube({address: 'LfixturePublicAddress'});
  f.node('ytGo').click();
  assert.deepEqual(f.actions, ['Chisel send button']);
  assert.match(f.node('ytStatus').textContent, /Preparing transaction for review/);
});

test('Cancel drops the unsent text and hex, returns to Portal, and never sends', () => {
  const f = openYouTube({address: 'LfixturePublicAddress'});
  f.node('ytCancel').click();
  assert.equal(f.node('opReturnAscii').value, '');
  assert.equal(f.node('opReturnHex').value, '');
  assert.equal(f.sendPanel.child.hidden, true);
  assert.deepEqual(f.actions, ['mode:portal']);
});

test('shared metadata title is shown only for the exact linked draft', () => {
  const f = openYouTube();
  f.rootHandlers.get('chisel:share-loaded')({detail: {
    content: f.node('opReturnAscii').value, title: 'A known video',
  }});
  assert.equal(f.node('ytTitle').textContent, 'A known video');
  f.node('opReturnAscii').value = 'https://youtu.be/dQw4w9WgXcQ';
  f.node('opReturnAscii').dispatchEvent({type: 'input'});
  assert.equal(f.node('ytTitle').textContent, 'YouTube video');
});
