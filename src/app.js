import { VEICULO, AREAS, PLANO, FLUIDOS, FICHA, PNEUS, LAMPADAS, FUSIVEIS } from './data.js';
import { situacao, ordenar, consumo } from './plan.js';
import { carro, carro3d, CARRO_3D } from './car.js';
import { Elm327Ble, HudiyObd, Simulador, COMANDOS } from './obd.js';
import { Hudiy, MSG, TECLA, mediaStatus, mediaMeta, navStatus, navDetalhes, navDistancia, imagemUrl } from './hudiy.js';
import { carregarGoogle, MapaTransito, linksNavegar } from './mapa.js';
import { analisarHash, manobraDeNotificacao, mmss, tempoDistancia } from './painel.js';

// --- Estado e persistência (localStorage + backup JSON) ---
const KEY = 'asx.v1';
const hojeIso = () => new Date().toISOString().slice(0, 10);
const vazio = () => ({ v: 1, odo: { km: 0, data: hojeIso() }, log: [], fuel: [] });

function validar(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.log) || !Array.isArray(d.fuel)) throw new Error('Arquivo não é um backup do app.');
  const num = (n) => (Number.isFinite(+n) && +n >= 0 ? +n : 0);
  const data = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : hojeIso());
  return {
    v: 1,
    odo: { km: num(d.odo?.km), data: data(d.odo?.data) },
    log: d.log.map((e) => ({ id: String(e.id ?? crypto.randomUUID()), data: data(e.data), km: num(e.km), custo: num(e.custo), obs: String(e.obs ?? '').slice(0, 500),
      itens: (Array.isArray(e.itens) ? e.itens : []).filter((i) => PLANO.some((p) => p.id === i)) })),
    fuel: d.fuel.map((f) => ({ id: String(f.id ?? crypto.randomUUID()), data: data(f.data), km: num(f.km), litros: num(f.litros), valor: num(f.valor), cheio: !!f.cheio })),
  };
}
function carregar() { try { return validar(JSON.parse(localStorage.getItem(KEY))); } catch { return vazio(); } }
let S = carregar();
const salvar = () => localStorage.setItem(KEY, JSON.stringify(S));

