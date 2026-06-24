// Service worker — офлайн-кэш оболочки приложения (только web/PWA-режим).
// В нативном Capacitor не регистрируется (см. index.html).
// При изменении файлов поднимай CACHE-версию, чтобы клиенты получили свежак.
const CACHE = 'balisticnote-v2';
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

  // NETWORK-FIRST для всего своего домена: всегда берём свежую версию из сети,
  // кэш — только запасной вариант при офлайне. Так обновления видны сразу.
  e.respondWith(
    fetch(req).then((resp) => {
      if (resp && resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return resp;
    }).catch(() =>
      caches.match(req).then((cached) => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
    )
  );
});
