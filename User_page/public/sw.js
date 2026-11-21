/* LNM Bytes service worker: offline fallback + push notifications. */
const SHELL_CACHE = 'lnm-shell-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only page navigations get the offline fallback. Everything else goes straight to the network.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode !== 'navigate') return;
  event.respondWith(
    fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error()))
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* not JSON */ }
  const title = data.title || 'LNM Bytes';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // The open page already shows its own alert, so do not double up.
      if (clients.some((c) => c.visibilityState === 'visible')) return;
      return self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        tag: data.tag || 'lnm-bytes',
        renotify: true,
        requireInteraction: !!data.urgent,
        data: { url: data.url || '/orders' },
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/orders', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          return c.focus().then((f) => (f && 'navigate' in f ? f.navigate(target) : f));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