// --- Utilidades ---
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const km = (n) => Math.round(n).toLocaleString('pt-BR');
const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (s) => s.split('-').reverse().join('/');
const seg = (pct, status) => `<div class="seg ${status}" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i class="${pct * 4 >= i - 0.5 ? 'on' : ''}"></i>`).join('')}</div>`;
const chipTxt = { vencido: 'Vencido', breve: 'Em breve', ok: 'Em dia', sem: 'Sem registro' };
const chip = (st, est) => `<span class="chip ${st}">${chipTxt[st]}${est ? ' · est.' : ''}</span>`;
const main = document.getElementById('main');
const dlg = document.getElementById('dlg');
let toastT;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2500);
}
function descricao(s) {
  if (s.status === 'sem') return 'Informe o odômetro ou registre a última vez que foi feito.';
  if (s.estimado) return `Sem registro · pela quilometragem, próxima aos ${km(s.proximo)} km (faltam ${km(s.kmRestante)} km)`;
  const partes = [];
  partes.push(s.kmRestante >= 0 ? `faltam ${km(s.kmRestante)} km` : `${km(-s.kmRestante)} km atrasado`);
  partes.push(s.diasRestante >= 0 ? `${s.diasRestante} dias` : `${-s.diasRestante} dias atrasado`);
  return `Último: ${km(s.ultimo.km)} km em ${dataBr(s.ultimo.data)} · ${partes.join(' / ')}`;
}

// --- Telas ---
function inicio() {
  const lista = ordenar(PLANO, S.log, S.odo.km);
  const porArea = {};
  for (const l of lista) {
    const a = l.item.area;
    const peso = { vencido: 0, breve: 1, sem: 2, ok: 3 };
    if (!porArea[a] || peso[l.status] < peso[porArea[a]]) porArea[a] = l.status;
  }
  const c = consumo(S.fuel);
  const vencidos = lista.filter((l) => l.status === 'vencido').length;
  return `
  <div class="grid">
    <div class="faixa-slot full" aria-live="polite">${faixaHtml()}</div>
    <section class="card dark">
      <h2>Odômetro</h2>
      <div class="row">
        <div class="num big">${km(S.odo.km)}</div>
        <button class="btn-ghost btn-sm" data-action="km">Atualizar</button>
      </div>
      <small class="muted">km · em ${dataBr(S.odo.data)}</small>
    </section>
    <section class="card dark span-2">
      <h2>${esc(VEICULO.nome)}</h2>
      ${carro3d(porArea, AREAS)}
      <div class="legend"><span><i></i>Em dia</span><span><i class="breve"></i>Em breve</span><span><i class="vencido"></i>Vencido</span><span><i class="sem"></i>Sem registro</span></div>
    </section>
    <section class="card ${vencidos ? 'alert' : ''} span-2">
      <div class="row"><h2>Próximas manutenções</h2>${vencidos ? `<span class="chip vencido">${vencidos} vencido${vencidos > 1 ? 's' : ''}</span>` : ''}</div>
      ${lista.slice(0, 4).map((l) => `
        <button class="row" style="width:100%;background:none;color:inherit;padding:10px 0;border-bottom:1px dashed var(--card-line);border-radius:0;text-align:left" data-action="ir" data-area="${l.item.area}">
          <div class="stack" style="flex:1">
            <span class="t">${esc(l.item.nome)}</span>
            <small class="muted">${descricao(l)}</small>
            ${seg(l.pct, l.status)}
          </div>
          ${chip(l.status, l.estimado)}
        </button>`).join('')}
      <div class="actions"><a class="btn btn-ghost btn-sm" href="#/manutencao" style="text-decoration:none;display:inline-flex;align-items:center">Ver plano completo</a></div>
    </section>
    <section class="card">
      <h2>Combustível</h2>
      ${c.media ? `
        <div class="row"><div><div class="num mid">${c.ultimo.toFixed(1)}<span class="u muted" style="font-size:14px;font-family:var(--sans)"> km/L</span></div><small class="muted">último tanque</small></div>
        <div class="r"><div class="num mid">${c.media.toFixed(1)}</div><small class="muted">média geral</small></div></div>`
      : `<p class="muted">Registre abastecimentos com tanque cheio para ver a média.</p>`}
      <div class="actions"><a class="btn btn-sm" href="#/combustivel" style="text-decoration:none;display:inline-flex;align-items:center">Registrar abastecimento</a></div>
    </section>
  </div>`;
}

function navegacao() {
  const nativo = navNativo();
  return `
  <div class="nav-view">
    <section class="mapa-area${nativo ? ' nativo' : ''}">
      <div class="manobra-slot" aria-live="polite">${manobraHtml()}</div>
      ${nativo ? '<div class="mapa-box nativo" id="mapa-nativo" role="region" aria-label="Mapa de navegação"></div>'
        : gm.chave ? '<div class="mapa-box gmapa" id="gmapa" role="region" aria-label="Mapa do Google com trânsito ao vivo"></div>'
        : '<div class="mapa-box vazio"><p class="muted" style="margin:0">Mapa do Google com trânsito ao vivo e rota com tempo real.</p><button class="btn-ghost btn-sm" data-action="gm-config">Configurar chave do Google Maps</button></div>'}
      <form data-form="rota" class="row destino">
        <input name="destino" placeholder="Para onde?" required aria-label="Destino" maxlength="200" value="${esc(gm.destino)}">
        <button class="btn-sm claro" type="submit">${nativo ? 'Ir' : gm.chave ? 'Rota' : 'Navegar'}</button>
        ${nativo ? '' : `<button class="btn-ghost btn-sm" type="button" data-action="pos" aria-label="${pos ? 'Atualizar minha posição' : 'Usar minha posição'}">◎</button>`}
      </form>
      <div class="rota-info">${nativo ? guiaHtml() : rotaHtml()}</div>
    </section>
    <section class="w-midia card dark" aria-label="Mídia"></section>
    <section class="w-avisos card dark" aria-label="Avisos"></section>
  </div>`;
}

function manutencao(q, sub) {
  const abas = [['', 'Plano'], ['ficha', 'Ficha'], ['obd', 'OBD']];
  return `
  <nav class="segctl" aria-label="Seções de manutenção">${abas.map(([s, r]) => `<a href="#/manutencao${s ? '/' + s : ''}" ${s === sub ? 'aria-current="page"' : ''}>${r}</a>`).join('')}</nav>
  ${sub === 'ficha' ? ficha() : sub === 'obd' ? obdView() : plano(q)}`;
}

function plano(q) {
  const area = q.get('area');
  const lista = ordenar(PLANO, S.log, S.odo.km).filter((l) => !area || l.item.area === area);
  const hist = [...S.log].sort((a, b) => b.km - a.km || b.data.localeCompare(a.data));
  const nome = (id) => PLANO.find((p) => p.id === id)?.nome ?? id;
  return `
  <div class="row" style="margin:8px 0 12px;flex-wrap:wrap">
    <h1>Plano${area ? ` · ${AREAS[area]}` : ''}</h1>
    <div class="actions" style="margin:0">
      ${area ? '<a class="btn btn-ghost btn-sm" href="#/manutencao" style="text-decoration:none;display:inline-flex;align-items:center">Todas as áreas</a>' : ''}
      <button class="btn-sm" data-action="registrar">+ Registrar serviço</button>
    </div>
  </div>
  <p class="muted" style="margin:0 0 12px"><small>Intervalos para uso severo (Brasil). Vence o que chegar primeiro: km ou tempo. Odômetro atual: ${km(S.odo.km)} km. Itens "est." são estimados pelo odômetro (múltiplos do intervalo) até você registrar o serviço.</small></p>
  <div class="grid">
    ${lista.map((l) => `
    <section class="card ${l.status === 'vencido' ? 'alert' : ''}">
      <div class="row"><h2 style="margin:0">${esc(l.item.nome)}</h2>${chip(l.status, l.estimado)}</div>
      <small class="muted">A cada ${km(l.item.km)} km ou ${l.item.meses} meses</small>
      ${seg(l.pct, l.status)}
      <p style="margin:10px 0 4px"><small>${descricao(l)}</small></p>
      <p class="muted" style="margin:0"><small>${esc(l.item.spec)}</small></p>
      <div class="actions"><button class="btn-ghost btn-sm" data-action="registrar" data-item="${l.item.id}">Registrar</button></div>
    </section>`).join('')}
  </div>
  <h2>Histórico</h2>
  <div class="list">
    ${hist.length ? hist.map((e) => `
      <div>
        <div class="stack"><span class="t">${e.itens.map((i) => esc(nome(i))).join(', ') || 'Serviço'}</span>
          <span class="d">${dataBr(e.data)} · ${km(e.km)} km${e.custo ? ` · ${brl(e.custo)}` : ''}${e.obs ? ` · ${esc(e.obs)}` : ''}</span></div>
        <button class="btn-ghost btn-sm" data-action="apagar-log" data-id="${e.id}" aria-label="Apagar registro de ${dataBr(e.data)}">Apagar</button>
      </div>`).join('') : '<div class="empty">Nenhum serviço registrado.</div>'}
  </div>`;
}

function combustivel() {
  const c = consumo(S.fuel);
  const lista = [...S.fuel].sort((a, b) => b.km - a.km);
  const gasto = S.fuel.reduce((s, f) => s + f.valor, 0);
  const kmTot = c.trechos.reduce((s, t) => s + t.km, 0);
  const cheios = S.fuel.filter((f) => f.cheio).map((f) => f.km);
  // Custo/km: só o combustível gasto dentro dos trechos medidos (entre o 1º e o último tanque cheio).
  const valorTrechos = S.fuel.filter((f) => f.km > Math.min(...cheios) && f.km <= Math.max(...cheios)).reduce((s, f) => s + f.valor, 0);
  return `
  <h1 style="margin:8px 0 12px">Combustível</h1>
  <div class="grid">
    <section class="card span-2">
      <h2>Novo abastecimento</h2>
      <form data-form="fuel">
        <div class="grid-2">
          <label>Data<input name="data" type="date" required value="${hojeIso()}"></label>
          <label>Odômetro (km)<input name="km" type="number" inputmode="numeric" min="0" step="1" required value="${S.odo.km || ''}"></label>
          <label>Litros<input name="litros" type="number" inputmode="decimal" min="0.1" step="0.01" required></label>
          <label>Valor total (R$)<input name="valor" type="number" inputmode="decimal" min="0" step="0.01" required></label>
        </div>
        <label class="inline"><input name="cheio" type="checkbox" checked>Tanque cheio</label>
        <button type="submit">Salvar</button>
      </form>
    </section>
    <section class="card">
      <h2>Consumo</h2>
      ${c.media ? `
      <div class="row"><div><div class="num mid">${c.ultimo.toFixed(1)}</div><small class="muted">km/L último</small></div>
        <div><div class="num mid">${c.media.toFixed(1)}</div><small class="muted">km/L média</small></div>
        <div class="r"><div class="num mid">${(valorTrechos / kmTot).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div><small class="muted">por km</small></div></div>`
      : '<p class="muted">A média usa trechos entre dois abastecimentos com tanque cheio.</p>'}
      <p class="muted" style="margin:12px 0 0"><small>Total gasto: ${brl(gasto)} · tanque ${VEICULO.tanqueL} L · gasolina</small></p>
    </section>
  </div>
  <h2>Registros</h2>
  <div class="list">
    ${lista.length ? lista.map((f) => `
      <div>
        <div class="stack"><span class="t">${f.litros.toLocaleString('pt-BR')} L · ${brl(f.valor)}${f.cheio ? '' : ' · parcial'}</span>
          <span class="d">${dataBr(f.data)} · ${km(f.km)} km · ${(f.valor / f.litros).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L</span></div>
        <button class="btn-ghost btn-sm" data-action="apagar-fuel" data-id="${f.id}" aria-label="Apagar abastecimento de ${dataBr(f.data)}">Apagar</button>
      </div>`).join('') : '<div class="empty">Nenhum abastecimento registrado.</div>'}
  </div>`;
}

const tabela = (linhas, cab) => `<table>${cab ? `<thead><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr></thead>` : ''}<tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
function ficha() {
  return `
  <h1 style="margin:8px 0 12px">Ficha técnica</h1>
  <div class="grid">
    <section class="card"><h2>Motor e dimensões</h2>${tabela([['Motor', VEICULO.motor], ['Câmbio', VEICULO.cambio], ['Tração', VEICULO.tracao], ['Combustível', VEICULO.combustivel], ...FICHA])}</section>
    <section class="card"><h2>Fluidos e capacidades</h2>${tabela(FLUIDOS, ['Sistema', 'Volume', 'Especificação'])}
      <p class="muted" style="margin:10px 0 0"><small>Freio e embreagem usam o mesmo reservatório: ao sangrar os freios, sangre também o atuador da embreagem.</small></p></section>
    <section class="card"><h2>Pneus</h2>${tabela(PNEUS, ['', 'Medida', 'Calibragem a frio'])}</section>
    <section class="card"><h2>Lâmpadas e ignição</h2>${tabela([['Velas', 'NGK FR6EI · DENSO K20PSR-B8'], ['Bateria', '12V 65Ah CCA 550A'], ...LAMPADAS])}</section>
    ${Object.entries(FUSIVEIS).map(([t, l]) => `<section class="card"><h2>Fusíveis · ${esc(t)}</h2>${tabela(l, ['Nº', 'A', 'Circuito'])}</section>`).join('')}
  </div>`;
}

