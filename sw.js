// Offline support: the app shell is cached so Daybook opens without a connection.
// Bump VERSION whenever you change a file so phones pick up the new build.
const VERSION = "daybook-v4";
const SHELL = ["./", "index.html", "styles.css", "app.js", "config.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"];
const CDN = ["https://cdn.jsdelivr.net/", "https://fonts.googleapis.com/", "https://fonts.gstatic.com/"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const cdn = CDN.some((p) => req.url.startsWith(p));
  if (!sameOrigin && !cdn) return; // Supabase API calls go straight to the network
  // Same-origin: network first so updates show up, cache as fallback. CDN: cache first.
  if (sameOrigin) {
    e.respondWith(
      // no-cache = always ask the server whether the file changed (GitHub Pages otherwise lets browsers reuse it for 10 min)
      fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
    );
  } else {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }))
    );
  }
});
