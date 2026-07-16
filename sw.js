/* IRIS — service worker: deja la app disponible sin conexión */
const CACHE = "iris-v12";
const ARCHIVOS = [
  ".",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/notes.js",
  "js/ai.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Al tocar una notificación: enfocar la app o abrirla
self.addEventListener("notificationclick", ev => {
  ev.notification.close();
  ev.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(lista =>
      lista.length ? lista[0].focus() : clients.openWindow(".")
    )
  );
});

// Red primero, con respaldo en caché (así las actualizaciones llegan al instante)
self.addEventListener("fetch", ev => {
  if (ev.request.method !== "GET") return;
  ev.respondWith(
    fetch(ev.request)
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(ev.request, copia));
        return resp;
      })
      .catch(() => caches.match(ev.request))
  );
});
