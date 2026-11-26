/* RegaDRIVE service worker. VERSION is replaced at build time. Never caches /api/* (private or dynamic). */
const VERSION = "__BUILD_ID__";
const CACHE = `regadrive-${VERSION}`;
const SHELL = ["/", "/manifest.webmanifest", "/brand/regadrive-logo.webp", "/favicon.png", "/icons/icon-192.png"];

/* Hashed student chunks of this build (filled in at build time). Precached so every screen works offline after
   the first visit, even one the learner has not opened yet. The owner /dr chunks are never precached. */
const ASSETS = [/*__PRECACHE__*/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).then(() => Promise.allSettled(ASSETS.map((a) => c.add(a)))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("regadrive-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // The only API response worth keeping: the published Italian catalogue. It is public, it holds no
  // personal data, and a learner offline should keep the questions already approved for them. Network
  // first so an approval or a withdrawal arrives as soon as there is a connection.
  if (url.pathname === "/api/content/italy") {
    event.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req).then((r) => r || new Response(JSON.stringify({ ok: false, offline: true, questions: [], signs: [] }), { status: 200, headers: { "content-type": "application/json" } }))),
    );
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    // Network first so updates arrive; fall back to the cached app shell offline.
    event.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("/", copy)); } return res; })
        .catch(() => caches.match("/").then((r) => r || new Response("Offline", { status: 503 }))),
    );
    return;
  }

  // Hashed build assets and static files: cache first, then network (and remember it).
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/flags/") || url.pathname.startsWith("/signs/it/"))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
