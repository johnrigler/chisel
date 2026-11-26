/* Chisel offline shell. No transaction, RPC, key or API responses are cached. */
'use strict';
const CACHE = 'chisel-shell-v54';
const SHELL = ['./chisel.send.registry.js?rev=20261126-send-registry-v295', './chisel.bsv.write.js?rev=20261126-send-registry-v295', './chisel.send.workspace.js?rev=20261126-send-registry-v295', './chisel.portal.view.js?rev=20261126-row-navigation-v28102', './data-bundled/portal-first-page.js?rev=20261125-fast-feed-v2894', './chisel.polygon.send.js?rev=20261125-polygon-recent-v2893', './chisel.evm.local.js?rev=20261125-polygon-fees-v2890', './chisel.evm.share.js?rev=20261125-local-polygon-v2884', './chisel.youtube.ui.js?rev=20261125-local-polygon-v2884', './chisel.evm.decode.js?rev=20261125-polygon-share-v2881', './chisel.bsv.media.js?rev=20261126-bitcom-v294', './chisel.portal.explore.js?rev=20261126-twetch-post-v299', './chisel.portal.record.css?rev=20261122-record-explore-v2871', './', './index.html', './chisel.portal.mobile.css?rev=20261122-visible-payload-links-v2870', './tools/qrField/index.html?rev=20261119-simple-labels-v2865', './manifest.webmanifest', './chisel-icon.svg', './chisel.version.js?rev=20261126-identity-v2910', './app.js?rev=20261126-refresh-route-v297', './chisel.js', './chisel.portal.discovery.js?rev=20261122-bsv-daemon-v2873', './chisel.portal.store.js?rev=20261126-app-facets-v28104', './chisel.portal.payload.js?rev=20261122-bsv-scan-v2867', './chisel.portal.record.js?rev=20261126-refresh-route-v297', './chisel.interactions.js?rev=20261126-record-source-v2898', './chisel.interactions.ui.js?rev=20261126-compact-comments-v28106', './chisel.thunderwords.js?rev=20261122-bsv-scan-v2867', './chisel.portal.static-data.js?rev=20261124-files-v2877', './chisel.portal.js?rev=20261126-twetch-post-v299', './chisel.header-identity.js?rev=20261125-polygon-fees-v2890', './chisel.networks.js?rev=20261120-network-accounts-v2866', './chisel.networks.ui.js?rev=20261120-network-accounts-v2866'];
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
    const versionedShell = !isNav && url.searchParams.has("rev") && SHELL.some(path => new URL(path,self.registration.scope).href === req.url);
    if (versionedShell) {
      const saved = await cache.match(req);
      if (saved) return saved;
    }
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
