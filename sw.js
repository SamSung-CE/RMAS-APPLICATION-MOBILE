/* RMAS POSM — service worker.
   Makes the app installable, load fast, and open even with weak signal.
   Live data (Google Apps Script) is NEVER cached — it always comes fresh.
   When you upload a new version, change VERSION below so phones update. */
const VERSION = 'rmas-posm-v4';
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./rmas-logo.webp", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./posm-org.js", "./posm-data-1.js", "./posm-data-2.js", "./posm-data-3.js", "./posm-data-4.js", "./posm-data-5.js", "./posm-data-6.js"];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache =>
    Promise.all(CORE.map(url => cache.add(new Request(url, {cache: 'reload'})).catch(() => null)))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Apps Script backend and map tiles: always network, never cached.
  if (url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com') ||
      url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('arcgisonline.com')) return;

  // The page itself: always fetch the newest copy (bypassing the browser cache) so
  // updates show right away; fall back to the saved copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req.url, {cache: 'no-store', credentials: 'same-origin'}).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // Libraries from CDNs: cache first (versioned URLs never change).
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Our own files (data, logo, icons): serve from cache, refresh in background.
  if (url.origin === self.location.origin) {
    event.respondWith(caches.open(VERSION).then(cache => cache.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
