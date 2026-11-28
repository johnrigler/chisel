(function (root) {
  "use strict";

  // Public downloaded catalogs/transactions only. Wallets, RPC balances,
  // credentials, configuration and shared notes do not use this store.
  function createCache(options) {
    const deps = options || {};
    const now = deps.now || Date.now;
    const budget = deps.maxBytes || 64 * 1024 * 1024;
    const entryLimit = deps.maxEntryBytes || 16 * 1024 * 1024;
    const recordLimit = deps.maxEntries || 1000;
    const metadata = new Map(), memory = new Map();
    const counters = {hits: 0, offlineHits: 0, downloads: 0, receivedBytes: 0};
    let db = null, epoch = 0, writes = Promise.resolve();
    let factory;
    try { factory = deps.indexedDB === undefined ? root.indexedDB : deps.indexedDB; } catch (_) {}

    function notify() { if (deps.onChange) { try { deps.onChange(); } catch (_) {} } }
    function enqueue(task) {
      const next = writes.then(task);
      writes = next.catch(function () {});
      return next;
    }
    function transaction(stores, mode, action) {
      return new Promise(function (resolve, reject) {
        let tx, result;
        const timeout = root.setTimeout(function () {
          try { if (tx) tx.abort(); } catch (_) {}
          reject(new Error("Browser cache storage timed out."));
        }, 2000);
        try {
          tx = db.transaction(stores, mode);
          tx.oncomplete = function () { root.clearTimeout(timeout); resolve(result && result.result); };
          tx.onabort = tx.onerror = function () { root.clearTimeout(timeout); reject(tx.error || new Error("Browser cache storage failed.")); };
          result = action(tx);
        } catch (error) { root.clearTimeout(timeout); reject(error); }
      });
    }
    function disable() {
      if (db) { try { db.close(); } catch (_) {} }
      db = null; metadata.clear(); memory.clear(); notify();
    }
    const ready = (async function () {
      if (!factory) return;
      db = await new Promise(function (resolve) {
        let settled = false;
        const timeout = root.setTimeout(function () { settled = true; resolve(null); }, 1000);
        let request;
        try { request = factory.open("chisel.portal.downloads.v1", 1); }
        catch (_) { root.clearTimeout(timeout); resolve(null); return; }
        request.onupgradeneeded = function () {
          const database = request.result;
          database.createObjectStore("responses", {keyPath: "key"});
          database.createObjectStore("metadata", {keyPath: "key"});
        };
        request.onsuccess = function () {
          root.clearTimeout(timeout);
          if (settled) { request.result.close(); return; }
          settled = true; resolve(request.result);
        };
        request.onerror = request.onblocked = function () { root.clearTimeout(timeout); settled = true; resolve(null); };
      });
      if (!db) return;
      db.onversionchange = disable;
      const saved = await transaction(["metadata"], "readonly", function (tx) { return tx.objectStore("metadata").getAll(); });
      saved.forEach(function (item) { metadata.set(item.key, item); });
    })().catch(disable).then(notify);

    function bytes(text) { return new TextEncoder().encode(text).byteLength; }
    function totalBytes() { return Array.from(metadata.values()).reduce(function (sum, item) { return sum + item.bytes; }, 0); }
    async function get(key) {
      await ready;
      try {
        const item = db ? await transaction(["responses"], "readonly", function (tx) { return tx.objectStore("responses").get(key); }) : memory.get(key);
        if (!item) return null;
        const meta = metadata.get(key);
        if (meta) {
          const changed = now() - (meta.touchedAt || meta.storedAt) > 60000;
          meta.usedAt = now();
          if (db && changed) enqueue(function () {
            if (metadata.get(key) !== meta || !db) return;
            meta.touchedAt = now();
            return transaction(["metadata"], "readwrite", function (tx) {
              const index = tx.objectStore("metadata"), request = index.get(key);
              request.onsuccess = function () {
                // Another tab may have replaced or evicted this file.
                if (request.result) index.put(Object.assign({}, request.result, {usedAt: now(), touchedAt: now()}));
              };
            });
          }).catch(function () {});
        }
        return item;
      } catch (_) { disable(); return null; }
    }
    function put(key, text, group, expectedEpoch) {
      const generation = expectedEpoch === undefined ? epoch : expectedEpoch;
      return enqueue(async function () {
        await ready;
        if (generation !== epoch || typeof text !== "string" || !["catalog", "transaction"].includes(group)) return false;
        const size = bytes(text), limit = db ? budget : Math.min(budget, 8 * 1024 * 1024);
        if (size > entryLimit || size > limit) return false;
        const meta = {key: key, group: group, bytes: size, storedAt: now(), usedAt: now(), touchedAt: now()};
        const value = {key: key, text: text, storedAt: meta.storedAt};
        function evictionPlan(entries) {
          const previous = entries.find(function (item) { return item.key === key; });
          let used = entries.reduce(function (sum, item) { return sum + item.bytes; }, 0) - (previous ? previous.bytes : 0) + size;
          let count = entries.length + (previous ? 0 : 1);
          const victims = new Set();
          const oldest = entries.filter(function (item) { return item.key !== key; }).sort(function (a, b) { return a.usedAt - b.usedAt; });
          for (const item of oldest) {
            if (used <= limit && count <= recordLimit) break;
            victims.add(item.key); used -= item.bytes; count -= 1;
          }
          return {victims: victims, remaining: entries.filter(function (item) { return item.key !== key && !victims.has(item.key); })};
        }
        let plan;
        try {
          if (db) await transaction(["responses", "metadata"], "readwrite", function (tx) {
            const data = tx.objectStore("responses"), index = tx.objectStore("metadata");
            const request = index.getAll();
            request.onsuccess = function () {
              // Plan and commit against one serialized transaction, so tabs
              // cannot independently fill the same origin past the budget.
              plan = evictionPlan(request.result);
              plan.victims.forEach(function (victim) { data.delete(victim); index.delete(victim); });
              data.put(value); index.put(meta);
            };
          });
          else {
            plan = evictionPlan(Array.from(metadata.values()));
            plan.victims.forEach(function (victim) { memory.delete(victim); }); memory.set(key, value);
          }
          metadata.clear(); plan.remaining.forEach(function (item) { metadata.set(item.key, item); });
          metadata.set(key, meta); notify(); return true;
        } catch (_) {
          // Keep the prior committed cache intact if a quota/write fails.
          return false;
        }
      });
    }
    function clear(group) {
      epoch += 1;
      return enqueue(async function () {
        await ready;
        let remaining = [];
        if (db) await transaction(["responses", "metadata"], "readwrite", function (tx) {
          const data = tx.objectStore("responses"), index = tx.objectStore("metadata");
          if (!group) { data.clear(); index.clear(); return; }
          const request = index.getAll();
          request.onsuccess = function () {
            remaining = request.result.filter(function (item) { return item.group !== group; });
            request.result.filter(function (item) { return item.group === group; })
              .forEach(function (item) { data.delete(item.key); index.delete(item.key); });
          };
        });
        else {
          remaining = Array.from(metadata.values()).filter(function (item) { return group && item.group !== group; });
          metadata.forEach(function (item, key) { if (!group || item.group === group) memory.delete(key); });
        }
        metadata.clear(); remaining.forEach(function (item) { metadata.set(item.key, item); }); notify();
      });
    }
    return {
      ready: ready, get: get, put: put, clear: clear,
      generation: function () { return epoch; },
      hit: function (offline) { counters.hits += 1; if (offline) counters.offlineHits += 1; notify(); },
      downloaded: function (text) { counters.downloads += 1; counters.receivedBytes += bytes(text); notify(); },
      stats: function () {
        const groups = {catalog: 0, transaction: 0};
        metadata.forEach(function (item) { groups[item.group] = (groups[item.group] || 0) + 1; });
        return Object.assign({persistent: !!db, entries: metadata.size, bytes: totalBytes(), maxBytes: db ? budget : Math.min(budget, 8 * 1024 * 1024), groups: groups}, counters);
      },
      flush: function () { return writes; }
    };
  }
  root.CHISEL_PORTAL_CACHE = {createCache: createCache};
})(typeof window !== "undefined" ? window : globalThis);
