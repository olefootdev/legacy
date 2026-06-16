/**
 * Compartilha uma IMAGEM (de uma URL same-origin) + texto via Web Share API.
 *
 * Estratégia em camadas (melhor → pior):
 *  1) imagem + texto  → navigator.share({ files, text })  (mobile: WhatsApp/IG/etc)
 *  2) só texto        → navigator.share({ text })
 *  3) fallback        → copia pro clipboard + abre Twitter/X intent
 *
 * O LINK deve vir embutido no `text` (não num campo `url` separado): assim ele
 * viaja junto mesmo quando o alvo do share ignora o campo url ao mandar arquivo.
 */
export type ShareResult = 'shared' | 'fallback' | 'cancelled';

export async function shareImageWithText(opts: {
  imageUrl: string;
  text: string;
  fileName?: string;
  title?: string;
}): Promise<ShareResult> {
  const { imageUrl, text, fileName = 'olefoot.png', title = 'Olefoot' } = opts;
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  }) : undefined;

  // 1) Imagem + texto (ideal pro viral)
  if (nav?.canShare) {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type || 'image/png' });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text, title });
        return 'shared';
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
      // segue pra próxima camada
    }
  }

  // 2) Só texto (link embutido no texto)
  if (nav?.share) {
    try {
      await nav.share({ title, text });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
    }
  }

  // 3) Fallback: clipboard + Twitter/X intent
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    // sem clipboard — ignora
  }
  if (typeof window !== 'undefined') {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.slice(0, 280))}`,
      '_blank',
      'noopener,noreferrer',
    );
  }
  return 'fallback';
}
