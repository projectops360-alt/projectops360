/**
 * ProjectOps360° service worker.
 *
 * Deliberately minimal. This app is authenticated and server-rendered against
 * live Supabase data, so caching HTML or API responses would risk serving stale
 * — or worse, another user's — content. The only job here is to satisfy the
 * install criteria and to show a readable page when the device is offline.
 */

const OFFLINE_CACHE = "po360-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== OFFLINE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Everything except top-level navigation goes straight to the network with no
  // interception at all.
  if (request.mode !== "navigate" || request.method !== "GET") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      const fallback = await cache.match(OFFLINE_URL);
      return (
        fallback ??
        new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    }),
  );
});
