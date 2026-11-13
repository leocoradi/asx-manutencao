// Base técnica do Mitsubishi ASX 2017/2018 2.0 16V MIVEC (4B11), 4x2, câmbio manual 5M.
// Fonte: Manual do Proprietário (MMC Automotores do Brasil) e o manual do Copilito da ASX.
// Intervalos em uso severo (Brasil). "Dado não confirmado" aparece onde a base não confirma.

export const VEICULO = {
  nome: 'Mitsubishi ASX 2.0 4x2 Manual',
  ano: '2017/2018',
  motor: '4B11 · 2.0 16V DOHC MIVEC',
  cambio: 'Manual 5 marchas',
  tracao: '4x2 (2WD)',
  combustivel: 'Gasolina (proibido etanol/metanol)',
  tanqueL: 63,
};

// Áreas usadas pelos pontos de atenção na silhueta do carro.
export const AREAS = {
  motor: 'Motor',
  cambio: 'Câmbio',
  freios: 'Freios',
  rodas: 'Rodas',
  eletrica: 'Elétrica',
};

// Plano de manutenção preventiva (uso severo). km e meses: o que vencer primeiro.
export const PLANO = [
  { id: 'oleo', area: 'motor', nome: 'Óleo do motor + filtro', km: 5000, meses: 6,
    spec: '4,3 L SAE 10W-30 API SG+ (Lubrax Advento 4x4 10W-30). Filtro OEM MD360935 / MZ690070, Mann W610/3, Mahle OC196.' },
  { id: 'filtro-ar', area: 'motor', nome: 'Filtro de ar do motor', km: 10000, meses: 12,
    spec: 'OEM 1500A023. Inspecionar a cada 5.000 km em poeira.' },
  { id: 'filtro-cabine', area: 'motor', nome: 'Filtro de ar-condicionado (cabine)', km: 10000, meses: 12,
    spec: 'OEM 7803A005.' },
  { id: 'rodizio', area: 'rodas', nome: 'Rodízio, alinhamento e balanceamento', km: 10000, meses: 12,
    spec: '225/55 R18 98V a 29 psi (2,0 bar) a frio. Estepe 215/70 R16 a 32 psi. Sulco mínimo 1,6 mm.' },
  { id: 'pneus', area: 'rodas', nome: 'Troca dos pneus', km: 50000, meses: 60,
    spec: '4x 225/55 R18 98V. O manual não fixa quilometragem: 50.000 km ou 5 anos é estimativa de vida útil. Trocar antes se o sulco chegar ao indicador TWI (1,6 mm) ou houver bolha, corte ou ressecamento. Data de fabricação (DOT) na lateral do pneu.' },
  { id: 'inspecao', area: 'freios', nome: 'Inspeção: freios, coifas, buchas, bieletas, correia', km: 10000, meses: 12,
    spec: 'Pastilhas/discos, coifas das homocinéticas, buchas de bandeja, bieletas, nível do óleo da caixa, correia Poly-V.' },
  { id: 'fluido-freio', area: 'freios', nome: 'Fluido de freio e embreagem (DOT 4)', km: 20000, meses: 12,
    spec: '~0,7 a 1,0 L DOT 4 (Lubrax Fluido para Freios Especial DOT 4). Sangrar as 4 rodas e o atuador da embreagem: reservatório compartilhado.' },
  { id: 'tbi', area: 'motor', nome: 'Limpeza do corpo de borboleta (TBI)', km: 20000, meses: 12,
    spec: 'Verificar também curso livre do pedal de embreagem e cabo do freio de estacionamento.' },
  { id: 'oleo-cambio', area: 'cambio', nome: 'Óleo da transmissão manual', km: 40000, meses: 24,
    spec: '2,5 L API GL-4 SAE 75W-85 (Lubrax TRM 4 75W-85 / DiaQueen Multi Gear Oil). Manual: 200.000 km; antecipado para uso severo.' },
  { id: 'filtro-comb', area: 'motor', nome: 'Filtro de combustível', km: 40000, meses: 24,
    spec: 'Integrado ao conjunto da bomba no tanque. Part number nacional 17/18: Dado não confirmado.' },
  { id: 'suspensao', area: 'rodas', nome: 'Inspeção da suspensão traseira multilink', km: 40000, meses: 24,
    spec: 'Buchas dos braços transversais/longitudinais e amortecedores KYB.' },
  { id: 'velas', area: 'eletrica', nome: 'Velas de ignição (irídio)', km: 80000, meses: 48,
    spec: '4x NGK FR6EI ou DENSO K20PSR-B8. Torque: Dado não confirmado.' },
  { id: 'arrefecimento', area: 'motor', nome: 'Líquido de arrefecimento', km: 80000, meses: 48,
    spec: '7,5 L (0,65 L no reservatório) Mitsubishi Super Long Life Premium Coolant 50/50. Após a 1ª troca: 40.000 km / 2 anos. Nunca completar só com água.' },
  { id: 'correia', area: 'motor', nome: 'Correia de acessórios (Poly-V) + tensor', km: 80000, meses: 48,
    spec: 'Comando por corrente metálica: só inspeção de ruído/tensor. Inspecionar polia tensora e polia livre do alternador.' },
  { id: 'bicos', area: 'motor', nome: 'Limpeza dos bicos injetores + descarbonização', km: 80000, meses: 48,
    spec: 'Limpeza ultrassônica e teste de vazão.' },
];

