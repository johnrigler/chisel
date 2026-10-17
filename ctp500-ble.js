/* Vanilla browser BLE transport for CTP500 raster bytes; no dependencies. */
export const CTP500_BLE_SERVICE = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
export const CTP500_BLE_WRITE = '49535343-8841-43f4-a8d4-ecbe34729bb3';

export async function ctp500ConnectBLE() {
  if (!globalThis.isSecureContext || !globalThis.navigator?.bluetooth) {
    throw new Error('Web Bluetooth requires a supported browser on HTTPS or localhost.');
  }
  // Teal Printer may not advertise a matching name or service filter.
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [CTP500_BLE_SERVICE],
  });
  try {
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(CTP500_BLE_SERVICE);
    const characteristic = await service.getCharacteristic(CTP500_BLE_WRITE);
    const withResponse = characteristic.properties.write &&
      typeof characteristic.writeValueWithResponse === 'function';
    const withoutResponse = characteristic.properties.writeWithoutResponse &&
      typeof characteristic.writeValueWithoutResponse === 'function';
    if (!withResponse && !withoutResponse) {
      throw new Error('The printer characteristic has no supported write method.');
    }
    let sending = false;
    return {
      device,
      disconnect() { device.gatt.disconnect(); },
      async write(bytes, onProgress = () => {}, { compatibilityPacing = false } = {}) {
        if (!(bytes instanceof Uint8Array)) throw new TypeError('Expected printer bytes.');
        if (sending) throw new Error('A print job is already running.');
        if (!device.gatt.connected) throw new Error('Printer disconnected; reconnect before printing.');
        const delayMs = (compatibilityPacing || !withResponse) ? 20 : 0;
        sending = true;
        try {
          // Keep the tested 20-byte payload and await each write. Acknowledged
          // writes provide backpressure without an extra timer; unacknowledged
          // writes and compatibility mode keep the tested 20 ms pacing.
          // Never retry a partially sent image automatically.
          for (let offset = 0; offset < bytes.length; offset += 20) {
            if (!device.gatt.connected) throw new Error('Printer disconnected during output.');
            const part = bytes.subarray(offset, offset + 20);
            if (withResponse) await characteristic.writeValueWithResponse(part);
            else await characteristic.writeValueWithoutResponse(part);
            onProgress(Math.min(offset + 20, bytes.length), bytes.length);
            if (delayMs && offset + 20 < bytes.length) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
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
