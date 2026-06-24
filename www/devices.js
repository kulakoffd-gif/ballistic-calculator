// Датчики и внешние устройства:
//   • Компас + тилт (DeviceOrientationEvent — работает и в WebView Capacitor)
//   • Bluetooth: автоматически выбирает реализацию
//       - Native (Capacitor) → @capacitor-community/bluetooth-le → нативный Android BLE
//       - Web → navigator.bluetooth (если открыто в браузере)
//   • Адаптеры профилей Kestrel 5700 и SIG KILO 8K (BDX).
//
// В нативном Android — никаких ограничений Web Bluetooth: HTTPS не нужен,
// разрешения системные, фоновая работа возможна.

// ═════════════════════════════ COMPASS ═════════════════════════════
const Compass = {
  listeners: new Set(),
  state: { heading: null, cant: null, pitch: null, absolute: false },
  active: false,
  _handler: null,

  supported() {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  },

  async start() {
    if (this.active) return;
    if (!this.supported()) throw new Error('Компас не поддерживается');
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p !== 'granted') throw new Error('Доступ к ориентации запрещён');
    }
    const handler = (e) => {
      let heading = this.state.heading;
      let absolute = this.state.absolute;
      if (e.webkitCompassHeading != null) {
        heading = e.webkitCompassHeading;
        absolute = true;
      } else if (e.absolute && e.alpha != null) {
        heading = (360 - e.alpha) % 360;
        absolute = true;
      } else if (e.alpha != null && !absolute) {
        heading = (360 - e.alpha) % 360;
      }
      this.state = { heading, cant: e.gamma, pitch: e.beta, absolute };
      for (const cb of this.listeners) try { cb(this.state); } catch {}
    };
    this._handler = handler;
    window.addEventListener('deviceorientationabsolute', handler);
    window.addEventListener('deviceorientation', handler);
    this.active = true;
  },

  stop() {
    if (!this.active) return;
    window.removeEventListener('deviceorientationabsolute', this._handler);
    window.removeEventListener('deviceorientation', this._handler);
    this.active = false;
  },

  subscribe(cb) {
    this.listeners.add(cb);
    if (this.state.heading != null) try { cb(this.state); } catch {}
    return () => this.listeners.delete(cb);
  }
};

// ═════════════════════════════ BLUETOOTH PROFILES ═════════════════════════════
const STD = {
  battery:       '0000180f-0000-1000-8000-00805f9b34fb',
  batteryLevel:  '00002a19-0000-1000-8000-00805f9b34fb',
  deviceInfo:    '0000180a-0000-1000-8000-00805f9b34fb',
  manufacturer:  '00002a29-0000-1000-8000-00805f9b34fb',
  model:         '00002a24-0000-1000-8000-00805f9b34fb',
  firmware:      '00002a26-0000-1000-8000-00805f9b34fb',
};

const Profiles = {
  KESTREL_5700: {
    id: 'kestrel-5700',
    label: 'Kestrel 5700/5500',
    namePrefix: 'Kestrel',
    services: ['03290000-eab4-dea1-b738-2c0fe9d9e8b6'],
    dataChar:  '03290001-eab4-dea1-b738-2c0fe9d9e8b6',
    parse(dv, override = {}) {
      const o = Object.assign({
        tempC:        { off: 4,  scale: 0.1 },
        pressureMbar: { off: 6,  scale: 0.1 },
        humidity:     { off: 8,  scale: 0.1 },
        windSpeed:    { off: 10, scale: 0.01 },
        windDir:      { off: 12, scale: 1 },
      }, override);
      const r = {};
      try {
        if (dv.byteLength >= o.tempC.off + 2)
          r.tempC = dv.getInt16(o.tempC.off, true) * o.tempC.scale;
        if (dv.byteLength >= o.pressureMbar.off + 2)
          r.pressureMbar = dv.getUint16(o.pressureMbar.off, true) * o.pressureMbar.scale;
        if (dv.byteLength >= o.humidity.off + 2)
          r.humidity = dv.getUint16(o.humidity.off, true) * o.humidity.scale;
        if (dv.byteLength >= o.windSpeed.off + 2)
          r.windSpeed = dv.getUint16(o.windSpeed.off, true) * o.windSpeed.scale;
        if (dv.byteLength >= o.windDir.off + 2)
          r.windDir = dv.getUint16(o.windDir.off, true) * o.windDir.scale;
      } catch (e) { r._err = e.message; }
      r._raw = bytesHex(dv);
      return r;
    }
  },

  SIG_KILO_BDX: {
    id: 'sig-kilo-bdx',
    label: 'SIG Sauer KILO (BDX)',
    namePrefix: 'KILO',
    services: ['4d426464-7a64-4761-9b6f-12f63a06f01a'],
    dataChar:  '4d426464-7a64-4761-9b6f-12f63a06f02a',
    parse(dv, override = {}) {
      const o = Object.assign({
        range_yd:   { off: 0, scale: 1 },
        angle_deg:  { off: 2, scale: 0.1 },
      }, override);
      const r = {};
      try {
        if (dv.byteLength >= 2) {
          const rng_yd = dv.getUint16(o.range_yd.off, true) * o.range_yd.scale;
          r.range_yd = rng_yd;
          r.range_m  = rng_yd * 0.9144;
        }
        if (dv.byteLength >= 4)
          r.angle_deg = dv.getInt16(o.angle_deg.off, true) * o.angle_deg.scale;
      } catch (e) { r._err = e.message; }
      r._raw = bytesHex(dv);
      return r;
    }
  }
};

