// YouTube (player embutido) e Waze (mapa ao vivo e deep link) no próprio app.

// Link do YouTube / YouTube Music -> { list } (playlist) ou { video } (um vídeo). null se não reconhecer.
export function alvoYoutube(texto) {
  let u;
  try { u = new URL(texto.trim()); } catch { return /^[\w-]{11}$/.test(texto.trim()) ? { video: texto.trim() } : null; }
  if (!/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(u.hostname)) return null;
  const list = u.searchParams.get('list');
  if (list && /^[\w-]+$/.test(list)) return { list };
  const v = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || (u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/) || [])[1];
  return v && /^[\w-]{11}$/.test(v) ? { video: v } : null;
}

// Mapa ao vivo oficial do Waze (embed.waze.com), centrado na posição.
export const wazeMapaUrl = (lat, lon, zoom = 15) => `https://embed.waze.com/iframe?zoom=${zoom}&lat=${(+lat).toFixed(5)}&lon=${(+lon).toFixed(5)}&ct=livemap`;

// Abre o Waze já roteando para o destino digitado (deep link universal).
export const wazeNavegarUrl = (destino) => `https://waze.com/ul?q=${encodeURIComponent(destino.trim())}&navigate=yes`;

export const youtubeMusicUrl = 'https://music.youtube.com/';
