// Cachea todo el juego para que arranque sin conexión y sin esperar la red.
//
// Estrategia: stale-while-revalidate. Se responde desde el caché al instante y
// se actualiza en segundo plano. Para un juego de reacción la latencia de
// arranque importa más que tener la última versión en el primer toque; la
// versión nueva queda lista para la próxima vez que lo abra.
//
// Al subir una versión hay que cambiar CACHE: es lo que dispara la limpieza de
// las anteriores.

const CACHE = 'smack-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',














  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // addAll falla entero si un solo pedido falla, así que se agregan de a
      // uno: un asset nuevo con el nombre mal escrito no debe dejar el juego
      // sin instalar.
      .then((c) => Promise.allSettled(ASSETS.map((url) => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Solo lo propio: no interceptar pedidos a otros dominios.
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      const fresh = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      // Si hay copia en caché se responde ya; la red sigue en segundo plano.
      return hit || (await fresh) || new Response('Sin conexión', { status: 503 });
    })
  );
});
