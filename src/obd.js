// OBD-II: decodificador no formato OBDb (signalset v3), parser ISO-TP de respostas ELM327,
// transporte Web Bluetooth (ELM327 BLE) e um simulador para uso sem adaptador.
import { SIGNALSET } from './signalset.js';
import { MSG, protoCampos } from './hudiy.js';

// --- Decodificação (porte de OBDb/.schemas python/can/signals.py) ---

function extrairBits(bytes, bix, len, blsb) {
  if (bix + len > bytes.length * 8) throw new Error(`Resposta curta: precisa de ${bix + len} bits, tem ${bytes.length * 8}`);
  let data = bytes;
  if (blsb && len > 8) {
    const ini = bix >> 3, n = (len + 7) >> 3;
    data = bytes.slice();
    data.splice(ini, n, ...bytes.slice(ini, ini + n).reverse());
  }
  let v = 0;
  for (let i = bix; i < bix + len; i++) {
    if (data[i >> 3] & (1 << (7 - (i & 7)))) v |= 1 << (bix + len - i - 1);
  }
  return v >>> 0;
}

export function decodificar(fmt, bytes) {
  let raw = extrairBits(bytes, fmt.bix ?? 0, fmt.len, fmt.blsb);
  if (fmt.map) return fmt.map[String(raw)]?.value ?? null;
  if (fmt.sign && raw & (1 << (fmt.len - 1))) raw -= 1 << fmt.len;
  let v = (raw * (fmt.mul ?? 1)) / (fmt.div ?? 1) + (fmt.add ?? 0);
  const min = fmt.min ?? 0;
  if (fmt.max > min) v = Math.max(min, Math.min(v, fmt.max));
  if (fmt.nullmin != null && v <= fmt.nullmin + Number.EPSILON) return null;
  if (fmt.nullmax != null && v >= fmt.nullmax - Number.EPSILON) return null;
  return v;
}

// Texto do ELM327 (ATH1, ATS0) -> { [rax]: bytes } com quadros ISO-TP remontados.
export function montarQuadros(texto) {
  const res = {};
  for (const linha of texto.split(/[\r\n]+/)) {
    const l = linha.trim().toUpperCase().replace(/\s/g, '');
    if (!/^[0-9A-F]{5,}$/.test(l)) continue;
    const rax = l.slice(0, 3);
    const hex = l.slice(3).match(/../g).map((h) => parseInt(h, 16));
    const pci = hex[0] >> 4;
    const r = (res[rax] ??= { bytes: [], len: 0 });
    if (pci === 0) { r.bytes = hex.slice(1, 1 + (hex[0] & 15)); r.len = r.bytes.length; }
    else if (pci === 1) { r.len = ((hex[0] & 15) << 8) | hex[1]; r.bytes = hex.slice(2); }
    else if (pci === 2) r.bytes.push(...hex.slice(1));
  }
  return Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.bytes.slice(0, r.len)]));
}

const SERVICOS = ['01', '21', '22'];

export function comandoTexto(cmd) {
  const s = SERVICOS.find((k) => k in cmd.cmd);
  return s + cmd.cmd[s];
}

// Resposta de texto do ELM para um comando -> { sinalId: valor }.
export function decodificarResposta(cmd, texto) {
  const quadros = montarQuadros(texto);
  const bytes = quadros[cmd.rax] ?? Object.values(quadros)[0];
  if (!bytes) return null;
  const s = SERVICOS.find((k) => k in cmd.cmd);
  const eco = 1 + cmd.cmd[s].length / 2; // byte de serviço + PID
  if (bytes[0] !== parseInt(s, 16) + 0x40) return null; // NRC ou resposta de outro comando
  const dados = bytes.slice(eco);
  const out = {};
  for (const sig of cmd.signals) {
    try { out[sig.id] = decodificar(sig.fmt, dados); } catch { out[sig.id] = null; }
  }
  return out;
}

// Serviço 03: "43 02 01 33 C1 23" -> ['P0133', 'U0123'].
export function decodificarDtcs(bytes) {
  if (bytes[0] !== 0x43) return [];
  const n = bytes[1];
  const letras = 'PCBU';
  const codigos = [];
  for (let i = 0; i < n; i++) {
    const a = bytes[2 + i * 2], b = bytes[3 + i * 2];
    if (a == null || b == null) break;
    if (a === 0 && b === 0) continue;
    codigos.push(letras[a >> 6] + ((a >> 4) & 3) + (a & 15).toString(16).toUpperCase() + b.toString(16).toUpperCase().padStart(2, '0'));
  }
  return codigos;
}

// --- Transporte ELM327 por Web Bluetooth (BLE) ---
// Perfis comuns: Vgate iCar Pro BLE / Kiwi: serviço FFF0 (FFF1 notify, FFF2 write);
// OBDLink CX e outros: 18F0 (2AF0 notify, 2AF1 write). ELM327 Bluetooth clássico (SPP) não é acessível pelo navegador.
const PERFIS = [
  { svc: 0xfff0, notify: 0xfff1, write: 0xfff2 },
  { svc: 0x18f0, notify: 0x2af0, write: 0x2af1 },
];

