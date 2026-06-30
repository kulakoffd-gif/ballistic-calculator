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
const DB_VER = 6;
const STORES = ['ranges', 'positions', 'targets', 'weapons', 'cartridges', 'sessions', 'hits', 'shots',
                'reticles', 'bullets', 'casePreps', 'notes', 'stages', 'profiles'];
// Служебный store: «надгробия» удалённых записей {id:`${store}::${recId}`, store, recId, deletedAt}.
// Нужны, чтобы удаление на одном устройстве распространялось при merge, а не «воскресало».
const TOMB_STORE = '_tombstones';

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
      if (!db.objectStoreNames.contains(TOMB_STORE)) {
        db.createObjectStore(TOMB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Запись «как есть», без проставления updatedAt — для merge, чтобы не сбить LWW.
async function putRaw(store, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

async function put(store, value) {
  if (!value.id) value.id = uid();
  value.updatedAt = new Date().toISOString();
  if (!value.createdAt) value.createdAt = value.updatedAt;
  return putRaw(store, value);
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

// Низкоуровневое удаление без надгробия — используется внутри merge.
async function delRaw(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Публичное удаление: убирает запись и оставляет надгробие для синхронизации.
async function del(store, id) {
  await delRaw(store, id);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TOMB_STORE, 'readwrite');
    tx.objectStore(TOMB_STORE).put({ id: `${store}::${id}`, store, recId: id, deletedAt: new Date().toISOString() });
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
  data[TOMB_STORE] = await getAll(TOMB_STORE);
  return { exportedAt: new Date().toISOString(), version: DB_VER, data };
}

// Полная замена базы данными из payload (для ручного «Восстановить из файла»).
async function importAll(payload) {
  if (!payload || !payload.data) throw new Error('Неверный формат файла');
  const db = await openDB();
  for (const s of [...STORES, TOMB_STORE]) {
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

// Склейка двух баз без потери данных: для каждой записи побеждает та, у которой
// updatedAt новее (last-write-wins на уровне записи). Удаления распространяются
// через надгробия: запись удаляется, только если её updatedAt не новее deletedAt.
// Возвращает {added, updated, deleted} для отчёта.
async function mergeAll(payload) {
  if (!payload || !payload.data) throw new Error('Неверный формат');
  const stats = { added: 0, updated: 0, deleted: 0 };

  // 1) Сливаем записи по STORES — last-write-wins по updatedAt.
  for (const s of STORES) {
    const incoming = payload.data[s];
    if (!Array.isArray(incoming) || !incoming.length) continue;
    for (const item of incoming) {
      if (!item || !item.id) continue;
      const local = await get(s, item.id);
      if (!local) { await putRaw(s, item); stats.added++; continue; }
      const li = local.updatedAt || local.createdAt || '';
      const ri = item.updatedAt || item.createdAt || '';
      if (ri > li) { await putRaw(s, item); stats.updated++; }
    }
  }

  // 2) Объединяем надгробия (оставляем самое позднее deletedAt на каждый id).
  const incomingTombs = payload.data[TOMB_STORE] || [];
  const localTombs = await getAll(TOMB_STORE);
  const tombMap = new Map();
  for (const t of [...localTombs, ...incomingTombs]) {
    if (!t || !t.id) continue;
    const prev = tombMap.get(t.id);
    if (!prev || (t.deletedAt || '') > (prev.deletedAt || '')) tombMap.set(t.id, t);
  }

  // 3) Применяем надгробия: удаляем запись, если она не была изменена после удаления.
  for (const t of tombMap.values()) {
    await putRaw(TOMB_STORE, t); // сохраняем объединённое надгробие локально
    const rec = await get(t.store, t.recId);
    if (rec) {
      const ru = rec.updatedAt || rec.createdAt || '';
      if (ru <= (t.deletedAt || '')) { await delRaw(t.store, t.recId); stats.deleted++; }
    }
  }
  return stats;
}

window.Store = { put, get, getAll, del, byRange, exportAll, importAll, mergeAll, uid };
