// Cache offline simples: app shell na instalação, rede com fallback ao cache depois.
const CACHE = 'asx-v9';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-512.png',
  'src/app.js', 'src/data.js', 'src/plan.js', 'src/obd.js', 'src/signalset.js', 'src/car.js', 'src/hudiy.js', 'src/mapa.js', 'src/painel.js',
  'vendor/model-viewer.min.js', 'vendor/meshopt_decoder.js', 'assets/asx.glb'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Arquivos do próprio app sempre conferem com o servidor (304 quando nada mudou), para uma versão
  // nova chegar no próximo carregamento em vez de esperar o cache HTTP expirar.
  const proprio = new URL(e.request.url).origin === self.location.origin;
  e.respondWith(
    (proprio ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(e.request)).then((r) => {
      if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, r.clone()));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
