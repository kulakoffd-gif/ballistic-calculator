// Service worker — офлайн-кэш оболочки приложения (только web/PWA-режим).
// В нативном Capacitor не регистрируется (см. index.html).
// При изменении файлов поднимай CACHE-версию, чтобы клиенты получили свежак.
const CACHE = 'balisticnote-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './ballistics.js',
  './storage.js',
  './devices.js',
  './yadisk.js',
  './backup.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Не трогаем внешние API (Я.Диск, Open-Meteo) и кросс-домен — всегда из сети.
  if (url.origin !== self.location.origin) return;

  // Навигация → сначала сеть (свежий index), при офлайне — кэш.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Остальное (статика) → cache-first, фоновое обновление.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