// ═════════════════════════════ utils ═════════════════════════════
function bytesHex(dv) {
  return Array.from(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength))
    .map(b => b.toString(16).padStart(2, '0')).join(' ');
}
function b64ToDataView(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new DataView(arr.buffer);
}
function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

// ═════════════════════════════ shared BT base ═════════════════════════════
const BT = {
  mode: isNative() ? 'native' : 'web',
  connections: new Map(),
  listeners: new Set(),
  overrides: {},

  supported() {
    return this.mode === 'native'
      ? !!(window.Capacitor?.Plugins?.BluetoothLe)
      : !!navigator.bluetooth;
  },

  subscribe(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); },
  _emit(ev) { for (const cb of this.listeners) try { cb(ev); } catch {} },

  loadOverrides() {
    try { this.overrides = JSON.parse(localStorage.getItem('bt:overrides') || '{}'); } catch {}
  },
  saveOverrides() { localStorage.setItem('bt:overrides', JSON.stringify(this.overrides)); }
};

BT.loadOverrides();

// ═════════════════════════════ WEB BLUETOOTH adapter ═════════════════════════════
const WebBT = {
  async connect(profile) {
    if (!navigator.bluetooth) throw new Error('Web Bluetooth не поддерживается');
    if (!isSecureContext) throw new Error('Нужен HTTPS');
    const opts = {
      filters: [],
      optionalServices: [0x180F, 0x180A, ...(profile.services || [])]
    };
    if (profile.namePrefix) opts.filters.push({ namePrefix: profile.namePrefix });
    else opts.acceptAllDevices = true;
    const device = await navigator.bluetooth.requestDevice(opts);
    device.addEventListener('gattserverdisconnected', () => {
      BT.connections.delete(device.id);
      BT._emit({ type: 'disconnect', deviceId: device.id });
    });
    const server = await device.gatt.connect();
    const conn = { device, server, profileId: profile.id, char: null, lastData: null,
                   deviceId: device.id, name: device.name };
    BT.connections.set(device.id, conn);
    BT._emit({ type: 'connect', deviceId: device.id, name: device.name });

    if (profile.dataChar) {
      try {
        const services = await server.getPrimaryServices();
        for (const s of services) {
          const chars = await s.getCharacteristics();
          for (const ch of chars) {
            if (ch.uuid === profile.dataChar.toLowerCase()) {
              if (ch.properties.notify) {
                await ch.startNotifications();
                ch.addEventListener('characteristicvaluechanged', () => {
                  const ov = BT.overrides[profile.id] || {};
                  const parsed = profile.parse(ch.value, ov);
                  conn.lastData = { ts: Date.now(), ...parsed };
                  BT._emit({ type: 'data', deviceId: device.id, profileId: profile.id, data: parsed });
                });
                conn.char = ch;
              } else if (ch.properties.read) {
                const dv = await ch.readValue();
                const ov = BT.overrides[profile.id] || {};
                const parsed = profile.parse(dv, ov);
                conn.lastData = { ts: Date.now(), ...parsed };
                BT._emit({ type: 'data', deviceId: device.id, profileId: profile.id, data: parsed });
                conn.char = ch;
              }
              break;
            }
          }
          if (conn.char) break;
        }
      } catch (e) { BT._emit({ type: 'warn', msg: e.message }); }
    }
    return conn;
  },

  async disconnect(deviceId) {
    const c = BT.connections.get(deviceId);
    if (c) { try { c.server.disconnect(); } catch {} BT.connections.delete(deviceId); }
  },

  async readBatteryAndInfo(deviceId) {
    const c = BT.connections.get(deviceId);
    if (!c) return null;
    const out = {};
    try {
      const bat = await c.server.getPrimaryService(0x180F);
      const ch = await bat.getCharacteristic(0x2A19);
      const dv = await ch.readValue();
      out.battery = dv.getUint8(0);
    } catch {}
    try {
      const info = await c.server.getPrimaryService(0x180A);
      for (const [k, uuid] of [['manufacturer', 0x2A29], ['model', 0x2A24], ['firmware', 0x2A26]]) {
        try {
          const ch = await info.getCharacteristic(uuid);
          const dv = await ch.readValue();
          out[k] = new TextDecoder().decode(dv);
        } catch {}
      }
    } catch {}
    return out;
  },

  async dumpServices(deviceId) {
    const c = BT.connections.get(deviceId);
    if (!c) return null;
    const out = [];
    const services = await c.server.getPrimaryServices();
    for (const s of services) {
      const chars = await s.getCharacteristics();
      const charsInfo = [];
      for (const ch of chars) {
        const info = { uuid: ch.uuid, props: Object.keys(ch.properties).filter(k => ch.properties[k]) };
        if (ch.properties.read) {
          try {
            const dv = await ch.readValue();
            info.value_hex = bytesHex(dv);
          } catch (e) { info.read_err = e.message; }
        }
        charsInfo.push(info);
      }
      out.push({ uuid: s.uuid, chars: charsInfo });
    }
    return out;
  }
};

