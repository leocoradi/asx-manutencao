// Cliente da API da central Hudiy (https://github.com/wiboma/hudiy).
// WebSocket (porta padrão 44406), quadros de 3×uint32 LE (tamanho, id, reservado) + protobuf.
// Só as mensagens usadas aqui são codificadas/decodificadas à mão, sem protobuf.js nem o Api.proto.
export const MSG = {
  HELLO: 1, HELLO_RESP: 2, SUBS: 3, MEDIA_STATUS: 6, MEDIA_META: 7, NAV_STATUS: 8, NAV_DETALHES: 9, NAV_DIST: 10,
  OBD_STATUS: 23, OBD_REQ: 24, OBD_RESP: 25, TECLA: 36, PING: 47, PONG: 48,
};
export const TECLA = { TOGGLE_PLAY: 14, ANTERIOR: 17, PROXIMA: 18 };
const SUBS = { MEDIA: 2, NAVIGATION: 3, OBD: 4 };

// --- protobuf mínimo ---
function varint(n) { const out = []; while (n > 127) { out.push((n & 127) | 128); n >>>= 7; } out.push(n); return out; }
const campoBytes = (tag, bytes) => [(tag << 3) | 2, ...varint(bytes.length), ...bytes];
const campoStr = (tag, s) => campoBytes(tag, [...new TextEncoder().encode(s)]);
const campoInt = (tag, n) => [(tag << 3) | 0, ...varint(n)];
const texto = (b) => (b ? new TextDecoder().decode(b) : '');

// Decodifica campos simples (varint e bytes) em { tag: [valores] }.
export function protoCampos(bytes) {
  const out = {}; let i = 0;
  const lerVarint = () => { let v = 0, s = 0, b; do { b = bytes[i++]; v += (b & 127) * 2 ** s; s += 7; } while (b & 128); return v; };
  while (i < bytes.length) {
    const chave = lerVarint(), tag = chave >> 3, tipo = chave & 7;
    let v;
    if (tipo === 0) v = lerVarint();
    else if (tipo === 2) { const n = lerVarint(); v = bytes.slice(i, i + n); i += n; }
    else if (tipo === 1) { i += 8; continue; } else if (tipo === 5) { i += 4; continue; } else break;
    (out[tag] ??= []).push(v);
  }
  return out;
}

export function quadro(id, payload) {
  const b = new Uint8Array(12 + payload.length);
  new DataView(b.buffer).setUint32(0, payload.length, true);
  new DataView(b.buffer).setUint32(4, id, true);
  b.set(payload, 12);
  return b;
}
export function lerQuadro(buf) {
  const v = new DataView(buf);
  return { id: v.getUint32(4, true), payload: new Uint8Array(buf.slice(12, 12 + v.getUint32(0, true))) };
}

export const msgHello = (nome) => new Uint8Array([...campoStr(1, nome), ...campoBytes(2, [...campoInt(1, 1), ...campoInt(2, 0)])]);
export const msgSubs = () => new Uint8Array(Object.values(SUBS).flatMap((s) => campoInt(1, s)));
export const msgObdReq = (cmds, codigo) => new Uint8Array([...cmds.flatMap((c) => campoStr(1, c)), ...campoInt(2, codigo)]);
export const msgTecla = (tipo, evento) => new Uint8Array([...campoInt(1, tipo), ...campoInt(2, evento)]);

