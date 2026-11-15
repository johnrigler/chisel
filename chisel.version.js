(function (root) {
  'use strict';

  // Single source of truth for the Chisel application release.
  // Increment for every published update to main; preserve earlier ledger protocol versions.
  const version = '2.8.31';
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Invalid Chisel release version.');
  }
  root.CHISEL_RELEASE = Object.freeze({ version: version });

  // Standalone pages can opt in without copying a version string.
  if (typeof document !== 'undefined') {
    const title = document.querySelector('title[data-chisel-release-title]');
    if (title) {
      const suffix = title.getAttribute('data-chisel-release-title') || '';
      title.textContent = 'Chisel ' + version + (suffix ? ' ' + suffix : '');
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
