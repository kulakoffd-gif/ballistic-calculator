// Auto-backup в публичную папку /Documents/BalisticNote/backup.json
// Файл переживает удаление приложения, поэтому после переустановки
// можно восстановить полную базу данных одним тапом.
//
// На Android Capacitor: Directory.Documents = /storage/emulated/0/Documents/
// На web: эта функция тихо ничего не делает (filesystem-plugin недоступен)

const BACKUP_DIR = 'BalisticNote';
const BACKUP_FILE = 'BalisticNote/backup.json';
const BACKUP_DIRECTORY = 'DOCUMENTS'; // см. Capacitor.Filesystem.Directory

function fs() {
  return window.Capacitor?.Plugins?.Filesystem || null;
}

async function save() {
  const F = fs();
  if (!F) return { ok: false, reason: 'no-filesystem-plugin' };
  try {
    const payload = await Store.exportAll();
    const data = JSON.stringify(payload);
    try { await F.mkdir({ path: BACKUP_DIR, directory: BACKUP_DIRECTORY, recursive: true }); }
    catch {} // уже существует
    await F.writeFile({
      path: BACKUP_FILE, directory: BACKUP_DIRECTORY,
      data, encoding: 'utf8'
    });
    const stat = await F.stat({ path: BACKUP_FILE, directory: BACKUP_DIRECTORY });
    return { ok: true, size: stat?.size, mtime: stat?.mtime, uri: stat?.uri };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

async function read() {
  const F = fs();
  if (!F) return null;
  try {
    const r = await F.readFile({ path: BACKUP_FILE, directory: BACKUP_DIRECTORY, encoding: 'utf8' });
    return JSON.parse(r.data);
  } catch {
    return null;
  }
}

async function exists() {
  const F = fs();
  if (!F) return false;
  try {
    await F.stat({ path: BACKUP_FILE, directory: BACKUP_DIRECTORY });
    return true;
  } catch { return false; }
}

async function restore(source = 'auto') {
  // source: 'yandex' | 'local' | 'auto' (сначала Я.Диск, потом локальный)
  let payload = null, from = null, yandexError = null;
  if (source === 'yandex' || source === 'auto') {
    const ry = await downloadFromYandex();
    if (ry.data) { payload = ry.data; from = 'yandex'; }
    else if (ry.error) yandexError = ry.error;
  }
  if (!payload && (source === 'local' || source === 'auto')) {
    payload = await read();
    if (payload) from = 'local';
  }
  // Настоящая причина (неверный токен, сеть и т.д.) важнее общего «нет бэкапа нигде» —
  // без этого пользователь видел одно и то же 'no-backup' независимо от реальной проблемы.
  if (!payload || !payload.data) return { ok: false, reason: yandexError || 'no-backup' };
  try {
    await Store.importAll(payload);
    return { ok: true, from, exportedAt: payload.exportedAt, version: payload.version };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

// — IndexedDB «пустая» = во всех важных stores 0 записей —
async function isStoreEmpty() {
  try {
    const counts = await Promise.all(['ranges','weapons','cartridges','hits'].map(async s => {
      try { return (await Store.getAll(s)).length; } catch { return 0; }
    }));
    return counts.every(n => n === 0);
  } catch { return false; }
}

// Yandex.Disk best-effort sync (если Yadisk сконфигурирован)
async function uploadToYandex() {
  if (!window.Yadisk || !Yadisk.isConfigured()) return { ok: false, reason: 'no-token' };
  try {
    const payload = await Store.exportAll();
    await Yadisk.uploadJSON(JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

// Возвращает { data, error }. data=null+error=null значит «файла ещё нет на Диске»
// (нормальное состояние при первой синхронизации) — отличаем это от РЕАЛЬНОЙ
// ошибки (неверный/просроченный токен, сеть и т.п.), которую раньше здесь же
// молча проглатывали (только console.warn, невидимый на реальном телефоне) —
// из-за этого пользователь видел одинаковое «no-backup» независимо от причины.
async function downloadFromYandex() {
  if (!window.Yadisk || !Yadisk.isConfigured()) return { data: null, error: 'нет токена Я.Диска' };
  try {
    const txt = await Yadisk.downloadJSON();
    return { data: JSON.parse(txt), error: null };
  } catch (e) {
    const msg = e?.message || String(e);
    if (/\b404\b/.test(msg)) return { data: null, error: null };
    console.warn('[backup/yandex] download:', msg);
    return { data: null, error: msg };
  }
}

// Полноценная двусторонняя синхронизация через Я.Диск:
//   1) скачать удалённую базу, 2) слить её в локальную без потерь (LWW по записям),
//   3) залить объединённый результат обратно. Так оба устройства сходятся к одному.
let syncing = false;
async function syncNow() {
  if (!window.Yadisk || !Yadisk.isConfigured()) return { ok: false, reason: 'no-token' };
  if (syncing) return { ok: false, reason: 'busy' };
  syncing = true;
  try {
    const remote = await downloadFromYandex();
    // Настоящая ошибка чтения (не «файла ещё нет») — не заливаем поверх
    // локальные данные вслепую, иначе можно молча затереть реальный бэкап.
    if (remote.error) return { ok: false, reason: remote.error };
    let merged = null;
    if (remote.data && remote.data.data) merged = await Store.mergeAll(remote.data);
    const payload = await Store.exportAll();
    await Yadisk.uploadJSON(JSON.stringify(payload));
    return { ok: true, merged };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  } finally {
    syncing = false;
  }
}

// — debounced auto-save: вызывать после каждого изменения —
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const r = await save();
    if (!r.ok && r.reason !== 'no-filesystem-plugin') {
      console.warn('[backup] save failed:', r.reason);
    }
    // Двусторонняя синхронизация (скачать → слить → залить), а не слепая перезапись.
    const ry = await syncNow();
    if (!ry.ok && ry.reason !== 'no-token' && ry.reason !== 'busy') {
      console.warn('[backup/yandex] sync failed:', ry.reason);
    }
  }, 2000);
}

// — обернуть Store.put, чтобы каждый put триггерил backup —
function instrumentStore() {
  if (!window.Store || Store.__backupInstrumented) return;
  const origPut = Store.put;
  const origDel = Store.del;
  const origImport = Store.importAll;
  Store.put = async function(...args) { const r = await origPut(...args); scheduleSave(); return r; };
  Store.del = async function(...args) { const r = await origDel(...args); scheduleSave(); return r; };
  Store.importAll = async function(...args) { const r = await origImport(...args); scheduleSave(); return r; };
  Store.__backupInstrumented = true;
}

window.Backup = { save, read, exists, restore, isStoreEmpty, instrumentStore,
                  uploadToYandex, downloadFromYandex, syncNow };
