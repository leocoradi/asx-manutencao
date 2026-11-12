import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protoCampos, quadro, lerQuadro, msgHello, msgSubs, msgObdReq, msgTecla, obdResp, mediaMeta, mediaStatus, navDetalhes, navDistancia, navStatus, TECLA } from '../src/hudiy.js';
import { decodificarResposta, COMANDOS } from '../src/obd.js';

const str = (tag, s) => { const b = [...new TextEncoder().encode(s)]; return [(tag << 3) | 2, b.length, ...b]; };

test('quadro e protobuf de ida e volta', () => {
  const q = quadro(24, msgObdReq(['010D', '0105'], 300));
  const { id, payload } = lerQuadro(q.buffer);
  assert.equal(id, 24);
  const c = protoCampos(payload);
  assert.deepEqual(c[1].map((b) => new TextDecoder().decode(b)), ['010D', '0105']);
  assert.equal(c[2][0], 300);
  // HelloRequest { name, api_version { major: 1, minor: 0 } } como o protobuf.js codificaria
  assert.deepEqual([...msgHello('A')], [0x0a, 1, 0x41, 0x12, 4, 0x08, 1, 0x10, 0]);
  assert.deepEqual([...msgSubs()], [0x08, 2, 0x08, 3, 0x08, 4]);
  assert.deepEqual([...msgTecla(TECLA.PROXIMA, 1)], [0x08, 18, 0x10, 1]);
});

test('resposta OBD "410D74" vira 116 km/h', () => {
  const r = obdResp(new Uint8Array([0x08, 1, ...str(2, '410D74'), 0x18, 7]));
  assert.deepEqual(r, { ok: true, dados: ['410D74'], codigo: 7 });
  const cmd = COMANDOS.find((c) => c.cmd['01'] === '0D');
  assert.equal(decodificarResposta(cmd, '7E803' + r.dados[0]).VSS, 116);
});

test('mídia e navegação', () => {
  const meta = mediaMeta(new Uint8Array([...str(1, 'Album'), ...str(2, 'Artista'), ...str(3, 'Faixa'), ...str(4, '04:56'), 0x2a, 2, 0x89, 0x50]));
  assert.equal(meta.titulo, 'Faixa'); assert.equal(meta.artista, 'Artista'); assert.deepEqual([...meta.capa], [0x89, 0x50]);
  assert.deepEqual(mediaStatus(new Uint8Array([...str(1, '01:23'), 0x10, 1, 0x18, 1])), { posicao: '01:23', tocando: true, fonte: 1 });
  const nav = navDetalhes(new Uint8Array([...str(1, 'Vire à direita'), 0x12, 0, 0x18, 2, 0x20, 4]));
  assert.equal(nav.descricao, 'Vire à direita'); assert.equal(nav.lado, 2); assert.equal(nav.tipo, 4); assert.equal(nav.icone.length, 0);
  assert.equal(navDistancia(new Uint8Array(str(1, '300 m'))), '300 m');
  assert.deepEqual(navStatus(new Uint8Array([0x08, 1, 0x10, 1])), { fonte: 1, ativo: true });
});
