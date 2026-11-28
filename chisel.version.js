(function (root) {
  'use strict';

  // Single source of truth for the Chisel application release.
  // Increment for every published update to main; preserve earlier ledger protocol versions.
  const version = '2.9.25';
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Invalid Chisel release version.');
  }
  root.CHISEL_RELEASE = Object.freeze({ version: version });

  // Standalone pages can opt in without copying a version string.
  if (typeof document !== 'undefined') {
    // The index shell is already visible here; no crypto, ledger or RPC dependency.
    const badge = document.getElementById('version');
    if (badge && document.body && document.getElementById('headerCurrency')) {
      badge.textContent = 'chisel v' + version;
      document.title = 'Chisel ' + version;
      const url = new URL(root.location.href), params = url.searchParams;
      const share = params.has('opreturn') || params.has('share_url') || params.has('share_text') ||
        new URLSearchParams(url.hash.slice(1)).has('opreturn');
      const requested = params.get('mode');
      const aliases = {send:'send',etch:'send',broadcast:'send',review:'review',portal:'portal',
        polygon:'polygon',about:'about',origin:'about',start:'about',examples:'examples',tools:'tools',decode:'tools'};
      const mode = aliases[requested] || (!requested && share ? 'send' : 'portal');
      document.body.dataset.mode = mode;
      const polygon = mode === 'send' && ['evm','polygon'].includes(params.get('coin'));
      if (polygon) {
        document.body.dataset.sendNetwork = 'polygon';
        document.getElementById('headerCurrency').value = 'polygon';
      }
      const current = document.getElementById('activityCurrent');
      if (current) current.textContent = mode === 'send'
        ? (polygon ? 'Loading Polygon Send…' : 'Loading Send…') : 'Loading ' + mode + '…';
      if (mode === 'send') {
        // Fetch the transaction entry point early, without changing execution order.
        const preload = document.createElement('link');
        preload.rel = 'preload'; preload.as = 'script';
        preload.href = 'app.js?rev=20261126-menu-account-v2913'; preload.fetchPriority = 'high';
        document.head.appendChild(preload);
        if (polygon) {
          const ethers = document.createElement('link');
          ethers.rel = 'preload'; ethers.as = 'script'; ethers.href = 'vendor/ethers-6.6.0.umd.min.js';
          ethers.fetchPriority = 'high'; document.head.appendChild(ethers);
        }
      }
      document.addEventListener('DOMContentLoaded', function () {
        const main = document.querySelector('main');
        if (main) main.inert = false;
      }, {once:true});
    }
    const title = document.querySelector('title[data-chisel-release-title]');
    if (title) {
      const suffix = title.getAttribute('data-chisel-release-title') || '';
      title.textContent = 'Chisel ' + version + (suffix ? ' ' + suffix : '');
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