// ═════════════════════════════ CAPACITOR BLE adapter ═════════════════════════════
const CapacitorBT = {
  _initialized: false,
  async _init() {
    if (this._initialized) return;
    const BLE = window.Capacitor.Plugins.BluetoothLe;
    await BLE.initialize({ androidNeverForLocation: false });
    this._initialized = true;
  },

  async connect(profile) {
    await this._init();
    const BLE = window.Capacitor.Plugins.BluetoothLe;
    const services = (profile.services || []).map(s => s.toLowerCase());
    const opts = {
      services: services.length ? services : undefined,
      namePrefix: profile.namePrefix || undefined,
      optionalServices: [STD.battery, STD.deviceInfo, ...services]
    };
    const dev = await BLE.requestDevice(opts);
    await BLE.connect({ deviceId: dev.deviceId });
    const conn = { deviceId: dev.deviceId, name: dev.name || profile.label,
                   profileId: profile.id, lastData: null };
    BT.connections.set(dev.deviceId, conn);
    BT._emit({ type: 'connect', deviceId: dev.deviceId, name: conn.name });

    BLE.addListener('disconnected|' + dev.deviceId, () => {
      BT.connections.delete(dev.deviceId);
      BT._emit({ type: 'disconnect', deviceId: dev.deviceId });
    }).catch(() => {});

    if (profile.dataChar && services.length) {
      const svc = services[0];
      const ch = profile.dataChar.toLowerCase();
      try {
        await BLE.startNotifications({ deviceId: dev.deviceId, service: svc, characteristic: ch });
        const evName = `notification|${dev.deviceId}|${svc}|${ch}`;
        BLE.addListener(evName, (event) => {
          try {
            const dv = b64ToDataView(event.value);
            const ov = BT.overrides[profile.id] || {};
            const parsed = profile.parse(dv, ov);
            conn.lastData = { ts: Date.now(), ...parsed };
            BT._emit({ type: 'data', deviceId: dev.deviceId, profileId: profile.id, data: parsed });
          } catch (e) {
            BT._emit({ type: 'warn', msg: 'parse: ' + e.message });
          }
        }).catch(() => {});
      } catch (e) {
        try {
          const { value } = await BLE.read({ deviceId: dev.deviceId, service: svc, characteristic: ch });
          const dv = b64ToDataView(value);
          const ov = BT.overrides[profile.id] || {};
          const parsed = profile.parse(dv, ov);
          conn.lastData = { ts: Date.now(), ...parsed };
          BT._emit({ type: 'data', deviceId: dev.deviceId, profileId: profile.id, data: parsed });
        } catch (e2) {
          BT._emit({ type: 'warn', msg: 'data char: ' + e.message + ' / read: ' + e2.message });
        }
      }
    }
    return conn;
  },

  async disconnect(deviceId) {
    const BLE = window.Capacitor.Plugins.BluetoothLe;
    try { await BLE.disconnect({ deviceId }); } catch {}
    BT.connections.delete(deviceId);
    BT._emit({ type: 'disconnect', deviceId });
  },

  async readBatteryAndInfo(deviceId) {
    const BLE = window.Capacitor.Plugins.BluetoothLe;
    const out = {};
    try {
      const r = await BLE.read({ deviceId, service: STD.battery, characteristic: STD.batteryLevel });
      out.battery = b64ToDataView(r.value).getUint8(0);
    } catch {}
    for (const [k, ch] of [['manufacturer', STD.manufacturer], ['model', STD.model], ['firmware', STD.firmware]]) {
      try {
        const r = await BLE.read({ deviceId, service: STD.deviceInfo, characteristic: ch });
        out[k] = new TextDecoder().decode(b64ToDataView(r.value));
      } catch {}
    }
    return out;
  },

  async dumpServices(deviceId) {
    const BLE = window.Capacitor.Plugins.BluetoothLe;
    const r = await BLE.getServices({ deviceId });
    const out = [];
    for (const s of (r.services || [])) {
      const charsInfo = [];
      for (const ch of (s.characteristics || [])) {
        const info = { uuid: ch.uuid, props: ch.properties ? Object.keys(ch.properties).filter(k => ch.properties[k]) : [] };
        if (ch.properties?.read) {
          try {
            const rv = await BLE.read({ deviceId, service: s.uuid, characteristic: ch.uuid });
            info.value_hex = bytesHex(b64ToDataView(rv.value));
          } catch (e) { info.read_err = e.message; }
        }
        charsInfo.push(info);
      }
      out.push({ uuid: s.uuid, chars: charsInfo });
    }
    return out;
  }
};

