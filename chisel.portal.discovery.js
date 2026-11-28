(function (root) {
  "use strict";

  function count(value) { return Math.max(0, Math.floor(Number(value) || 0)); }
  function number(value) { return count(value).toLocaleString("en-US"); }

  function recordLabel(summary) {
    const s = summary || {};
    if (!s.transactionBytes) return "";
    return [number(s.transactionBytes) + " transaction bytes",
      s.dataOutputs ? (s.dataComplete === false ? "at least " : "") + number(s.dataBytes) + " data bytes" : "size candidate",
      s.dataComplete === false ? "payload preview incomplete" : ""].filter(Boolean).join(" · ");
  }

  function coverageLabel(scan) {
    const jobs = Array.isArray(scan.jobs) ? scan.jobs : [];
    return number(scan.transactionsChecked) + " transactions checked · " +
      number(scan.blocksComplete) + "/" + number(scan.blocksChecked) + " visited blocks complete · " +
      number(scan.candidates) + " candidates" + (jobs.length ? " · " + jobs.length + " scan cursors" :
        " · next block " + (scan.nextHeight === null ? "unstarted" : number(scan.nextHeight)));
  }

  function renderCoverage(container, scan) {
    if (!container || !scan || scan.kind !== "bsv-block-scan" || scan.coin !== "bsv") return;
    if (root.CHISEL_BSV_COVERAGE) return root.CHISEL_BSV_COVERAGE.render(container, scan);
    const doc = container.ownerDocument;
    container.replaceChildren();
    function paragraph(text) {
      const p = doc.createElement("p"); p.className = "muted"; p.textContent = text; container.appendChild(p);
    }
    paragraph(coverageLabel(scan));
    paragraph("Saved public-provider observations. Last check: " + String(scan.lastCheckedAt || "unknown") +
      ". Candidates: transaction ≥ " + number(scan.minTransactionBytes) + " bytes or data output ≥ " +
      number(scan.minDataBytes) + " bytes. Sizes identify candidates; they do not establish file type or authorship.");
    (Array.isArray(scan.jobs) ? scan.jobs : []).slice(0, 12).forEach(function (job) {
      paragraph(String(job.name || "scan") + " · " + String(job.direction || "unknown direction") +
        " from block " + number(job.anchorHeight) + " · next block " + String(job.nextHeight) +
        " · " + String(job.phase || "unknown") + (job.lastError ? " · " + String(job.lastError) : ""));
    });
    if (scan.runner && scan.runner.heartbeatAt) paragraph("Daemon last reported " + String(scan.runner.lastReportedState || "unknown") +
      " · heartbeat " + String(scan.runner.heartbeatAt) + ". This is the saved export's observation time.");
    if (scan.lastError) paragraph("Scanner report: " + String(scan.lastError));
    const table = doc.createElement("table");
    table.className = "portalBsvCoverageTable";
    const caption = doc.createElement("caption"); caption.textContent = "Blocks ranked by data bytes observed"; table.appendChild(caption);
    const head = doc.createElement("thead"), heading = doc.createElement("tr");
    ["Block", "Transactions checked", "Status", "Data bytes (minimum)", "Largest checked transaction"].forEach(function (label) {
      const th = doc.createElement("th"); th.scope = "col"; th.textContent = label; heading.appendChild(th);
    });
    head.appendChild(heading); table.appendChild(head);
    const body = doc.createElement("tbody");
    (Array.isArray(scan.topBlocks) ? scan.topBlocks : []).slice(0, 20).forEach(function (block) {
      const tr = doc.createElement("tr");
      [number(block.height), number(block.checked) + " / " + number(block.tx_count),
        block.status === "complete" ? "complete" : "partial", number(block.data_bytes),
        number(block.largest_transaction) + " bytes"].forEach(function (text) {
        const td = doc.createElement("td"); td.textContent = text; tr.appendChild(td);
      });
      body.appendChild(tr);
      if (block.note || block.error) {
        const row = doc.createElement("tr"), cell = doc.createElement("td"); cell.colSpan = 5;
        cell.textContent = [block.note, block.error].filter(Boolean).join(" · "); row.appendChild(cell); body.appendChild(row);
      }
    });
    table.appendChild(body); container.appendChild(table);
  }

  root.CHISEL_PORTAL_DISCOVERY = {recordLabel: recordLabel, coverageLabel: coverageLabel, renderCoverage: renderCoverage};
})(typeof window !== "undefined" ? window : globalThis);
