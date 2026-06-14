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

async function restore() {
  const payload = await read();
  if (!payload || !payload.data) return { ok: false, reason: 'no-backup' };
  try {
    await Store.importAll(payload);
    return { ok: true, exportedAt: payload.exportedAt, version: payload.version };
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

// — debounced auto-save: вызывать после каждого изменения —
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    save().then(r => {
      if (!r.ok && r.reason !== 'no-filesystem-plugin') {
        console.warn('[backup] save failed:', r.reason);
      }
    });
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

window.Backup = { save, read, exists, restore, isStoreEmpty, instrumentStore };
