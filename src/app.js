import { VEICULO, AREAS, PLANO, FLUIDOS, FICHA, PNEUS, LAMPADAS, FUSIVEIS } from './data.js';
import { situacao, ordenar, consumo } from './plan.js';
import { carro, carro3d, CARRO_3D } from './car.js';
import { Elm327Ble, HudiyObd, Simulador, COMANDOS } from './obd.js';
import { Hudiy, MSG, TECLA, mediaStatus, mediaMeta, navStatus, navDetalhes, navDistancia, imagemUrl } from './hudiy.js';

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
    ${nav.ativo ? `<section class="card navcard span-2" style="grid-column:1/-1" aria-live="polite">
      ${nav.iconeUrl ? `<img src="${nav.iconeUrl}" alt="">` : ''}
      <div class="stack" style="flex:1"><div class="num dist">${esc(nav.distancia || '')}</div><div class="desc">${esc(nav.descricao || 'Navegando')}</div><small class="muted">Navegação via central (Android Auto)</small></div>
    </section>` : ''}
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

function manutencao(q) {
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
    <section class="card">
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
function abrir(html) { dlg.innerHTML = html; dlg.showModal(); }
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
  return { data: fd.get('data'), km: +fd.get('km'), litros: +fd.get('litros'), valor: +fd.get('valor'), custo: +fd.get('custo') || 0, obs: (fd.get('obs') || '').trim(), cheio: fd.get('cheio') === 'on', itens: fd.getAll('itens') };
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

// --- Central Hudiy: player no rodapé e manobra do Android Auto (Waze, Maps) no Início ---
const central = new Hudiy();
const midia = { titulo: '', artista: '', posicao: '', duracao: '', tocando: false, capaUrl: null };
const nav = { ativo: false, descricao: '', distancia: '', iconeUrl: null };
const trocarUrl = (obj, chave, bytes) => { if (obj[chave]) URL.revokeObjectURL(obj[chave]); obj[chave] = imagemUrl(bytes); };
central
  .on(MSG.MEDIA_STATUS, (p) => { Object.assign(midia, mediaStatus(p)); renderPlayer(); })
  .on(MSG.MEDIA_META, (p) => { const m = mediaMeta(p); trocarUrl(midia, 'capaUrl', m.capa); Object.assign(midia, m, { capa: undefined }); renderPlayer(); })
  .on(MSG.NAV_STATUS, (p) => { const antes = nav.ativo; nav.ativo = navStatus(p).ativo; if (antes !== nav.ativo) render(); })
  .on(MSG.NAV_DETALHES, (p) => { const d = navDetalhes(p); trocarUrl(nav, 'iconeUrl', d.icone); nav.descricao = d.descricao; renderNav(); })
  .on(MSG.NAV_DIST, (p) => { nav.distancia = navDistancia(p); renderNav(); })
  .on('fechou', () => { midia.titulo = ''; nav.ativo = false; renderPlayer(); render(); });
function conectarCentral() { return central.conectar().then(renderPlayer).catch((e) => { logObd(e.message); return null; }); }
function renderNav() {
  const el = main.querySelector('.navcard');
  if (!el) { if (nav.ativo) render(); return; }
  el.querySelector('.dist').textContent = nav.distancia || '';
  el.querySelector('.desc').textContent = nav.descricao || 'Navegando';
  const img = el.querySelector('img'); if (img && nav.iconeUrl) img.src = nav.iconeUrl;
}
function renderPlayer() {
  const el = document.getElementById('player');
  if (central.conectado && midia.titulo) {
    el.innerHTML = `
      ${midia.capaUrl ? `<img class="capa" src="${midia.capaUrl}" alt="">` : '<div class="capa"></div>'}
      <div class="info"><div class="t">${esc(midia.titulo)}</div><div class="d">${esc(midia.artista)}${midia.posicao ? ` · ${esc(midia.posicao)} / ${esc(midia.duracao)}` : ''}</div></div>
      <div class="ctl">
        <button data-tecla="${TECLA.ANTERIOR}" aria-label="Faixa anterior">⏮</button>
        <button class="play" data-tecla="${TECLA.TOGGLE_PLAY}" aria-label="${midia.tocando ? 'Pausar' : 'Tocar'}">${midia.tocando ? '⏸' : '▶'}</button>
        <button data-tecla="${TECLA.PROXIMA}" aria-label="Próxima faixa">⏭</button>
      </div>`;
  } else if (window.hudiy) el.innerHTML = '';
  else el.innerHTML = `
      <a class="atalho" href="https://music.youtube.com/" target="_blank" rel="noopener"><i></i>YouTube Music</a>
      <a class="atalho waze" href="https://waze.com/ul?navigate=yes" target="_blank" rel="noopener"><i></i>Waze</a>
      <small class="muted" style="margin-left:auto">Player e manobras aparecem na central Hudiy</small>`;
}
document.getElementById('player').addEventListener('click', (e) => { const b = e.target.closest('[data-tecla]'); if (b) central.tecla(+b.dataset.tecla); });
renderPlayer();
if (window.hudiy) conectarCentral();

// --- Roteamento ---
const VIEWS = { inicio, manutencao, combustivel, ficha, obd: obdView };
function render() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const view = VIEWS[path] ? path : 'inicio';
  main.innerHTML = VIEWS[view](new URLSearchParams(qs));
  document.querySelectorAll('.nav a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.view === view));
  if (view === 'inicio') montarCarro3d();
}
window.addEventListener('hashchange', () => { render(); main.focus({ preventScroll: true }); window.scrollTo(0, 0); });
render();
// Dentro da central Hudiy: tecla/gesto de voltar do web view.
if (window.hudiy) window.hudiy.onGoBack = () => history.back();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
