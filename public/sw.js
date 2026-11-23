// public/sw.js
const CACHE_NAME = "framebooks-pwa-v3";

const PRECACHE_ASSETS = [
  "/offline.html",
  "/favicon-192x192.png",
  "/favicon-512x512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/favicon.svg",
];

// Install Event - Precache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("PWA precache error:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event - Network first with offline fallback for navigation
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== "GET" || !request.url.startsWith("http")) {
    return;
  }

  // Only handle same-origin requests; let cross-origin CDN/R2/external images pass directly to browser
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip Next.js internal development hot-reloads and API actions
  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/api/auth")
  ) {
    return;
  }

  // 1. Navigation (HTML pages) -> Network first, fallback to offline.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match("/offline.html");
        return (
          cachedOffline ||
          new Response("Offline - Please check your internet connection.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          })
        );
      })
    );
    return;
  }

  // 2. Static image & font assets -> Cache first or stale-while-revalidate
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2|ico)$/) ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/logos/")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Default -> Normal network request
  event.respondWith(fetch(request));
});

// Push Event - Receive and display system push notifications
self.addEventListener("push", (event) => {
  let data = {
    title: "Framebooks",
    body: "You have a new update",
    url: "/user/dashboard",
    tag: "framebooks-push",
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || "",
    icon: "/favicon-192x192.png",
    badge: "/favicon-192x192.png",
    tag: data.tag || "framebooks-push",
    renotify: true,
    data: {
      url: data.url || "/user/dashboard",
      dateOfArrival: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(data.title || "Framebooks", options));
});

// Notification Click Event - Focus existing tab or open target page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/user/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
