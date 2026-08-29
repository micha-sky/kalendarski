/* Kalendarski service worker — hand-rolled, no build step.
 * - App shell: network-first, falls back to cache so the calendar boots offline.
 * - Static assets (hashed /assets/*, icons, manifest): stale-while-revalidate.
 * - Weather APIs (Open-Meteo, BigDataCloud): stale-while-revalidate in their own
 *   cache, so the gradient and header still render with no network.
 * Bump CACHE_VERSION to invalidate old caches on deploy.
 */
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `kalendarski-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `kalendarski-assets-${CACHE_VERSION}`;
const WEATHER_CACHE = `kalendarski-weather-${CACHE_VERSION}`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

const WEATHER_HOSTS = [
  'api.open-meteo.com',
  'archive-api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'api.bigdatacloud.net',
  'api-bdc.io',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)),
  );
  // Do not skipWaiting automatically — the page decides when to activate the
  // update (see the SKIP_WAITING message handler), enabling an update prompt.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, ASSET_CACHE, WEATHER_CACHE].includes(k))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || network || fetch(request);
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put('/index.html', response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request)) || (await cache.match('/index.html'));
    if (cached) return cached;
    throw new Error('offline and no cached shell');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache same-origin API calls (e.g. the /api/ics-proxy subscription
  // proxy) — always hit the network so a refresh returns live data.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Weather / geocoding APIs — cross-origin, stale-while-revalidate.
  if (WEATHER_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, WEATHER_CACHE));
    return;
  }

  // Only handle same-origin from here on.
  if (url.origin !== self.location.origin) return;

  // App-shell navigations — network-first so users get fresh HTML when online,
  // cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  // Same-origin static assets — stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
});
