const CACHE_NAME = "runexo-dragon-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/logo-frameweave.png",
  "./images/logo-runexo-dragon.png",
  "./images/stamp-frameweave.png",
  "./sound/bg.mp3",
  "./sound/click.mp3",
  "./sound/win.mp3",
  "./sound/lose.mp3",
  "./sound/draw.mp3"
];

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evt) => {
  const req = evt.request;
  if (req.method !== "GET") return;

  evt.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
