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

// Posições dos pontos no modelo 3D (espaço do GLB: x = comprimento, frente em -x; y = altura; z = largura).
const PONTOS_3D = { motor: [-44, 38, -52], eletrica: [-64, 30, -4], cambio: [-4, -6, 11], freios: [-49, 0, 13], rodas: [47, 0, 13] };
// Extensão projetada do carro na órbita padrão (-32°), em unidades do modelo, para enquadrar a câmera.
export const CARRO_3D = { largura: 175, altura: 90 };

// <model-viewer> com os mesmos pontos; a silhueta SVG é o poster (carregando) e o fallback (erro).
export function carro3d(statusPorArea, nomes) {
  const hot = Object.entries(PONTOS_3D).map(([area, p]) => `
    <button class="hot3d ${statusPorArea[area] ?? 'sem'}" slot="hotspot-${area}" data-position="${p.join(' ')}" data-normal="0 0 1" data-area="${area}" aria-label="${nomes[area]}: ${statusPorArea[area] ?? 'sem registro'}"><i></i><span>${nomes[area]}</span></button>`).join('');
  return `<model-viewer class="car3d" src="assets/asx.glb" alt="Mitsubishi ASX preto" camera-controls disable-zoom disable-pan touch-action="pan-y"
    camera-orbit="-32deg 78deg auto" exposure="1.1" shadow-intensity="1" environment-image="neutral" interaction-prompt="none">
    <div slot="poster" class="poster">${carro(statusPorArea, nomes)}</div>
    ${hot}
  </model-viewer>`;
}