export class Elm327Ble {
  #gatt; #write; #buf = ''; #pendente = null; #header = '';
  nome = '';

  async conectar() {
    if (!navigator.bluetooth) throw new Error('Web Bluetooth indisponível neste navegador. Use Chrome no Android.');
    const dev = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true, optionalServices: PERFIS.map((p) => p.svc),
    });
    this.nome = dev.name || 'ELM327';
    const gatt = this.#gatt = await dev.gatt.connect();
    let erro;
    for (const p of PERFIS) {
      try {
        const svc = await gatt.getPrimaryService(p.svc);
        const n = await svc.getCharacteristic(p.notify);
        this.#write = await svc.getCharacteristic(p.write);
        n.addEventListener('characteristicvaluechanged', (e) => this.#receber(new TextDecoder().decode(e.target.value)));
        await n.startNotifications();
        erro = null; break;
      } catch (e) { erro = e; }
    }
    if (erro) throw new Error('Adaptador sem serviço BLE conhecido (FFF0/18F0).');
    for (const c of ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH1', 'ATSP0']) await this.enviar(c);
  }

  #receber(txt) {
    this.#buf += txt;
    if (this.#buf.includes('>')) {
      const r = this.#buf.replace('>', '');
      this.#buf = '';
      this.#pendente?.(r);
      this.#pendente = null;
    }
  }

  enviar(cmd, timeoutMs = 3000) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.#pendente = null; rej(new Error(`Sem resposta para ${cmd}`)); }, timeoutMs);
      this.#pendente = (r) => { clearTimeout(t); res(r); };
      this.#write.writeValue(new TextEncoder().encode(cmd + '\r')).catch((e) => { clearTimeout(t); rej(e); });
    });
  }

  async consultar(cmd) {
    const h = `${cmd.hdr}/${cmd.rax}/${cmd.fcm1 ? 1 : 0}`;
    if (h !== this.#header) {
      await this.enviar('ATSH' + cmd.hdr);
      if (cmd.rax) await this.enviar('ATCRA' + cmd.rax);
      if (cmd.fcm1) { await this.enviar('ATFCSH' + cmd.hdr); await this.enviar('ATFCSD300000'); await this.enviar('ATFCSM1'); }
      else await this.enviar('ATFCSM0');
      this.#header = h;
    }
    return decodificarResposta(cmd, await this.enviar(comandoTexto(cmd)));
  }

  async dtcs() {
    await this.enviar('ATSH7E0'); await this.enviar('ATCRA7E8'); this.#header = '';
    const q = montarQuadros(await this.enviar('03'));
    return decodificarDtcs(q['7E8'] ?? Object.values(q)[0] ?? []);
  }

  desconectar() { this.#gatt?.disconnect(); }
}

// --- Transporte pela central Hudiy: a central cuida do ELM327 e responde sem cabeçalho (ex.: "410D74"). ---
export class HudiyObd {
  nome = 'Hudiy';
  constructor(cliente) {
    this.cliente = cliente;
    cliente.on(MSG.OBD_STATUS, (p) => { if (protoCampos(p)[1]?.[0] === 2) this.onStatus?.('ELM327 desconectado do carro'); });
  }
  conectar() { return this.cliente.conectar(); }
  // Só os PIDs padrão da ECU 7E0: a API não troca o cabeçalho CAN (sem ATSH).
  async consultar(cmd) {
    if (cmd.hdr !== '7E0') return null;
    const r = await this.cliente.obd([comandoTexto(cmd)]);
    if (!r.ok || !r.dados[0]) return null;
    return decodificarResposta(cmd, '7E8' + (r.dados[0].length / 2).toString(16).padStart(2, '0') + r.dados[0]);
  }
  async dtcs() {
    const r = await this.cliente.obd(['03']);
    if (!r.ok || !r.dados[0]) return [];
    return decodificarDtcs(r.dados[0].match(/../g).map((h) => parseInt(h, 16)));
  }
  // A conexão com a central é compartilhada com player e navegação; "desconectar" só para a leitura OBD.
  desconectar() {}
}

// --- Simulador: mesmos métodos, valores plausíveis para demonstrar a tela sem adaptador ---
export class Simulador {
  nome = 'Simulador';
  #t = 0;
  async conectar() {}
  async consultar(cmd) {
    this.#t += 0.3;
    const out = {};
    const s = Math.sin(this.#t);
    for (const sig of cmd.signals) {
      out[sig.id] = {
        RPM: 750 + Math.round(s * 60 + 60), VSS: 0, ECT: 88 + Math.round(s * 2), VPWR: 14.1 + s * 0.1,
        LOAD_PCT: 22 + s * 3, IAT: 34, FLI: 61, AAT: 27, RUNTM: Math.round(this.#t * 10),
        MIL: 0, DTC_CNT: 0, ASX_ODO: 103250, ASX_MILEAGE_BEFORE_SERVICING: 2600, ASX_PERIOD_BEFORE_SERVICING_MONTHS: 3,
      }[sig.id] ?? null;
    }
    return out;
  }
  async dtcs() { return []; }
}

export const COMANDOS = SIGNALSET.commands;
