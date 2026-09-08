// Cachea todo el juego para que arranque sin conexión.
//
// Estrategia: red primero, caché como respaldo. Antes era stale-while-
// revalidate, que responde del caché al instante y actualiza en segundo plano,
// y para un juego de reacción parecía la elección obvia por la latencia de
// arranque. Es un error cuando la app son doce módulos que dependen entre sí:
// cada uno se actualiza por separado, así que un jugador podía quedarse con
// game.js de una versión y render.js de la anterior. Una app mezclada no
// arranca lenta, arranca rota, y eso cuesta la sesión entera en lugar de unos
// milisegundos. Pasó durante el desarrollo: el caché servía el archivo viejo y
// los cambios aparecían una recarga tarde.
//
// Con red primero, quien está conectado recibe siempre un juego consistente, y
// quien no lo está sigue jugando desde el caché, que era el objetivo real.
//
// Al subir una versión hay que cambiar CACHE: es lo que dispara la limpieza de
// las anteriores.

const CACHE = 'smack-v2';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/main.js',
  './src/game.js',
  './src/config.js',
  './src/rng.js',
  './src/save.js',
  './src/feedback.js',
  './src/entities.js',
  './src/character.js',
  './src/render.js',
  './src/hud.js',
  './src/share.js',
  './src/missions.js',
  './src/progression.js',
  './src/daily.js',
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
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        // Sin red. Para una navegación cualquier ruta tiene que caer en el
        // index, que es lo único que el juego necesita para arrancar.
        const hit = (await cache.match(req)) || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
        return hit || new Response('Sin conexión', { status: 503 });
      }
    })
  );
});
