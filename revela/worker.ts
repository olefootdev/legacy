/**
 * Worker do REVELA — injeta as tags de compartilhamento no edge.
 *
 * O PROBLEMA QUE ELE RESOLVE: WhatsApp, Instagram, X e Discord não executam
 * JavaScript. Eles pedem o HTML, leem as meta tags e vão embora. Numa SPA o
 * `index.html` é o mesmo pra todas as rotas — então TODO link do REVELA
 * mostrava o mesmo título e o mesmo ícone de bola, inclusive o perfil de um
 * atleta. Sem isto, "compartilhar" não compartilha nada: é um link cego.
 *
 * COMO FUNCIONA: para `/t/<slug>` e `/lenda/<slug>` o Worker consulta os RPCs
 * públicos, e reescreve as meta tags do HTML com HTMLRewriter (streaming, sem
 * montar a página na memória). Qualquer outra rota recebe o asset intacto.
 *
 * O QUE ELE NÃO É: renderização de página. O visitante humano continua recebendo
 * a SPA e o React assume normalmente — só o `<head>` chega personalizado.
 */

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

interface Meta {
  title: string;
  description: string;
  image?: string;
  /** Canônica da rota — evita que buscador trate ?ref= como página distinta. */
  url: string;
}

const SITE = 'OLEFOOT REVELA';
const FALLBACK: Omit<Meta, 'url'> = {
  title: 'OLEFOOT REVELA — Descubra quem está chegando',
  description:
    'O portal dos talentos do futebol brasileiro. Descubra quem está chegando, reconheça quem fez história e monte seu time com os dois.',
  image: '/og-default.png',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const res = await env.ASSETS.fetch(request);

    // Só mexe em documento HTML. Imagem, CSS e JS passam direto.
    const tipo = res.headers.get('content-type') ?? '';
    if (!tipo.includes('text/html')) return res;

    const meta = await metaParaRota(url, env);
    if (!meta) return res;

    return new HTMLRewriter()
      .on('title', new TrocaTexto(meta.title))
      .on('meta', new TrocaMeta(meta))
      .on('head', new AppendCanonical(meta.url))
      .transform(res);
  },
};

/* ══ Rotas ═════════════════════════════════════════════════════════════════ */

async function metaParaRota(url: URL, env: Env): Promise<Meta | null> {
  const base = `${url.origin}`;
  const partes = url.pathname.split('/').filter(Boolean);

  if (partes.length === 2 && partes[0] === 't') {
    return metaDeTalento(env, base, partes[1]);
  }

  if (partes.length === 2 && (partes[0] === 'lenda' || partes[0] === 'playervip')) {
    return metaDeLenda(env, base, partes[1]);
  }

  // Link CURTO: revela.olefoot.com/<handle-ou-código>. É o que o crawler pede
  // quando o jogador posta o link dele — sem isto, o preview seria o da home.
  if (partes.length === 1) {
    const seg = partes[0];
    // Código de indicação cru (MAIÚSCULO 6-8) redireciona pra home no cliente,
    // então o preview é o da home.
    if (/^[A-Z0-9]{6,8}$/.test(seg)) return { ...FALLBACK, url: `${base}/${seg}` };

    const r = await rpc<{ found: boolean; kind?: string; slug?: string }>(
      env,
      'revela_resolve_handle',
      { p_handle: seg },
    );
    if (r?.found && r.kind === 'talent' && r.slug) return metaDeTalento(env, base, r.slug);
    if (r?.found && r.kind === 'legend' && r.slug) return metaDeLenda(env, base, r.slug);
    return { ...FALLBACK, url: `${base}/${seg}` };
  }

  // Home e resto: tags padrão, mas com canônica da rota.
  return { ...FALLBACK, url: `${base}${url.pathname}` };
}

async function metaDeTalento(env: Env, base: string, slug: string): Promise<Meta> {
  const t = await rpc<TalentRow>(env, 'revela_get_talent', { p_slug: slug });
  if (!t) return { ...FALLBACK, url: `${base}/t/${slug}` };

  const onde = [t.club, t.uf].filter(Boolean).join(' · ');
  const apoios =
    t.supporters > 0
      ? ` ${t.supporters} ${t.supporters === 1 ? 'pessoa acredita' : 'pessoas acreditam'} nele.`
      : ' Seja o primeiro a acreditar.';

  return {
    // Nome + posição + nota responde "quem é esse?" sem a pessoa abrir o link.
    // Canônica em /t/<slug> mesmo vindo do link curto — evita conteúdo duplicado.
    title: `${t.name} · ${t.pos}${t.overall != null ? ` · ${t.overall} OVR` : ''} | ${SITE}`,
    description: `${onde ? `${onde}.` : ''}${apoios}`.trim(),
    image: paraCompartilhar(t.portrait),
    url: `${base}/t/${t.slug}`,
  };
}

