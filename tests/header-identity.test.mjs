import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

async function page() {
  const source = await read("chisel.header-identity.js");
  const account = {hidden: true};
  const accountCoin = {textContent: "LTC"};
  const accountAddress = {textContent: ""};
  const badge = {textContent: "", hidden: true, title: ""};
  const sendSelect = {hidden: false, value: "ravencoin"};
  const elements = new Map([
    ["portalPersonalAccount", account],
    ["portalPersonalAccountCoin", accountCoin],
    ["portalPersonalAccountAddress", accountAddress],
    ["headerAccountCoin", badge],
    ["headerCurrency", sendSelect]
  ]);
  let observer = null, pageshow = null;
  class Observer {
    constructor(callback) { observer = callback; }
    observe(target, options) {
      assert.equal(target, account);
      assert.equal(options.subtree, true);
      assert.equal(options.characterData, true);
      assert.equal(options.attributes, true);
    }
  }
  const context = {
    document: {body:{dataset:{}}, getElementById: id => elements.get(id)},
    window: {addEventListener: (kind, callback) => {
      if (kind === "pageshow") pageshow = callback;
    }},
    MutationObserver: Observer
  };
  vm.runInNewContext(source, context, {filename: "chisel.header-identity.js"});
  assert.ok(observer && pageshow);
  return {account, accountCoin, accountAddress, badge, sendSelect, window:context.window, body:context.document.body, sync: observer, pageshow};
}

test("unloaded identity leaves the Send currency unchanged", async () => {
  const ui = await page();
  assert.equal(ui.badge.hidden, true);
  assert.equal(ui.sendSelect.hidden, false);
  assert.equal(ui.sendSelect.value, "ravencoin");
});

test("loaded Litecoin identity shows LTC instead of unrelated RVN", async () => {
  const ui = await page();
  ui.account.hidden = false;
  ui.accountAddress.textContent = "LTC-public-address";
  ui.accountCoin.textContent = "LTC";
  ui.sync();
  assert.equal(ui.badge.hidden, false);
  assert.equal(ui.badge.textContent, "LTC");
  assert.equal(ui.sendSelect.hidden, true);
  assert.equal(ui.sendSelect.value, "ravencoin", "Never silently change transaction network");
  ui.accountCoin.textContent = "DGB";
  ui.pageshow();
  assert.equal(ui.badge.textContent, "DGB");
  ui.account.hidden = true;
  ui.sync();
  assert.equal(ui.badge.hidden, true);
  assert.equal(ui.sendSelect.hidden, false);
});

test("loaded identity network is displayed in every Chisel mode", async () => {
  const html = await read("index.html");
  assert.match(html, /id="headerAccountCoin" class="headerAccountCoin"/);
  assert.match(html, /#headerCurrency\[hidden\], #headerAccountCoin\[hidden\]/);
  assert.match(html, /chisel\.header-identity\.js\?rev=[^"]+/);
  assert.match(html, /chisel\.version\.js\?rev=[^"]+/);
  assert.doesNotMatch(html, /body\[data-mode="portal"\] #headerAccountCoin/);
});

test("account-only network choice labels the header without changing its selected chain", async () => {
  const ui=await page();
  ui.sendSelect.value="bsvTestnet";
  ui.window.CHISEL_ACTIVE_ACCOUNT={currency:"bsvTestnet",network:"testnet",ticker:"tBSV",address:"public-test-address",accountOnly:true};
  ui.sync();
  assert.equal(ui.badge.textContent,"tBSV");
  assert.equal(ui.sendSelect.hidden,false);
  assert.equal(ui.sendSelect.value,"bsvTestnet");
});

test("Polygon Send displays POL even when Portal has a loaded LTC account", async () => {
  const ui = await page();
  ui.account.hidden = false;
  ui.accountAddress.textContent = "LTC-public-address";
  ui.body.dataset.mode = "send";
  ui.body.dataset.sendNetwork = "polygon";
  ui.sendSelect.value = "polygon";
  ui.sync();
  assert.equal(ui.badge.textContent, "POL");
  assert.equal(ui.badge.hidden, false);
  ui.body.dataset.mode = "portal";
  ui.sync();
  assert.equal(ui.badge.textContent, "LTC");
});
