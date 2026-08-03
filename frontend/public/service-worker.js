self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open('car-directory-cache-v1').then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match('/'));
    })
  );
});