// --- OBD ---
const UN = { rpm: 'rpm', kilometersPerHour: 'km/h', celsius: '°C', volts: 'V', percent: '%', seconds: 's', kilometers: 'km', scalar: '', offon: '' };
const obd = { tx: null, valores: {}, dtcs: null, log: [], timer: null, ciclo: 0 };
function logObd(m) { obd.log = [`${new Date().toLocaleTimeString('pt-BR')} ${m}`, ...obd.log].slice(0, 30); document.querySelector('.log')?.replaceChildren(obd.log.join('\n')); }
function fmtVal(sig, v) {
  if (v == null) return '—';
  if (sig.fmt.unit === 'offon') return v ? 'Ligada' : 'Apagada';
  return Number.isInteger(v) ? String(v) : v.toFixed(sig.fmt.unit === 'volts' ? 2 : 1);
}
function tiles() {
  return COMANDOS.flatMap((c) => c.signals).map((s) => `
    <div class="tile"><div class="k">${esc(s.name)}</div><div class="v"><span data-sig="${s.id}">${fmtVal(s, obd.valores[s.id])}</span><span class="u">${UN[s.fmt.unit] ?? ''}</span></div></div>`).join('');
}
function obdView() {
  const on = !!obd.tx;
  return `
  <h1 style="margin:8px 0 12px">Diagnóstico OBD</h1>
  <section class="card dark">
    <div class="row" style="flex-wrap:wrap">
      <div class="stack"><span class="t">${on ? `Conectado: ${esc(obd.tx.nome)}` : 'Desconectado'}</span>
        <small class="muted">Bluetooth: ELM327 BLE (Vgate iCar Pro BLE, OBDLink CX…) via Chrome no Android; adaptadores SPP não funcionam no navegador. Central Hudiy: o ELM327 ligado à central, pela API local.</small></div>
      <div class="actions" style="margin:0">
        ${on ? '<button class="btn-red btn-sm" data-action="obd-off">Desconectar</button>'
             : `<button class="btn-sm" style="background:var(--fg);color:var(--bg)" data-action="obd-ble">Conectar Bluetooth</button><button class="btn-ghost btn-sm" data-action="obd-hudiy">Central Hudiy</button><button class="btn-ghost btn-sm" data-action="obd-sim">Simular</button>`}
      </div>
    </div>
  </section>
  <h2>Leituras</h2>
  <div class="tiles">${tiles()}</div>
  <div class="actions">
    <button class="btn-ghost btn-sm" data-action="obd-dtc" ${on ? '' : 'disabled'}>Ler códigos de falha</button>
    <button class="btn-ghost btn-sm" data-action="obd-odo" ${on && obd.valores.ASX_ODO ? '' : 'disabled'}>Usar odômetro do carro (${obd.valores.ASX_ODO ? km(obd.valores.ASX_ODO) + ' km' : '—'})</button>
  </div>
  ${obd.dtcs ? `<section class="card ${obd.dtcs.length ? 'alert' : ''}" style="margin-top:12px"><h2>Códigos de falha</h2>${obd.dtcs.length ? `<div class="num mid">${obd.dtcs.map(esc).join(' · ')}</div>` : '<p>Nenhum código armazenado.</p>'}</section>` : ''}
  <h2>Log</h2>
  <div class="log">${esc(obd.log.join('\n'))}</div>`;
}
async function obdConectar(tx) {
  try {
    await tx.conectar();
    obd.tx = tx; obd.valores = {}; obd.dtcs = null; tx.onStatus = logObd;
    logObd(`Conectado a ${tx.nome}`);
    render();
    obdPoll();
  } catch (e) { logObd(`Erro: ${e.message}`); toast(e.message); }
}
async function obdPoll() {
  if (!obd.tx) return;
  obd.ciclo++;
  for (const c of COMANDOS) {
    if (!obd.tx || (obd.ciclo !== 1 && obd.ciclo % Math.max(1, Math.round(c.freq)) !== 0)) continue;
    try {
      const r = await obd.tx.consultar(c);
      if (r) Object.assign(obd.valores, r);
      else if (obd.ciclo === 1) logObd(`${c.hdr} ${Object.values(c.cmd).join('')}: sem resposta`);
    } catch (e) { logObd(`${c.hdr}: ${e.message}`); }
    for (const s of c.signals) { const el = document.querySelector(`[data-sig="${s.id}"]`); if (el) el.textContent = fmtVal(s, obd.valores[s.id]); }
  }
  const b = document.querySelector('[data-action="obd-odo"]');
  if (b && obd.valores.ASX_ODO) { b.disabled = false; b.textContent = `Usar odômetro do carro (${km(obd.valores.ASX_ODO)} km)`; }
  obd.timer = setTimeout(obdPoll, 1000);
}
function obdDesconectar() {
  clearTimeout(obd.timer); obd.tx?.desconectar?.(); obd.tx = null; obd.valores = {}; logObd('Desconectado'); render();
}

