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
        const feed = client.feed(view.filter), visible = fullComments ? feed.items :
          feed.items.filter(function (entry) { return entry.document.payload.kind !== "visit"; });
        const owners = visible.map(function (entry) {
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
    function summarizeRecords(entries) {
      const records = new Map();
      for (const entry of entries) {
        const payload = entry && entry.document && entry.document.payload;
        if (!payload || !payload.subject || !["select", "engage"].includes(payload.kind)) continue;
        let key;
        try { key = api.subjectKey(payload.subject); } catch (_) { continue; }
        let record = records.get(key);
        if (!record) {
          record = {key: key, subject: payload.subject, title: payload.title || "Chisel record",
            url: payload.url || "", synopsis: payload.synopsis || "", views: 0, engagements: 0,
            lastAt: "", lastEntry: null};
          records.set(key, record);
        }
        if (payload.kind === "select") record.views++;
        else record.engagements++;
        if (!record.lastAt || payload.at > record.lastAt) {
          record.lastAt = payload.at; record.lastEntry = entry;
          record.title = payload.title || record.title;
          record.url = payload.url || record.url;
          record.synopsis = payload.synopsis || record.synopsis;
        }
      }
      return Array.from(records.values()).sort(function (a, b) {
        return b.views - a.views || b.engagements - a.engagements || b.lastAt.localeCompare(a.lastAt);
      });
    }
    function viewCount(record) {
      if (!record) return "";
      const views = record.views, engagements = record.engagements;
      return (views ? views + (views === 1 ? " view" : " views") : "") +
        (engagements ? (views ? " · " : "") + engagements + (engagements === 1 ? " media open" : " media opens") : "");
    }
    function makeRecordCatalog(container) {
      const view = {entries: new Map()}, list = element("div", "portalHistoryList portalViewedList");
      list.tabIndex = 0; list.setAttribute("aria-label", "Other viewed Chisel records");
      const empty = element("p", "muted", "No other records viewed yet.");
      const older = button("OLDER RECORDS", function () { client.refresh({}, true, true); });
      const message = element("p", "muted portalHistoryMessage");
      container.appendChild(list); container.appendChild(empty); container.appendChild(older); container.appendChild(message);
      function makeCard(owner) {
        const card = element("article", "portalViewedEntry");
        const open = button("", function () { options.open(owner.record.subject); });
        open.className = "portalViewedLink";
        const media = element("span", "portalViewedMedia");
        const body = element("span", "portalViewedBody");
        const title = element("span", "portalViewedTitle");
        const count = element("span", "portalViewedCount");
        body.appendChild(title); body.appendChild(count);
        open.appendChild(media); open.appendChild(body); card.appendChild(open);
        owner.open = open; owner.titleNode = title; owner.countNode = count; owner.media = media;
        owner.mediaId = null;
        updateCard(card, owner);
        return card;
      }
      function updateCard(_card, owner) {
        const record = owner.record;
        owner.titleNode.textContent = record.title || "Chisel record";
        owner.countNode.textContent = viewCount(record) || "Recorded interaction";
        owner.countNode.className = "portalViewedCount" + (record.views > 1 ? " isRepeated" : "");
        owner.open.title = "Open " + record.title + " in Portal";
        const videoId = youtubeVideoId(record.url);
        if (owner.mediaId !== videoId) {
          owner.media.replaceChildren();
          if (videoId) {
            const image = element("img", "portalViewedThumb");
            image.src = "https://i.ytimg.com/vi/" + videoId + "/mqdefault.jpg";
            image.alt = ""; image.loading = "lazy"; image.referrerPolicy = "no-referrer";
            image.onerror = function () { image.remove(); };
            owner.media.appendChild(image);
          }
          owner.media.hidden = !videoId; owner.mediaId = videoId;
        }
      }
      const renderer = root.CHISEL_PORTAL_VIEW.createList({
        key: function (owner) { return owner.key; }, create: makeCard, update: updateCard
      });
      view.paint = function (selectedKey, records) {
        const feed = client.feed({}), grouped = (records || summarizeRecords(feed.items))
          .filter(function (record) { return record.key !== selectedKey; });
        const owners = grouped.map(function (record) {
          if (!view.entries.has(record.key)) view.entries.set(record.key, {key: record.key});
          const owner = view.entries.get(record.key);
          owner.record = record; return owner;
        });
        const keys = new Set(owners.map(function (owner) { return owner.key; }));
        for (const key of view.entries.keys()) if (!keys.has(key)) view.entries.delete(key);
        renderer.render(list, owners);
        empty.hidden = owners.length > 0;
        older.hidden = !feed.hasMore;
        const unavailable = !client.state.online && !!(feed.error || client.state.error);
        older.disabled = feed.busy || unavailable;
        message.textContent = unavailable ? "Shared record history unavailable. Saved selections remain available." :
          feed.busy ? "Reading records…" : "";
      };
      return view;
    }
    const panel = doc.getElementById("portalViewingNow"), historyContainer = doc.getElementById("portalInteractionHistory");
    const globalView = makeRecordCatalog(historyContainer);
    const SELECTED_KEY = "chisel.portal.lastSelected.v1";
    let lastSelected = null, localCleared = false;
    try {
      const stored = root.localStorage && JSON.parse(root.localStorage.getItem(SELECTED_KEY) || "null");
      if (stored && typeof stored.title === "string" && stored.title.trim() && typeof stored.url === "string") {
        // Legacy cached selections contained only title and URL. Resolve their ledger
        // identity from a matching history entry rather than guessing a transaction.
        lastSelected = {title: stored.title.slice(0, 200), url: api.publicUrl(stored.url), subject: null};
        if (stored.subject) {
          api.subjectKey(stored.subject);
          lastSelected.subject = stored.subject;
        }
      }
    } catch (_) { lastSelected = null; }
    function rememberSelection(record) {
      if (!record || !record.subject) return;
      try { api.subjectKey(record.subject); } catch (_) { return; }
      const title = String(record.title || "").trim().slice(0, 200);
      if (!title) return;
      let url = "";
      try { url = api.publicUrl(String(record.url || "")); } catch (_) {}
      lastSelected = {title: title, url: url, subject: record.subject};
      localCleared = false;
      if (client.state.enabled) {
        try { root.localStorage.setItem(SELECTED_KEY, JSON.stringify(lastSelected)); } catch (_) {}
      }
      paint();
    }
    function selectedPreview(entries) {
      if (localCleared) return {record: null, entry: null};
      const selected = entries.find(function (entry) {
        const payload = entry.document && entry.document.payload;
        return payload && payload.kind === "select" && payload.subject;
      });
      if (lastSelected && !lastSelected.subject) {
        const match = entries.find(function (entry) {
          const payload = entry.document && entry.document.payload;
          return payload && payload.kind === "select" && payload.subject &&
            payload.title === lastSelected.title && payload.url === lastSelected.url;
        });
        if (match) {
          lastSelected.subject = match.document.payload.subject;
          try { root.localStorage.setItem(SELECTED_KEY, JSON.stringify(lastSelected)); } catch (_) {}
        }
      }
      return {record: lastSelected || selected && selected.document.payload || null,
        entry: lastSelected ? null : selected || null};
    }
    function youtubeVideoId(value) {
      if (!value) return "";
      try {
        const url = new URL(value);
        const hostname = url.hostname.toLowerCase();
        let id = "";
        if (hostname === "youtu.be" || hostname === "www.youtu.be") id = url.pathname.split("/")[1] || "";
        else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(hostname)) {
          const parts = url.pathname.split("/").filter(Boolean);
          id = parts[0] === "watch" ? url.searchParams.get("v") || "" :
            ["shorts", "embed", "live", "v"].includes(parts[0]) ? parts[1] || "" : "";
        }
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
      } catch (_) { return ""; }
    }
    function transactionLabel(record) {
      const subject = record && record.subject;
      const txid = String(subject && subject.txid || "").replace(/^0x/i, "").toLowerCase();
      if (!subject || !/^[0-9a-f]{64}$/.test(txid)) return "No transaction selected";
      const labels = {
        bitcoin: "BTC", digibyte: "DGB", dogecoin: "DOGE",
        ecash: "XEC", litecoin: "LTC", ravencoin: "RVN"
      };
      const coin = subject.coin === "evm"
        ? "EVM " + (subject.chainId ? "chain " + subject.chainId : "")
        : labels[subject.coin] || String(subject.coin || "Ledger").toUpperCase();
      return coin.trim() + " transaction · " + txid.slice(0, 10) + "…" + txid.slice(-8);
    }

    function renderLatest(latest, record, recent, stats) {
      // This slot represents a selected ledger transaction. Use its chain and
      // transaction ID instead of a semantic title that may be an address,
      // identifier, or other payload text.
      const title = transactionLabel(record);
      const txid = String(record && record.subject && record.subject.txid || "").replace(/^0x/i, "").toLowerCase();
      const validTransaction = /^[0-9a-f]{64}$/.test(txid);
      const count = stats && viewCount(stats) || "";
      const key = title + ":" + txid + ":" + count;
      if (latest.dataset.previewKey !== key) {
        latest.replaceChildren();
        const caption = element("span", "portalViewingNowCaption");
        caption.appendChild(element("span", "portalViewingNowTitle", title));
        if (count) caption.appendChild(element("span", "portalViewedCount" + (stats.views > 1 ? " isRepeated" : ""), count));
        latest.appendChild(caption);
        latest.dataset.previewKey = key;
      }
      const canOpen = validTransaction && !!(record && record.subject);
      latest.disabled = !canOpen;
      latest.onclick = function (event) {
        if (!canOpen) return;
        event.preventDefault(); event.stopPropagation();
        options.open(record.subject);
      };
      latest.setAttribute("aria-label", canOpen ? "Open " + title + " in Portal" : "No transaction selected");
      latest.title = canOpen ? [title, "Transaction ID: " + txid, count && count + " in loaded history",
        record.synopsis, recent && stamp(recent)].filter(Boolean).join("\n") : title;
    }
    function paint() {
      const feed = client.feed({}), selected = selectedPreview(feed.items);
      const records = summarizeRecords(feed.items);
      let key = "";
      try { if (selected.record && selected.record.subject) key = api.subjectKey(selected.record.subject); } catch (_) {}
      globalView.paint(key, records);
      const latest = doc.getElementById("portalInteractionLatest");
      if (latest) renderLatest(latest, selected.record, selected.entry,
        records.find(function (record) { return record.key === key; }));
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
      const control = element("div", "portalCommentControl");
      const toggle = button("💬", null);
      toggle.className += " portalCommentToggle";
      control.appendChild(toggle);
      const section = element("section", "portalComments");
      section.hidden = true;
      control.appendChild(section);
      let manuallyToggled = false;
      function setExpanded(expanded) {
        section.hidden = !expanded;
        toggle.setAttribute("aria-expanded", String(expanded));
      }
      toggle.onclick = function () {
        manuallyToggled = true;
        setExpanded(section.hidden);
      };
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
      const paintFeed = view.paint;
      view.paint = function () {
        paintFeed();
        const feed = client.feed(view.filter), count = feed.items.length;
        const countLabel = String(count) + (count && feed.hasMore ? "+" : "");
        const label = count ? countLabel + " loaded comments" : "Comments: add or view";
        if (!manuallyToggled) setExpanded(count > 0);
        toggle.textContent = count ? "💬 " + countLabel : "💬";
        toggle.setAttribute("aria-label", label);
        toggle.title = label;
      };
      container.appendChild(control); commentsByContainer.set(container, view); commentViews.add(view);
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
      doc.getElementById("portalInteractionClear").onclick = function () {
        verifications.clear(); lastSelected = null; localCleared = true;
        try { root.localStorage.removeItem(SELECTED_KEY); } catch (_) {}
        client.clearLocal(); paint();
      };
      tick(false);
      timer = root.setInterval(function () { tick(false); }, 15000);
      doc.addEventListener("visibilitychange", function () { if (!doc.hidden) tick(false); });
      root.addEventListener("pagehide", function () { if (timer) root.clearInterval(timer); timer = null; client.flush(); });
      root.addEventListener("pageshow", function () { if (started && !timer) timer = root.setInterval(function () { tick(false); }, 15000); });
    }
    return {start: start, comments: comments, refresh: tick, paint: paint, rememberSelection: rememberSelection};
  }
  root.CHISEL_INTERACTIONS_UI = {create: create};
})(window);
