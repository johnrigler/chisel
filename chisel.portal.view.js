(function (root) {
  "use strict";

  // This patcher is for display-only trees (row headers and linked media).
  // Editors, payload controls and function runtimes have their own lifetimes.
  function patchDisplay(node, next) {
    if (node.nodeType === 3 && next.nodeType === 3) {
      if (node.nodeValue !== next.nodeValue) node.nodeValue = next.nodeValue;
      return node;
    }
    const sameImageSource = node.dataset && next.dataset && node.dataset.portalImageSource && node.dataset.portalImageSource === next.dataset.portalImageSource;
    if (node.tagName !== next.tagName || node.nodeType !== next.nodeType ||
        String(node.tagName).toLowerCase() === "img" && node.src !== next.src && !sameImageSource) {
      node.parentNode.replaceChild(next, node);
      return next;
    }
    const disclosure = String(node.tagName).toLowerCase() === "details" ? node.open : null;
    const attributes = function (element) {
      return element.attributes && typeof element.attributes.length === "number"
        ? Array.from(element.attributes).map(function (attr) { return [attr.name, attr.value]; })
        : Object.entries(element.attributes || {});
    };
    const incoming = new Map(attributes(next));
    attributes(node).forEach(function (attr) { if (!incoming.has(attr[0])) node.removeAttribute(attr[0]); });
    incoming.forEach(function (value, name) {
      if (sameImageSource && name === "src") return;
      if (!node.getAttribute || node.getAttribute(name) !== value) node.setAttribute(name, value);
    });
    ["className", "title", "href", "target", "rel", "alt", "loading", "referrerPolicy", "hidden", "disabled", "type"].forEach(function (key) {
      if (next[key] !== undefined && node[key] !== next[key]) node[key] = next[key];
    });
    node.onclick = next.onclick;
    if (String(node.tagName).toLowerCase() === "canvas") {
      if (node.width !== next.width) node.width = next.width;
      if (node.height !== next.height) node.height = next.height;
      const context = node.getContext && node.getContext("2d");
      if (context && context.drawImage) { context.clearRect(0, 0, node.width, node.height); context.drawImage(next, 0, 0); }
      return node;
    }
    patchChildren(node, next);
    if (disclosure !== null) node.open = disclosure;
    return node;
  }

  function patchChildren(container, next) {
    const children = Array.from(next.childNodes);
    if (!children.length) {
      if (container.textContent !== next.textContent) container.textContent = next.textContent;
      return;
    }
    children.forEach(function (child, i) {
      const current = container.childNodes[i];
      if (current) patchDisplay(current, child);
      else container.appendChild(child);
    });
    while (container.childNodes.length > children.length) container.removeChild(container.lastChild || container.childNodes[container.childNodes.length - 1]);
  }

  function createList(options) {
    let container = null, entries = new Map();
    function remove(entry) {
      if (options.dispose) options.dispose(entry.node);
      if (entry.node.parentNode) entry.node.parentNode.removeChild(entry.node);
    }
    function clear() { entries.forEach(remove); entries.clear(); }
    function render(target, rows) {
      if (target !== container) { clear(); container = target; }
      const original = Array.from(target.childNodes), wanted = new Set(rows.map(options.key));
      let anchor = null;
      if (target.scrollTop > 0 && target.getBoundingClientRect) {
        const bounds = target.getBoundingClientRect();
        original.some(function (node) {
          if (!node.getBoundingClientRect) return false;
          const rect = node.getBoundingClientRect();
          if (rect.bottom <= bounds.top || rect.top >= bounds.bottom) return false;
          anchor = {node: node, top: rect.top}; return true;
        });
      }
      entries.forEach(function (entry, key) { if (!wanted.has(key)) { remove(entry); entries.delete(key); } });
      const desired = rows.map(function (row) {
        const key = options.key(row);
        let entry = entries.get(key);
        // A reset can replace the row object while keeping its transaction ID.
        if (entry && entry.owner !== row) { remove(entry); entries.delete(key); entry = null; }
        if (!entry) {
          entry = {node: options.create(row), owner: row}; entries.set(key, entry);
        } else options.update(entry.node, row);
        return entry.node;
      });
      const live = new Set(desired);
      Array.from(target.childNodes).forEach(function (node) { if (!live.has(node)) target.removeChild(node); });

      // Keep the longest existing ordered subsequence. On older browsers, give
      // focused controls and iframe owners priority so moving siblings around
      // them does not interrupt their session. moveBefore preserves DOM state
      // even when two such rows exchange positions on supporting browsers.
      const positions = new Map(original.map(function (node, i) { return [node, i]; }));
      let lastPosition = -1;
      const ordered = desired.every(function (node) {
        if (!positions.has(node)) return true;
        const position = positions.get(node), follows = position > lastPosition;
        lastPosition = position; return follows;
      });
      const kept = new Set();
      if (ordered) desired.forEach(function (node) { if (positions.has(node)) kept.add(node); });
      else {
        const scores = [], previous = []; let best = -1;
        desired.forEach(function (node, i) {
          if (!positions.has(node)) { scores[i] = 0; previous[i] = -1; return; }
          const focused = target.ownerDocument && target.ownerDocument.activeElement;
          const protectedNode = node.contains && (node.contains(focused) || node.querySelector && node.querySelector("iframe"));
          const weight = protectedNode ? desired.length + 1 : 1;
          scores[i] = weight; previous[i] = -1;
          for (let j = 0; j < i; j += 1) if (positions.has(desired[j]) && positions.get(desired[j]) < positions.get(node) && scores[j] + weight > scores[i]) {
            scores[i] = scores[j] + weight; previous[i] = j;
          }
          if (best < 0 || scores[i] > scores[best]) best = i;
        });
        for (let i = best; i >= 0; i = previous[i]) kept.add(desired[i]);
      }
      let before = null;
      for (let i = desired.length - 1; i >= 0; i -= 1) {
        const node = desired[i];
        if (!kept.has(node)) {
          const siblings = node.parentNode === target ? Array.from(target.childNodes) : [], at = siblings.indexOf(node);
          if (at < 0 || (siblings[at + 1] || null) !== before) {
            if (typeof target.moveBefore === "function" && node.parentNode === target) target.moveBefore(node, before);
            else target.insertBefore(node, before);
          }
        }
        before = node;
      }
      if (anchor && anchor.node.parentNode === target) target.scrollTop += anchor.node.getBoundingClientRect().top - anchor.top;
    }
    return {render: render, clear: clear};
  }

  root.CHISEL_PORTAL_VIEW = {createList: createList, patchDisplay: patchDisplay, patchChildren: patchChildren};
})(window);
