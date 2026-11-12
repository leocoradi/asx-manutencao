import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodificar, montarQuadros, decodificarResposta, decodificarDtcs, COMANDOS } from '../src/obd.js';

const cmd = (svc, pid) => COMANDOS.find((c) => c.cmd[svc] === pid);

// Casos extraídos de OBDb/Mitsubishi-ASX tests/test_cases.
test('PID padrão 0105 e 010C', () => {
  assert.equal(decodificarResposta(cmd('01', '05'), '7E803410584').ECT, 92);
  assert.equal(decodificarResposta(cmd('01', '0C'), '7E804410C1DE8').RPM, 1914);
});

test('odômetro little-endian (6A0 21AD)', () => {
  assert.equal(decodificarResposta(cmd('21', 'AD'), '5140561AD009A02').ASX_ODO, 170496);
  assert.equal(decodificarResposta(cmd('21', 'AD'), '5140561ADFF9902').ASX_ODO, 170495);
});

test('multi-frame ISO-TP (6A0 21BC)', () => {
  const r = decodificarResposta(cmd('21', 'BC'), '514100861BC4200FFFF\r514211BFF0000000000\r');
  assert.equal(r.ASX_MILEAGE_BEFORE_SERVICING, 6600);
  assert.equal(r.ASX_PERIOD_BEFORE_SERVICING_MONTHS, 27);
});

test('montarQuadros ignora ruído e separa por endereço', () => {
  const q = montarQuadros('SEARCHING...\r7E803410584\r7E903410530\rNO DATA\r');
  assert.deepEqual(q['7E8'], [0x41, 0x05, 0x84]);
  assert.deepEqual(q['7E9'], [0x41, 0x05, 0x30]);
});

test('nullmax e sinal com sign', () => {
  assert.equal(decodificar({ len: 8, max: 255, nullmax: 255 }, [0xff]), null);
  assert.equal(decodificar({ len: 8, max: 127, min: -128, sign: true }, [0xfe]), -2);
  assert.equal(decodificar({ len: 8, max: 100, mul: 100, div: 255 }, [0xff]), 100);
});

test('NRC ou resposta de outro serviço retorna null', () => {
  assert.equal(decodificarResposta(cmd('01', '05'), '7E8037F0112'), null);
  assert.equal(decodificarResposta(cmd('01', '05'), 'NO DATA'), null);
});

test('DTCs do serviço 03', () => {
  assert.deepEqual(decodificarDtcs([0x43, 0x02, 0x01, 0x33, 0xc1, 0x23]), ['P0133', 'U0123']);
  assert.deepEqual(decodificarDtcs([0x43, 0x00]), []);
  assert.deepEqual(decodificarDtcs(montarQuadros('7E8064302013300000')['7E8']), ['P0133']);
});
