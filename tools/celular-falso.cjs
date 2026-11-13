// Simula a ponte nativa do APK (window.AsxNative / window.asxNativo): mídia, manobra, avisos e modo carro.
// Uso: node tools/celular-falso.cjs <pasta>   (app servido em http://localhost:8080)
const { chromium } = require('playwright');
const out = process.argv[2] || 'shots';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
const estado = (carro) => ({ acesso: true, carro: { ativo: carro, salvo: 'ASX Rádio', audio: carro ? 'ASX Rádio' : null },
  midia: { app: 'YouTube Music', titulo: 'Instant Crush (feat. Julian Casablancas)', artista: 'Daft Punk', album: 'RAM', tocando: true, posicao: 83000, duracao: 337000, instante: Date.now(), capa: png },
  nav: { app: 'Google Maps', titulo: 'Siga em direção à R. Dr. Emílio Chierighini', texto: '', sub: 'Chegada: 07:47', curta: '350 m', icone: png },
  avisos: [{ chave: 'k1', app: 'WhatsApp', titulo: 'Marina', texto: 'Chego em 10 minutos, me espera na portaria?', quando: Date.now() - 120000 },
           { chave: 'k2', app: 'Telefone', titulo: 'Chamada perdida', texto: 'Oficina do bairro', quando: Date.now() - 900000 }] });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [nome, vp, carro] of [['retrato', { width: 390, height: 844 }, false], ['paisagem', { width: 844, height: 390 }, false], ['tablet-carro', { width: 1333, height: 800 }, true]]) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2 });
    p.on('pageerror', (e) => { if (!/Unexpected token/.test(e.message)) console.log('PAGEERROR', nome, e.message); });
    await p.addInitScript((e) => {
      window.__cmds = []; window.__estado = e;
      window.AsxNative = { versao: () => 3, versaoApp: () => '1.12', temAcesso: () => true, pedirAcesso: () => {}, midia: (c) => window.__cmds.push(c), estado: () => JSON.stringify(window.__estado),
        aviso: (a, k) => window.__cmds.push(`aviso:${a}:${k}`), modoCarro: (l) => window.__cmds.push('carro:' + l), lembrarCarro: (n) => window.__cmds.push('lembrar:' + n),
        apps: () => JSON.stringify([{ id: 'com.waze', nome: 'Waze', tipo: 'nav' }, { id: 'com.google.android.apps.youtube.music', nome: 'YouTube Music', tipo: 'musica' }, { id: 'com.andrerinas.headunitrevived', nome: 'Android Auto', tipo: 'auto' }]),
        abrirApp: (id) => window.__cmds.push('app:' + id), bateriaLivre: () => false, pedirBateria: () => window.__cmds.push('bateria'), procurarAtualizacao() {}, instalarAtualizacao() {} };
      // GPS simulado: 133 m para o norte a cada leitura, com 8 s entre elas (60 km/h); as leituras chegam aceleradas.
      let lat = -23.55, n = 0;
      const ler = () => ({ coords: { latitude: (lat += 0.0012), longitude: -46.63, accuracy: 8, speed: 16.7 }, timestamp: Date.now() + 8000 * n++ });
      navigator.geolocation.getCurrentPosition = (ok) => ok(ler());
      navigator.geolocation.watchPosition = (ok) => setInterval(() => ok(ler()), 300);
    }, estado(carro));
    await p.goto('http://localhost:8080/#/navegacao'); await p.waitForTimeout(1300);
    await p.screenshot({ path: `${out}/nav-${nome}.png` });
    if (nome === 'retrato') {
      await p.click('[data-cel="toggle"]'); await p.click('[data-action="aviso-ouvir"]');
      await p.goto('http://localhost:8080/#/'); await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}/inicio-faixa.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
      await p.goto('http://localhost:8080/#/obd'); await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}/manutencao-obd.png`, clip: { x: 0, y: 0, width: 390, height: 420 } });
      console.log(nome, await p.evaluate(() => ({ cmds: window.__cmds, hash: location.hash })));
    }
    if (carro) {
      await p.goto('http://localhost:8080/#/'); await p.waitForTimeout(3500);
      await p.screenshot({ path: `${out}/inicio-${nome}.png` });
      console.log('gps', await p.evaluate(() => ({ vel: document.querySelector('[data-gps="vel"]')?.textContent, odo: JSON.parse(localStorage.getItem('asx.v1') || '{}').odo, atalhos: document.querySelectorAll('.atalhos button').length })));
      await p.click('.atalhos button');
      await p.click('#btn-carro'); await p.click('#btn-config'); await p.waitForTimeout(200);
      await p.screenshot({ path: `${out}/config-${nome}.png` });
      console.log(nome, await p.evaluate(() => ({ cmds: window.__cmds, carro: document.body.dataset.carro, botao: document.getElementById('btn-carro').getAttribute('aria-label') })));
    }
    await p.close();
  }
  await b.close();
})();
