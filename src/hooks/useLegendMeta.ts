/**
 * useLegendMeta — atualiza title + Open Graph tags pra cada lenda.
 *
 * Sem dependência externa (sem react-helmet). Manipula `document.head`
 * diretamente, marcando os tags com `data-legend-meta` para limpeza
 * idempotente quando o usuário navega para outra lenda.
 *
 * Útil pra divulgação social: game.olefoot.com/legend/pele
 */
import { useEffect } from 'react';
import type { LegendData } from '@/data/legends';

const ATTR = 'data-legend-meta';

function setOrCreateMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(`${selector}[${ATTR}]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(ATTR, '1');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
}

export function useLegendMeta(legend: LegendData) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = legend.og.title;

    const url = `${window.location.origin}/legend/${legend.slug}`;
    const image = legend.og.image ?? legend.photoUrl ?? '';

    setOrCreateMeta('meta[name="description"]', {
      name: 'description',
      content: legend.og.description,
    });
    setOrCreateMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: legend.og.title,
    });
    setOrCreateMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: legend.og.description,
    });
    setOrCreateMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: 'profile',
    });
    setOrCreateMeta('meta[property="og:url"]', {
      property: 'og:url',
      content: url,
    });
    if (image) {
      setOrCreateMeta('meta[property="og:image"]', {
        property: 'og:image',
        content: image,
      });
    }
    setOrCreateMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: image ? 'summary_large_image' : 'summary',
    });
    setOrCreateMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: legend.og.title,
    });
    setOrCreateMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: legend.og.description,
    });

    return () => {
      document.title = prevTitle;
      // Remove apenas os tags que criamos para esta visualização
      document.head
        .querySelectorAll(`meta[${ATTR}]`)
        .forEach((el) => el.parentElement?.removeChild(el));
    };
  }, [legend]);
}
