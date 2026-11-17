/* Register Chisel's scoped offline shell without blocking startup. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', async function () {
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js', {scope: './', updateViaCache: 'none'});
      registration.update().catch(() => {});
      if (typeof window.chiselActivity === 'function') window.chiselActivity('PWA', 'Offline shell registered');
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        // Do not reload automatically: drafts, keys and ongoing transactions may be in memory.
        if (typeof window.chiselActivity === 'function') window.chiselActivity('PWA', 'Update available; reload when ready');
      });
    } catch (error) {
      if (typeof window.chiselActivity === 'function') window.chiselActivity('PWA', 'Offline shell unavailable: ' + error.message, 'error');
    }
  });
})();
