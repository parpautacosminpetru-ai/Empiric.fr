/* Empiric.fr service worker: cache doar pentru propriile fișiere statice. */
const CACHE = "empiric-fr-shell-v1";
const CORE = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest",
  "./assets/icon.svg", "./src/app.js", "./src/engine.js",
  "./src/storage.js", "./src/audio.js"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(names => Promise.all(names.filter(name => name.startsWith("empiric-fr-shell-") && name !== CACHE).map(name => caches.delete(name))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(caches.match(request).then(cached => cached ?? fetch(request).then(response => {
    if (response.ok && url.pathname.startsWith(new URL("./", self.registration.scope).pathname)) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  })));
});
