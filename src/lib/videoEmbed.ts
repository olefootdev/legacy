/**
 * LINK DE VÍDEO → ENDEREÇO DE EMBED, ou nada.
 *
 * O campo `revela_talents.video_url` é texto livre digitado pelo atleta no
 * onboarding ("YouTube, Drive…"). Ou seja: o valor pode ser um link de vídeo,
 * pode ser um Drive, pode ser lixo. Nada disso pode virar `src` de iframe sem
 * passar por aqui.
 *
 * ── A REGRA ─────────────────────────────────────────────────────────────────
 * Só devolve endereço para hosts de vídeo que a gente reconhece, e monta o
 * endereço a partir do ID EXTRAÍDO — nunca repassa a string original. Qualquer
 * outra coisa devolve null, e quem chama mostra um link comum em vez de embutir
 * um iframe apontando pra qualquer lugar.
 *
 * YouTube sai em `youtube-nocookie.com`: a página mostra menores de idade e não
 * tem por que plantar cookie de publicidade em quem vem só olhar um talento.
 *
 * ── POR QUE VIVE EM src/lib ─────────────────────────────────────────────────
 * Havia duas cópias idênticas desta função — uma no painel do OLE SCOUT (app do
 * jogo) e outra no guia do REVELA (app separado). O REVELA importa `@/` do
 * mesmo `src/`, então este é o único lugar que os dois alcançam.
 */
export function videoEmbedUrl(bruto: string): string | null {
  let u: URL;
  try {
    u = new URL(bruto.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = u.pathname.slice(1);
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (u.pathname === '/watch') {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    const m = u.pathname.match(/^\/(shorts|embed)\/([\w-]+)/);
    if (m) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(m[2])}`;
    return null;
  }
  if (host === 'vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return /^\d+$/.test(id ?? '') ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}
