// Cálculo de vencimento de cada item do plano a partir do histórico.

const DIA = 86400000;

export function mesesEntre(a, b) {
  return (new Date(b) - new Date(a)) / (DIA * 30.44);
}

// Último registro do item no histórico (maior km).
export function ultimoRegistro(itemId, log) {
  return log.filter((e) => e.itens.includes(itemId)).sort((a, b) => b.km - a.km)[0] || null;
}

// Retorna { status, pct, kmRestante, diasRestante, ultimo, estimado }.
// status: 'sem' (sem registro e sem odômetro), 'ok', 'breve' (>= 80%), 'vencido'.
// Sem registro mas com odômetro, estima pelo múltiplo do intervalo (plano por km fixo:
// 5.000, 10.000, 20.000…): próxima aos próximos N km, só por quilometragem.
export function situacao(item, log, odoKm, hoje = new Date()) {
  const ultimo = ultimoRegistro(item.id, log);
  if (!ultimo) {
    if (!(odoKm > 0)) return { status: 'sem', pct: 0, ultimo: null };
    const proximo = (Math.floor(odoKm / item.km) + 1) * item.km;
    const pct = 1 - (proximo - odoKm) / item.km;
    return { status: pct >= 0.8 ? 'breve' : 'ok', pct, kmRestante: proximo - odoKm, proximo, ultimo: null, estimado: true };
  }
  const pctKm = (odoKm - ultimo.km) / item.km;
  const pctTempo = mesesEntre(ultimo.data, hoje) / item.meses;
  const pct = Math.max(pctKm, pctTempo, 0);
  const kmRestante = ultimo.km + item.km - odoKm;
  const vence = new Date(ultimo.data);
  vence.setMonth(vence.getMonth() + item.meses);
  const diasRestante = Math.floor((vence - hoje) / DIA);
  const status = pct >= 1 ? 'vencido' : pct >= 0.8 ? 'breve' : 'ok';
  return { status, pct: Math.min(pct, 1), kmRestante, diasRestante, ultimo };
}

export const PESO = { vencido: 0, breve: 1, sem: 2, ok: 3 };

export function ordenar(plano, log, odoKm, hoje) {
  return plano
    .map((item) => ({ item, ...situacao(item, log, odoKm, hoje) }))
    .sort((a, b) => PESO[a.status] - PESO[b.status] || b.pct - a.pct);
}

// Média de consumo entre abastecimentos com tanque cheio consecutivos.
export function consumo(fuel) {
  const cheios = fuel.filter((f) => f.cheio).sort((a, b) => a.km - b.km);
  const trechos = [];
  for (let i = 1; i < cheios.length; i++) {
    const km = cheios[i].km - cheios[i - 1].km;
    // Litros gastos no trecho = tudo abastecido depois do cheio anterior até este cheio.
    const litros = fuel
      .filter((f) => f.km > cheios[i - 1].km && f.km <= cheios[i].km)
      .reduce((s, f) => s + f.litros, 0);
    if (km > 0 && litros > 0) trechos.push({ km, litros, kmL: km / litros, data: cheios[i].data });
  }
  const km = trechos.reduce((s, t) => s + t.km, 0);
  const litros = trechos.reduce((s, t) => s + t.litros, 0);
  return { trechos, media: litros ? km / litros : null, ultimo: trechos.at(-1)?.kmL ?? null };
}
