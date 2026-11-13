// Fluxo do card Trânsito sem rede: google.maps simulado + Routes API interceptada.
// Uso: node tools/mapa-falso.cjs <pasta-de-saida>   (app servido em http://localhost:8080)
const { chromium } = require('playwright');
const out = process.argv[2] || 'shots';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, geolocation: { latitude: -23.5614, longitude: -46.6559 }, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { if (!/Unexpected token/.test(e.message)) console.log('PAGEERROR', e.message); });
  await p.addInitScript(() => {
    window.google = { maps: {
      ColorScheme: { DARK: 'DARK' },
      Map: class { constructor(el) { el.style.background = '#1d2b36'; el.innerHTML = '<div style="padding:12px;color:#9ab;font:12px sans-serif">[mapa google simulado]</div>'; } panTo() {} fitBounds() {} },
      TrafficLayer: class { setMap() {} },
      Circle: class { setCenter() {} setMap() {} },
      Polyline: class { setMap() {} addListener() {} },
      LatLngBounds: class { extend() { this.n = (this.n || 0) + 1; } isEmpty() { return !this.n; } },
    } };
  });
  const leg = (passos) => [{ endLocation: { latLng: { latitude: -23.6, longitude: -46.7 } }, steps: passos.map(([t, d]) => ({ navigationInstruction: { instructions: t }, localizedValues: { distance: { text: d } } })) }];
  await p.route('https://routes.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ routes: [
    { description: 'Av. 23 de Maio', duration: '1860s', staticDuration: '1080s', distanceMeters: 8400, polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC' }, localizedValues: { distance: { text: '8,4 km' }, duration: { text: '31 min' }, staticDuration: { text: '18 min' } }, legs: leg([['Siga na Av. Paulista', '1,2 km'], ['Vire à direita na R. Vergueiro', '2,0 km'], ['Pegue a Av. 23 de Maio', '5,2 km']]) },
    { description: 'Av. dos Bandeirantes', duration: '2100s', staticDuration: '1320s', distanceMeters: 10100, polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC' }, localizedValues: { distance: { text: '10,1 km' }, duration: { text: '35 min' }, staticDuration: { text: '22 min' } }, legs: leg([['Siga', '10 km']]) },
  ] }) }));
  await p.goto('http://localhost:8080/#/navegacao');
  await p.evaluate(() => { localStorage.setItem('asx.v1', JSON.stringify({ v: 1, odo: { km: 103250, data: '2026-11-10' }, log: [], fuel: [] })); localStorage.removeItem('asx.gmaps'); localStorage.removeItem('asx.pos'); });
  await p.reload(); await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/mapa-sem-chave.png`, clip: { x: 0, y: 90, width: 390, height: 330 } });
  await p.click('#btn-config'); await p.fill('input[name="chave"]', 'CHAVE-DE-TESTE'); await p.click('form[data-form="gm"] button'); await p.waitForTimeout(800);
  await p.click('[data-action="pos"]'); await p.waitForTimeout(600);
  await p.fill('input[name="destino"]', 'Aeroporto de Congonhas'); await p.click('form[data-form="rota"] button'); await p.waitForTimeout(800);
  await p.click('[data-action="rota-alt"][data-i="1"]'); await p.waitForTimeout(200);
  await p.click('.passos summary'); await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/mapa-rota.png`, clip: { x: 0, y: 90, width: 390, height: 750 } });
  console.log(await p.evaluate(() => ({ vela: document.querySelector('.rota-info a')?.getAttribute('href'), alternativas: document.querySelectorAll('.alts .alt').length, tempo: document.querySelector('.rr-tempo')?.textContent })));
  await b.close();
})();
