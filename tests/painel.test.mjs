import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisarHash, manobraDeNotificacao, mmss } from '../src/painel.js';

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
