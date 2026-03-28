const CACHE_NAME = "coffeecontrol-gerente-v2";
const ASSETS = [
  "/coffeecontrol-gerente.html",
  "/coffeecontrol-gerente.css?v=2",
  "/coffeecontrol-gerente.js?v=2",
  "/coffeecontrol-gerente.webmanifest?v=2",
  "/coffeecontrol-gerente-icon.svg?v=2"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys
      .filter(key => key !== CACHE_NAME)
      .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