// --- Diálogos ---
function abrir(html) { dlg.innerHTML = html; dlg.showModal(); sincronizarMapaNativo(); }
function dlgRegistrar(itemId) {
  abrir(`<h2>Registrar serviço</h2>
  <form data-form="log">
    <div class="grid-2">
      <label>Data<input name="data" type="date" required value="${hojeIso()}"></label>
      <label>Odômetro (km)<input name="km" type="number" inputmode="numeric" min="0" step="1" required value="${S.odo.km || ''}"></label>
    </div>
    <fieldset><legend>Itens feitos</legend>
      ${PLANO.map((p) => `<label class="inline"><input type="checkbox" name="itens" value="${p.id}" ${p.id === itemId ? 'checked' : ''}>${esc(p.nome)}</label>`).join('')}
    </fieldset>
    <div class="grid-2">
      <label>Custo (R$)<input name="custo" type="number" inputmode="decimal" min="0" step="0.01" value="0"></label>
      <label>Observações<input name="obs" maxlength="500" placeholder="oficina, peças…"></label>
    </div>
    <div class="actions"><button type="submit">Salvar</button><button type="button" class="btn-ghost" data-action="fechar">Cancelar</button></div>
  </form>`);
}
function dlgKm() {
  abrir(`<h2>Odômetro</h2>
  <form data-form="km">
    <label>Quilometragem atual<input name="km" type="number" inputmode="numeric" min="${S.odo.km}" step="1" required value="${S.odo.km || ''}" autofocus></label>
    <div class="actions"><button type="submit">Salvar</button><button type="button" class="btn-ghost" data-action="fechar">Cancelar</button></div>
  </form>`);
}
function dlgConfig() {
  abrir(`<h2>Backup</h2>
  <p>Os dados ficam só neste aparelho. Exporte um JSON de vez em quando e importe em outro aparelho.</p>
  <div class="actions">
    <button data-action="exportar">Exportar JSON</button>
    <label class="btn btn-ghost" style="display:inline-flex;align-items:center;cursor:pointer">Importar JSON<input type="file" accept="application/json,.json" data-action="importar" hidden></label>
  </div>
  <h2 style="margin-top:20px">Google Maps</h2>
  <form data-form="gm">
    <label>Chave da API (fica só neste aparelho)<input name="chave" autocomplete="off" spellcheck="false" placeholder="AIza…" value="${esc(gm.chave)}"></label>
    <div class="actions"><button type="submit" class="btn-sm">Salvar chave</button></div>
  </form>
  <p class="muted"><small>Crie no console do Google Cloud com as APIs "Maps JavaScript API" e "Routes API" ativas e restrinja a chave ao domínio deste app. Uso pessoal cabe na cota gratuita.</small></p>
  <h2 style="margin-top:20px">Apagar tudo</h2>
  <div class="actions"><button class="btn-red" data-action="zerar">Apagar todos os registros</button><button class="btn-ghost" data-action="fechar">Fechar</button></div>`);
}
function exportar() {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' })), download: `asx-backup-${hojeIso()}.json` });
  a.click(); URL.revokeObjectURL(a.href);
}
async function importar(file) {
  try {
    const d = validar(JSON.parse(await file.text()));
    if (!confirm(`Substituir os dados atuais por ${d.log.length} serviços e ${d.fuel.length} abastecimentos?`)) return;
    S = d; salvar(); dlg.close(); render(); toast('Backup importado.');
  } catch (e) { toast(e.message); }
}

