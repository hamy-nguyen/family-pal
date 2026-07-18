// Family Pal service worker — minimal + safe. Its job is installability + a fast
// app shell, NOT offline data. Rules: never touch mutations, never cache
// cross-origin (Supabase / the tunnelled AI always hit the network), navigations
// are network-first so records are always fresh.
const CACHE = "family-pal-v1";
const SHELL = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // never cache POST/PUT/etc.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase + AI go straight to network

  // Navigations: network-first (fresh data), fall back to the cached shell offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }

  // Static build assets + shell: cache-first, then network (and cache the result).
  if (url.pathname.startsWith("/_next/") || SHELL.includes(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else same-origin: network, fall back to cache if offline.
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
