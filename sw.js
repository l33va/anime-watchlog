// Offline cache for Anime Watchlog. Bump CACHE when you change any app file.
var CACHE = "watchlog-v2";
var COVERS = "watchlog-covers"; // cover pictures seen so far, kept across app updates
var MAX_COVERS = 150;
var FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== COVERS; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function trim(cache) {
  return cache.keys().then(function (keys) {
    var extra = keys.length - MAX_COVERS;
    return Promise.all(keys.slice(0, Math.max(0, extra)).map(function (k) { return cache.delete(k); }));
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Cover pictures from other sites: show the saved copy first, fetch once if missing.
  if (url.origin !== self.location.origin) {
    if (req.destination !== "image") return;
    e.respondWith(
      caches.open(COVERS).then(function (cache) {
        return cache.match(req).then(function (hit) {
          return hit || fetch(req).then(function (res) {
            if (res && (res.ok || res.type === "opaque")) {
              cache.put(req, res.clone()).then(function () { return trim(cache); });
            }
            return res;
          });
        });
      })
    );
    return;
  }

  // The app page: try the network first so updates show up, fall back to the saved copy offline.
  if (req.mode === "navigate" || url.pathname.slice(-1) === "/" || url.pathname.slice(-10) === "index.html") {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match("./index.html"); });
      })
    );
    return;
  }

  // Other app files: saved copy first. Your list lives in the phone's storage, not in this cache.
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