export function obdResp(payload) {
  const c = protoCampos(payload);
  return { ok: c[1]?.[0] === 1, dados: (c[2] ?? []).map(texto), codigo: c[3]?.[0] };
}
export function mediaStatus(payload) {
  const c = protoCampos(payload);
  return { posicao: texto(c[1]?.[0]), tocando: c[2]?.[0] === 1, fonte: c[3]?.[0] ?? 0 };
}
export function mediaMeta(payload) {
  const c = protoCampos(payload);
  return { album: texto(c[1]?.[0]), artista: texto(c[2]?.[0]), titulo: texto(c[3]?.[0]), duracao: texto(c[4]?.[0]), capa: c[5]?.[0] ?? null };
}
export function navStatus(payload) {
  const c = protoCampos(payload);
  return { fonte: c[1]?.[0] ?? 0, ativo: c[2]?.[0] === 1 };
}
export function navDetalhes(payload) {
  const c = protoCampos(payload);
  return { descricao: texto(c[1]?.[0]), icone: c[2]?.[0] ?? null, lado: c[3]?.[0], tipo: c[4]?.[0] };
}
export const navDistancia = (payload) => texto(protoCampos(payload)[1]?.[0]);

// Bytes de imagem -> URL de objeto; o formato vem da fonte (Android Auto manda PNG).
export function imagemUrl(bytes) {
  if (!bytes?.length) return null;
  const tipo = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0xff ? 'image/jpeg' : bytes[0] === 0x3c ? 'image/svg+xml' : 'application/octet-stream';
  return URL.createObjectURL(new Blob([bytes], { type: tipo }));
}

export class Hudiy {
  #ws; #pendentes = new Map(); #codigo = 0; #ouvintes = {};
  nome = 'Hudiy';
  constructor(url = 'ws://localhost:44406') { this.url = url; }
  get conectado() { return this.#ws?.readyState === 1; }
  on(id, fn) { (this.#ouvintes[id] ??= []).push(fn); return this; }
  #emitir(id, payload) { for (const f of this.#ouvintes[id] ?? []) f(payload); }

  conectar() {
    if (this.conectado) return Promise.resolve();
    return new Promise((res, rej) => {
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { return rej(new Error('Hudiy não acessível: ' + e.message)); }
      ws.binaryType = 'arraybuffer';
      const t = setTimeout(() => { ws.close(); rej(new Error('Hudiy não respondeu ao hello.')); }, 4000);
      ws.onerror = () => rej(new Error('Sem conexão com a API do Hudiy em ' + this.url));
      ws.onclose = () => {
        for (const p of this.#pendentes.values()) p.rej(new Error('Hudiy desconectou'));
        this.#pendentes.clear(); this.#ws = null; this.#emitir('fechou');
      };
      ws.onopen = () => ws.send(quadro(MSG.HELLO, msgHello('ASX Manutenção')));
      ws.onmessage = (e) => {
        const { id, payload } = lerQuadro(e.data);
        if (id === MSG.PING) ws.send(quadro(MSG.PONG, new Uint8Array(0)));
        else if (id === MSG.HELLO_RESP) {
          clearTimeout(t);
          if (protoCampos(payload)[3]?.[0] !== 1) return rej(new Error('Hudiy recusou a versão da API.'));
          this.#ws = ws; ws.send(quadro(MSG.SUBS, msgSubs())); res(); this.#emitir('abriu');
        } else if (id === MSG.OBD_RESP) {
          const r = obdResp(payload);
          const p = this.#pendentes.get(r.codigo); this.#pendentes.delete(r.codigo); p?.res(r);
        } else this.#emitir(id, payload);
      };
    });
  }

  enviar(id, payload) { if (this.conectado) this.#ws.send(quadro(id, payload)); }
  tecla(tipo) { this.enviar(MSG.TECLA, msgTecla(tipo, 1)); this.enviar(MSG.TECLA, msgTecla(tipo, 2)); }

  obd(cmds) {
    return new Promise((res, rej) => {
      if (!this.conectado) return rej(new Error('Hudiy desconectado'));
      const codigo = ++this.#codigo;
      const t = setTimeout(() => { this.#pendentes.delete(codigo); rej(new Error('Hudiy: sem resposta')); }, 5000);
      this.#pendentes.set(codigo, { res: (r) => { clearTimeout(t); res(r); }, rej });
      this.#ws.send(quadro(MSG.OBD_REQ, msgObdReq(cmds, codigo)));
    });
  }

  desconectar() { this.#ws?.close(); }
}
