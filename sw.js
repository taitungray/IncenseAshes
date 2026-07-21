const CACHE_NAME = "incense-ashes-cache-v1";
const ASSETS_TO_CACHE = [
  "index.html",
  "style.css",
  "js/config.js",
  "js/state.js",
  "js/audio.js",
  "js/activities.js",
  "js/render.js",
  "js/input.js",
  "js/flow.js",
  "js/effects.js",
  "js/app.js",
  "manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request).then((response) => {
      const responseClone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
      return response;
    }).catch(() => caches.match(e.request))
  );
});
