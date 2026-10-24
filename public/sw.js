// Service worker: shows the "picks due" notification and opens the app when it is tapped.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* not JSON: use the defaults */ }
  event.waitUntil(
    self.registration.showNotification(data.title || "Pick'em", {
      body: data.body || 'You have picks to make.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'picks-due',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});
