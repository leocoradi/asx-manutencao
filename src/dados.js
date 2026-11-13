// Registros do usuário (asx.v1): formato vazio e validação de tudo o que vem de fora (localStorage e backup JSON).
// É a fronteira de confiança dos dados: o que sai daqui vai para a tela e para os cálculos.
import { PLANO } from './data.js';

export const hojeIso = () => new Date().toISOString().slice(0, 10);
export const vazio = () => ({ v: 1, odo: { km: 0, data: hojeIso() }, log: [], fuel: [] });

const MAX_REGISTROS = 5000;   // por lista; um backup maior que isso não é deste app
const MAX_KM = 2_000_000;

export function validar(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.log) || !Array.isArray(d.fuel)) throw new Error('Arquivo não é um backup do app.');
  if (d.log.length > MAX_REGISTROS || d.fuel.length > MAX_REGISTROS) throw new Error('Backup com registros demais.');
  const num = (n, max = 1e9) => (Number.isFinite(+n) && +n >= 0 ? Math.min(+n, max) : 0);
  // Data ISO que existe de verdade ("2026-02-31" e "9999-99-99" viram hoje).
  const existe = (s) => { const t = Date.parse(s); return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s; };
  const data = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && existe(s) ? s : hojeIso());
  // O id vai para atributos HTML: só letras, números, "-" e "_"; qualquer outra coisa ganha um id novo.
  const id = (s) => (typeof s === 'string' && /^[\w-]{1,64}$/.test(s) ? s : crypto.randomUUID());
  const lista = (l) => l.filter((e) => e && typeof e === 'object');
  return {
    v: 1,
    // gps: km somados pelo GPS desde a última leitura digitada; m: resto em metros
    odo: { km: num(d.odo?.km, MAX_KM), data: data(d.odo?.data), gps: num(d.odo?.gps, MAX_KM), m: num(d.odo?.m, 1000) },
    log: lista(d.log).map((e) => ({ id: id(e.id), data: data(e.data), km: num(e.km, MAX_KM), custo: num(e.custo), obs: String(e.obs ?? '').slice(0, 500),
      itens: (Array.isArray(e.itens) ? e.itens : []).filter((i) => PLANO.some((p) => p.id === i)) })),
    fuel: lista(d.fuel).map((f) => ({ id: id(f.id), data: data(f.data), km: num(f.km, MAX_KM), litros: num(f.litros, 1000), valor: num(f.valor), cheio: !!f.cheio })),
  };
}
