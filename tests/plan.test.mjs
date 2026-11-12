import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situacao, ordenar, consumo } from '../src/plan.js';
import { PLANO } from '../src/data.js';

const oleo = PLANO.find((p) => p.id === 'oleo');
const hoje = new Date('2026-11-12');

test('sem registro', () => {
  assert.equal(situacao(oleo, [], 100000, hoje).status, 'sem');
});

test('ok, breve e vencido por km', () => {
  const log = [{ data: '2026-10-01', km: 100000, itens: ['oleo'] }];
  assert.equal(situacao(oleo, log, 101000, hoje).status, 'ok');
  assert.equal(situacao(oleo, log, 104100, hoje).status, 'breve');
  assert.equal(situacao(oleo, log, 105000, hoje).status, 'vencido');
  assert.equal(situacao(oleo, log, 104000, hoje).kmRestante, 1000);
});

test('vencido por tempo mesmo com pouco km', () => {
  const log = [{ data: '2026-04-01', km: 100000, itens: ['oleo'] }];
  const s = situacao(oleo, log, 100500, hoje);
  assert.equal(s.status, 'vencido');
  assert.ok(s.diasRestante < 0);
});

test('ordenar coloca vencidos antes', () => {
  const log = [
    { data: '2026-10-01', km: 90000, itens: ['oleo'] },
    { data: '2026-10-01', km: 99000, itens: ['filtro-ar'] },
  ];
  const [primeiro] = ordenar(PLANO, log, 100000, hoje);
  assert.equal(primeiro.item.id, 'oleo');
});

test('consumo entre tanques cheios', () => {
  const fuel = [
    { data: '2026-10-01', km: 100000, litros: 50, cheio: true },
    { data: '2026-10-10', km: 100300, litros: 20, cheio: false },
    { data: '2026-10-20', km: 100500, litros: 30, cheio: true },
  ];
  const c = consumo(fuel);
  assert.equal(c.trechos.length, 1);
  assert.equal(c.media, 10);
  assert.equal(consumo([]).media, null);
});