// --- Eventos ---
function formDados(f) {
  const fd = new FormData(f);
  return { data: fd.get('data'), km: +fd.get('km'), litros: +fd.get('litros'), valor: +fd.get('valor'), custo: +fd.get('custo') || 0, obs: (fd.get('obs') || '').trim(), cheio: fd.get('cheio') === 'on', itens: fd.getAll('itens'), destino: (fd.get('destino') || '').trim(), url: (fd.get('url') || '').trim(), chave: (fd.get('chave') || '').trim() };
}
function atualizaOdo(kmNovo, data) {
  if (kmNovo > S.odo.km) S.odo = { km: kmNovo, data: data > S.odo.data ? data : S.odo.data };
}
document.addEventListener('submit', (e) => {
  const f = e.target; if (!f.dataset.form) return;
  e.preventDefault();
  if (!f.reportValidity()) return;
  const d = formDados(f);
  if (f.dataset.form === 'log') {
    if (!d.itens.length) return toast('Marque ao menos um item.');
    S.log.push({ id: crypto.randomUUID(), data: d.data, km: d.km, itens: d.itens, custo: d.custo, obs: d.obs });
    atualizaOdo(d.km, d.data); toast('Serviço registrado.');
  } else if (f.dataset.form === 'fuel') {
    S.fuel.push({ id: crypto.randomUUID(), data: d.data, km: d.km, litros: d.litros, valor: d.valor, cheio: d.cheio });
    atualizaOdo(d.km, d.data); toast('Abastecimento registrado.');
  } else if (f.dataset.form === 'rota') {
    gm.destino = d.destino;
    if (navNativo()) { window.AsxNative.navegar(d.destino); toast('Calculando rota…'); return; }
    if (!gm.mapa) { location.href = linksNavegar(d.destino).geo; return; }
    if (!pos) return toast('Toque em "Minha posição" primeiro.');
    gm.mapa.rota(pos, d.destino).then((r) => { gm.resumo = r; rotaAtualizar(); }).catch((e) => toast('Rota: ' + (e.message || e)));
    return;
  } else if (f.dataset.form === 'gm') {
    gm.chave = d.chave; if (gm.chave) localStorage.setItem('asx.gmaps', gm.chave); else localStorage.removeItem('asx.gmaps');
    dlg.close(); render(); return;
  } else if (f.dataset.form === 'km') {
    S.odo = { km: d.km, data: hojeIso() }; toast('Odômetro atualizado.');
  }
  salvar(); if (dlg.open) dlg.close(); render();
});
document.addEventListener('change', (e) => { if (e.target.dataset.action === 'importar' && e.target.files[0]) importar(e.target.files[0]); });
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action;
  if (a === 'km') dlgKm();
  else if (a === 'registrar') dlgRegistrar(el.dataset.item);
  else if (a === 'ir') location.hash = `#/manutencao?area=${el.dataset.area}`;
  else if (a === 'fechar') dlg.close();
  else if (a === 'exportar') exportar();
  else if (a === 'zerar') { if (confirm('Apagar todos os registros deste aparelho? Exporte um backup antes.')) { S = vazio(); salvar(); dlg.close(); render(); } }
  else if (a === 'apagar-log' || a === 'apagar-fuel') {
    if (!confirm('Apagar este registro?')) return;
    const k = a === 'apagar-log' ? 'log' : 'fuel';
    S[k] = S[k].filter((x) => x.id !== el.dataset.id); salvar(); render();
  }
  else if (a === 'pos') localizar(true);
  else if (a === 'gm-config') dlgConfig();
  else if (a === 'rota-alt') { gm.resumo = gm.mapa.escolher(+el.dataset.i); rotaAtualizar(); }
  else if (a === 'rota-limpar') { gm.mapa?.limpar(); gm.resumo = null; gm.destino = ''; rotaAtualizar(); }
  else if (a === 'cel-acesso') window.AsxNative.pedirAcesso();
  else if (a === 'guia-parar') window.AsxNative.pararGuia();
  else if (a.startsWith('aviso-')) window.AsxNative.aviso(a.slice(6), el.dataset.chave);
  else if (a === 'obd-ble') obdConectar(new Elm327Ble());
  else if (a === 'obd-hudiy') { conectarCentral(); obdConectar(new HudiyObd(central)); }
  else if (a === 'obd-sim') obdConectar(new Simulador());
  else if (a === 'obd-off') obdDesconectar();
  else if (a === 'obd-dtc') obd.tx.dtcs().then((d) => { obd.dtcs = d; logObd(`DTCs: ${d.join(', ') || 'nenhum'}`); render(); }).catch((err) => toast(err.message));
  else if (a === 'obd-odo') { S.odo = { km: Math.round(obd.valores.ASX_ODO), data: hojeIso() }; salvar(); toast('Odômetro sincronizado.'); }
});
document.getElementById('btn-config').addEventListener('click', dlgConfig);
main.addEventListener('click', (e) => { const h = e.target.closest('.hot, .hot3d'); if (h) location.hash = `#/manutencao?area=${h.dataset.area}`; });
// Modelo 3D: carrega o visualizador só quando a tela Início está aberta; em erro (sem WebGL, sem rede) fica a silhueta SVG.
let mvPronto;
function montarCarro3d() {
  const mv = main.querySelector('model-viewer'); if (!mv) return;
  const fallback = () => mv.replaceWith(Object.assign(document.createElement('div'), { innerHTML: mv.querySelector('.poster').innerHTML }));
  // Raio da câmera pelo aspecto do elemento: o enquadramento automático usa a esfera envolvente e deixa o carro pequeno.
  const enquadrar = () => {
    const vis = 2 * Math.tan((30 / 2) * Math.PI / 180); // altura visível por metro de distância (fov 30°)
    const d = Math.max((CARRO_3D.largura * 1.1) / (vis * (mv.clientWidth / Math.max(mv.clientHeight, 1))), (CARRO_3D.altura * 1.1) / vis);
    mv.cameraOrbit = `-32deg 78deg ${d}m`; mv.minCameraOrbit = `auto 60deg ${d}m`; mv.maxCameraOrbit = `auto 92deg ${d}m`;
  };
  mvPronto ??= import('../vendor/model-viewer.min.js').then((m) => { m.ModelViewerElement.meshoptDecoderLocation = 'vendor/meshopt_decoder.js'; }).catch(() => null);
  mvPronto.then((ok) => {
    if (ok === null) return fallback();
    mv.addEventListener('error', fallback, { once: true });
    enquadrar(); new ResizeObserver(enquadrar).observe(mv);
  });
}
main.addEventListener('keydown', (e) => { const h = e.target.closest('.hot'); if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); h.click(); } });