Object.assign(BT, BT.mode === 'native' ? CapacitorBT : WebBT);

// ═════════════════════════════ WEATHER by GPS (Open-Meteo) ═════════════════════════════
// Бесплатный API без регистрации. Берёт ближайшую метеостанцию + интерполированную модель.
// Возвращает текущее: tempC, humidity, pressureMbar (станционное), windSpeed (м/с),
// windDir (в нашу конвенцию "куда дует", не "откуда").
const Weather = {
  async fetchByGPS() {
    const pos = typeof getGeo === 'function'
      ? await getGeo({ timeout: 15000 })
      : await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 }));
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=temperature_2m,relative_humidity_2m,surface_pressure,pressure_msl,wind_speed_10m,wind_direction_10m` +
      `&wind_speed_unit=ms&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Open-Meteo вернул ' + r.status);
    const data = await r.json();
    const c = data.current;
    if (!c) throw new Error('Нет текущих данных');
    // Open-Meteo даёт wind_direction как «откуда дует» (метео-конвенция).
    // У нас в solver: «куда дует». Переворачиваем на 180°.
    const windDirTo = ((c.wind_direction_10m + 180) % 360 + 360) % 360;
    return {
      lat, lon, altitude_m: pos.coords.altitude,
      tempC: c.temperature_2m,
      humidity: c.relative_humidity_2m,
      pressureMbar: c.surface_pressure,         // станционное (нужно для баллистики)
      pressureMslMbar: c.pressure_msl,          // приведённое к ур. моря (для справки)
      windSpeed: c.wind_speed_10m,
      windDir: windDirTo,
      sourceTime: c.time,
      fetchedAt: new Date().toISOString()
    };
  }
};

window.Compass = Compass;
window.BT = BT;
window.DeviceProfiles = Profiles;
window.Weather = Weather;