async function metaDeLenda(env: Env, base: string, slug: string): Promise<Meta> {
  const lendas = (await rpc<LegendRow[]>(env, 'revela_list_legends', { p_limit: 60 })) ?? [];
  const doAtleta = lendas.filter((l) => slugDoAtleta(l) === slug.toLowerCase());
  if (doAtleta.length === 0) return { ...FALLBACK, url: `${base}/lenda/${slug}` };

  const melhor = doAtleta.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))[0];
  const nome = nomeDoAtleta(melhor.name);
  const fases = doAtleta.length > 1 ? ` ${doAtleta.length} fases da carreira, ${doAtleta.length} cartas.` : '';

  return {
    title: `${nome} · Lenda Olefoot${melhor.overall != null ? ` · ${melhor.overall} OVR` : ''} | ${SITE}`,
    description: `${melhor.tagline ?? melhor.title ?? ''}${fases}`.trim() || FALLBACK.description,
    image: paraCompartilhar(melhor.portrait),
    url: `${base}/lenda/${slug}`,
  };
}

/* ══ Supabase ══════════════════════════════════════════════════════════════ */

async function rpc<T>(env: Env, fn: string, args: Record<string, unknown>): Promise<T | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: env.SUPABASE_ANON_KEY,
        authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(args),
      // O preview do WhatsApp é pedido muitas vezes seguidas pro mesmo link.
      // Cinco minutos de cache no edge evitam martelar o banco à toa.
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    // Crawler não pode ficar sem resposta por causa de uma falha de rede:
    // o chamador cai no FALLBACK.
    return null;
  }
}

interface TalentRow {
  slug: string;
  name: string;
  pos: string;
  club: string | null;
  uf: string | null;
  overall: number | null;
  portrait: string | null;
  supporters: number;
}

interface LegendRow {
  name: string;
  overall: number | null;
  portrait: string;
  tagline: string | null;
  title: string | null;
  handle: string | null;
}

/**
 * ⚠️ ESPELHO de `athleteSlug()` em src/data/legends.ts.
 *
 * O Worker roda fora do bundle do React e não pode importar aquele módulo. Se as
 * duas regras divergirem, o link que a página gera deixa de casar com o link que
 * o crawler resolve — e o preview quebra justamente no compartilhamento. Mexeu
 * num lado, mexa no outro: `npm run test:revela-share` falha se divergirem.
 */
function slugDoAtleta(l: LegendRow): string {
  const handle = l.handle?.trim().toLowerCase();
  if (handle) return handle;
  const primeiro = l.name.trim().split(/\s+/)[0] ?? l.name;
  return (
    primeiro
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\d+$/, '')
      .toLowerCase() || l.name.toLowerCase()
  );
}

/** Idem `nomeDoAtleta()` da LegendPage: tira o sufixo de fase do nome da carta. */
function nomeDoAtleta(nomeDaCarta: string): string {
  return nomeDaCarta
    .trim()
    .replace(/\s*\d{2,4}$/, '')
    .replace(/\d+$/, '')
    .replace(/\s+[A-Z]{2,4}$/, '')
    .trim();
}

/**
 * Recorte 1200×630 em jpeg no gateway do Pinata.
 *
 * ⚠️ ESPELHO de `imagemParaCompartilhar()` em src/data/images.ts — o Worker não
 * pode importar do bundle. Medido: o PNG cru do Palhinha tem 2,6 MB; com estes
 * parâmetros vai a 75 KB e já na proporção que o preview usa. Crawler costuma
 * desistir de imagem pesada, então mandar o original era arriscar o preview
 * inteiro.
 *
 * jpeg em vez de webp de propósito: crawler é mais conservador que navegador, e
 * o preview é o lugar errado pra apostar em suporte a formato.
 */
function paraCompartilhar(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  try {
    const u = new URL(src);
    if (!u.hostname.endsWith('.mypinata.cloud')) return src;
    u.searchParams.set('img-width', '1200');
    u.searchParams.set('img-height', '630');
    u.searchParams.set('img-fit', 'cover');
    u.searchParams.set('img-quality', '85');
    u.searchParams.set('img-format', 'jpeg');
    return u.toString();
  } catch {
    return src;
  }
}

/* ══ Reescrita ═════════════════════════════════════════════════════════════ */

class TrocaTexto {
  constructor(private readonly texto: string) {}
  element(el: Element) {
    el.setInnerContent(this.texto);
  }
}

/** Reescreve as meta tags que já existem no index.html, sem duplicar nenhuma. */
class TrocaMeta {
  constructor(private readonly meta: Meta) {}

  element(el: Element) {
    const chave = el.getAttribute('property') ?? el.getAttribute('name');
    if (!chave) return;

    const absoluta = (src?: string) => {
      if (!src) return undefined;
      // og:image precisa ser absoluta: o crawler não resolve caminho relativo.
      return src.startsWith('http') ? src : new URL(src, this.meta.url).toString();
    };

    switch (chave) {
      case 'description':
      case 'og:description':
      case 'twitter:description':
        el.setAttribute('content', this.meta.description);
        break;
      case 'og:title':
      case 'twitter:title':
        el.setAttribute('content', this.meta.title);
        break;
      case 'og:image':
      case 'twitter:image': {
        const img = absoluta(this.meta.image);
        if (img) el.setAttribute('content', img);
        break;
      }
      case 'og:url':
        el.setAttribute('content', this.meta.url);
        break;
    }
  }
}

class AppendCanonical {
  constructor(private readonly url: string) {}
  element(el: Element) {
    el.append(`<link rel="canonical" href="${escapar(this.url)}">`, { html: true });
  }
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