// --- Manobra em andamento: vem da central Hudiy (Android Auto) ou da notificação do navegador no celular ---
const central = new Hudiy();
const midia = { titulo: '', artista: '', posicao: '', duracao: '', tocando: false, capaUrl: null };
const nav = { ativo: false, descricao: '', distancia: '', iconeUrl: null, fonte: '', central: false, inverter: false };
const trocarUrl = (obj, chave, bytes) => { if (obj[chave]) URL.revokeObjectURL(obj[chave]); obj[chave] = imagemUrl(bytes); };
central
  .on(MSG.MEDIA_STATUS, (p) => { Object.assign(midia, mediaStatus(p)); renderPlayer(); renderWidgets(); })
  .on(MSG.MEDIA_META, (p) => { const m = mediaMeta(p); trocarUrl(midia, 'capaUrl', m.capa); Object.assign(midia, m, { capa: undefined }); renderPlayer(); renderWidgets(); })
  .on(MSG.NAV_STATUS, (p) => { Object.assign(nav, { ativo: navStatus(p).ativo, central: true, inverter: true, fonte: 'Navegação via central (Android Auto)' }); atualizarManobra(); })
  .on(MSG.NAV_DETALHES, (p) => { const d = navDetalhes(p); trocarUrl(nav, 'iconeUrl', d.icone); nav.descricao = d.descricao; atualizarManobra(); })
  .on(MSG.NAV_DIST, (p) => { nav.distancia = navDistancia(p); atualizarManobra(); })
  .on('fechou', () => { midia.titulo = ''; if (nav.central) nav.ativo = false; renderPlayer(); renderWidgets(); atualizarManobra(); });
function conectarCentral() { return central.conectar().then(() => { renderPlayer(); renderWidgets(); }).catch((e) => { logObd(e.message); return null; }); }

function manobraHtml() {
  if (!nav.ativo) return '';
  return `<div class="card navcard">
    ${nav.iconeUrl ? `<img class="${nav.inverter ? 'inv' : ''}" src="${nav.iconeUrl}" alt="">` : ''}
    <div class="stack" style="flex:1;min-width:0">${nav.distancia ? `<div class="num dist">${esc(nav.distancia)}</div>` : ''}<div class="desc">${esc(nav.descricao || 'Navegando')}</div><small class="muted">${esc(nav.fonte || 'Navegação')}</small></div></div>`;
}
// Guia do Navigation SDK (APK com chave): estado resumido; o mapa nativo já mostra a manobra.
function guiaHtml() {
  const g = cel.guia;
  if (!g?.ativo) return g?.erro ? `<small class="muted">${esc(g.erro)}</small>` : '';
  return `<div class="row" style="gap:8px"><small class="muted" style="min-width:0">Para ${esc(g.destino)}${g.segundos ? ' · ' + tempoDistancia(g.segundos, g.metros) : ''}</small><button class="btn-ghost btn-sm" data-action="guia-parar">Parar</button></div>`;
}
// No Início: faixa compacta que leva à aba Navegação.
function faixaHtml() {
  const g = cel.guia;
  if (g?.ativo) return `<a class="navlink" href="#/navegacao"><div class="card navcard"><div class="stack" style="flex:1;min-width:0"><div class="desc">Navegando para ${esc(g.destino)}</div><small class="muted">${g.segundos ? tempoDistancia(g.segundos, g.metros) : 'Calculando…'}</small></div></div></a>`;
  return nav.ativo ? `<a class="navlink" href="#/navegacao">${manobraHtml()}</a>` : '';
}
function atualizarManobra() {
  const s = main.querySelector('.manobra-slot'); if (s) s.innerHTML = manobraHtml();
  const f = main.querySelector('.faixa-slot'); if (f) f.innerHTML = faixaHtml();
  const r = main.querySelector('.rota-info'); if (r && navNativo()) r.innerHTML = guiaHtml();
  sincronizarMapaNativo();
}
// O ícone da notificação pode ser claro ou escuro conforme o tema do sistema; no cartão branco, o claro é invertido.
function iconeClaro(url) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 24;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 24, 24);
      const d = g.getImageData(0, 0, 24, 24).data; let soma = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { soma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; }
      res(n > 0 && soma / n > 150);
    };
    img.onerror = () => res(false);
    img.src = url;
  });
}

