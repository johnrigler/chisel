(function (root) {
  "use strict";

  // Observed names are reader interpretations, not a new wire format.
  function describe(value) {
    if (value && value.p === "BSV_SECTION_1" && Array.isArray(value.f)) {
      return {label: "BSV section feed", guide: "bsv-section-1", count: value.f.length,
        section: typeof value.s === "string" ? value.s.slice(0, 80) : ""};
    }
    return null;
  }

  function render(doc, value) {
    const viewer = doc.createElement("div");
    viewer.className = "portalJsonTree";
    const span = function (className, text) {
      const node = doc.createElement("span"); node.className = className; node.textContent = text; return node;
    };
    const short = function (text, size) { return text.length > size ? text.slice(0, size) + "…" : text; };
    function node(item, key, depth) {
      const isObject = item !== null && typeof item === "object";
      const prefix = key === null ? "" : key + ": ";
      if (!isObject) {
        const kind = item === null ? "null" : typeof item;
        const text = JSON.stringify(item);
        if (typeof item === "string" && item.length > 400) {
          const details = doc.createElement("details"), summary = doc.createElement("summary");
          details.className = "portalJsonLongString";
          summary.appendChild(span("portalJsonKey", prefix));
          summary.appendChild(span("portalJsonString", short(text, 120)));
          summary.appendChild(span("portalJsonCount", " · " + item.length.toLocaleString() + " characters"));
          details.appendChild(summary);
          let mounted = false;
          details.addEventListener("toggle", function () {
            if (!details.open || mounted) return;
            mounted = true; details.appendChild(span("portalJsonString portalJsonFullString", text));
          });
          return details;
        }
        const line = doc.createElement("div"); line.className = "portalJsonLeaf";
        line.appendChild(span("portalJsonKey", prefix));
        line.appendChild(span("portalJson" + kind.charAt(0).toUpperCase() + kind.slice(1), text));
        return line;
      }
      const array = Array.isArray(item), keys = Object.keys(item), count = keys.length;
      const details = doc.createElement("details"), summary = doc.createElement("summary");
      details.className = "portalJsonBranch";
      summary.appendChild(span("portalJsonKey", prefix));
      summary.appendChild(span("portalJsonBrackets", array ? "[" : "{"));
      summary.appendChild(span("portalJsonCount", " " + count.toLocaleString() + (array ? " items " : " fields ")));
      summary.appendChild(span("portalJsonBrackets", array ? "]" : "}"));
      const title = !array && (typeof item.title === "string" ? item.title : typeof item.name === "string" ? item.name : "");
      if (key !== null && title) summary.appendChild(span("portalJsonCount", " · " + short(title, 100)));
      details.appendChild(summary);
      let mounted = false;
      details.addEventListener("toggle", function () {
        if (!details.open || mounted) return;
        mounted = true;
        const body = doc.createElement("div"); body.className = "portalJsonChildren";
        details.appendChild(body);
        // Deep structures retain an exact formatted source view below. Keep
        // interactive inspection bounded even for hostile/huge documents.
        if (depth >= 32) { body.appendChild(span("portalJsonCount", "Continue in formatted source.")); return; }
        let offset = 0;
        const more = doc.createElement("button"); more.type = "button"; more.className = "secondaryButton";
        const page = function () {
          const end = Math.min(offset + 100, count);
          for (; offset < end; offset += 1) {
            const childKey = keys[offset];
            body.insertBefore(node(item[childKey], array ? "[" + childKey + "]" : JSON.stringify(childKey), depth + 1), more);
          }
          more.hidden = offset >= count;
          more.textContent = "Show next " + Math.min(100, count - offset) + " items (" + (count - offset).toLocaleString() + " remaining)";
        };
        more.onclick = function (event) { event.preventDefault(); event.stopPropagation(); page(); };
        body.appendChild(more); page();
      });
      return details;
    }
    const tree = node(value, null, 0);
    tree.className += " portalJsonRoot";
    viewer.appendChild(tree);
    return viewer;
  }

  root.CHISEL_PORTAL_JSON = {describe: describe, render: render};
})(typeof window !== "undefined" ? window : globalThis);
