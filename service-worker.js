/* Chisel offline shell. No transaction, RPC, key or API responses are cached. */
'use strict';
const CACHE = 'chisel-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './chisel-icon.svg', './chisel.version.js', './app.js', './chisel.js', './chisel.portal.js'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(path => cache.add(new Request(path, {cache: 'reload'}))));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('chisel-shell-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  const isNav = req.mode === 'navigate';
  const staticAsset = /\.(?:html?|js|css|svg|png|webmanifest|woff2?)$/i.test(url.pathname);
  if (!isNav && !staticAsset) return;
  // Shared URLs and stateful deep links must never be stored in Cache Storage.
  const navigationWithState = isNav && Boolean(url.search || url.hash);
  // Never persist transaction-specific or user-dependent responses.
  if (/\/(?:api|rpc|fileproxy|chisel-data)\//i.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(req);
      if (!navigationWithState && response.ok && response.type === 'basic') {
        // Only static same-origin resources. Navigation cached for offline launch.
        await cache.put(req, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(req, {ignoreSearch: true});
      if (cached) return cached;
      if (isNav) {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
