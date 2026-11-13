// Cache offline simples: app shell na instalação, rede com fallback ao cache depois.
const CACHE = 'asx-v13';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-512.png',
  'src/app.js', 'src/data.js', 'src/plan.js', 'src/obd.js', 'src/signalset.js', 'src/car.js', 'src/hudiy.js', 'src/mapa.js', 'src/painel.js',
  'vendor/doto.woff2', 'vendor/model-viewer.min.js', 'vendor/meshopt_decoder.js', 'assets/asx.glb'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  // Só os arquivos do próprio app passam por aqui; o Google Maps vai direto à rede e não enche o cache.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  // Sempre conferem com o servidor (304 quando nada mudou), para uma versão nova chegar no próximo
  // carregamento em vez de esperar o cache HTTP expirar.
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache' }).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
