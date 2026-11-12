// Simula a ponte nativa do APK (window.AsxNative / window.asxNativo) para ver o rodapé e o card de manobra.
// Uso: node tools/celular-falso.cjs <pasta>   (app servido em http://localhost:8080)
const { chromium } = require('playwright');
const out = process.argv[2] || 'shots';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => { if (!/Unexpected token/.test(e.message)) console.log('PAGEERROR', e.message); });
  await p.addInitScript(() => {
    window.__estado = { acesso: false, midia: null, nav: null };
    window.__cmds = [];
    window.AsxNative = { versao: () => 1, temAcesso: () => window.__estado.acesso, pedirAcesso: () => { window.__estado.acesso = true; }, midia: (c) => window.__cmds.push(c), estado: () => JSON.stringify(window.__estado) };
  });
  await p.goto('http://localhost:8080/');
  await p.evaluate(() => localStorage.setItem('asx.v1', JSON.stringify({ v: 1, odo: { km: 103250, data: '2026-11-10' }, log: [], fuel: [] })));
  await p.reload(); await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/cel-sem-acesso.png`, clip: { x: 0, y: 684, width: 390, height: 160 } });
  await p.click('[data-action="cel-acesso"]'); await p.waitForTimeout(100);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
  await p.evaluate((png) => window.asxNativo.evento({ acesso: true, midia: { app: 'YouTube Music', titulo: 'Instant Crush (feat. Julian Casablancas)', artista: 'Daft Punk', album: 'RAM', tocando: true, posicao: 83000, duracao: 337000, instante: Date.now(), capa: png },
    nav: { app: 'Vela', titulo: '300 m', texto: 'Vire à direita na Av. Paulista', sub: '18 min · 8,4 km · 14:32', icone: png } }), png);
  await p.waitForTimeout(1500);
  await p.click('[data-cel="toggle"]'); await p.click('[data-cel="next"]');
  await p.screenshot({ path: `${out}/cel-tocando.png` });
  console.log(await p.evaluate(() => ({ cmds: window.__cmds, barra: document.querySelector('#player .d').textContent, nav: document.querySelector('.navcard .desc')?.textContent, fonte: document.querySelector('.navcard small')?.textContent })));
  await b.close();
})();
