(function (root) {
  "use strict";
  const views = new WeakMap();
  const colors = {empty: "#22313d", complete: "#51d59a", partial: "#e9b95a", error: "#ed7d84"};
  const integer = value => (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const format = value => Number(value || 0).toLocaleString("en-US");
  function displayTime(value) {
    const date = new Date(value || "");
    return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, {month: "short", day: "numeric", hour: "numeric", minute: "2-digit"}) : "unknown";
  }

  function recentRecords(job) {
    const seen = new Set();
    return (Array.isArray(job.recentRecords) ? job.recentRecords : []).filter(function (record) {
      if (!record || typeof record.txid !== "string" || !/^[0-9a-f]{64}$/.test(record.txid) ||
          seen.has(record.txid) || integer(record.blockHeight) === null) return false;
      seen.add(record.txid); return true;
    }).slice(0, 20);
  }

  function createModel(scan, options) {
    const settings = options || {}, blocks = new Map();
    (Array.isArray(scan.blocks) ? scan.blocks : Array.isArray(scan.topBlocks) ? scan.topBlocks : []).forEach(function (block) {
      if (!block || typeof block !== "object") return;
      const height = integer(block.height);
      if (height !== null) blocks.set(height, block);
    });
    const jobs = (Array.isArray(scan.jobs) ? scan.jobs : []).filter(Boolean);
    const reported = [integer(scan.tipHeight), integer(scan.nextHeight), ...blocks.keys()];
    jobs.forEach(function (job) { reported.push(integer(job.anchorHeight), integer(job.nextHeight), integer(job.currentBlock && job.currentBlock.height)); });
    const reportedTip = reported.reduce((highest, value) => value === null ? highest : Math.max(highest, value), 0);
    const liveTip = integer(settings.tipHeight);
    const tip = Math.max(reportedTip, liveTip === null ? 0 : liveTip), total = tip + 1;
    const side = Math.max(1, Math.min(96, integer(settings.side) || 64, Math.floor(Math.sqrt(total))));
    const cells = Array.from({length: side * side}, function (_, index) {
      const start = Math.floor(index * total / (side * side));
      const end = Math.floor((index + 1) * total / (side * side)) - 1;
      return {index, start, end, complete: 0, partial: 0, errors: 0, visited: 0};
    });
    const cellForHeight = height => Math.max(0, Math.min(cells.length - 1, Math.ceil((height + 1) * cells.length / total) - 1));
    blocks.forEach(function (block, height) {
      const cell = cells[cellForHeight(height)]; cell.visited += 1;
      if (block.status === "complete") cell.complete += 1;
      else cell.partial += 1;
      if (block.status === "error" || block.error) cell.errors += 1;
    });
    cells.forEach(function (cell) {
      cell.fraction = cell.complete / (cell.end - cell.start + 1);
      cell.state = cell.errors ? "error" : cell.partial ? "partial" : cell.fraction === 1 ? "complete" : cell.complete ? "mixed" : "empty";
    });
    const chosen = [];
    const early = jobs.find(job => job.name === "early") || jobs.find(job => job.direction === "forward");
    const recent = jobs.find(job => job.name === "recent") || jobs.find(job => job.direction === "backward");
    if (early) chosen.push(early);
    if (recent && recent !== early) chosen.push(recent);
    ["apollo-forward", "apollo-backward"].forEach(function (name) {
      const job = jobs.find(item => item.name === name);
      if (job && !chosen.includes(job)) chosen.push(job);
    });
    const stamp = Date.parse(scan.runner && scan.runner.heartbeatAt || scan.lastCheckedAt || scan.generatedAt || "");
    const age = (settings.now == null ? Date.now() : settings.now) - stamp;
    const fresh = Number.isFinite(stamp) && age >= 0 && age < 180000;
    const runner = String(scan.runner && scan.runner.lastReportedState || "snapshot");
    const readers = chosen.map(function (job, index) {
      const height = integer(job.currentBlock && job.currentBlock.height) ?? integer(job.nextHeight);
      const cell = height === null ? null : cells[cellForHeight(height)];
      return {job, height, cell, recentRecords: recentRecords(job), id: String(job.name || "reader-" + index),
        title: job.name === "apollo-forward" ? "Apollo forward" : job.name === "apollo-backward" ? "Apollo backward" :
          job.direction === "forward" ? "Early reader" : "Recent reader",
        marker: job.name === "apollo-forward" ? "A→" : job.name === "apollo-backward" ? "A←" : job.direction === "forward" ? "E→" : "R←",
        arrow: job.direction === "forward" ? "→" : "←",
        color: job.name === "apollo-forward" ? "#ffd166" : job.name === "apollo-backward" ? "#ff9f83" :
          job.direction === "forward" ? "#6edcf6" : "#d8a6ff",
        running: runner === "running" && fresh && job.phase === "scanning"};
    });
    const groups = new Map();
    readers.forEach(function (reader) {
      if (!reader.cell) return;
      const group = groups.get(reader.cell.index) || [];
      group.push(reader); groups.set(reader.cell.index, group);
    });
    groups.forEach(function (group) {
      group.forEach(function (reader, index) {
        reader.below = (Math.floor(reader.cell.index / side) < 8) !== (index % 2 === 1);
        reader.offset = group.length > 2 ? (Math.floor(index / 2) - (Math.ceil(group.length / 2) - 1) / 2) * 38 : 0;
      });
    });
    const knownComplete = Array.from(blocks.values()).filter(block => block.status === "complete").length;
    const complete = integer(scan.blocksComplete) ?? knownComplete;
    return {tip, total, reportedTip, liveTip: liveTip !== null && liveTip >= reportedTip, side, cells, readers,
      otherJobs: jobs.filter(job => !chosen.includes(job)), knownComplete, complete,
      percentage: Math.min(100, complete * 100 / total), runner, fresh,
      state: runner === "stopped" ? "Stopped" : runner === "running" && fresh ? "Running" : runner === "running" ? "Last report" : "Saved snapshot"};
  }

  function cellLabel(cell) {
    return "Blocks " + format(cell.start) + "–" + format(cell.end) + " · " + format(cell.complete) + "/" +
      format(cell.end - cell.start + 1) + " complete · " + format(cell.partial) + " partial" +
      (cell.errors ? " · " + format(cell.errors) + " need retry" : "");
  }

  function buildView(container) {
    const doc = container.ownerDocument;
    const make = function (tag, cls, text, parent) {
      const node = doc.createElement(tag); if (cls) node.className = cls;
      if (text) node.textContent = text; if (parent) parent.appendChild(node); return node;
    };
    container.replaceChildren();
    const section = make("section", "portalCoverage", "", container);
    const head = make("div", "portalCoverageHeading", "", section);
    make("h3", "", "BSV ledger coverage", head);
    const refresh = make("button", "secondaryButton portalCoverageRefresh", "REFRESH", head); refresh.type = "button";
    const status = make("p", "portalCoverageStatus", "", section); status.setAttribute("role", "status");
    const metrics = make("div", "portalCoverageMetrics", "", section);
    const percent = make("strong", "portalCoveragePercent", "", metrics);
    const counts = make("span", "", "", metrics);
    const edges = make("div", "portalCoverageEdges", "", section);
    make("span", "", "↖ Oldest · block 0", edges); const newest = make("span", "", "", edges);
    const frame = make("div", "portalCoverageFrame", "", section);
    const canvas = make("canvas", "portalCoverageCanvas", "", frame); canvas.width = canvas.height = 512;
    canvas.tabIndex = 0; canvas.setAttribute("role", "img");
    const markerLayer = make("div", "portalCoverageMarkers", "", frame);
    const selected = make("p", "portalCoverageSelection", "Tap a square to inspect its block range.", section);
    selected.setAttribute("aria-live", "polite");
    const legend = make("div", "portalCoverageLegend", "", section);
    [["empty", "Not scanned"], ["mixed", "Part scanned"], ["complete", "Complete"], ["partial", "In progress"], ["error", "Needs retry"]].forEach(function (item) {
      const label = make("span", "", "", legend); make("i", "coverage-" + item[0], "", label); make("span", "", item[1], label);
    });
    const scale = make("p", "help", "", section);
    const cards = make("div", "portalCoverageReaders", "", section);
    const detail = make("details", "portalCoverageDetails", "", section); make("summary", "", "Scan details and other saved cursors", detail);
    const detailBody = make("div", "portalCoverageDetailBody", "", detail);
    const view = {section, refresh, status, percent, counts, newest, canvas, frame, markerLayer, selected, scale, cards, detailBody,
      markers: new Map(), readerCards: new Map(), selection: null, model: null, make};
    refresh.onclick = function () { if (view.onRefresh) view.onRefresh(); };
    function hit(event) {
      const rect = canvas.getBoundingClientRect(), side = view.model.side;
      const x = Math.max(0, Math.min(side - 1, Math.floor((event.clientX - rect.left) * side / rect.width)));
      const y = Math.max(0, Math.min(side - 1, Math.floor((event.clientY - rect.top) * side / rect.height)));
      return y * side + x;
    }
    canvas.onpointermove = function (event) { if (view.model) canvas.title = cellLabel(view.model.cells[hit(event)]); };
    canvas.onclick = function (event) { if (view.model) { view.selection = hit(event); paint(view); } };
    canvas.onkeydown = function (event) {
      if (!view.model) return;
      const side = view.model.side, last = view.model.cells.length - 1, current = view.selection || 0;
      const values = {ArrowLeft: current - 1, ArrowRight: current + 1, ArrowUp: current - side, ArrowDown: current + side, Home: 0, End: last};
      if (!(event.key in values)) return;
      event.preventDefault(); view.selection = Math.max(0, Math.min(last, values[event.key])); paint(view);
    };
    return view;
  }

  function paint(view) {
    const model = view.model;
    const context = view.canvas.getContext && view.canvas.getContext("2d");
    if (context) {
      const step = view.canvas.width / model.side;
      context.fillStyle = "#101c26"; context.fillRect(0, 0, view.canvas.width, view.canvas.height);
      model.cells.forEach(function (cell) {
        let color = colors[cell.state] || colors.empty;
        if (cell.state === "mixed") {
          const fraction = Math.sqrt(cell.fraction);
          color = "rgb(" + [34 + 47 * fraction, 49 + 164 * fraction, 61 + 93 * fraction].map(Math.round).join(",") + ")";
        }
        context.fillStyle = color;
        context.fillRect(cell.index % model.side * step + 1, Math.floor(cell.index / model.side) * step + 1, Math.max(1, step - 1), Math.max(1, step - 1));
      });
      if (view.selection !== null) {
        const cell = model.cells[Math.min(view.selection, model.cells.length - 1)];
        context.strokeStyle = "#fff"; context.lineWidth = 2;
        context.strokeRect(cell.index % model.side * step, Math.floor(cell.index / model.side) * step, step, step);
      }
    }
    if (view.selection !== null) view.selected.textContent = cellLabel(model.cells[Math.min(view.selection, model.cells.length - 1)]);
  }

  function render(container, scan, options) {
    if (!container || !scan || scan.kind !== "bsv-block-scan" || scan.coin !== "bsv") return;
    const settings = options || {};
    let view = views.get(container);
    if (!view || view.section.parentNode !== container) { view = buildView(container); views.set(container, view); }
    const model = createModel(scan, settings); view.model = model;
    if (settings.onRefresh) view.onRefresh = settings.onRefresh;
    view.onReader = settings.onReader;
    view.refresh.disabled = !!settings.loading;
    view.percent.textContent = model.percentage > 0 && model.percentage < 0.01 ? "<0.01%" : model.percentage.toFixed(2) + "%";
    view.counts.textContent = "of ledger blocks complete · " + format(model.complete) + " / " + format(model.total) +
      " · " + format(scan.transactionsChecked) + " transactions checked";
    view.status.textContent = model.state + " · last export " + displayTime(scan.generatedAt || scan.lastCheckedAt) +
      (settings.error ? " · " + settings.error : settings.loading ? " · checking for updates…" : "");
    view.status.dataset.state = model.state.toLowerCase().replace(/\s+/g, "-");
    view.status.dataset.stale = settings.error ? "true" : "false";
    view.newest.textContent = (model.liveTip ? "Current tip" : "Last reported tip") + " · " + format(model.tip) + " ↘";
    view.canvas.setAttribute("aria-label", "BSV ledger from block 0 at the top left to block " + model.tip +
      " at the bottom right. " + format(model.complete) + " blocks complete. Use arrow keys to inspect squares.");
    view.scale.textContent = "Each square represents about " + format(Math.ceil(model.total / model.cells.length)) +
      " blocks, read left to right, then down. Green shows reported complete block scans." +
      (model.knownComplete < model.complete ? " Some completed blocks have no positions in this export." : "");
    const visible = new Set();
    model.readers.forEach(function (reader) {
      visible.add(reader.id);
      let marker = view.markers.get(reader.id), card = view.readerCards.get(reader.id);
      if (!marker) { marker = view.make("span", "portalCoverageReaderMarker", "", view.markerLayer); view.markers.set(reader.id, marker); }
      marker.textContent = reader.marker;
      marker.style.setProperty("--reader-color", reader.color); marker.classList.toggle("isRunning", reader.running);
      marker.hidden = !reader.cell;
      if (reader.cell) {
        marker.classList.toggle("isTop", reader.below);
        marker.style.setProperty("--reader-offset", reader.offset + "px");
        marker.style.left = (reader.cell.index % model.side + 0.5) * 100 / model.side + "%";
        marker.style.top = (Math.floor(reader.cell.index / model.side) + 0.5) * 100 / model.side + "%";
        marker.title = reader.title + " " + reader.arrow + " block " + format(reader.height);
      }
      if (!card) {
        const node = view.make("article", "portalCoverageReader", "", view.cards);
        card = {node, title: view.make("strong", "", "", node), position: view.make("p", "", "", node),
          progress: view.make("progress", "", "", node), state: view.make("p", "help", "", node),
          open: view.make("button", "secondaryButton portalCoverageOpenReader", "", node)};
        card.open.type = "button";
        card.node.onclick = function (event) {
          if (event.target !== card.open && !card.open.disabled && !card.open.hidden) card.open.click();
        };
        view.readerCards.set(reader.id, card);
      }
      card.node.style.setProperty("--reader-color", reader.color);
      card.title.textContent = reader.arrow + " " + reader.title + " · " + reader.id;
      card.open.hidden = !view.onReader;
      card.open.disabled = !reader.recentRecords.length && reader.height === null;
      card.open.textContent = reader.recentRecords.length ? "View recent finds (" + reader.recentRecords.length + ")" : "View nearby records";
      card.open.onclick = function () { if (view.onReader) view.onReader(reader); };
      const current = reader.job.currentBlock || {}, checked = integer(current.transactionsChecked), total = integer(current.transactionsTotal);
      card.position.textContent = reader.height === null ? "Position not reported" : "Block " + format(reader.height) +
        (checked !== null && total !== null ? " · " + format(checked) + " / " + format(total) + " transactions" : "");
      card.progress.hidden = checked === null || total === null || !total;
      card.progress.max = Math.max(1, total || 1); card.progress.value = checked || 0;
      card.progress.setAttribute("aria-label", reader.title + " current block progress");
      card.state.textContent = (reader.job.lastError ? "Retry needed: " + reader.job.lastError : model.state === "Stopped" ? "Stopped at last report" :
        reader.running ? "Reading " + (reader.job.direction === "forward" ? "toward newer blocks" : "toward older blocks") : "Last reported: " + String(reader.job.phase || "unknown"));
    });
    view.markers.forEach(function (node, id) { if (!visible.has(id)) { node.remove(); view.markers.delete(id); } });
    view.readerCards.forEach(function (card, id) { if (!visible.has(id)) { card.node.remove(); view.readerCards.delete(id); } });
    view.detailBody.replaceChildren();
    view.make("p", "help", format(scan.blocksComplete) + " / " + format(scan.blocksChecked) + " visited blocks complete · " + format(scan.candidates) + " candidate records", view.detailBody);
    if (scan.runner && scan.runner.heartbeatAt) view.make("p", "help", "Daemon last reported " + scan.runner.lastReportedState + " · heartbeat " + scan.runner.heartbeatAt, view.detailBody);
    model.otherJobs.forEach(function (job) { view.make("p", "help", String(job.name || "scan") + " · " + String(job.direction || "unknown") + " · next block " + String(job.nextHeight) + " · saved cursor", view.detailBody); });
    if (scan.lastError) view.make("p", "help", "Scanner report: " + scan.lastError, view.detailBody);
    paint(view); return view;
  }

  function createController(deps) {
    const container = deps.container, panel = deps.panel, doc = container.ownerDocument;
    let snapshot = null, tip = null, tipAt = 0, pending = null, timer = null, lastAttempt = 0, error = "", disposed = false;
    const active = () => !disposed && panel.open && !doc.hidden && (!deps.isActive || deps.isActive());
    const now = deps.now || Date.now;
    function draw(loading) {
      if (snapshot) render(container, snapshot, {tipHeight: tip, now: now(), loading, error, onRefresh: () => refresh(true),
        onReader: deps.onReader ? reader => deps.onReader(reader, deps.scanUrl()) : null});
      else {
        container.textContent = loading ? "Reading the latest BSV scan report…" : error || "No BSV scan report available.";
        if (!loading) {
          const button = doc.createElement("button"); button.type = "button"; button.className = "secondaryButton";
          button.textContent = "RETRY"; button.onclick = () => refresh(true); container.appendChild(button);
        }
      }
    }
    function setSnapshot(scan) {
      if (disposed || !scan || scan.kind !== "bsv-block-scan" || scan.coin !== "bsv") return;
      const stamp = value => Date.parse(value.generatedAt || value.lastCheckedAt || "") || 0;
      if (snapshot && stamp(scan) < stamp(snapshot)) return;
      snapshot = scan; draw(!!pending);
    }
    async function refresh(force) {
      if (!active() || pending || !force && now() - lastAttempt < 15000) return pending;
      lastAttempt = now(); error = ""; draw(true);
      const tasks = [deps.fetchJson(deps.scanUrl()).then(function (scan) {
        if (!scan || scan.kind !== "bsv-block-scan" || scan.coin !== "bsv" || scan.network && scan.network !== "mainnet") throw new Error("Invalid BSV mainnet scan report");
        setSnapshot(scan);
      }).catch(function () { error = snapshot ? "Refresh unavailable; showing saved coverage" : "Scan report unavailable"; })];
      if (tip === null || now() - tipAt >= 300000) tasks.push(deps.fetchJson("https://api.whatsonchain.com/v1/bsv/main/chain/info").then(function (info) {
        const height = integer(info && info.blocks);
        if (!disposed && height !== null && (!info.chain || info.chain === "main")) { tip = height; tipAt = now(); draw(true); }
      }).catch(function () {}));
      pending = Promise.allSettled(tasks).finally(function () { pending = null; if (!disposed) draw(false); });
      return pending;
    }
    function schedule() {
      if (timer !== null) { root.clearInterval(timer); timer = null; }
      if (!active()) return;
      refresh(false); timer = root.setInterval(function () { refresh(false); }, 60000);
    }
    panel.addEventListener("toggle", schedule); doc.addEventListener("visibilitychange", schedule);
    root.addEventListener("chisel:mode", schedule); root.addEventListener("focus", schedule);
    schedule();
    return {setSnapshot, refresh, dispose: function () {
      disposed = true; if (timer !== null) root.clearInterval(timer);
      panel.removeEventListener("toggle", schedule); doc.removeEventListener("visibilitychange", schedule);
      root.removeEventListener("chisel:mode", schedule); root.removeEventListener("focus", schedule);
    }};
  }
  root.CHISEL_BSV_COVERAGE = {createModel, cellLabel, render, createController};
})(typeof window !== "undefined" ? window : globalThis);
