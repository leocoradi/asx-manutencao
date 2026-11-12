// Silhueta lateral do ASX (preta) com pontos de atenção por área.
// [x, y, yTexto]
const PONTOS = { motor: [104, 124, 92], eletrica: [178, 108, 70], cambio: [240, 154, 134], freios: [150, 172, 232], rodas: [498, 172, 232] };

export function carro(statusPorArea, nomes) {
  const hot = Object.entries(PONTOS).map(([area, [x, y, ty]]) => `
    <g class="hot ${statusPorArea[area] ?? 'sem'}" data-area="${area}" role="button" tabindex="0" aria-label="${nomes[area]}: ${statusPorArea[area] ?? 'sem registro'}">
      <circle class="ring" cx="${x}" cy="${y}" r="13"/>
      <circle class="core" cx="${x}" cy="${y}" r="6"/>
      <text x="${x}" y="${ty}" text-anchor="middle">${nomes[area]}</text>
    </g>`).join('');
  return `<svg class="car" viewBox="0 0 640 242" role="img" aria-label="Silhueta do ASX com estado por área">
    <path d="M40 172 L40 140 Q40 116 64 110 L150 96 Q172 92 190 86 L248 50 Q270 36 302 36 L466 36 Q522 38 548 62 L582 112 Q602 126 600 152 L598 172 Z" fill="#141414" stroke="#f4f4f4" stroke-width="1.2"/>
    <path d="M206 86 L254 56 L330 56 L330 86 Z M342 56 L452 56 Q492 58 512 86 L342 86 Z" fill="#262626" stroke="#f4f4f4" stroke-width=".8"/>
    <path d="M330 90 V150 M40 150 H120 M560 150 H598" stroke="#f4f4f4" stroke-width=".8" stroke-dasharray="3 4" fill="none"/>
    <circle cx="150" cy="172" r="44" fill="#0a0a0a"/><circle cx="498" cy="172" r="44" fill="#0a0a0a"/>
    <circle cx="150" cy="172" r="36" fill="#1c1c1c" stroke="#f4f4f4" stroke-width="1"/><circle cx="498" cy="172" r="36" fill="#1c1c1c" stroke="#f4f4f4" stroke-width="1"/>
    <circle cx="150" cy="172" r="19" fill="none" stroke="#f4f4f4" stroke-width="1.6" stroke-dasharray="2 4"/><circle cx="498" cy="172" r="19" fill="none" stroke="#f4f4f4" stroke-width="1.6" stroke-dasharray="2 4"/>
    <path d="M40 150 L36 150 Q30 132 44 126" fill="none" stroke="#f4f4f4" stroke-width="1"/>
    ${hot}
  </svg>`;
}
