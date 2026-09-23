/* Service worker: app offline (PWA).
   - Navegación (HTML) y recursos propios (JS/CSS core): network-first
     con bypass de la caché HTTP intermedia (¡jamás mezclar versiones!
     un HTML nuevo con un JS viejo deja botones muertos). Sin conexión
     se usa la última copia guardada.
   - Resto (iconos/manifest): caché primero con actualización en
     segundo plano (stale-while-revalidate).
   1.14.0.1 · fix: antes los recursos iban caché-primero y la primera
   apertura tras publicar mezclaba HTML nuevo con JS viejo. */
const CACHE = 'mis-cuentas-v28';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Rutas cuya versión DEBE coincidir con la del HTML servido. */
function isCoreAsset(url) {
  const p = url.pathname;
  return p.endsWith('/') || p.endsWith('/index.html') || p.endsWith('/app.js') || p.endsWith('/styles.css');
}

/* Red primero ignorando la caché HTTP intermedia (CDNs con max-age,
   p. ej. GitHub Pages). Guarda copia fresca para uso offline. */
function networkFirstFresh(request) {
  return fetch(request, { cache: 'reload' })
    .then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      }
      return caches.match(request).then((hit) => hit || res);
    })
    .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html')));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  const url = new URL(e.request.url);

  // Documentos y recursos esenciales: siempre consistentes con la red.
  if (e.request.mode === 'navigate' || isCoreAsset(url)) {
    e.respondWith(networkFirstFresh(e.request));
    return;
  }

  // Demás recursos: caché primero; si hay red, se actualiza en segundo plano.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const fresh = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    })
  );
});
