// Subconjunto de sinais no formato OBDb signalset v3 (https://github.com/OBDb).
// Fontes: OBDb/SAEJ1979 (PIDs padrão) e OBDb/Mitsubishi-ASX (sinais estendidos, serviço 21).
// Licença dos dados: CC-BY-SA-4.0 (OBDb). Os sinais estendidos foram confirmados pela comunidade
// em ASX 2020/2021; no 2017/2018 nacional, ausência de resposta é esperada em alguns deles.
export const SIGNALSET = {
  ecu: [{ hdr: '7E0', type: 'engine' }, { hdr: '7E1', type: 'transmission' }],
  commands: [
    { hdr: '7E0', rax: '7E8', cmd: { '01': '01' }, freq: 10, signals: [
      { id: 'MIL', name: 'Luz de injeção (MIL)', fmt: { len: 1, max: 1, unit: 'offon' } },
      { id: 'DTC_CNT', name: 'Códigos de falha armazenados', fmt: { bix: 1, len: 7, max: 127, unit: 'scalar' } },
    ] },
    { hdr: '7E0', rax: '7E8', cmd: { '01': '04' }, freq: 0.25, signals: [
      { id: 'LOAD_PCT', name: 'Carga do motor', fmt: { len: 8, max: 100, mul: 100, div: 255, unit: 'percent' } },
    ] },
    { hdr: '7E0', rax: '7E8', cmd: { '01': '05' }, freq: 0.5, signals: [
      { id: 'ECT', name: 'Temp. do arrefecimento', fmt: { len: 8, max: 215, min: -40, add: -40, unit: 'celsius' } },
    ] },
    { hdr: '7E0', rax: '7E8', cmd: { '01': '0C' }, freq: 0.25, signals: [
      { id: 'RPM', name: 'Rotação', fmt: { len: 16, max: 16383.75, div: 4, nullmax: 16383.5, unit: 'rpm' } },
    ] },
    { hdr: '7E0', rax: '7E8', cmd: { '01': '0D' }, freq: 0.25, signals: [
      { id: 'VSS', name: 'Velocidade', fmt: { len: 8, max: 255, nullmax: 255, unit: 'kilometersPerHour' } },
    ] },
    { hdr: '7E0', rax: '7E8', cmd: { '01': '0F' }, freq: 0.25, signals: [
      { id: 'IAT', name: 'Temp. do ar de admissão', fmt: { len: 8, max: 215, min: -40, add: -40, unit: 'celsius' } },
    ] },
    { hdr: '7E0', rax: '7E8', cmd: { '01': '1F' }, freq: 1, signals: [
      { id: 'RUNTM', name: 'Tempo desde a partida', fmt: { len: 16, max: 65535, unit: 'seconds' } },
    ] },
    { hdr: '7E0', rax: '7E8', cmd: { '01': '2F' }, freq: 1, signals: [
      { id: 'FLI', name: 'Nível do tanque', fmt: { len: 8, max: 100, mul: 100, div: 255, nullmin: 0, unit: 'percent' } },
    ] },
    { hdr: '7E0', rax: '7E8', cmd: { '01': '42' }, freq: 10, signals: [
      { id: 'VPWR', name: 'Tensão do módulo', fmt: { len: 16, max: 65.535, div: 1000, unit: 'volts' } },
    ] },
    { hdr: '7E0', rax: '7E8', cmd: { '01': '46' }, freq: 15, signals: [
      { id: 'AAT', name: 'Temp. ambiente', fmt: { len: 8, max: 215, min: -40, add: -40, unit: 'celsius' } },
    ] },
    // Estendidos (ETACS / painel), OBDb/Mitsubishi-ASX.
    { hdr: '6A0', rax: '514', fcm1: true, cmd: { '21': 'AD' }, freq: 30, signals: [
      { id: 'ASX_ODO', name: 'Odômetro', fmt: { len: 24, blsb: true, max: 16777215, unit: 'kilometers' } },
    ] },
    { hdr: '6A0', rax: '514', fcm1: true, cmd: { '21': 'BC' }, freq: 30, signals: [
      { id: 'ASX_MILEAGE_BEFORE_SERVICING', name: 'km até a revisão (painel)', fmt: { len: 8, max: 25500, mul: 100, unit: 'kilometers' } },
      { id: 'ASX_PERIOD_BEFORE_SERVICING_MONTHS', name: 'Meses até a revisão (painel)', fmt: { bix: 32, len: 8, max: 255, unit: 'scalar' } },
    ] },
  ],
};