// --- Posição (mapa de trânsito) ---
let pos = (() => { try { const p = JSON.parse(localStorage.getItem('asx.pos')); return Number.isFinite(p?.lat) && Number.isFinite(p?.lon) ? p : null; } catch { return null; } })();
function localizar(pedido) {
  if (!navigator.geolocation) return toast('Sem geolocalização neste navegador.');
  navigator.geolocation.getCurrentPosition((g) => {
    pos = { lat: g.coords.latitude, lon: g.coords.longitude };
    localStorage.setItem('asx.pos', JSON.stringify(pos));
    gm.mapa?.posicao(pos);
    vigiarPosicao();
  }, (e) => { if (pedido) toast(e.code === 1 ? 'Permissão de localização negada.' : 'Não foi possível obter a posição.'); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}
let vigia;
function vigiarPosicao() {
  vigia ??= navigator.geolocation.watchPosition((g) => { pos = { lat: g.coords.latitude, lon: g.coords.longitude }; gm.mapa?.posicao(pos); }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
}

// --- Mapa do Google com trânsito (chave do usuário) ---
const gm = { chave: localStorage.getItem('asx.gmaps') || '', mapa: null, resumo: null, destino: '' };
function montarMapa() {
  const el = document.getElementById('gmapa'); if (!el || !gm.chave) return;
  gm.mapa = null;
  carregarGoogle(gm.chave).then((g) => {
    if (!document.getElementById('gmapa')) return;
    gm.mapa = new MapaTransito(g, el, pos, gm.chave);
    gm.mapa.onEscolher = (i) => { gm.resumo = gm.mapa.escolher(i); rotaAtualizar(); };
    if (gm.destino && pos) gm.mapa.rota(pos, gm.destino).then((r) => { gm.resumo = r; rotaAtualizar(); }).catch(() => {});
  }).catch((e) => { toast(e.message); el.innerHTML = `<p class="muted" style="padding:12px">${esc(e.message)}</p>`; });
}
function rotaHtml() {
  const r = gm.resumo; if (!r) return '';
  const a = r.rotas[r.atual];
  const l = linksNavegar(gm.destino, a.fim.lat, a.fim.lng);
  return `
    <div class="rota-resumo">
      <div class="rr-texto"><b class="rr-tempo">${esc(a.tempo)}</b><small class="muted">${esc(a.distancia)}${a.via ? ` · via ${esc(a.via)}` : ''}${a.tempo !== a.tempoSemTransito ? ` · sem trânsito ${esc(a.tempoSemTransito)}` : ''}</small></div>
      <a class="btn btn-sm claro rr-ir" href="${l.geo}">Navegar no Vela</a>
      <button class="btn-ghost btn-sm" data-action="rota-limpar" aria-label="Limpar rota">✕</button>
    </div>
    ${r.rotas.length > 1 ? `<div class="alts" role="group" aria-label="Rotas alternativas">${r.rotas.map((x) => `<button class="alt" data-action="rota-alt" data-i="${x.i}" aria-pressed="${x.i === r.atual}">${esc(x.tempo)} · ${esc(x.via || x.distancia)}</button>`).join('')}</div>` : ''}
    <details class="passos"><summary>${a.passos.length} ${a.passos.length === 1 ? 'manobra' : 'manobras'}${a.endereco ? ` até ${esc(a.endereco)}` : ''}</summary><ol>${a.passos.map((p) => `<li>${esc(p.texto)} <small class="muted">${esc(p.distancia)}</small></li>`).join('')}</ol></details>`;
}
window.addEventListener('gmaps-chave', (e) => {
  gm.mapa = null; toast(e.detail);
  const el = document.getElementById('gmapa'); if (el) el.innerHTML = `<p class="muted" style="padding:16px;margin:0">${esc(e.detail)}</p>`;
});
function rotaAtualizar() { const el = main.querySelector('.rota-info'); if (el) el.innerHTML = rotaHtml(); }
// Atualiza a posição sem perguntar quando a permissão já foi dada.
navigator.permissions?.query({ name: 'geolocation' }).then((p) => { if (p.state === 'granted') localizar(false); }).catch(() => {});

// --- Celular (APK): mídia, manobra, avisos e guia pela ponte nativa (window.AsxNative / window.asxNativo) ---
const cel = { acesso: false, midia: null, guia: null, avisos: [] };
const navNativo = () => { try { return !!window.AsxNative?.navSdk?.(); } catch { return false; } };
let erroGuia = '';
function celAplicar(e) {
  Object.assign(cel, { acesso: !!e.acesso, midia: e.midia || null, guia: e.guia || null, avisos: e.avisos || [] });
  if (e.nav) {
    const novoIcone = nav.iconeUrl !== e.nav.icone;
    Object.assign(nav, manobraDeNotificacao(e.nav), { ativo: true, central: false, iconeUrl: e.nav.icone });
    if (novoIcone) { nav.inverter = false; if (e.nav.icone) iconeClaro(e.nav.icone).then((c) => { nav.inverter = c; atualizarManobra(); }); }
  } else if (!nav.central) nav.ativo = false;
  if (cel.guia?.erro && cel.guia.erro !== erroGuia) toast(cel.guia.erro);
  erroGuia = cel.guia?.erro || '';
  renderPlayer(); renderWidgets(); atualizarManobra();
}
window.asxNativo = { evento: (json) => { try { celAplicar(typeof json === 'string' ? JSON.parse(json) : json); } catch (err) { console.error(err); } } };
function celSincronizar() { if (window.AsxNative) { try { celAplicar(JSON.parse(window.AsxNative.estado())); } catch {} } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) celSincronizar(); });

// --- Mídia: rodapé (todas as abas) e widget (aba Navegação), com a mesma fonte de dados ---
const IC = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5l11 7-11 7z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
};
function midiaInfo() {
  if (central.conectado && midia.titulo) return { titulo: midia.titulo, artista: midia.artista, capa: midia.capaUrl, tocando: midia.tocando, pct: null,
    tempo: midia.posicao ? `${midia.posicao} / ${midia.duracao}` : '', attr: { prev: `data-tecla="${TECLA.ANTERIOR}"`, toggle: `data-tecla="${TECLA.TOGGLE_PLAY}"`, next: `data-tecla="${TECLA.PROXIMA}"` } };
  const m = window.AsxNative && cel.midia;
  if (!m) return null;
  const p = Math.min(m.duracao || Infinity, m.posicao + (m.tocando ? Date.now() - m.instante : 0));
  return { titulo: m.titulo, artista: m.artista, capa: m.capa, tocando: m.tocando, pct: m.duracao ? p / m.duracao : null,
    tempo: m.duracao ? `${mmss(p)} / ${mmss(m.duracao)}` : '', attr: { prev: 'data-cel="prev"', toggle: 'data-cel="toggle"', next: 'data-cel="next"' } };
}
const ctlHtml = (i) => `<div class="ctl">
  <button ${i.attr.prev} aria-label="Faixa anterior">${IC.prev}</button>
  <button class="play" ${i.attr.toggle} aria-label="${i.tocando ? 'Pausar' : 'Tocar'}">${i.tocando ? IC.pause : IC.play}</button>
  <button ${i.attr.next} aria-label="Próxima faixa">${IC.next}</button></div>`;
