(function (root) {
  "use strict";
  function create(options) {
    const doc = options.document || root.document, client = options.client, api = root.CHISEL_INTERACTIONS;
    const commentViews = new Set(), commentsByContainer = new WeakMap(), verifications = new Map();
    let timer = null, running = false, started = false;
    function element(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function button(label, action) {
      const node = element("button", "secondaryButton", label); node.type = "button"; node.onclick = action; return node;
    }
    function download(value, filename) {
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + "\n"], {type: "application/json"}));
      const link = element("a"); link.href = url; link.download = filename; link.click();
      root.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    function stamp(entry) {
      const value = entry.document.payload.kind === "comment" ? entry.document.payload.at : entry.receivedAt || entry.document.payload.at, date = new Date(value);
      return (Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown date") + (entry.seq === null ? " · pending" : "");
    }
    function verification(document) {
      const key = JSON.stringify(document);
      if (!verifications.has(key)) verifications.set(key, api.verifyDocument(document));
      return verifications.get(key);
    }
    function makeFeed(container, filter, fullComments) {
      const view = {container: container, filter: filter, entries: new Map()};
      const list = element("div", "portalHistoryList"); list.tabIndex = 0;
      list.setAttribute("aria-label", fullComments ? "Dated record comments" : "Recent Chisel interactions");
      const empty = element("p", "muted", fullComments ? "No comments yet." : "No interactions loaded yet.");
      const older = button(fullComments ? "OLDER COMMENTS" : "OLDER ACTIVITY", function () { client.refresh(filter, true, true); });
      const message = element("p", "muted portalHistoryMessage");
      container.appendChild(list); container.appendChild(empty); container.appendChild(older); container.appendChild(message);
      function makeCard(owner) {
        const entry = owner.entry, payload = entry.document.payload;
        const card = element("article", "portalHistoryEntry"); card.dataset.interactionId = payload.id;
        const top = element("div", "portalHistoryMeta");
        const kind = element("span", "portalHistoryKind", {visit: "Arrived", select: "Selected", engage: "Engaged", comment: "Comment"}[payload.kind]);
        if (payload.action === "open_media") kind.textContent = "Opened media";
        if (payload.action === "run_function") kind.textContent = "Run requested";
        if (payload.action === "function_drawn") kind.textContent = "Drew function";
        const time = element("time"); top.appendChild(kind); top.appendChild(time); card.appendChild(top);
        if (payload.subject && !fullComments) {
          const open = button(payload.title || "Open record", function () { options.open(payload.subject); });
          open.className = "portalHistoryRecord"; card.appendChild(open);
        } else if (!fullComments) card.appendChild(element("strong", "", payload.title || "Chisel"));
        const synopsis = element("p", fullComments ? "portalCommentText" : "portalHistorySynopsis", payload.kind === "comment" ? payload.comment : payload.synopsis);
        if (synopsis.textContent) card.appendChild(synopsis);
        const author = element("p", "portalHistoryAuthor", entry.document.proof ? "Verifying signature…" : (payload.session === client.session ? "You" : "Visitor") + (payload.kind === "comment" ? " · unsigned" : "")); card.appendChild(author);
        if (payload.kind === "comment") {
          const exportButton = button("JSON", function () { download(entry.document, "chisel-comment-" + payload.id + ".json"); });
          exportButton.className += " portalHistoryExport"; card.appendChild(exportButton);
          if (entry.document.proof) {
            const proof = element("details", "portalCommentProof");
            proof.appendChild(element("summary", "", "Signature"));
            proof.appendChild(element("pre", "json", JSON.stringify({identity: entry.document.identity, proof: entry.document.proof}, null, 2)));
            card.appendChild(proof);
          }
        }
        owner.time = time; owner.author = author;
        verification(entry.document).then(function (result) {
          if (result.status === "verified") { author.textContent = result.address + " · signature verified"; author.classList.add("isVerified"); }
          else if (result.status === "invalid") { author.textContent = "Invalid signature or interaction document"; author.classList.add("error"); }
          else author.textContent = (payload.session === client.session ? "You" : "Visitor") + (payload.kind === "comment" ? " · unsigned" : "");
        });
        return card;
      }
      function updateCard(node, owner) {
        const date = owner.entry.document.payload.kind === "comment" ? owner.entry.document.payload.at : owner.entry.receivedAt || owner.entry.document.payload.at;
        const title = owner.entry.receivedAt ? "Received " + owner.entry.receivedAt : "Awaiting API acknowledgement", label = stamp(owner.entry);
        if (owner.time.dateTime !== date) owner.time.dateTime = date;
        if (owner.time.title !== title) owner.time.title = title;
        if (owner.time.textContent !== label) owner.time.textContent = label;
      }
      const renderer = root.CHISEL_PORTAL_VIEW.createList({key: function (owner) { return owner.key; },
        create: function (owner) { const node = makeCard(owner); updateCard(node, owner); return node; }, update: updateCard});
      view.paint = function () {
        const feed = client.feed(view.filter), owners = feed.items.map(function (entry) {
          const key = entry.endpoint + ":" + entry.document.payload.id;
          if (!view.entries.has(key)) view.entries.set(key, {key: key, entry: entry});
          const owner = view.entries.get(key); owner.entry = entry; return owner;
        });
        const wanted = new Set(owners.map(function (owner) { return owner.key; }));
        for (const key of view.entries.keys()) if (!wanted.has(key)) view.entries.delete(key);
        renderer.render(list, owners); empty.hidden = owners.length > 0;
        const unavailable = !client.state.online && !!(feed.error || client.state.error);
        if (fullComments) empty.textContent = unavailable ? "Shared comments are unavailable. Pending comments stay on this device." : feed.loaded ? "No comments yet." : "Reading comments…";
        older.hidden = !feed.hasMore; older.disabled = feed.busy || unavailable;
        message.textContent = feed.error || unavailable ? "Shared history unavailable. Saved entries remain available." : feed.busy ? "Reading history…" : "";
      };
      return view;
    }
    const panel = doc.getElementById("portalViewingNow"), historyContainer = doc.getElementById("portalInteractionHistory");
    const globalView = makeFeed(historyContainer, {}, false);
    function paint() {
      globalView.paint();
      const state = client.state, pending = state.outbox.length;
      const status = doc.getElementById("portalInteractionStatus");
      if (status) {
        const error = state.error && (/outbox is full/.test(state.error) ? state.error : "FileProxy history API unavailable");
        status.textContent = state.online ? "Shared history" + (pending ? " · " + pending + " pending" : "") :
          (state.storageAvailable ? "Local history" : "History in this tab") + (pending ? " · " + pending + " pending" : "") + (error ? " · " + error : "");
        status.title = state.error;
      }
      for (const view of Array.from(commentViews)) {
        if (view.container.isConnected !== false) view.mounted = true;
        if (view.mounted && view.container.isConnected === false) { commentViews.delete(view); continue; }
        view.paint();
      }
    }
    function comments(container, record) {
      let view = commentsByContainer.get(container);
      const key = api.subjectKey(record.subject);
      if (view && view.key === key) { commentViews.add(view); view.paint(); return; }
      if (view) commentViews.delete(view);
      container.replaceChildren();
      const section = element("section", "portalComments");
      section.appendChild(element("h5", "", "Comments"));
      const entries = element("div"); section.appendChild(entries);
      view = makeFeed(entries, {subject: key, kind: "comment"}, true);
      view.key = key; view.container = container;
      const form = element("form", "portalCommentForm"), label = element("label", "", "Add a dated comment");
      const field = element("textarea"); field.rows = 3; field.maxLength = 4000;
      field.placeholder = "Add a comment to this record…"; label.appendChild(field); form.appendChild(label);
      const submit = button("POST COMMENT", null); submit.type = "submit"; form.appendChild(submit);
      const status = element("p", "muted"); status.setAttribute("role", "status"); form.appendChild(status);
      form.onsubmit = async function (event) {
        event.preventDefault(); const value = field.value;
        if (!value.trim()) { status.textContent = "Enter a comment."; return; }
        submit.disabled = true;
        try {
          const document = await client.record("comment", record, {comment: value});
          if (field.value === value) field.value = "";
          status.textContent = document.proof ? "Signed comment added. Pending entries sync through the API." : "Comment added. Pending entries sync through the API.";
        } catch (error) { status.textContent = error.message || String(error); }
        finally { submit.disabled = false; }
      };
      section.appendChild(form);
      section.appendChild(element("p", "muted", "Each comment is a new dated entry. A loaded identity signs the comment with its Litecoin identity."));
      container.appendChild(section); commentsByContainer.set(container, view); commentViews.add(view);
      view.paint(); client.refresh(view.filter);
    }
    async function tick(force) {
      if (running || doc.hidden && !force) return;
      running = true;
      try {
        await client.flush(force); await client.refresh({}, false, force);
        const filters = new Map();
        for (const view of commentViews) if (view.container.isConnected !== false) filters.set(view.key, view.filter);
        for (const filter of filters.values()) await client.refresh(filter, false, force);
      } catch (error) { client.state.error = error.message || String(error); paint(); }
      finally { running = false; }
    }
    function start() {
      if (started) return; started = true;
      panel.hidden = false;
      client.subscribe(paint); paint();
      const enabled = doc.getElementById("portalInteractionEnabled");
      enabled.checked = client.state.enabled;
      enabled.onchange = function () { client.setEnabled(enabled.checked); };
      doc.getElementById("portalInteractionRefresh").onclick = function () { tick(true); };
      doc.getElementById("portalInteractionExport").onclick = function () { download(client.exportData(), "chisel-interaction-history.json"); };
      doc.getElementById("portalInteractionClear").onclick = function () { verifications.clear(); client.clearLocal(); };
      client.record("visit", null, {mode: MODESafe(doc.body.dataset.mode), action: "arrive"}).catch(function () {});
      tick(false);
      timer = root.setInterval(function () { tick(false); }, 15000);
      doc.addEventListener("visibilitychange", function () { if (!doc.hidden) tick(false); });
      root.addEventListener("pagehide", function () { if (timer) root.clearInterval(timer); timer = null; client.flush(); });
      root.addEventListener("pageshow", function () { if (started && !timer) timer = root.setInterval(function () { tick(false); }, 15000); });
    }
    function MODESafe(value) { return ["portal", "send", "review", "examples", "tools"].includes(value) ? value : "portal"; }
    return {start: start, comments: comments, refresh: tick, paint: paint};
  }
  root.CHISEL_INTERACTIONS_UI = {create: create};
})(window);
