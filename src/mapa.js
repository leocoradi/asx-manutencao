// Mapa do Google (API JavaScript oficial) com trânsito ao vivo e rota com tempo em trânsito.
// A chave é do usuário, fica no aparelho (localStorage) e deve ser restrita ao domínio do app no console do Google.
// Os termos do Google Maps Platform não permitem guiar curva a curva no app; a condução é entregue ao Vela.

export const textoDeHtml = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// Links para entregar o destino ao app de navegação.
// geo: é o intent que o Vela registra (o Android abre o seletor se houver outros apps de mapa).
export function linksNavegar(destino, lat, lng) {
  const rotulo = encodeURIComponent(destino.trim());
  const temPos = Number.isFinite(lat) && Number.isFinite(lng);
  return { geo: temPos ? `geo:${lat},${lng}?q=${lat},${lng}(${rotulo})` : `geo:0,0?q=${rotulo}` };
}

let carregando;
export function carregarGoogle(chave) {
  return (carregando ??= new Promise((res, rej) => {
    if (window.google?.maps?.Map) return res(window.google.maps);
    window.__gmapsPronto = () => res(window.google.maps);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(chave)}&v=weekly&loading=async&language=pt-BR&region=BR&callback=__gmapsPronto`;
    s.onerror = () => { carregando = null; rej(new Error('Não foi possível carregar o Google Maps. Confira a chave e a rede.')); };
    document.head.append(s);
    // O Google chama isto quando recusa a chave, inclusive depois de o mapa já ter carregado.
    window.gm_authFailure = () => {
      carregando = null;
      const msg = 'O Google recusou a chave. Chaves novas podem levar alguns minutos para funcionar; confira também as APIs ativadas e a restrição de site.';
      rej(new Error(msg));
      window.dispatchEvent(new CustomEvent('gmaps-chave', { detail: msg }));
    };
  }));
}

// Polyline codificada do Google -> [{lat,lng}] (algoritmo de codificação de polilinhas, precisão 1e-5).
export function decodificarPolyline(str) {
  const pts = []; let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const eixo of ['lat', 'lng']) {
      let r = 0, shift = 0, b;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << shift; shift += 5; } while (b >= 32);
      const d = r & 1 ? ~(r >> 1) : r >> 1;
      if (eixo === 'lat') lat += d; else lng += d;
    }
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pts;
}

// Routes API (substituta da Directions API, que projetos novos não conseguem mais ativar).
// TRAFFIC_AWARE devolve a duração com o trânsito de agora; staticDuration é sem trânsito.
const CAMPOS = 'routes.description,routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.localizedValues,routes.legs.endLocation,routes.legs.steps.navigationInstruction,routes.legs.steps.localizedValues';
export async function calcularRotas(chave, pos, destino, fetchFn = fetch) {
  const r = await fetchFn('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chave, 'X-Goog-FieldMask': CAMPOS },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: pos.lat, longitude: pos.lon ?? pos.lng } } },
      destination: { address: destino }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: true, languageCode: 'pt-BR', regionCode: 'BR', units: 'METRIC',
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `Routes API: HTTP ${r.status}`);
  return (j.routes ?? []).map((rt, i) => ({
    i, via: rt.description || '', distancia: rt.localizedValues?.distance?.text || `${(rt.distanceMeters / 1000).toFixed(1)} km`,
    tempo: rt.localizedValues?.duration?.text || rt.duration, tempoSemTransito: rt.localizedValues?.staticDuration?.text || rt.staticDuration,
    fim: { lat: rt.legs?.at(-1)?.endLocation?.latLng?.latitude, lng: rt.legs?.at(-1)?.endLocation?.latLng?.longitude },
    pontos: decodificarPolyline(rt.polyline?.encodedPolyline || ''),
    passos: (rt.legs ?? []).flatMap((l) => l.steps ?? []).map((st) => ({ texto: textoDeHtml(st.navigationInstruction?.instructions), distancia: st.localizedValues?.distance?.text || '' })).filter((p) => p.texto),
  }));
}

export class MapaTransito {
  #g; #mapa; #transito; #marcador; #linhas = []; #destinoMarc; #rotas = null; #indice = 0; #chave;
  constructor(g, el, pos, chave) {
    this.#g = g; this.#chave = chave;
    this.#mapa = new g.Map(el, {
      center: pos ? { lat: pos.lat, lng: pos.lon } : { lat: -15.78, lng: -47.93 }, zoom: pos ? 14 : 4, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy',
      colorScheme: g.ColorScheme?.DARK ?? 'DARK', clickableIcons: false,
    });
    this.#transito = new g.TrafficLayer(); this.#transito.setMap(this.#mapa);
    if (pos) this.posicao(pos);
  }
  posicao(pos) {
    const centro = { lat: pos.lat, lng: pos.lon ?? pos.lng };
    this.#marcador ??= new this.#g.Circle({ map: this.#mapa, radius: 25, fillColor: '#ffffff', fillOpacity: 1, strokeColor: '#0a0a0a', strokeWeight: 3, zIndex: 10 });
    this.#marcador.setCenter(centro);
    if (!this.#rotas) { this.#mapa.panTo(centro); if (this.#mapa.getZoom?.() < 10) this.#mapa.setZoom(14); }
  }
  async rota(pos, destino) {
    const rotas = await calcularRotas(this.#chave, pos, destino);
    if (!rotas.length) throw new Error('nenhuma rota devolvida');
    this.#rotas = rotas; this.#desenhar(0);
    return this.resumo();
  }
  escolher(i) { this.#desenhar(i); return this.resumo(); }
  limpar() { this.#rotas = null; this.#apagar(); }
  #apagar() { for (const l of this.#linhas) l.setMap(null); this.#linhas = []; this.#destinoMarc?.setMap(null); this.#destinoMarc = null; }
  #desenhar(i) {
    this.#indice = i; this.#apagar();
    const g = this.#g, limites = new g.LatLngBounds();
    this.#rotas.forEach((rt, k) => {
      const l = new g.Polyline({ map: this.#mapa, path: rt.pontos, strokeColor: k === i ? '#4fc3f7' : '#6b6b6b', strokeOpacity: k === i ? 1 : 0.7, strokeWeight: k === i ? 6 : 4, zIndex: k === i ? 5 : 1 });
      l.addListener('click', () => this.onEscolher?.(k));
      this.#linhas.push(l);
      rt.pontos.forEach((p) => limites.extend(p));
    });
    const fim = this.#rotas[i].fim;
    if (Number.isFinite(fim.lat)) this.#destinoMarc = new g.Circle({ map: this.#mapa, center: fim, radius: 30, fillColor: '#d71921', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2, zIndex: 10 });
    if (!limites.isEmpty()) this.#mapa.fitBounds(limites, 40);
  }
  resumo() { return this.#rotas ? { atual: this.#indice, rotas: this.#rotas } : null; }
}
