// Mapa do Google (API JavaScript oficial) com trânsito ao vivo e rota com tempo em trânsito.
// A chave é do usuário, fica no aparelho (localStorage) e deve ser restrita ao domínio do app no console do Google.
// Os termos do Google Maps Platform não permitem guiar curva a curva no app; a condução é entregue ao Vela.

export const textoDeHtml = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// Links para entregar o destino ao app de navegação.
// geo: é o intent que o Vela registra (o Android abre o seletor se houver outros apps de mapa).
export function linksNavegar(destino, lat, lng) {
  const rotulo = encodeURIComponent(destino.trim());
  const temPos = Number.isFinite(lat) && Number.isFinite(lng);
  return {
    geo: temPos ? `geo:${lat},${lng}?q=${lat},${lng}(${rotulo})` : `geo:0,0?q=${rotulo}`,
    google: temPos ? `google.navigation:q=${lat},${lng}&mode=d` : `google.navigation:q=${rotulo}&mode=d`,
  };
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
    window.gm_authFailure = () => { carregando = null; rej(new Error('Chave do Google Maps recusada. Confira a chave e as restrições de domínio.')); };
  }));
}

export class MapaTransito {
  #g; #mapa; #transito; #marcador; #dir; #render; #rotas = null; #indice = 0;
  constructor(g, el, pos) {
    this.#g = g;
    this.#mapa = new g.Map(el, {
      center: pos ?? { lat: -15.78, lng: -47.93 }, zoom: pos ? 14 : 4, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy',
      colorScheme: g.ColorScheme?.DARK ?? 'DARK', clickableIcons: false,
    });
    this.#transito = new g.TrafficLayer(); this.#transito.setMap(this.#mapa);
    this.#dir = new g.DirectionsService();
    this.#render = new g.DirectionsRenderer({ map: this.#mapa, suppressMarkers: false, polylineOptions: { strokeColor: '#4fc3f7', strokeWeight: 6 } });
    if (pos) this.posicao(pos);
  }
  posicao(pos) {
    const centro = { lat: pos.lat, lng: pos.lon ?? pos.lng };
    this.#marcador ??= new this.#g.Circle({ map: this.#mapa, radius: 25, fillColor: '#ffffff', fillOpacity: 1, strokeColor: '#0a0a0a', strokeWeight: 3, zIndex: 10 });
    this.#marcador.setCenter(centro);
    if (!this.#rotas) this.#mapa.panTo(centro);
  }
  // Rota de carro saindo da posição, com tempo em trânsito agora e alternativas.
  async rota(pos, destino) {
    const r = await this.#dir.route({
      origin: { lat: pos.lat, lng: pos.lon ?? pos.lng }, destination: destino, travelMode: 'DRIVING',
      drivingOptions: { departureTime: new Date(), trafficModel: 'BEST_GUESS' }, provideRouteAlternatives: true, region: 'BR', language: 'pt-BR',
    });
    this.#rotas = r; this.#indice = 0;
    this.#render.setDirections(r); this.#render.setRouteIndex(0);
    return this.resumo();
  }
  escolher(i) { this.#indice = i; this.#render.setRouteIndex(i); return this.resumo(); }
  limpar() { this.#rotas = null; this.#render.set('directions', null); }
  resumo() {
    if (!this.#rotas) return null;
    const rotas = this.#rotas.routes.map((rt, i) => {
      const leg = rt.legs[0];
      return { i, via: rt.summary, distancia: leg.distance.text, tempo: leg.duration_in_traffic?.text ?? leg.duration.text, tempoSemTransito: leg.duration.text,
        fim: { lat: leg.end_location.lat(), lng: leg.end_location.lng() }, endereco: leg.end_address,
        passos: leg.steps.map((s) => ({ texto: textoDeHtml(s.instructions), distancia: s.distance.text })) };
    });
    return { atual: this.#indice, rotas };
  }
}
