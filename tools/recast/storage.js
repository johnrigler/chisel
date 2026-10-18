(function (root) {
  'use strict';
  function isoWeek(now = new Date()) {
    const day = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
    const year = day.getUTCFullYear(), week = Math.ceil(((day - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
    return { year, week: String(week).padStart(2, '0') };
  }
  function defaults(now) { const { year, week } = isoWeek(now); return { year, folder: week, root: 'daisy' + year, directory: 'daisy_' + year }; }
  function path(value, allowEmpty = false) {
    if (typeof value !== 'string' || !value && !allowEmpty || /[\s\\:\x00-\x1f]/.test(value) || value.startsWith('/') || value.split('/').some(part => ['.', '..'].includes(part) || !part && value)) throw new Error('Use a relative folder/file path without spaces or ..');
    return value;
  }
  async function directory(handle, now) {
    const current = defaults(now), annual = /^daisy_(\d{4})$/.exec(handle.name);
    let selected = handle, label = handle.name;
    if (annual) {
      if (Number(annual[1]) !== current.year) throw new Error('This ISO week belongs to ' + current.directory + '. Choose that year folder or an exact working folder.');
      try { selected = await handle.getDirectoryHandle(current.folder); }
      catch (error) { if (error.name !== 'NotFoundError') throw error; selected = await handle.getDirectoryHandle(current.folder, { create: true }); }
      label += '/' + current.folder;
    }
    return { label, async write(name, data) {
      const parts = path(name).split('/'); let folder = selected;
      for (const part of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(part, { create: true });
      const file = parts.at(-1);
      try { await folder.getFileHandle(file); throw new Error('File already exists: ' + name); }
      catch (error) { if (error.name !== 'NotFoundError') throw error; }
      const entry = await folder.getFileHandle(file, { create: true }), writer = await entry.createWritable();
      try { await writer.write(data); await writer.close(); }
      catch (error) { try { await writer.abort(); } catch (_) {} throw error; }
    } };
  }
  function endpoint(value) {
    const url = new URL(value), local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!(url.protocol === 'https:' || url.protocol === 'http:' && local) || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTPS FileProxy URL, or HTTP on localhost.');
    return url.href.replace(/\/$/, '');
  }
  async function request(base, route, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await root.fetch(base + route, { ...options, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'FileProxy returned HTTP ' + response.status);
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('FileProxy is unavailable. Check its URL, local-network permission and running service. No download was substituted.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function proxy({ url, root: name, folder = '', token }) {
    const base = endpoint(url); path(folder, true);
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) throw new Error('Enter the registered FileProxy root name.');
    if (typeof token !== 'string' || !token) throw new Error('Enter the local FileProxy write token. It stays in memory.');
    const health = await request(base, '/v1/health');
    if (health.service !== 'fileproxy' || health.version !== 1 || !Array.isArray(health.roots) || !health.roots.includes(name)) throw new Error('FileProxy root ' + name + ' is not registered. Register the existing Daisy directory from your shell first.');
    return { label: name + ':' + (folder || '.'), async write(relative, data) {
      const destination = [folder, path(relative)].filter(Boolean).join('/'), body = { root: name, path: destination, overwrite: false };
      if (typeof data === 'string') body.text = data;
      else {
        const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(await data.arrayBuffer()), chunks = [];
        for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
        body.base64 = root.btoa(chunks.join(''));
      }
      const encoded = JSON.stringify(body);
      if (new TextEncoder().encode(encoded).length > 12 * 1024 * 1024) throw new Error('This file exceeds FileProxy’s 12 MiB request limit. Choose a local folder or use the ZIP download.');
      await request(base, '/v1/put', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-FileProxy-Token': token }, body: encoded });
    } };
  }
  let serial = 0;
  function snapshot(source, now = new Date()) {
    const base = String(source || 'video').split(/[\\/]/).at(-1).replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80) || 'video';
    return base + '-recast-' + now.toISOString().replace(/[-:.]/g, '') + '-' + (++serial).toString(36);
  }
  async function bundle(target, folder, files) {
    path(folder); let saved = 0;
    try { for (const file of files) { await target.write(folder + '/' + path(file.name), file.data); saved++; } }
    catch (error) { throw new Error('Save stopped after ' + saved + '/' + files.length + ' files in ' + target.label + '/' + folder + '. ' + error.message); }
    return target.label + '/' + folder;
  }
  root.MogwaiRecastStorage = Object.freeze({ isoWeek, defaults, path, directory, proxy, snapshot, bundle });
})(typeof globalThis !== 'undefined' ? globalThis : this);
