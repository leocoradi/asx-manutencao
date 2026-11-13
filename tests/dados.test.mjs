import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validar, vazio, hojeIso } from '../src/dados.js';

test('backup que não é do app é recusado', () => {
  for (const d of [null, 5, 'x', {}, { log: [] }, { log: {}, fuel: [] }]) assert.throws(() => validar(d), /backup/);
  assert.throws(() => validar({ log: Array(5001).fill({}), fuel: [] }), /demais/);
  assert.deepEqual(validar(vazio()), { ...vazio(), odo: { km: 0, data: hojeIso(), gps: 0, m: 0 } });
});

test('campos de um backup adulterado são neutralizados', () => {
  const d = validar({
    odo: { km: 'abc', data: '9999-99-99', gps: -3, m: 1e9 },
    log: [null, 'x', { id: '"><img src=x onerror=alert(1)>', data: '2026-02-31', km: 1e12, custo: -5, obs: 'o'.repeat(900), itens: ['oleo', '<script>', 7] }],
    fuel: [{ id: 'abc-123_X', data: '2026-10-01', km: 100000, litros: Infinity, valor: '250.5', cheio: 'sim' }],
  });
  assert.deepEqual(d.odo, { km: 0, data: hojeIso(), gps: 0, m: 1000 });
  assert.equal(d.log.length, 1);                       // entradas que não são objeto saem
  const [e] = d.log;
  assert.match(e.id, /^[\w-]{1,64}$/);                  // id com HTML é trocado por um novo
  assert.equal(e.data, hojeIso());                     // data que não existe vira hoje
  assert.equal(e.km, 2_000_000); assert.equal(e.custo, 0); assert.equal(e.obs.length, 500);
  assert.deepEqual(e.itens, ['oleo']);                 // só itens do plano
  assert.deepEqual(d.fuel[0], { id: 'abc-123_X', data: '2026-10-01', km: 100000, litros: 0, valor: 250.5, cheio: true });
});
