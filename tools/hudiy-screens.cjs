// App conectado a uma central Hudiy falsa (rode antes: npm run fake-hudiy). Uso: node tools/hudiy-screens.cjs <pasta>
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['central', { width: 1024, height: 600 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await p.addInitScript(() => { window.hudiy = {}; });
    await p.goto('http://localhost:8080/');
    await p.evaluate(() => localStorage.setItem('asx.v1', JSON.stringify({ v: 1, odo: { km: 103250, data: '2026-11-10' }, log: [], fuel: [] })));
    await p.reload(); await p.waitForTimeout(name === 'phone' ? 1500 : 7000);
    await p.screenshot({ path: (process.argv[2] || 'shots') + `/hudiy-${name}.png` });
    if (name === 'central') {
      await p.click('[data-tecla="14"]');
      await p.goto('http://localhost:8080/#/obd'); await p.waitForTimeout(300);
      await p.click('[data-action="obd-hudiy"]'); await p.waitForTimeout(2500);
      await p.click('[data-action="obd-dtc"]'); await p.waitForTimeout(500);
      await p.screenshot({ path: (process.argv[2] || 'shots') + `/hudiy-obd.png`, fullPage: true });
      console.log('log:', await p.evaluate(() => document.querySelector('.log').textContent));
    }
    await ctx.close();
  }
  await b.close();
})();
