// Capturas das telas em 390 (celular), 820 (tablet) e 1366 (desktop) com dados de exemplo. Uso: node tools/screens.cjs <pasta>
const { chromium } = require('playwright');
const S = process.argv[2] || 'shots';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // Ícone PNG 512 a partir do SVG
  let p = await b.newPage({ viewport: { width: 512, height: 512 } });
  await p.goto('http://localhost:8080/assets/icon.svg');
  await p.screenshot({ path: 'assets/icon-512.png', clip: { x: 0, y: 0, width: 512, height: 512 } });
  const seed = {
    v: 1, odo: { km: 103250, data: '2026-11-10' },
    log: [
      { id: '1', data: '2026-07-02', km: 98900, itens: ['oleo', 'filtro-ar', 'rodizio', 'inspecao'], custo: 420, obs: 'Oficina do Zé' },
      { id: '2', data: '2025-10-15', km: 88000, itens: ['fluido-freio', 'tbi', 'filtro-cabine'], custo: 310, obs: '' },
      { id: '3', data: '2024-03-20', km: 62000, itens: ['oleo-cambio', 'velas', 'arrefecimento'], custo: 980, obs: '' },
    ],
    fuel: [
      { id: 'a', data: '2026-10-20', km: 102400, litros: 48.2, valor: 298.4, cheio: true },
      { id: 'b', data: '2026-11-02', km: 102900, litros: 46.1, valor: 285.8, cheio: true },
      { id: 'c', data: '2026-11-10', km: 103250, litros: 33.5, valor: 207.7, cheio: true },
    ],
  };
  for (const [name, vp, mobile] of [['mobile', { width: 390, height: 844 }, true], ['tablet', { width: 820, height: 1180 }, true], ['desktop', { width: 1366, height: 900 }, false]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
    p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR', name, e.message));
    p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', name, m.text()); });
    await p.goto('http://localhost:8080/');
    await p.evaluate((s) => localStorage.setItem('asx.v1', JSON.stringify(s)), seed);
    for (const v of ['', 'manutencao', 'combustivel', 'ficha', 'obd']) {
      await p.goto('http://localhost:8080/#/' + v);
      await p.reload();
      await p.waitForTimeout(v === '' ? 6000 : 400);
      if (v === 'obd') { await p.click('[data-action="obd-sim"]'); await p.waitForTimeout(1500); await p.click('[data-action="obd-dtc"]'); await p.waitForTimeout(300); }
      await p.screenshot({ path: `${S}/shots/${name}-${v || 'inicio'}.png`, fullPage: true });
    }
    await ctx.close();
  }
  await b.close();
})();
