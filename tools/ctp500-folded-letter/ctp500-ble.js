/* Vanilla browser BLE transport; no dependencies or automatic retries. */
export const CTP500_BLE_SERVICE = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
export const CTP500_BLE_WRITE = '49535343-8841-43f4-a8d4-ecbe34729bb3';

export async function ctp500ConnectBLE() {
  if (!globalThis.isSecureContext || !globalThis.navigator?.bluetooth) {
    throw new Error('Web Bluetooth requires a supported browser on HTTPS or localhost.');
  }
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true, optionalServices: [CTP500_BLE_SERVICE],
  });
  try {
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(CTP500_BLE_SERVICE);
    const characteristic = await service.getCharacteristic(CTP500_BLE_WRITE);
    const acknowledged = characteristic.properties.write &&
      typeof characteristic.writeValueWithResponse === 'function';
    const unacknowledged = characteristic.properties.writeWithoutResponse &&
      typeof characteristic.writeValueWithoutResponse === 'function';
    if (!acknowledged && !unacknowledged) throw new Error('No supported printer write method.');
    function describe({ mode = 'acknowledged', compatibilityPacing = false } = {}) {
      if (!['fast', 'acknowledged', 'compatibility'].includes(mode)) {
        throw new RangeError('Unknown BLE transfer mode');
      }
      if (compatibilityPacing) mode = 'compatibility';
      const noResponse = mode === 'fast' ? unacknowledged : !acknowledged;
      return {
        requestedMode: mode,
        writeMode: noResponse ? 'without-response' : 'with-response',
        chunkBytes: 20,
        delayMs: mode === 'fast' && noResponse ? 25 : (noResponse || mode === 'compatibility' ? 20 : 0),
        pacing: mode === 'fast' && noResponse ? 'minimum-interval' : 'after-write',
      };
    }
    let sending = false, previousWriteStarted = -Infinity;
    return {
      device, describe,
      capabilities: { acknowledged: !!acknowledged, unacknowledged: !!unacknowledged },
      disconnect() { device.gatt.disconnect(); },
      async write(bytes, onProgress = () => {}, options = {}) {
        if (!(bytes instanceof Uint8Array)) throw new TypeError('Expected printer bytes.');
        if (sending) throw new Error('A print job is already running.');
        if (!device.gatt.connected) throw new Error('Printer disconnected; reconnect before printing.');
        const policy = describe(options);
        const clock = () => performance.now();
        const started = clock();
        const latencies = [];
        let sent = 0, packets = 0, writeMs = 0, pauseMs = 0, scheduledPauseMs = 0, maxWriteMs = 0;
        function snapshot() {
          const sorted = latencies.slice().sort((a, b) => a - b);
          const percentile = fraction => sorted.length ? sorted[Math.ceil(fraction * sorted.length) - 1] : 0;
          return {
            ...policy, bytes: sent, packets, elapsedMs: clock() - started,
            writeMs, pauseMs, scheduledPauseMs,
            latency: { samples: sorted.length, meanMs: packets ? writeMs / packets : 0,
              p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: maxWriteMs },
          };
        }
        sending = true;
        try {
          for (let offset = 0; offset < bytes.length; offset += policy.chunkBytes) {
            // Rate-limit starts, including across the main/footer boundary.
            // An already slow browser call adds no further fast-mode timer.
            if (policy.pacing === 'minimum-interval') {
              const remaining = Math.max(0, policy.delayMs - (clock() - previousWriteStarted));
              if (remaining) {
                const paused = clock(); scheduledPauseMs += remaining;
                await new Promise(resolve => setTimeout(resolve, remaining));
                pauseMs += clock() - paused;
              }
            }
            if (!device.gatt.connected) throw new Error('Printer disconnected during output.');
            const part = bytes.subarray(offset, offset + policy.chunkBytes);
            const before = clock();
            previousWriteStarted = before;
            if (policy.writeMode === 'without-response') await characteristic.writeValueWithoutResponse(part);
            else await characteristic.writeValueWithResponse(part);
            const duration = clock() - before;
            writeMs += duration;
            maxWriteMs = Math.max(maxWriteMs, duration);
            // Bound memory for large images; counts and aggregate times stay exact.
            if (latencies.length < 4096) latencies.push(duration);
            packets++;
            sent += part.length;
            onProgress(sent, bytes.length);
            const pause = policy.pacing === 'after-write' ? policy.delayMs : 0;
            if (pause && sent < bytes.length) {
              const paused = clock();
              scheduledPauseMs += pause;
              await new Promise(resolve => setTimeout(resolve, pause));
              pauseMs += clock() - paused;
            }
          }
          return snapshot();
        } catch (cause) {
          const error = new Error(cause.message || String(cause));
          error.name = cause.name || 'Error';
          error.transferStats = snapshot();
          throw error;
        } finally {
          sending = false;
        }
      },
    };
  } catch (error) {
    device.gatt?.disconnect();
    throw error;
  }
}

