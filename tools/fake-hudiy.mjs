// Servidor falso da API Hudiy para testar o app de ponta a ponta (hello, assinaturas, mídia, navegação, OBD, teclas).
// Uso: node tools/fake-hudiy.mjs assets/icon-512.png   (precisa de `npm i -D ws`)
import { WebSocketServer } from 'ws';
import { readFileSync } from 'node:fs';
const str = (tag, s) => { const b = [...new TextEncoder().encode(s)]; return [(tag << 3) | 2, ...varint(b.length), ...b]; };
const bytes = (tag, b) => [(tag << 3) | 2, ...varint(b.length), ...b];
const int = (tag, n) => [(tag << 3), ...varint(n)];
function varint(n) { const o = []; while (n > 127) { o.push((n & 127) | 128); n >>>= 7; } o.push(n); return o; }
const quadro = (id, p) => { const b = Buffer.alloc(12 + p.length); b.writeUInt32LE(p.length, 0); b.writeUInt32LE(id, 4); Buffer.from(p).copy(b, 12); return b; };
const png = [...readFileSync(process.argv[2])]; // ícone de manobra
const wss = new WebSocketServer({ port: 44406 });
wss.on('connection', (ws) => {
  ws.on('message', (m) => {
    const id = m.readUInt32LE(4), len = m.readUInt32LE(0), p = m.subarray(12, 12 + len);
    console.log('recebido id', id, 'bytes', len);
    if (id === 1) {
      ws.send(quadro(2, [...bytes(1, [...int(1, 1), ...int(2, 28)]), ...bytes(2, [...int(1, 1), ...int(2, 0)]), ...int(3, 1)]));
      setTimeout(() => {
        ws.send(quadro(7, [...str(1, 'Random Access Memories'), ...str(2, 'Daft Punk'), ...str(3, 'Instant Crush (feat. Julian Casablancas)'), ...str(4, '05:37'), ...bytes(5, png)]));
        ws.send(quadro(6, [...str(1, '01:23'), ...int(2, 1), ...int(3, 1)]));
        ws.send(quadro(8, [...int(1, 1), ...int(2, 1)]));
        ws.send(quadro(9, [...str(1, 'Vire à direita na Av. Paulista'), ...bytes(2, png), ...int(3, 2), ...int(4, 4)]));
        ws.send(quadro(10, [...str(1, '300 m')]));
      }, 300);
    } else if (id === 24) {
      const c = {}; let i = 0; const lv = () => { let v = 0, s = 0, b; do { b = p[i++]; v += (b & 127) * 2 ** s; s += 7; } while (b & 128); return v; };
      while (i < p.length) { const k = lv(), t = k >> 3, w = k & 7; if (w === 2) { const n = lv(); (c[t] ??= []).push(p.subarray(i, i + n).toString()); i += n; } else (c[t] ??= []).push(lv()); }
      const resp = { '010D': '410D74', '0105': '41055A', '010C': '410C0BB8', '0104': '41043F', '012F': '412F80', '0142': '4142370C', '0101': '41010000E000', '010F': '410F40', '011F': '411F0100', '0146': '41461F', '03': '4300' };
      const d = resp[c[1][0]];
      ws.send(quadro(25, [...int(1, d ? 1 : 0), ...(d ? str(2, d) : []), ...int(3, c[2][0])]));
    } else if (id === 36) console.log('tecla', [...p]);
  });
});
console.log('fake hudiy em ws://localhost:44406');
