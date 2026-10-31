/* Minimal service worker for Web Push. Offline caching is handled in the PWA phase. */
self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : '' };
  }

  const title = message.title || 'CinemApp';
  const options = {
    body: message.body || '',
    data: message.data || {},
    tag: message.tag || undefined,
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data && event.notification.data.url;
  const target = new URL(typeof path === 'string' ? path : '/', self.location.origin);
  const safePath = target.origin === self.location.origin ? `${target.pathname}${target.search}${target.hash}` : '/';

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      const windowClient = existing;
      return windowClient.navigate(safePath).then(() => windowClient.focus());
    }
    return self.clients.openWindow(safePath);
  }));
});
