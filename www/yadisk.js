// Yandex.Disk REST API: загрузка и скачивание /BalisticNote/backup.json
// Документация: https://yandex.com/dev/disk-api/
//
// Поток авторизации (один раз):
//   1. Юзер создаёт OAuth-приложение на https://oauth.yandex.ru/client/new
//      - Платформа: Web-сервисы, Callback: https://oauth.yandex.ru/verification_code
//      - Права: Яндекс.Диск REST API → cloud_api:disk.write + cloud_api:disk.read + cloud_api:disk.info
//   2. Копирует Client ID из карточки приложения, вставляет в /settings.
//   3. Тапает «Получить токен» → откроется страница Яндекс ID → разрешает → получает Access Token.
//   4. Копирует токен и вставляет в /settings.
//
// После этого upload/download работают всю жизнь токена (1 год по умолчанию).

const API_BASE = 'https://cloud-api.yandex.net/v1/disk';
const REMOTE_FOLDER = 'BalisticNote';
const REMOTE_FILE   = 'BalisticNote/backup.json';

function getToken()    { return localStorage.getItem('yadisk_token') || ''; }
function setToken(t)   { if (t) localStorage.setItem('yadisk_token', t); else localStorage.removeItem('yadisk_token'); }
function getClientId() { return localStorage.getItem('yadisk_client_id') || ''; }
function setClientId(c){ if (c) localStorage.setItem('yadisk_client_id', c); else localStorage.removeItem('yadisk_client_id'); }
function isConfigured(){ return !!getToken(); }

async function api(path, opts = {}) {
  const t = getToken();
  if (!t) throw new Error('Нет OAuth-токена Яндекс.Диска');
  const r = await fetch(API_BASE + path, {
    ...opts,
    headers: { 'Accept': 'application/json', ...(opts.headers || {}), 'Authorization': 'OAuth ' + t }
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    let msg = text;
    try { msg = JSON.parse(text).message || msg; } catch {}
    throw new Error(`Я.Диск ${r.status}: ${msg.slice(0, 250)}`);
  }
  return r;
}

// Получить инфо об аккаунте (для «проверить токен»)
async function info() {
  const r = await api('/');
  return r.json();
}

// Убедиться что папка существует. PUT возвращает 201 при создании или 409 если уже есть — оба OK.
async function ensureFolder() {
  try {
    await fetch(API_BASE + '/resources?path=' + encodeURIComponent(REMOTE_FOLDER), {
      method: 'PUT',
      headers: { 'Authorization': 'OAuth ' + getToken() }
    });
  } catch {}
}

// Загрузить строку JSON в /BalisticNote/backup.json (перезаписывает).
async function uploadJSON(jsonString) {
  await ensureFolder();
  // 1. Запрос pre-signed URL для загрузки
  const r1 = await api(`/resources/upload?path=${encodeURIComponent(REMOTE_FILE)}&overwrite=true`);
  const meta = await r1.json();
  // 2. PUT с телом — авторизация уже встроена в href
  const r2 = await fetch(meta.href, { method: 'PUT', body: jsonString });
  if (!r2.ok) throw new Error(`upload PUT ${r2.status}`);
  return { ok: true, size: jsonString.length };
}

// Скачать JSON-строку из /BalisticNote/backup.json.
// Два разных сетевых запроса: 1) к API Яндекса — получить временную ссылку
// на файл; 2) GET по этой ссылке (уже другой домен, файловое хранилище).
// Раньше при сбое любого из них терялось, КАКОЙ именно шаг не прошёл (Safari
// на сетевых ошибках выдаёт голое «Load failed» без деталей) — оборачиваем
// оба шага отдельно, чтобы сообщение об ошибке указывало конкретный этап.
async function downloadJSON() {
  let meta;
  try {
    const r1 = await api(`/resources/download?path=${encodeURIComponent(REMOTE_FILE)}`);
    meta = await r1.json();
  } catch (e) {
    throw new Error('получение ссылки на файл: ' + (e?.message || e));
  }
  let r2;
  try {
    r2 = await fetch(meta.href);
  } catch (e) {
    throw new Error('скачивание по ссылке (файловое хранилище): ' + (e?.message || e));
  }
  if (!r2.ok) throw new Error(`скачивание по ссылке: HTTP ${r2.status}`);
  return r2.text();
}

// Только шаг 1 (временная ссылка на файл) — на случай, если сам fetch() по
// ней блокируется браузером (см. downloadJSON). Открыть эту ссылку обычной
// навигацией (window.open/location) СКАЧАЕТ файл как обычно — навигация не
// подчиняется CORS в отличие от fetch(), так что это надёжный обходной путь.
async function getDownloadHref() {
  const r1 = await api(`/resources/download?path=${encodeURIComponent(REMOTE_FILE)}`);
  const meta = await r1.json();
  return meta.href;
}

// Метаданные файла бэкапа (или null если файла нет).
async function statBackup() {
  try {
    const r = await api(`/resources?path=${encodeURIComponent(REMOTE_FILE)}&fields=name,size,modified,md5`);
    return r.json();
  } catch (e) {
    if (String(e.message).includes('404')) return null;
    throw e;
  }
}

// Готовая ссылка для пользователя, чтобы получить implicit-grant токен.
function getAuthUrl() {
  const cid = getClientId();
  if (!cid) return null;
  return `https://oauth.yandex.ru/authorize?response_type=token&client_id=${encodeURIComponent(cid)}`;
}

window.Yadisk = {
  getToken, setToken, getClientId, setClientId, isConfigured,
  info, uploadJSON, downloadJSON, statBackup, getAuthUrl, getDownloadHref
};
