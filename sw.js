// ─── AVIGO SERVICE WORKER ────────────────────────────────────
// Maneja notificaciones push en segundo plano
// TEC CAPITAL © 2026

var CACHE_NAME = 'avigo-v1';

// Instalar Service Worker
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

// ── RECIBIR NOTIFICACION PUSH ────────────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;

  var data = {};
  try { data = event.data.json(); } catch(e) { return; }

  var options = {
    body:    data.body    || 'Nueva notificacion de AviGo',
    icon:    data.icon    || '/avigo-app/icon-192.png',
    badge:   data.badge   || '/avigo-app/icon-192.png',
    tag:     data.tag     || 'avigo',
    vibrate: [200, 100, 200],
    data:    data.data    || {},
    actions: [
      { action: 'abrir', title: 'Abrir AviGo' },
      { action: 'cerrar', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AviGo', options)
  );
});

// ── CLICK EN NOTIFICACION ────────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'cerrar') return;

  var url = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : 'https://teccapitalweb.github.io/avigo-app/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(function(windowClients) {
      // Si ya hay una ventana abierta, enfocarla
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.indexOf('avigo-app') >= 0 && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no hay ventana, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
