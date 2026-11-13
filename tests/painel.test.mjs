import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisarHash, manobraDeNotificacao, mmss, distanciaM, passoOdometro } from '../src/painel.js';

test('rotas das abas e redirecionamento das antigas', () => {
  assert.deepEqual(analisarHash(''), { view: 'inicio', sub: '', qs: '', redirecionar: null });
  assert.deepEqual(analisarHash('#/navegacao'), { view: 'navegacao', sub: '', qs: '', redirecionar: null });
  assert.deepEqual(analisarHash('#/manutencao/obd'), { view: 'manutencao', sub: 'obd', qs: '', redirecionar: null });
  assert.deepEqual(analisarHash('#/manutencao?area=motor'), { view: 'manutencao', sub: '', qs: 'area=motor', redirecionar: null });
  assert.equal(analisarHash('#/manutencao/xyz').sub, '');
  assert.equal(analisarHash('#/obd').redirecionar, '#/manutencao/obd');
  assert.equal(analisarHash('#/ficha').redirecionar, '#/manutencao/ficha');
  assert.equal(analisarHash('#/desconhecida').view, 'inicio');
});

test('manobra: Google Maps põe a instrução no título', () => {
  const m = manobraDeNotificacao({ app: 'Google Maps', titulo: 'Siga em direção à R. Dr. Emílio', texto: '', sub: 'Chegada: 07:47', curta: '0 m' });
  assert.deepEqual(m, { distancia: '0 m', descricao: 'Siga em direção à R. Dr. Emílio', fonte: 'Google Maps · Chegada: 07:47' });
  assert.equal(manobraDeNotificacao({ app: 'Google Maps', titulo: 'Vire à direita', texto: 'Navegando', sub: '' }).fonte, 'Google Maps · Navegando');
});

test('manobra: distância no título, rua no texto', () => {
  assert.deepEqual(manobraDeNotificacao({ app: 'Vela', titulo: '300 m', texto: 'Vire à direita na Av. Paulista', sub: '18 min' }),
    { distancia: '300 m', descricao: 'Vire à direita na Av. Paulista', fonte: 'Vela · 18 min' });
  assert.deepEqual(manobraDeNotificacao({ app: 'Waze', titulo: '1,2 km · Mantenha-se à esquerda', texto: '', sub: '' }),
    { distancia: '1,2 km', descricao: 'Mantenha-se à esquerda', fonte: 'Waze' });
  // "5 minutos" não é distância
  assert.equal(manobraDeNotificacao({ app: 'X', titulo: '5 minutos até o destino', texto: '' }).distancia, '');
});

test('formatação de tempo', () => {
  assert.equal(mmss(83000), '1:23');
});

test('odômetro pelo GPS: soma trechos válidos e descarta ruído, leitura ruim e salto', () => {
  // 0,001° de latitude = 111,2 m
  const p = (lat, t, precisao = 10) => ({ lat, lon: -46.6, t, precisao });
  assert.ok(Math.abs(distanciaM(p(-23.5, 0), p(-23.501, 0)) - 111.2) < 0.5);
  const a = p(-23.5, 0);
  assert.deepEqual(passoOdometro(null, a), { ref: a, metros: 0 });                     // primeira leitura só marca o ponto
  assert.deepEqual(passoOdometro(null, p(-23.5, 0, 80)), { ref: null, metros: 0 });    // imprecisa: nem vira referência
  assert.deepEqual(passoOdometro(a, p(-23.5, 0, undefined)), { ref: a, metros: 0 });   // sem precisão informada
  assert.deepEqual(passoOdometro(a, p(-23.5001, 5000)), { ref: a, metros: 0 });        // 11 m: ruído parado
  const b = p(-23.501, 5000), r = passoOdometro(a, b);                                 // 111 m em 5 s (80 km/h)
  assert.equal(r.ref, b); assert.ok(Math.abs(r.metros - 111.2) < 0.5);
  const longe = p(-23.6, 6000);                                                        // 11 km em 1 s: salto
  assert.deepEqual(passoOdometro(b, longe), { ref: longe, metros: 0 });
});
