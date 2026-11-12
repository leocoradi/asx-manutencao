// Simula a ponte nativa do APK (window.AsxNative / window.asxNativo): mídia, manobra, avisos e mapa nativo.
// Uso: node tools/celular-falso.cjs <pasta>   (app servido em http://localhost:8080)
const { chromium } = require('playwright');
const out = process.argv[2] || 'shots';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
const estado = (navSdk) => ({ acesso: true,
  midia: { app: 'YouTube Music', titulo: 'Instant Crush (feat. Julian Casablancas)', artista: 'Daft Punk', album: 'RAM', tocando: true, posicao: 83000, duracao: 337000, instante: Date.now(), capa: png },
  nav: navSdk ? null : { app: 'Google Maps', titulo: 'Siga em direção à R. Dr. Emílio Chierighini', texto: '', sub: 'Chegada: 07:47', curta: '350 m', icone: png },
  guia: navSdk ? { ativo: true, destino: 'Itu', segundos: 1980, metros: 31400, erro: '' } : null,
  avisos: [{ chave: 'k1', app: 'WhatsApp', titulo: 'Marina', texto: 'Chego em 10 minutos, me espera na portaria?', quando: Date.now() - 120000 },
           { chave: 'k2', app: 'Telefone', titulo: 'Chamada perdida', texto: 'Oficina do bairro', quando: Date.now() - 900000 }] });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [nome, vp, navSdk] of [['retrato', { width: 390, height: 844 }, false], ['paisagem', { width: 844, height: 390 }, false], ['paisagem-sdk', { width: 844, height: 390 }, true], ['central', { width: 1024, height: 600 }, true]]) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2 });
    p.on('pageerror', (e) => { if (!/Unexpected token/.test(e.message)) console.log('PAGEERROR', nome, e.message); });
    await p.addInitScript(([e, navSdk]) => {
      window.__cmds = []; window.__estado = e;
      window.AsxNative = { versao: () => 2, temAcesso: () => true, pedirAcesso: () => {}, midia: (c) => window.__cmds.push(c), estado: () => JSON.stringify(window.__estado),
        navSdk: () => navSdk, mapa: (x, y, w, h) => { window.__mapa = [x, y, w, h].map(Math.round); }, navegar: (d) => window.__cmds.push('navegar:' + d), pararGuia: () => window.__cmds.push('parar'),
        aviso: (a, k) => window.__cmds.push(`aviso:${a}:${k}`) };
    }, [estado(navSdk), navSdk]);
    await p.goto('http://localhost:8080/#/navegacao'); await p.waitForTimeout(1300);
    // Marca visualmente o retângulo que a view nativa ocuparia.
    await p.evaluate(() => { const el = document.getElementById('mapa-nativo'); if (el) { el.style.background = '#1d2b36'; el.textContent = ' [NavigationView nativa aqui]'; el.style.color = '#9ab'; } });
    await p.screenshot({ path: `${out}/nav-${nome}.png` });
    if (nome === 'retrato') {
      await p.click('[data-cel="toggle"]'); await p.click('[data-action="aviso-ouvir"]');
      await p.goto('http://localhost:8080/#/'); await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}/inicio-faixa.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
      await p.goto('http://localhost:8080/#/obd'); await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}/manutencao-obd.png`, clip: { x: 0, y: 0, width: 390, height: 420 } });
      console.log(nome, await p.evaluate(() => ({ cmds: window.__cmds, hash: location.hash })));
    }
    if (navSdk) {
      await p.fill('input[name="destino"]', 'Itu'); await p.click('form[data-form="rota"] button[type="submit"]'); await p.click('[data-action="guia-parar"]');
      console.log(nome, await p.evaluate(() => ({ mapa: window.__mapa, cmds: window.__cmds, rolagem: document.documentElement.scrollHeight > innerHeight })));
    }
    await p.close();
  }
  await b.close();
})();
