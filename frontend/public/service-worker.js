const CACHE_NAME = 'car-directory-cache-v2';
const APP_SHELL_TTL_MS = 5 * 60 * 1000;

const isAppShellRequest = (url) => {
  if (url.origin !== self.location.origin) return false;

  if (url.pathname === '/' || url.pathname === '/index.html') return true;

  return /\.(?:js|css|png|jpe?g|gif|svg|webp|ico|json|woff2?|ttf|map)$/.test(url.pathname);
};

const cacheFetch = async (request, response) => {
  const cache = await caches.open(CACHE_NAME);
  const cloned = response.clone();
  const headers = new Headers(cloned.headers);
  headers.set('sw-cache-timestamp', String(Date.now()));

  const responseWithMeta = new Response(cloned.body, {
    status: cloned.status,
    statusText: cloned.statusText,
    headers,
  });

  await cache.put(request, responseWithMeta);
};

const getCachedShell = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (!cached) return null;

  const cachedAt = Number(cached.headers.get('sw-cache-timestamp') || '0');
  if (!cachedAt || Date.now() - cachedAt <= APP_SHELL_TTL_MS) {
    return cached;
  }

  return null;
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/index.html', '/']))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  const skipCache =
    url.pathname.startsWith('/auth') ||
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('/users') ||
    url.pathname.includes('/cars') ||
    url.pathname.includes('/dealers') ||
    url.pathname.includes('/payments') ||
    url.origin !== self.location.origin ||
    request.url.includes('supabase');

  if (skipCache) {
    return;
  }

  if (event.request.mode === 'navigate' || isAppShellRequest(url)) {
    event.respondWith(
      (async () => {
        if (navigator.onLine) {
          try {
            const response = await fetch(request, { cache: 'no-store' });
            if (response && response.ok) {
              await cacheFetch(request, response);
            }
            return response;
          } catch (error) {
            const cached = await getCachedShell(request);
            if (cached) return cached;
            return caches.match('/index.html') || Response.error();
          }
        }

        const cached = await getCachedShell(request);
        if (cached) return cached;

        return caches.match('/index.html') || Response.error();
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      if (navigator.onLine) {
        try {
          const response = await fetch(request, { cache: 'no-store' });
          if (response && response.ok) {
            await cacheFetch(request, response);
          }
          return response;
        } catch (error) {
          const cached = await caches.match(request);
          if (cached) return cached;
          return Response.error();
        }
      }

      const cached = await caches.match(request);
      if (cached) return cached;
      return Response.error();
    })()
  );
});
