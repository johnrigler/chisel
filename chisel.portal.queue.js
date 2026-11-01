(function (root) {
  "use strict";

  // Coordinates reads only. Source fallback, persistence and rendering remain
  // with the caller. Reset settles obsolete callers with null; active work
  // keeps its slot until it actually finishes, so resets cannot flood a host.
  function createQueue(options) {
    const settings = options || {};
    const concurrency = Math.max(1, Math.floor(Number(settings.concurrency) || 6));
    const reserved = Math.max(0, Math.min(concurrency - 1, Math.floor(Number(settings.reserved) || 0)));
    const groupLimits = settings.groupLimits || {};
    const jobs = new Map(), waiting = new Set(), active = new Set();
    let generation = 0, serial = 0, scheduled = false;
    const priority = value => Number.isFinite(Number(value)) ? Number(value) : 20;

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(pump);
    }

    function cancel(job) {
      job.cancelled = true;
      waiting.delete(job);
      if (jobs.get(job.key) === job) jobs.delete(job.key);
      job.resolve(null);
    }

    function complete(job, ok, value) {
      active.delete(job);
      if (jobs.get(job.key) === job) jobs.delete(job.key);
      if (!job.cancelled && job.generation === generation) {
        if (ok) job.resolve(value);
        else job.reject(value);
      }
      schedule();
    }

    function pump() {
      scheduled = false;
      while (active.size < concurrency && waiting.size) {
        const running = Array.from(active);
        const ordinary = running.filter(job => job.cancelled || job.priority > 0).length;
        const candidates = Array.from(waiting).filter(function (job) {
          // Priority zero is an explicit/expanded record. It can use the
          // reserved slot and bypass a background group's soft limit.
          if (job.priority <= 0) return true;
          if (ordinary >= concurrency - reserved) return false;
          const limit = Number(groupLimits[job.group]);
          return !(limit > 0) || running.filter(other => other.group === job.group).length < limit;
        }).sort((a, b) => a.priority - b.priority || b.order - a.order || a.serial - b.serial);
        const job = candidates[0];
        if (!job) return;
        waiting.delete(job); active.add(job);
        Promise.resolve().then(() => job.cancelled ? null : job.run()).then(
          value => complete(job, true, value), error => complete(job, false, error));
      }
    }

    function enqueue(request) {
      if (!request || !request.key || typeof request.run !== "function") throw new Error("A queued read needs a key and a function.");
      const key = String(request.key), previous = jobs.get(key);
      const rank = priority(request.priority);
      if (previous && previous.owner === request.owner) {
        previous.priority = Math.min(previous.priority, rank);
        schedule();
        return previous.promise;
      }
      if (previous) cancel(previous);
      const job = {key: key, owner: request.owner, group: request.group || "transaction", priority: rank,
        order: Number(request.order) || 0, serial: ++serial, generation: generation, run: request.run, cancelled: false};
      job.promise = new Promise(function (resolve, reject) { job.resolve = resolve; job.reject = reject; });
      jobs.set(key, job); waiting.add(job); schedule();
      return job.promise;
    }

    function reprioritize(rank) {
      jobs.forEach(function (job) { job.priority = priority(rank(job.owner, job.group)); });
      schedule();
    }

    function reset() {
      generation += 1;
      Array.from(jobs.values()).forEach(cancel);
      schedule();
    }

    return {enqueue: enqueue, reprioritize: reprioritize, reset: reset,
      snapshot: function () { return {active: active.size, waiting: waiting.size, generation: generation, concurrency: concurrency}; }};
  }

  root.CHISEL_PORTAL_QUEUE = {createQueue: createQueue};
})(window);
