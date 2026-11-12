import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoDeHtml, linksNavegar } from '../src/mapa.js';

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
