// Lógica pura do painel: rotas das abas e leitura da manobra a partir da notificação do app de navegação.

const VIEWS = ['inicio', 'navegacao', 'manutencao', 'combustivel'];
const SUBS = { manutencao: ['ficha', 'obd'] };
const ANTIGAS = { ficha: 'manutencao/ficha', obd: 'manutencao/obd' };

// "#/manutencao/obd?area=x" -> { view, sub, qs, redirecionar }. Rotas antigas (#/ficha, #/obd) apontam para a nova.
export function analisarHash(hash) {
  const [caminho, qs = ''] = String(hash || '').replace(/^#\/?/, '').split('?');
  const [a = '', b = ''] = caminho.split('/');
  if (ANTIGAS[a]) return { view: 'manutencao', sub: a, qs, redirecionar: `#/${ANTIGAS[a]}` };
  const view = VIEWS.includes(a) ? a : 'inicio';
  const sub = SUBS[view]?.includes(b) ? b : '';
  return { view, sub, qs, redirecionar: null };
}

const DIST = /^\s*(\d+(?:[.,]\d+)?\s?(?:km|m|mi|ft))(?![\p{L}\d])\s*[·\-–—:]?\s*(.*)$/iu;

// Notificação { app, titulo, texto, sub, curta } -> { distancia, descricao, fonte }.
// Cada app usa os campos de um jeito: o Google Maps põe a instrução no título e a distância no texto curto
// do chip (Android 16); outros põem "300 m" no título e a rua no texto.
export function manobraDeNotificacao(n) {
  const t = DIST.exec(n.titulo || ''), x = DIST.exec(n.texto || ''), c = DIST.exec(n.curta || '');
  const distancia = (c && c[1]) || (t && t[1]) || (x && x[1]) || '';
  const descricao = t ? (t[2] || (x ? x[2] : n.texto) || '') : (n.titulo || (x ? x[2] : n.texto) || '');
  const extra = !t && n.texto && !x ? n.texto : '';
  return { distancia, descricao, fonte: [n.app, extra, n.sub].filter(Boolean).join(' · ') };
}

// Distância em metros entre dois pontos { lat, lon } (haversine).
export function distanciaM(a, b) {
  const rad = (g) => (g * Math.PI) / 180, R = 6371000;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Odômetro pelo GPS: ref é o último ponto aceito, atual é { lat, lon, t (ms), precisao (m) }.
// Devolve { ref, metros }: o ponto de referência para a próxima leitura e quanto somar agora.
export function passoOdometro(ref, atual) {
  if (!(atual.precisao <= 40)) return { ref, metros: 0 };            // leitura imprecisa: ignora
  if (!ref) return { ref: atual, metros: 0 };
  const d = distanciaM(ref, atual);
  if (d < 20) return { ref, metros: 0 };                              // ruído do GPS com o carro parado
  if (d / Math.max(1, (atual.t - ref.t) / 1000) > 70) return { ref: atual, metros: 0 }; // salto acima de 250 km/h
  return { ref: atual, metros: d };
}

export const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
