// ─── AVIGO SERVICE WORKER ────────────────────────────────────
// Push en segundo plano + offline real (network-first).
// TEC CAPITAL © 2026

var CACHE_NAME = 'avigo-cache-v1';
var TIMEOUT_RED_MS = 4000;

// Precache mínimo: el shell de la app y sus íconos.
var PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE);
    }).catch(function() {})
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) {
        return k !== CACHE_NAME;
      }).map(function(k) {
        return caches.delete(k);
      }));
    }).then(function() { return clients.claim(); })
  );
});

// fetch con límite de tiempo: si la red tarda más, se cae al caché.
function fetchConTimeout(request, ms) {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() { reject(new Error('timeout')); }, ms);
    fetch(request).then(function(res) {
      clearTimeout(timer);
      resolve(res);
    }, function(err) {
      clearTimeout(timer);
      reject(err);
    });
  });
}

self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // La API jamás se intercepta: siempre red directa, sin caché.
  if (url.hostname.indexOf('railway.app') >= 0 ||
      url.hostname.indexOf('avigo-backend') >= 0) {
    return;
  }

  // Solo mismo origen; todo lo demás (backend en localhost u otro
  // puerto, CDNs de fuentes/Google) va directo a red.
  if (url.origin !== self.location.origin) return;

  // Íconos: cache-first (no cambian; si cambian, cambia CACHE_NAME).
  if (url.pathname.indexOf('/icon-') >= 0) {
    event.respondWith(
      caches.match(req).then(function(cached) {
        return cached || fetch(req).then(function(res) {
          if (res && res.status === 200) {
            var copia = res.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(req, copia); });
          }
          return res;
        });
      })
    );
    return;
  }

  // Navegación e index: network-first con timeout y re-cacheo.
  // La red manda — cada deploy llega al usuario; el caché es solo
  // el plan B cuando no hay conexión o la red se arrastra.
  // En navegaciones se revalida siempre (no-cache) para saltar el
  // max-age=600 de Pages: un 304 barato a cambio de deploys al instante.
  var fetchReq = req.mode === 'navigate'
    ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })
    : req;
  event.respondWith(
    fetchConTimeout(fetchReq, TIMEOUT_RED_MS).then(function(res) {
      if (res && res.status === 200) {
        var copia = res.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(req, copia); });
      }
      return res;
    }).catch(function() {
      return caches.match(req).then(function(cached) {
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
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
