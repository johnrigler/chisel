/* Register Chisel's scoped offline shell and retain sanitized PWA diagnostics. */
(function () {
  'use strict';
  const diag = window.CHISEL_DIAGNOSTICS;
  const state = {
    secureContext: !!window.isSecureContext,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    manifest: {status: 'not checked'},
    registration: null,
    beforeInstallPromptSeen: false,
    appInstalledEventSeen: false
  };
  function record(type, message, level, endpoint) {
    if (diag && typeof diag.record === 'function') {
      diag.record(type, message, {level: level || 'info', endpoint: endpoint || undefined});
    }
    if (typeof window.chiselActivity === 'function') window.chiselActivity('PWA', message, level || 'info');
  }
  function safeEndpoint(value) {
    return diag && typeof diag.endpoint === 'function' ? diag.endpoint(value) : null;
  }
  function workerInfo(worker) {
    return worker ? {state: worker.state || null, script: safeEndpoint(worker.scriptURL)} : null;
  }
  function registrationInfo() {
    const reg = state.registration;
    return reg ? {
      scope: safeEndpoint(reg.scope),
      installing: workerInfo(reg.installing),
      waiting: workerInfo(reg.waiting),
      active: workerInfo(reg.active),
      updateViaCache: reg.updateViaCache || null
    } : null;
  }
  function incomingShareParameterNames() {
    const declared = state.manifest && state.manifest.shareTarget && state.manifest.shareTarget.parameterNames || [];
    const query = new URLSearchParams(location.search);
    return declared.filter(name => query.has(name)).slice(0, 12);
  }
  function snapshot() {
    const link = document.querySelector('link[rel="manifest"]');
    return {
      secureContext: state.secureContext,
      serviceWorkerSupported: state.serviceWorkerSupported,
      controllerPresent: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      manifestLink: link ? safeEndpoint(link.href) : null,
      manifest: state.manifest,
      incomingShareParameterNames: incomingShareParameterNames(),
      registration: registrationInfo(),
      beforeInstallPromptSeen: state.beforeInstallPromptSeen,
      appInstalledEventSeen: state.appInstalledEventSeen
    };
  }
  window.CHISEL_PWA_DIAGNOSTICS = Object.freeze({snapshot: snapshot});

  window.addEventListener('beforeinstallprompt', function () {
    state.beforeInstallPromptSeen = true;
    record('pwa.installability', 'beforeinstallprompt event received');
  });
  window.addEventListener('appinstalled', function () {
    state.appInstalledEventSeen = true;
    record('pwa.installability', 'appinstalled event received');
  });

  async function inspectManifest() {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link || !link.href) {
      state.manifest = {status: 'missing-link'};
      record('pwa.manifest', 'Manifest link is missing', 'error');
      return;
    }
    try {
      const response = await fetch(link.href, {cache: 'no-store', credentials: 'same-origin'});
      if (!response.ok) {
        state.manifest = {status: 'http-error', httpStatus: response.status};
        record('pwa.manifest', 'Manifest request failed with HTTP ' + response.status, 'error', link.href);
        return;
      }
      const manifest = await response.json();
      const target = manifest && manifest.share_target;
      const params = target && target.params && typeof target.params === 'object' ? Object.keys(target.params) : [];
      const icons = Array.isArray(manifest && manifest.icons) ? manifest.icons : [];
      const clean = value => diag && typeof diag.clean === 'function'
        ? diag.clean(value || '', 240) : String(value || '').slice(0, 240);
      state.manifest = {
        status: 'loaded',
        id: clean(manifest.id),
        startUrl: clean(manifest.start_url),
        scope: clean(manifest.scope),
        display: clean(manifest.display),
        shareTarget: target ? {
          present: true,
          action: clean(target.action || './').slice(0, 240),
          method: clean(target.method || 'GET').slice(0, 12),
          enctype: clean(target.enctype || '').slice(0, 120),
          parameterNames: params.slice(0, 12).map(name => clean(name).slice(0, 60))
        } : {present: false},
        icons: icons.slice(0, 12).map(icon => ({
          sizes: clean(icon.sizes).slice(0, 80),
          type: clean(icon.type).slice(0, 80),
          purpose: clean(icon.purpose || 'any').slice(0, 80)
        }))
      };
      record('pwa.manifest', 'Manifest loaded; share target ' + (target ? 'present' : 'missing') + '; icons=' + icons.length, 'info', link.href);
      const incoming = incomingShareParameterNames();
      if (incoming.length) record('pwa.incoming-share', 'Incoming share parameter names present: ' + incoming.join(', '));
    } catch (error) {
      state.manifest = {status: 'error'};
      record('pwa.manifest', 'Manifest read failed: ' + (error && error.message || error), 'error', link.href);
    }
  }
  function attachRegistration(registration) {
    state.registration = registration;
    record('pwa.registration', 'Service worker registered; active=' + (registration.active && registration.active.state || 'none') +
      '; waiting=' + (registration.waiting && registration.waiting.state || 'none'), 'info', registration.scope);
    const track = worker => {
      if (worker) worker.addEventListener('statechange', () =>
        record('pwa.worker.state', 'Service worker state=' + worker.state, 'info', worker.scriptURL));
    };
    track(registration.installing);
    registration.addEventListener('updatefound', function () {
      record('pwa.update', 'Service worker update found', 'info', registration.scope);
      track(registration.installing);
    });
  }

  if (!state.serviceWorkerSupported) {
    record('pwa.unsupported', 'Service workers are not supported by this browser', 'error');
    return;
  }
  if (!state.secureContext) {
    record('pwa.insecure', 'Service worker registration skipped outside a secure context', 'error');
    return;
  }
  window.addEventListener('load', async function () {
    await inspectManifest();
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js', {scope: './', updateViaCache: 'none'});
      attachRegistration(registration);
      try {
        await registration.update();
        record('pwa.update', 'Service worker update check completed', 'info', registration.scope);
      } catch (error) {
        record('pwa.update', 'Service worker update check failed: ' + (error && error.message || error), 'warn', registration.scope);
      }
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        record('pwa.controller', 'Service worker now controls this page', 'info', registration.scope);
      });
    } catch (error) {
      record('pwa.registration', 'Service worker registration failed: ' + (error && error.message || error), 'error', './service-worker.js');
    }
  });
})();