const capaHtml = (i) => (i.capa ? `<img class="capa" src="${i.capa}" alt="">` : '<div class="capa"></div>');
function semMidiaHtml() {
  if (!window.AsxNative) return '';
  return cel.acesso ? '<div class="info"><div class="t">Nada tocando</div><div class="d">Dê play no YouTube Music; a faixa aparece aqui.</div></div>'
    : '<div class="info"><div class="t">Mídia, manobras e avisos</div><div class="d">Permita o acesso a notificações.</div></div><button class="btn-sm claro" data-action="cel-acesso">Permitir</button>';
}
function renderPlayer() {
  const i = midiaInfo(), vazio = semMidiaHtml();
  document.getElementById('player').innerHTML = i
    ? `<div class="barra">${capaHtml(i)}<div class="info"><div class="t">${esc(i.titulo)}</div><div class="d" data-midia-tempo="artista">${esc(i.artista)}${i.tempo ? ` · ${esc(i.tempo)}` : ''}</div></div>${ctlHtml(i)}</div>`
    : vazio && !cel.acesso ? `<div class="barra">${vazio}</div>` : ''; // sem mídia, o rodapé some; só o pedido de permissão ocupa espaço
}
function widgetMidiaHtml() {
  const i = midiaInfo();
  if (!i) return `<div class="wm-vazio">${semMidiaHtml() || '<div class="info"><div class="t">Mídia</div><div class="d">O player do celular aparece aqui no app Android ou na central.</div></div>'}</div>`;
  return `<div class="wm-topo">${capaHtml(i)}<div class="info"><div class="t">${esc(i.titulo)}</div><div class="d">${esc(i.artista)}</div></div></div>
    <div class="wm-prog"><div class="wm-barra"><i data-midia-barra style="width:${(i.pct ?? 0) * 100}%"></i></div><small class="muted" data-midia-tempo="so">${esc(i.tempo)}</small></div>
    ${ctlHtml(i)}`;
}
const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function widgetAvisosHtml() {
  const l = cel.avisos || [];
  if (!l.length) return `<h2>Avisos</h2><p class="muted" style="margin:0">${window.AsxNative ? (cel.acesso ? 'Sem avisos.' : 'Permita o acesso a notificações.') : 'Mensagens e chamadas aparecem aqui no app Android.'}</p>`;
  return `<h2>Avisos</h2><ul class="avisos">${l.map((a) => `<li>
    <button class="av-corpo" data-action="aviso-abrir" data-chave="${esc(a.chave)}"><small class="muted">${esc(a.app)} · ${hora(a.quando)}</small><span class="t">${esc(a.titulo)}</span><span class="tx">${esc(a.texto)}</span></button>
    <div class="av-acoes"><button class="btn-ghost btn-sm" data-action="aviso-ouvir" data-chave="${esc(a.chave)}">Ouvir</button><button class="btn-ghost btn-sm" data-action="aviso-dispensar" data-chave="${esc(a.chave)}">Dispensar</button></div></li>`).join('')}</ul>`;
}
function renderWidgets() {
  const m = main.querySelector('.w-midia'); if (m) m.innerHTML = widgetMidiaHtml();
  const a = main.querySelector('.w-avisos'); if (a) a.innerHTML = widgetAvisosHtml();
}
setInterval(() => { // posição corrente enquanto toca, sem esperar evento do Android
  const i = midiaInfo(); if (!i?.tocando || !i.tempo) return;
  document.querySelectorAll('[data-midia-tempo]').forEach((d) => { d.textContent = d.dataset.midiaTempo === 'so' ? i.tempo : `${i.artista} · ${i.tempo}`; });
  if (i.pct != null) document.querySelectorAll('[data-midia-barra]').forEach((b) => { b.style.width = `${i.pct * 100}%`; });
}, 1000);
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-cel]'); if (c && window.AsxNative) return window.AsxNative.midia(c.dataset.cel);
  const t = e.target.closest('[data-tecla]'); if (t) central.tecla(+t.dataset.tecla);
});

// --- Mapa nativo (Navigation SDK no APK): a view fica por cima da WebView, no retângulo de #mapa-nativo ---
let mapaObs;
function sincronizarMapaNativo() {
  if (!window.AsxNative?.mapa) return;
  const el = document.getElementById('mapa-nativo');
  if (!el || dlg.open) return window.AsxNative.mapa(0, 0, 0, 0);
  const r = el.getBoundingClientRect();
  window.AsxNative.mapa(r.left, r.top, r.width, r.height);
}
dlg.addEventListener('close', sincronizarMapaNativo);
window.addEventListener('resize', sincronizarMapaNativo);

// --- Roteamento ---
const VIEWS = { inicio, navegacao, manutencao, combustivel };
function render() {
  const r = analisarHash(location.hash);
  if (r.redirecionar) return location.replace(r.redirecionar);
  main.innerHTML = VIEWS[r.view](new URLSearchParams(r.qs), r.sub);
  document.body.dataset.view = r.view;
  document.querySelectorAll('.nav a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.view === r.view));
  mapaObs?.disconnect();
  if (r.view === 'inicio') montarCarro3d();
  if (r.view === 'navegacao') {
    montarMapa(); renderWidgets();
    const el = document.getElementById('mapa-nativo');
    if (el) { mapaObs = new ResizeObserver(sincronizarMapaNativo); mapaObs.observe(el); }
  }
  sincronizarMapaNativo();
}
window.addEventListener('hashchange', () => { render(); main.focus({ preventScroll: true }); window.scrollTo(0, 0); });
renderPlayer();
render();
celSincronizar();
if (window.hudiy) conectarCentral();
// Dentro da central Hudiy: tecla/gesto de voltar do web view.
if (window.hudiy) window.hudiy.onGoBack = () => history.back();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
