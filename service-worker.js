/* Chisel offline shell. No transaction, RPC, key or API responses are cached. */
'use strict';
const CACHE = 'chisel-shell-v21';
const SHELL = ['./chisel.evm.decode.js?rev=20261122-gomez-reader-v2874', './chisel.bsv.media.js?rev=20261122-record-explore-v2871', './chisel.portal.explore.js?rev=20261122-record-explore-v2871', './chisel.portal.record.css?rev=20261122-record-explore-v2871', './', './index.html', './chisel.portal.mobile.css?rev=20261122-visible-payload-links-v2870', './tools/qrField/index.html?rev=20261119-simple-labels-v2865', './manifest.webmanifest', './chisel-icon.svg', './chisel.version.js?rev=20261124-clear-search-shell-v2880', './app.js?rev=20261124-base58-v2878', './chisel.js', './chisel.portal.discovery.js?rev=20261122-bsv-daemon-v2873', './chisel.portal.store.js?rev=20261122-gomez-reader-v2874', './chisel.portal.payload.js?rev=20261122-bsv-scan-v2867', './chisel.portal.record.js?rev=20261124-base58-v2878', './chisel.interactions.js?rev=20261122-bsv-scan-v2867', './chisel.thunderwords.js?rev=20261122-bsv-scan-v2867', './chisel.portal.static-data.js?rev=20261124-files-v2877', './chisel.portal.js?rev=20261124-clear-search-shell-v2880', './chisel.header-identity.js?rev=20261120-network-accounts-v2866', './chisel.networks.js?rev=20261120-network-accounts-v2866', './chisel.networks.ui.js?rev=20261120-network-accounts-v2866'];
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
  if (/\/(?:api|rpc|fileproxy|chisel[-_]data)\//i.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // Revalidate online navigations and versioned shell assets so a fresh
      // release label cannot be paired with an HTTP-cached older index page.
      const response = await fetch(req, (isNav || url.searchParams.has('rev')) ? {cache: 'no-cache'} : {});
      if (!navigationWithState && response.ok && response.type === 'basic') {
        // Only static same-origin resources. Navigation cached for offline launch.
        await cache.put(req, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(req) || await cache.match(req, {ignoreSearch: true});
      if (cached) return cached;
      if (isNav) {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
