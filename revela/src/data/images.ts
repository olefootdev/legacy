/**
 * Otimização de imagem no gateway do Pinata.
 *
 * O QUE ESTAVA ERRADO: o acervo inteiro (23 de 23 retratos) já vive num gateway
 * DEDICADO do Pinata, que faz redimensionamento e conversão sob demanda — e nós
 * pedíamos o PNG original toda vez. Medido em 2026-07-23: um único retrato de
 * 2,4 MB vira 82 KB com `?img-width=600&img-format=webp`. Trinta vezes menor,
 * sem tocar no arquivo de origem, sem migrar nada.
 *
 * A conta na home: ~15 retratos × ~2,3 MB = 27 MB. Com os parâmetros, cai pra
 * menos de 1 MB. Num portal mobile-first, feito pra abrir de um link no
 * WhatsApp, essa diferença é entre "abriu" e "desistiu".
 *
 * ⚠️ Só funciona em gateway DEDICADO (`*.mypinata.cloud`). O gateway público
 * ignora os parâmetros e devolve o original — por isso a função checa o host em
 * vez de sair concatenando query em qualquer URL.
 *
 * Referência de peso (retrato 3:4, medido):
 *   320px webp ......  20 KB   tile do Reveal Wall
 *   480px webp ......  35 KB   card de grade
 *   640px webp ......  51 KB   card grande / hero mobile
 *   960px webp q82 ..  88 KB   hero desktop em retina
 *   1200×630 jpeg ...  75 KB   og:image (com img-fit=cover)
 */

/** Gateways que sabem transformar imagem. Host desconhecido passa intacto. */
function otimizavel(url: string): URL | null {
  try {
    const u = new URL(url);
    return u.hostname.endsWith('.mypinata.cloud') ? u : null;
  } catch {
    return null;
  }
}

export interface OpcoesImagem {
  /** Largura em pixels do arquivo servido (não a de layout). */
  width: number;
  /** Altura — só quando quiser recorte fixo, junto com `fit`. */
  height?: number;
  /** `cover` recorta pro formato pedido; sem isso a proporção é mantida. */
  fit?: 'cover' | 'contain' | 'scale-down';
  /** 1–100. Padrão do gateway serve bem; 80–85 economiza sem marcar. */
  quality?: number;
  /**
   * webp para navegador (menor). jpeg para crawler de rede social, que é mais
   * conservador que navegador — o preview é o lugar errado pra apostar em
   * suporte a formato.
   */
  format?: 'webp' | 'jpeg' | 'png';
}

export function imagemOtimizada(url: string | null | undefined, opts: OpcoesImagem): string | undefined {
  if (!url) return undefined;
  const u = otimizavel(url);
  if (!u) return url;

  u.searchParams.set('img-width', String(Math.round(opts.width)));
  if (opts.height) u.searchParams.set('img-height', String(Math.round(opts.height)));
  if (opts.fit) u.searchParams.set('img-fit', opts.fit);
  if (opts.quality) u.searchParams.set('img-quality', String(opts.quality));
  u.searchParams.set('img-format', opts.format ?? 'webp');
  return u.toString();
}

/**
 * `srcset` de 1x e 2x. Sem isto, tela retina recebe imagem borrada — e pedir
 * sempre o dobro desperdiça banda em tela comum. O navegador escolhe.
 */
export function srcSetOtimizado(url: string | null | undefined, larguraDeLayout: number): string | undefined {
  if (!url || !otimizavel(url)) return undefined;
  const x1 = imagemOtimizada(url, { width: larguraDeLayout, quality: 82 });
  const x2 = imagemOtimizada(url, { width: larguraDeLayout * 2, quality: 78 });
  if (!x1 || !x2) return undefined;
  // Qualidade menor no 2x de propósito: em densidade dobrada o olho não vê a
  // diferença, e o arquivo pesa bem menos.
  return `${x1} 1x, ${x2} 2x`;
}

/** Recorte 1200×630 para og:image, no formato que todo crawler entende. */
export function imagemParaCompartilhar(url: string | null | undefined): string | undefined {
  return imagemOtimizada(url, { width: 1200, height: 630, fit: 'cover', quality: 85, format: 'jpeg' });
}
