/* Service Worker — Treino ABCD
   Estratégia:
   - app shell (index, manifest, ícones): cache-first com refresh em background
   - fotos do Free Exercise DB: cache-first, persistente (sobrevive a updates)
*/
const SHELL = 'treino-shell-v15';
const PHOTOS = 'treino-photos-v1';

const SHELL_FILES = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'img/cable-lateral-raise.jpg',
  'img/roman-chair.jpg',
  'img/lying-leg-curl.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL && k !== PHOTOS).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Push event — recebe notificação remota do Worker
self.addEventListener('push', e => {
  let data = { title: 'Descanso terminado', body: 'Próxima série!' };
  try {
    if (e.data) data = e.data.json();
  } catch (err) {
    try { data.body = e.data.text(); } catch (err2) {}
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Descanso terminado', {
      body: data.body || 'Próxima série!',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'meutreino-push',
      renotify: true,
    })
  );
});

// Notification click — abre/foca o app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('meu-treino') && 'focus' in c) return c.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // fotos do Free Exercise DB → cache-first, persistente
  if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('free-exercise-db')) {
    e.respondWith(
      caches.open(PHOTOS).then(c =>
        c.match(req).then(hit => hit || fetch(req).then(res => {
          if (res.ok) c.put(req, res.clone());
          return res;
        }).catch(() => hit || Response.error()))
      )
    );
    return;
  }

  // mesma origem → cache-first com refresh em background
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(SHELL).then(c =>
        c.match(req).then(hit => {
          const net = fetch(req).then(res => {
            if (res.ok) c.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || net;
        })
      )
    );
  }
});
