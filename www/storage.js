// IndexedDB. Хранилища:
//   ranges     — полигоны (название, координаты, заметки)
//   positions  — огневые позиции, привязанные к полигону
//   targets    — каталог целей: дистанция, азимут, имя, привязка к полигону/позиции
//   weapons    — оружие
//   cartridges — патроны (включая релоадные с reload-полями)
//   sessions   — выходы (общий журнал)
//   hits       — отдельные попадания (для обучения «по истории»)
//   shots      — расчёты (по одиночной цели/карте) — короткая история
//   reticles   — библиотека сеток прицелов (фото + калибровка)
//   bullets    — библиотека пуль (Wave 2)
//   casePreps  — подготовка гильз (Wave 2)
//   notes      — универсальные заметки прикреплённые к сущностям (Wave 2)

const DB_NAME = 'skyrange';
const DB_VER = 3;
const STORES = ['ranges', 'positions', 'targets', 'weapons', 'cartridges', 'sessions', 'hits', 'shots',
                'reticles', 'bullets', 'casePreps', 'notes'];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function put(store, value) {
  const db = await openDB();
  if (!value.id) value.id = uid();
  value.updatedAt = new Date().toISOString();
  if (!value.createdAt) value.createdAt = value.updatedAt;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function get(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function del(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function byRange(store, rangeId) {
  const all = await getAll(store);
  return all.filter(x => x.rangeId === rangeId);
}

async function exportAll() {
  const data = {};
  for (const s of STORES) data[s] = await getAll(s);
  return { exportedAt: new Date().toISOString(), version: DB_VER, data };
}

async function importAll(payload) {
  if (!payload || !payload.data) throw new Error('Неверный формат файла');
  const db = await openDB();
  for (const s of STORES) {
    if (!payload.data[s]) continue;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(s, 'readwrite');
      const os = tx.objectStore(s);
      for (const item of payload.data[s]) os.put(item);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
}

window.Store = { put, get, getAll, del, byRange, exportAll, importAll, uid };
