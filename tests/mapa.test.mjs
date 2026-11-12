import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoDeHtml, linksNavegar, decodificarPolyline, calcularRotas } from '../src/mapa.js';

test('instruções do Google viram texto puro', () => {
  assert.equal(textoDeHtml('Vire à <b>direita</b> na <b>Av. Paulista</b><div style="font-size:0.9em">Pedágio</div>'), 'Vire à direita na Av. Paulista Pedágio');
  assert.equal(textoDeHtml(null), '');
});

test('links de navegação com e sem coordenadas', () => {
  const l = linksNavegar('Av. Paulista, 1000', -23.5614, -46.6559);
  assert.equal(l.geo, 'geo:-23.5614,-46.6559?q=-23.5614,-46.6559(Av.%20Paulista%2C%201000)');
  assert.equal(l.google, 'google.navigation:q=-23.5614,-46.6559&mode=d');
  const s = linksNavegar(' Aeroporto ');
  assert.equal(s.geo, 'geo:0,0?q=Aeroporto');
  assert.equal(s.google, 'google.navigation:q=Aeroporto&mode=d');
});

test('polyline do Google (exemplo da documentação)', () => {
  const pts = decodificarPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.deepEqual(pts, [{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }]);
  assert.deepEqual(decodificarPolyline(''), []);
});

test('Routes API: requisição e resposta', async () => {
  let req;
  const fetchFalso = async (url, opts) => { req = { url, opts }; return { ok: true, status: 200, json: async () => ({ routes: [{
    description: 'Av. 23 de Maio', duration: '1860s', staticDuration: '1080s', distanceMeters: 8400, polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC' },
    localizedValues: { distance: { text: '8,4 km' }, duration: { text: '31 min' }, staticDuration: { text: '18 min' } },
    legs: [{ endLocation: { latLng: { latitude: -23.6, longitude: -46.7 } }, steps: [{ navigationInstruction: { instructions: 'Vire à direita na Av. Paulista' }, localizedValues: { distance: { text: '1,2 km' } } }, { localizedValues: { distance: { text: '0 m' } } }] }],
  }] }) }; };
  const rotas = await calcularRotas('CHAVE', { lat: -23.56, lon: -46.65 }, 'Aeroporto', fetchFalso);
  assert.equal(req.url, 'https://routes.googleapis.com/directions/v2:computeRoutes');
  assert.equal(req.opts.headers['X-Goog-Api-Key'], 'CHAVE');
  const corpo = JSON.parse(req.opts.body);
  assert.equal(corpo.routingPreference, 'TRAFFIC_AWARE'); assert.equal(corpo.destination.address, 'Aeroporto'); assert.equal(corpo.origin.location.latLng.longitude, -46.65);
  assert.equal(rotas.length, 1);
  assert.deepEqual({ ...rotas[0], pontos: rotas[0].pontos.length }, { i: 0, via: 'Av. 23 de Maio', distancia: '8,4 km', tempo: '31 min', tempoSemTransito: '18 min', fim: { lat: -23.6, lng: -46.7 }, pontos: 2, passos: [{ texto: 'Vire à direita na Av. Paulista', distancia: '1,2 km' }] });
  const erro = async () => ({ ok: false, status: 403, json: async () => ({ error: { message: 'API key not valid' } }) });
  await assert.rejects(calcularRotas('X', { lat: 0, lon: 0 }, 'Y', erro), /API key not valid/);
});