export const FLUIDOS = [
  ['Óleo do motor', '4,3 L (4,0 cárter + 0,3 filtro)', 'SAE 10W-30 API SG+ · Lubrax Advento 4x4'],
  ['Transmissão manual', '2,5 L', 'API GL-4 SAE 75W-85 · Lubrax TRM 4'],
  ['Freios + embreagem', 'conforme necessário (~0,7 a 1,0 L)', 'DOT 4 · Lubrax Freios Especial'],
  ['Arrefecimento', '7,5 L (0,65 L reservatório)', 'Super Long Life Premium Coolant 50/50'],
  ['Ar-condicionado', '480 a 520 g', 'R134a (HFC-134a)'],
  ['Lavador do para-brisa', '4,5 L', 'Água + detergente automotivo'],
];

export const FICHA = [
  ['Cilindrada', '1.998 cm³ (86,0 × 86,0 mm)'],
  ['Potência', '160 cv @ 6.000 rpm'],
  ['Torque', '197 N·m (20,1 kgf·m) @ 4.200 rpm'],
  ['Marcha lenta', '700 ± 100 rpm'],
  ['Velocidade máxima', '190 km/h'],
  ['Peso em ordem de marcha', '1.355 kg'],
  ['PBT', '1.970 kg (diant. 1.000 / tras. 970)'],
  ['Carga no teto', '80 kg'],
  ['Reboque', '1.100 kg com freio / 500 kg sem freio'],
  ['Tanque', '63 L (reserva ~10 L; pisca rápido ~5 L)'],
  ['Vão livre do solo', '215 mm'],
  ['Entre-eixos', '2.670 mm'],
  ['Bateria', '12V 65Ah CCA 550A (livre de manutenção)'],
  ['Alternador', '105 A'],
];

export const PNEUS = [
  ['Rodagem', '225/55 R18 98V · roda 18x7J offset 46', '29 psi · 2,0 bar · 200 kPa'],
  ['Estepe', '215/70 R16 100H · roda 16x6½J offset 46', '32 psi · 2,2 bar · 220 kPa'],
];

export const LAMPADAS = [
  ['Farol baixo', 'H11 55 W'],
  ['Farol alto', 'HB3 60 W'],
  ['Neblina dianteiro', 'H11 55 W'],
  ['Meia-luz e placa', 'W5W 5 W'],
  ['Setas', 'WY21W 21 W'],
  ['Luz de ré', 'W16W 16 W'],
  ['Lanterna/freio traseiro', 'Módulo LED (não substituível)'],
];

export const FUSIVEIS = {
  'Caixa interna (painel, lado do motorista)': [
    ['#2', '15A', 'Luzes de freio'], ['#4', '30A', 'Limpadores do para-brisa'],
    ['#6', '20A', 'Trava elétrica das portas'], ['#7', '15A', 'Rádio / multimídia'],
    ['#11', '15A', 'Limpador do vidro traseiro'], ['#12', '7,5A', 'Painel de instrumentos'],
    ['#13 / #19', '15A', 'Tomadas 12V'], ['#14', '10A', 'Ignição'], ['#18', '7,5A', 'Luzes de ré'],
  ],
  'Caixa do motor': [
    ['#2', '7,5A', 'ECU / sensores'], ['#4', '10A', 'Buzina'], ['#5', '7,5A', 'Alternador'],
    ['#7', '10A', 'Compressor do A/C'], ['#14 / #15', '10A', 'Farol alto E / D'],
    ['#18 / #19', '10A', 'Farol baixo E / D'], ['#20 / #22', '10A / 20A', 'ENG/POWER'],
    ['#21', '10A', 'Bobinas de ignição'], ['#23', '15A', 'Bomba de combustível'],
    ['#24', '30A', 'Motor de partida'], ['#26 / #27', '40A / 30A', 'ABS / ASC'],
    ['#28', '30A', 'Ventoinha do condensador'], ['#29', '40A', 'Ventoinha do radiador'],
    ['Reservas', '10A / 15A / 20A', '#33 / #34 / #35 na tampa'],
  ],
};
